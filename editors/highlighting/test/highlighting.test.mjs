import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import textmate from "vscode-textmate";
import oniguruma from "vscode-oniguruma";
import { parseDocument } from "yaml";
import { generatedFiles, lexical, sublimeGrammar, textmateGrammar } from "../generate.mjs";
import { identifierName, upperSnakeName, punctuation } from "../../../src/lexical.ts";
import { parseNumericSpelling } from "../../../src/rational.ts";
import { createPatternFenceHighlighter } from "../examples/markdown.mjs";

const root = new URL("../", import.meta.url);
const cases = JSON.parse(await readFile(new URL("test/cases.json", root), "utf8"));
await oniguruma.loadWASM(await readFile(new URL("node_modules/vscode-oniguruma/release/onig.wasm", root)));
const onigLib = {
  createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
  createOnigString: (source) => new oniguruma.OnigString(source),
};
const registry = new textmate.Registry({ onigLib: Promise.resolve(onigLib), loadGrammar: async () => textmateGrammar() });
const grammar = await registry.loadGrammar(lexical.scope);
const selected = (scopes, selector) => scopes.some((scope) => scope === selector || scope.startsWith(selector + "."));

for (const fixture of cases) {
  test(`TextMate: ${fixture.name}`, () => {
    let state = textmate.INITIAL;
    const lines = fixture.source.split("\n");
    const tokenized = lines.map((line) => {
      const result = grammar.tokenizeLine(line, state);
      assert.equal(result.stoppedEarly, false);
      state = result.ruleStack;
      return result.tokens;
    });
    for (const check of fixture.checks) {
      const line = lines[check.line];
      assert.notEqual(line, undefined, `missing fixture line ${check.line}`);
      const found = line.indexOf(check.text, check.from ?? 0);
      assert.notEqual(found, -1, `missing fixture text ${check.text}`);
      const start = found + (check.offset ?? 0);
      const end = start + (check.length ?? check.text.length - (check.offset ?? 0));
      for (let column = start; column < end; column++) {
        const token = tokenized[check.line].find((item) => item.startIndex <= column && column < item.endIndex);
        assert.ok(token, `missing token at ${check.line + 1}:${column + 1}`);
        const message = `${fixture.name}, ${check.line + 1}:${column + 1}, ${JSON.stringify(line.slice(start, end))}: ${token.scopes.join(" ")}`;
        if (check.scope) assert.ok(selected(token.scopes, check.scope), message + ` expected ${check.scope}`);
        for (const excluded of check.not ?? []) assert.equal(selected(token.scopes, excluded), false, message + ` excludes ${excluded}`);
      }
    }
  });
}

test("shared lexical spellings agree with the actual language helpers", () => {
  const name = new RegExp(`^(?:${lexical.patterns.identifier}|${lexical.patterns.wildcard}|\\[\\]|\\{\\})$`, "u");
  const upperSnake = new RegExp(`^${lexical.patterns.upperSnake}$`, "u");
  for (const spelling of ["foo", "UpperCamel", "ABC", "ABC1", "A_", "AB_", "A_B", "A1_B2", "_", "_12", "[]", "{}", "lower_snake", "ABC_bad", "A1_", "AB1", "αname", "fooé", "3bad", ""]) {
    assert.equal(name.test(spelling), identifierName(spelling), `identifier ${spelling}`);
    assert.equal(upperSnake.test(spelling), upperSnakeName(spelling), `UpperSnake ${spelling}`);
  }
  const numeric = new RegExp(`^(?:0[fF]${lexical.patterns.decimal}|${lexical.patterns.hex}|${lexical.patterns.binary}|${lexical.patterns.decimal})$`);
  for (const spelling of ["0", "1_024", "0.1", "12e-3", "0f0.1", "0F1_000e-2", "0x1.4p3", "0X1_F.8P-2", "0b1.01p+2", "0B10_01", "0x1p-1074", "0xFFjunk", "0b102", "0fInfinity", "1//3", ".1", "1.", "1__2", "0f0x1", "0x.1", "0b1p", "-2"]) {
    assert.equal(numeric.test(spelling), parseNumericSpelling(spelling) !== undefined, `numeric spelling ${spelling}`);
  }
  const operator = new RegExp(`^${lexical.patterns.operators}$`, "u");
  for (const character of punctuation) {
    if (character !== "…") assert.ok(operator.test(character), `missing operator ${character}`);
  }
  assert.equal(operator.test("#"), false);
  assert.deepEqual("~!@$%^&*?".split("").filter((character) => new RegExp(lexical.patterns.postfixCharacters).test(character)), "~!@$%^&*?".split(""));
  assert.equal(new RegExp(lexical.patterns.postfixCharacters).test("#"), false);
});

