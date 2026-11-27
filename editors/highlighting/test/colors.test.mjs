import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHighlighter } from "shiki";
import { parse as parseJsonc } from "jsonc-parser";
import { patternLanguage } from "../examples/markdown.mjs";

const root = new URL("../sublime/PatternLanguage/", import.meta.url);
async function readSublimeJson(filename) {
  const errors = [];
  const value = parseJsonc(
    await readFile(new URL(filename, root), "utf8"),
    errors,
    { allowTrailingComma: true },
  );
  assert.deepEqual(errors, [], filename);
  return value;
}
const schemes = await Promise.all(
  ["Dark", "Light"].map(async (variant) => ({
    variant,
    ...(await readSublimeJson(
      `PatternLanguage ${variant}.sublime-color-scheme`,
    )),
  })),
);

const source = [
  "42 0.1 0f0.1 0x1.4p3 0b1.1p1",
  "UpperCamel Float String Code",
  "if else match end test expect is fails contains todo",
  ":None :UpperCamel :String :if",
  'value = $"$(42) $(UpperCamel) $(:None)"',
  '"42 UpperCamel if :None" # 42 UpperCamel if :None',
  "Some(Int) Outer(Some(String), Pair(Float, NumericValue)) Factory(Int)",
  "Int(String) Float(NumericValue) Type(Bool)",
  "BareType Some Some (Int) Some?(Int) Factory",
  "ABC(Int) A_(String) :Some(Int) :Int(String)",
].join("\n");

