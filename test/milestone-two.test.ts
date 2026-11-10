import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Interpreter,
  Grammar,
  displayResults,
  LANGUAGE_SCHEMA,
  encodeSyntax,
  decodeSyntax,
  parseSurface,
  parseExpression,
  normal,
  LanguageError,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";
import {
  field,
  items,
  list,
  record,
  node,
} from "../src/language-description.ts";
import { valLiteral, valSymbol } from "../src/values.ts";
import type { Value } from "../src/values.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));
const validate = (v: Value) => {
  const i = new Interpreter();
  i.env.bindings.set("description", v);
  if (displayResults(i.run("description .matches languageSchema()")) !== "True")
    throw new LanguageError("invalid language-description shape");
};
test("recursive Language schema is executable and generated documentation is current", () => {
  assert.equal(
    readFileSync(
      new URL("../examples/language-description.pattern", import.meta.url),
      "utf8",
    ),
    LANGUAGE_SCHEMA,
  );
});
test("AST transport distinguishes source quotation from similarly named applications", () => {
  for (const source of [
    ":f(1)",
    "Quote(f(1))",
    "(1,color: :Red)",
    "f()(3)",
    "if True\n  1\nelse\n  2\nend",
    "1*",
    "Int?",
  ]) {
    const tree = parseSurface(source, "program", {
      layoutForms: new Grammar().layoutForms(),
    });
    assert.equal(syntaxKey(decodeSyntax(encodeSyntax(tree))), syntaxKey(tree));
  }
  assert.notDeepEqual(
    encodeSyntax(parseSurface(":x")),
    encodeSyntax(parseSurface("Quote(x)")),
  );
});
test("default and edited grammars round trip through ordinary language-description values", () => {
  for (const grammar of [
    new Grammar(),
    new Grammar(
      "def Choice type :choose a :: Expression :otherwise b :: Expression",
    ),
  ]) {
    const restored = Grammar.fromDescription(grammar.description(), validate);
    const source = grammar.keywords.has("choose")
      ? "choose 1 otherwise 2"
      : "if True 1 else 2";
    assert.equal(
      syntaxKey(restored.parse(source)),
      syntaxKey(grammar.parse(source)),
    );
  }
});
test("source parseSyntax uses the transported grammar without evaluating source", () => {
  const i = new Interpreter();
  const result = i.run('parseSyntax(language())("missing(1 / 0)")');
  assert.match(displayResults(result), /Apply/);
  assert.throws(() => i.run("missing"), /unbound/);
});
test("scoped sidefix and structural rules are reflected without transporting macro implementations", () => {
  const i = new Interpreter();
  i.run("def Box type Box(value :: Int)\nmacro :answer Args(x) Code$` $(x)\n0");
  const restored = Grammar.fromDescription(i.grammar.description(), validate);
  assert.equal(normal(restored.parseAs("Box(3)", "Box")), "Box(3)");
  assert.equal(restored.parse("answer Args(3)").kind, "block");
  const fresh = new Interpreter();
  fresh.grammar = restored;
  assert.throws(
    () => fresh.run("answer Args(3)"),
    /sidefix macro is not available: answer/,
  );
});
test("language descriptions reject changed host policies, duplicate rules and invalid AST variants", () => {
  const original = new Grammar().description();
  const values = Object.fromEntries(
    (original as Extract<Value, { kind: "term" }>).body.map((f) => [
      f.label,
      f.value,
    ]),
  );
  assert.throws(
    () =>
      Grammar.fromDescription(
        record("Language", { ...values, start: valSymbol("Elsewhere") }),
        validate,
      ),
    /unsupported/,
  );
  const rules = items(field(original, "rules"));
  assert.throws(
    () =>
      Grammar.fromDescription(
        record("Language", { ...values, rules: list([rules[0], rules[0]]) }),
        validate,
      ),
    /duplicate/,
  );
  const badRule = record("Rule", {
    name: valLiteral("Bad"),
    kind: valSymbol("Form"),
    pattern: list([node("UnknownAst")]),
  });
  assert.throws(
    () =>
      Grammar.fromDescription(
        record("Language", { ...values, rules: list([badRule]) }),
        validate,
      ),
    /invalid language-description/,
  );
});
test("AST codec has an explicit recursion budget", () => {
  let ast: ReturnType<typeof parseSurface> = {
    kind: "symbol",
    name: "x",
    quoted: false,
  };
  for (let n = 0; n < 300; n++) ast = { kind: "quote", value: ast };
  assert.throws(() => encodeSyntax(ast), /codec budget/);
});

test("grammar parseAs agrees with open-label, default and rest binding patterns", () => {
  for (const [spec, value] of [
    [
      "Box(n :: Int,color: c :: String,**)",
      'Box(3,extra: 7,color: "red")',
    ],
    ['Box(n :: Int,color: c :: String = "red")', "Box(3)"],
    [
      "Box(n :: Int,rest... :: Int*,color: c :: String,**)",
      'Box(1,2,3,color: "red",extra: 9)',
    ],
  ] as const) {
    assert.equal(
      normal(new Grammar("def B type " + spec).parseAs(value, "B")),
      normal(parseExpression(value)),
    );
  }
});
test("grammar parseAs rejects missing labels, extra fields and ambiguous constructors", () => {
  for (const [spec, value] of [
    ["Box(n :: Int,color: c :: String,**)", "Box(3,extra: 7)"],
    ["Box(n :: Int)", "Box(3,extra: 7)"],
    ["(Box(n :: Int) | Box(n :: Float))", "Box(3)"],
  ]) {
    assert.throws(() => new Grammar("def B type " + spec).parseAs(value, "B"));
  }
});

test("duplicate capture diagnostics agree across every applicable pattern context", () => {
  const spec = "Box(n :: Int,n :: Int)",
    value = "Box(1,2)";
  const contexts = [
    spec + " = " + value + "\nn",
    "def f(" + spec + ")\n  n\nend\nf(" + value + ")",
    "match " + value + "\n  " + spec + " -> n\nend",
    "macro :take Args(" + spec + ") Code$` $n\n(take Args(" + value + "))",
    "def B type " + spec + "\n0",
  ];
  for (const source of contexts)
    assert.throws(
      () => run(source),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_DUPLICATE_CAPTURE",
    );
  assert.throws(
    () => new Grammar("def B type " + spec),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_DUPLICATE_CAPTURE",
  );
});
test("schema recognition rejects malformed constructor arities before interpretation", () => {
  for (const source of [
    "Type(:(Type()))",
    "Type(:(Literal()))",
    "Type(:(Apply(:A)))",
    "Type(:(Recur()))",
    "Type(:(OpenFields(labels: True,positional: False)))",
  ])
    assert.throws(
      () => run(source),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_TYPE_DESCRIPTION",
    );
});