test("generated Sublime YAML loads, every context exists, and Oniguruma compiles every pattern", async () => {
  const files = await generatedFiles();
  const document = parseDocument(files.get("sublime/PatternLanguage/PatternLanguage.sublime-syntax"), { strict: true, uniqueKeys: true });
  assert.deepEqual(document.errors, []);
  const syntax = document.toJS();
  assert.deepEqual(syntax, sublimeGrammar());
  assert.equal(syntax.version, 2);
  assert.deepEqual(syntax.file_extensions, ["pattern", "test"]);
  const references = [];
  for (const [context, rules] of Object.entries(syntax.contexts)) {
    for (const rule of rules) {
      for (const key of ["include", "push", "set"]) {
        if (rule[key]) references.push(...(Array.isArray(rule[key]) ? rule[key] : [rule[key]]));
      }
      if (rule.match) {
        // Sublime substitutes captures from the entry match for dynamic heredoc
        // ends. Compile that substituted expression, not a free backreference.
        const regex = rule.match.replaceAll("\\1", "  ");
        const scanner = new oniguruma.OnigScanner([regex]);
        scanner.dispose();
      }
      assert.equal("branch" in rule || "embed" in rule || "clear_scopes" in rule, false, `unexpected complex feature in ${context}`);
    }
  }
  for (const reference of references) assert.ok(reference in syntax.contexts, `missing context ${reference}`);
});

test("native block entry rules capture exact indentation without confusing reader payloads", () => {
  const syntax = sublimeGrammar();
  const patterns = syntax.contexts.blocks.map((rule) => rule.match);
  const scanner = new oniguruma.OnigScanner(patterns);
  for (const [source, kind, indent] of [
    ['  value = "\n', "double", "  "],
    ['\tvalue = $"\n', "double-interpolated", "\t"],
    ["  html'\n", "single", "  "],
    ["  html$'\n", "single-interpolated", "  "],
    ["  code = Code`\n", "typed", "  "],
    ["  code = Code$`\n", "typed-interpolated", "  "],
  ]) {
    const result = scanner.findNextMatchSync(source, 0);
    assert.ok(result, source);
    assert.equal(syntax.contexts.blocks[result.index].push[0], `block-${kind}`);
    const capture = result.captureIndices[1];
    assert.equal(source.slice(capture.start, capture.end), indent);
  }
  for (const source of ['x # a comment "\n', 'html\' payload "\n', "html' payload '\n", 'x = "inline"\n']) assert.equal(scanner.findNextMatchSync(source, 0), null, source);
  scanner.dispose();
  // An entire tight reader opener must win before the inline raw-reader rule.
  for (const id of ["single", "single-interpolated", "double", "double-interpolated"]) {
    const rule = syntax.contexts[`open-${id}`][0];
    assert.equal(rule.pop, true);
    assert.ok(rule.captures[1].startsWith("entity.name.function.reader"));
  }
});

test("checked-in grammars and native assertions are reproducible", async () => {
  for (const [path, content] of await generatedFiles()) assert.equal(await readFile(new URL(path, root), "utf8"), content, `${path} requires regeneration`);
});

test("Markdown fence callback renders the TextMate grammar and escapes source", async () => {
  const renderer = await createPatternFenceHighlighter();
  try {
    const html = renderer.highlight('expect "<script>alert(1)</script>" is :None :: Float?', "pattern");
    assert.ok(html.startsWith('<pre class="shiki'));
    assert.ok(html.includes("<span"));
    assert.match(html, /(?:&lt;|&#x0*3c;|&#0*60;)script/iu);
    assert.equal(html.includes("<script>"), false);
    assert.equal(renderer.highlight("x = 1", "pattern-language"), renderer.highlight("x = 1", "pattern"));
    assert.equal(renderer.highlight("x = 1", "javascript"), "");
  } finally {
    renderer.dispose();
  }
});