function luminance(color) {
  const [r, g, b] = color
    .slice(1)
    .match(/../g)
    .map((channel) => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function hue(color) {
  const [r, g, b] = color
    .slice(1)
    .match(/../g)
    .map((channel) => parseInt(channel, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const difference = max - min;
  if (!difference) return 0;
  const value =
    max === r
      ? (g - b) / difference
      : max === g
        ? (b - r) / difference + 2
        : (r - g) / difference + 4;
  return (value * 60 + 360) % 360;
}

test("syntax-specific selection and every palette rule stay within Pattern Language", async () => {
  const settings = await readSublimeJson("PatternLanguage.sublime-settings");
  assert.equal(
    settings.color_scheme,
    "Packages/PatternLanguage/PatternLanguage Dark.sublime-color-scheme",
  );
  for (const scheme of schemes) {
    assert.deepEqual(Object.keys(scheme).sort(), [
      "globals",
      "name",
      "rules",
      "variant",
    ]);
    for (const rule of scheme.rules) {
      for (const selector of rule.scope.split(","))
        assert.ok(
          selector.trim().startsWith("source.pattern-language "),
          selector,
        );
      assert.match(rule.foreground, /^#[0-9A-F]{6}$/);
    }
  }
});

for (const scheme of schemes) {
  test(`${scheme.variant}: real tokens map to four distinct, readable colors`, async () => {
    // These selectors use only ancestor + scope-prefix matching, shared by the
    // documented Sublime and TextMate formats. Exercise actual theme matching
    // with the checked-in colors, rather than just comparing scope names.
    const theme = {
      name: `pattern-${scheme.variant.toLowerCase()}`,
      colors: {
        "editor.background": scheme.globals.background,
        "editor.foreground": scheme.globals.foreground,
      },
      tokenColors: scheme.rules.map((rule) => ({
        name: rule.name,
        scope: rule.scope,
        settings: { foreground: rule.foreground },
      })),
    };
    const highlighter = await createHighlighter({
      themes: [theme],
      langs: [patternLanguage],
    });
    try {
      const { tokens } = highlighter.codeToTokens(source, {
        lang: "pattern-language",
        theme: theme.name,
      });
      const colorAt = (lineNumber, text, offset = 0) => {
        const found = source.split("\n")[lineNumber].indexOf(text);
        assert.ok(found >= 0, text);
        const column = found + offset;
        const token = tokens[lineNumber].find((item) => {
          const start =
            item.offset -
            source
              .split("\n")
              .slice(0, lineNumber)
              .reduce((length, line) => length + line.length + 1, 0);
          return start <= column && column < start + item.content.length;
        });
        assert.ok(token, text);
        return token.color.toUpperCase();
      };
      const expected =
        scheme.variant === "Dark"
          ? {
              number: "#F4A261",
              type: "#62D6E8",
              keyword: "#C792EA",
              symbol: "#B7D97A",
            }
          : {
              number: "#9C4B00",
              type: "#006B88",
              keyword: "#7A3EAC",
              symbol: "#426F13",
            };
      for (const spelling of ["42", "0.1", "0f0.1", "0x1.4p3", "0b1.1p1"])
        assert.equal(colorAt(0, spelling), expected.number, spelling);
      for (const spelling of ["UpperCamel", "Float", "String", "Code"])
        assert.equal(colorAt(1, spelling), expected.type, spelling);
      for (const spelling of [
        "if",
        "else",
        "match",
        "end",
        "test",
        "expect",
        "is",
        "fails",
        "contains",
        "todo",
      ])
        assert.equal(colorAt(2, spelling), expected.keyword, spelling);
      for (const spelling of [":None", ":UpperCamel", ":String", ":if"])
        assert.equal(colorAt(3, spelling, 1), expected.symbol, spelling);
      assert.equal(
        colorAt(4, "42"),
        expected.number,
        "number inside interpolation",
      );
      assert.equal(
        colorAt(4, "UpperCamel"),
        expected.type,
        "type name inside interpolation",
      );
      assert.equal(
        colorAt(4, ":None", 1),
        expected.symbol,
        "symbol inside interpolation",
      );
      assert.notEqual(
        colorAt(5, "42"),
        expected.number,
        "string text is not recolored as a number",
      );
      for (const spelling of [
        "Some(Int)",
        "Outer",
        "Some(String)",
        "Pair",
        "Factory",
      ])
        assert.equal(
          colorAt(6, spelling),
          expected.symbol,
          `tight call head ${spelling}`,
        );
      for (const spelling of ["Int", "String", "Float", "NumericValue"])
        assert.equal(
          colorAt(6, spelling),
          expected.type,
          `primitive argument ${spelling}`,
        );
      for (const spelling of [
        "Int",
        "String",
        "Float",
        "NumericValue",
        "Type",
        "Bool",
      ])
        assert.equal(
          colorAt(7, spelling),
          expected.type,
          `built-in call head or argument ${spelling}`,
        );
      for (const spelling of [
        "BareType",
        "Some",
        "Some (Int)",
        "Some?(Int)",
        "Factory",
      ])
        assert.equal(
          colorAt(8, spelling),
          expected.type,
          `ordinary UpperCamel ${spelling}`,
        );
      for (const spelling of ["ABC", "A_"])
        assert.equal(
          colorAt(9, spelling),
          expected.symbol,
          `UpperSnake ${spelling}`,
        );
      for (const spelling of [":Some", ":Int"])
        assert.equal(
          colorAt(9, spelling, 1),
          expected.symbol,
          `quoted head ${spelling}`,
        );
      assert.equal(new Set(Object.values(expected)).size, 4);
      for (const color of Object.values(expected)) {
        const [light, dark] = [
          luminance(color),
          luminance(scheme.globals.background),
        ].sort((a, b) => b - a);
        assert.ok((light + 0.05) / (dark + 0.05) >= 4.5, `${color} contrast`);
      }
      for (const [left, right] of [
        [expected.number, expected.type],
        [expected.keyword, expected.symbol],
      ]) {
        const difference = Math.abs(hue(left) - hue(right));
        assert.ok(
          Math.min(difference, 360 - difference) >= 45,
          `${left} and ${right} must remain different hues`,
        );
      }
    } finally {
      highlighter.dispose();
    }
  });
}
