import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Grammar } from "../src/grammar.ts";
import { Interpreter } from "../src/runtime.ts";
import { LanguageError, normal } from "../src/syntax.ts";

test("shared starting keywords recognize disjoint complete grammar alternatives", () => {
  const grammar = new Grammar(
    "def Numeric type :item value :: Int\ndef Textual type :item value :: String",
  );
  for (const [source, name] of [
    ["item 3", "Numeric"],
    ['item "hello"', "Textual"],
  ]) {
    const tree = grammar.parse(source);
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") return;
    assert.equal(tree.lines[0].kind, "form");
    if (tree.lines[0].kind === "form") assert.equal(tree.lines[0].name, name);
  }
});

test("ambiguous complete grammar alternatives reject instead of choosing declaration order", () => {
  const grammar = new Grammar(
    "def First type :item value :: Int\ndef Second type :item value :: Int",
  );
  assert.throws(
    () => grammar.parse("item 3"),
    (error: unknown) =>
      fails instanceof LanguageError && /ambiguous form/.test(error.message),
  );
});

test("grammar cloning and description transport retain shared-keyword alternatives", () => {
  const original = new Grammar(
    "def Numeric type :item value :: Int\ndef Textual type :item value :: String",
  );
  const restored = Grammar.fromDescription(original.description(), () => {});
  for (const grammar of [original.clone(), restored])
    for (const source of ["item 3", 'item "hello"'])
      assert.deepEqual(grammar.parse(source), original.parse(source));
});

test("type declarations share Definition elaboration while retaining source spelling", () => {
  const grammar = new Grammar();
  for (const kind of ["concrete", "abstract"]) {
    const source =
      kind === "concrete"
        ? "type Rectangle concrete Rect(w :: Rational, h :: Rational)\nRectangle"
        : "type Either abstract Float32 | Float64\nEither";
    const tree = grammar.parse(source, "program", "declarations.pattern");
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") return;
    const declaration = tree.lines[0];
    assert.equal(declaration.kind, "form");
    if (declaration.kind !== "form") return;
    assert.equal(declaration.name, "Definition");
    assert.equal(
      declaration.captures.get("signature")?.fields[0].value.kind,
      "symbol",
    );
    const body = declaration.captures.get("body")?.fields[0].value;
    assert.equal(body?.kind, "form");
    if (body?.kind === "form")
      assert.equal(
        body.name,
        kind === "concrete" ? "TypeExpression" : "UnionTypeExpression",
      );
    assert.equal(normal(declaration), source.split("\n")[0]);
    assert.equal(declaration.span?.source?.name, "declarations.pattern");
  }
});

test("named type declarations retain the required final-result rule", () => {
  for (const source of [
    "type Rectangle concrete Rect(Rational, Rational)",
    "type Either abstract Float32 | Float64",
  ]) {
    assert.throws(
      () => new Interpreter().run(source),
      (error: unknown) =>
        fails instanceof LanguageError &&
        error.diagnostic.code === "E_SYNTAX" &&
        /result pack/.test(error.message),
    );
  }
});

test("indented concrete declarations require and preserve their aligned end", () => {
  const source =
    "type Rectangle concrete\n  Rect(w :: Rational, h :: Rational)\nend\nRectangle";
  const interpreter = new Interpreter();
  const expected = interpreter.inspect(interpreter.run(source));
  assert.equal(
    expected,
    new Interpreter().inspect(
      new Interpreter().run(
        "def Rectangle type Rect(w :: Rational, h :: Rational)\nRectangle",
      ),
    ),
  );
  const tree = interpreter.parse(source);
  assert.equal(tree.kind, "block");
  if (tree.kind === "block") {
    const canonical = tree.lines.map(normal).join("\n");
    const restored = new Interpreter();
    assert.equal(
      restored.inspect(restored.run(canonical)),
      expected,
    );
  }
  assert.throws(
    () =>
      new Interpreter().run(
        "type Rectangle concrete\n  Rect(w :: Rational, h :: Rational)\nRectangle",
      ),
    (error: unknown) =>
      fails instanceof LanguageError && error.diagnostic.code === "E_BLOCK_END",
  );
});

test("unimplemented declaration signatures are rejected rather than becoming functions", () => {
  assert.throws(
    () =>
      new Interpreter().run(
        "type rectangle concrete Rect(Rational, Rational)\nrectangle",
      ),
    /type declaration requires a bare UpperCamel name/,
  );
  assert.throws(
    () => new Interpreter().run("type Box(T) concrete Box(T)\nBox"),
    /type declaration requires a bare UpperCamel name/,
  );
});

test("reading Code with the new declarations remains inert", () => {
  const interpreter = new Interpreter();
  interpreter.run(
    'stored = parse(Code)("type Untouched concrete :Tag\\nUntouched")\nstored',
  );
  assert.throws(
    () => interpreter.run("Untouched"),
    (error: unknown) =>
      fails instanceof LanguageError &&
      error.diagnostic.code === "E_UNBOUND_NAME",
  );
});

test("the published default grammar supports the same declaration forms", () => {
  const grammar = readFileSync(
    new URL("../default.pattern", import.meta.url),
    "utf8",
  );
  const interpreter = new Interpreter(grammar);
  assert.equal(
    interpreter.inspect(
      interpreter.run(
        "type Rectangle concrete Rect(w :: Rational, h :: Rational)\nRectangle == (concrete Rect(Rational, Rational))",
      ),
    ),
    "True :: Bool",
  );
});
