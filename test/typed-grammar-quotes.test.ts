import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Interpreter,
  displayResults,
  parseExpression,
  parseSurface,
  normal,
  encodeSyntax,
  decodeSyntax,
  LanguageError,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));
const expected =
  "def ExpectedOutput type\n  (e :: Expression) ::: (type :: Expression)\nend\n";

test("triple colon quotes the ascription symbol in a structural pattern", () => {
  const expr = parseExpression("left ::: right");
  assert.equal(normal(expr), "left ::: right");
  assert.equal(expr.kind, "apply");
  if (expr.kind !== "apply" || expr.head.kind !== "apply") assert.fail();
  assert.deepEqual(expr.head.head, {
    kind: "symbol",
    name: "::",
    quoted: true,
  });
  assert.notEqual(syntaxKey(expr), syntaxKey(parseExpression("left :: right")));
  assert.equal(syntaxKey(parseExpression(normal(expr))), syntaxKey(expr));
  assert.equal(normal(parseExpression(":::")), ":::");
  assert.equal(
    run("s = :::\n(s == :(::),parse(Symbol)(toString(Symbol)(s)) == s)"),
    "(True, True)",
  );
  assert.equal(
    run(expected + "o = ExpectedOutput` (1 / 0) :: MissingType\n(o.e,o.type)"),
    "(1 / 0, MissingType)",
  );
});
test("ExpectedOutput stores a raw type expression without resolving or materializing it", () => {
  assert.equal(
    run(
      expected + "o = ExpectedOutput` missing(x) :: Unknown(T)\n(o.e,o.type)",
    ),
    "(missing(x), Unknown(T))",
  );
  assert.equal(
    run(
      expected +
        "o = ExpectedOutput` 3 :: Int\n((e :: Expression) ::: (t :: Expression)) = o\n(e,t)",
    ),
    "(3, Int)",
  );
});
test("typed quotes retain their own AST node across source and transport round trips", () => {
  for (const source of ["MathExp` sum(foo,bar)", "Code` Code$` $x"]) {
    const tree = parseExpression(source);
    assert.equal(tree.kind, "typedQuote");
    assert.equal(syntaxKey(parseExpression(normal(tree))), syntaxKey(tree));
    assert.equal(syntaxKey(decodeSyntax(encodeSyntax(tree))), syntaxKey(tree));
  }
});
test("a DSL typed quote returns the same interpreted value as explicit ascription", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(
      i.run(
        "def MathExp type Symbol | Float | :sum(a :: MathExp,b :: MathExp) | :product(a :: MathExp,b :: MathExp)\na = MathExp` sum(foo,bar)\nb = :sum(:foo,:bar) :: MathExp\n(a,a == b)",
      ),
    ),
    "(sum(foo, bar) :: MathExp, True :: Bool)",
  );
});
test("recursive symbolic operators in application heads are structural, not type modifiers", () => {
  assert.equal(
    run(
      "def MathExp type Symbol | Float | ((a :: MathExp) :+ (b :: MathExp)) | ((a :: MathExp) :* (b :: MathExp))\na = MathExp` (1 + foo) * 3\nb = ((1 :+ :foo) :* 3) :: MathExp\na == b",
    ),
    "True",
  );
});
test("ordinary sidefix types quote and destructure without installing a Code keyword", () => {
  const decl =
    "def Entry type :test name :: String :expect value :: Expression\n";
  assert.equal(
    run(
      decl +
        'v = Entry` test "one" expect missing(x)\n(:test name :: String :expect value :: Expression) = v\n(name,value)',
    ),
    '("one", missing(x))',
  );
  assert.throws(
    () => run(decl + 'test "one" expect 3'),
    /grammar|syntax|macro/,
  );
  assert.equal(
    run(
      decl +
        'macro :test x :: Expression Code$` $(x)\nv = Entry` test "one" expect 3\ntest 42',
    ),
    "42",
  );
});
test("a Test-shaped DSL retains nested code as raw Expression during migration", () => {
  const source =
    expected +
    'def Test type :test name :: String code :: Expression :expect expected :: ExpectedOutput\nt = Test`\n  test "inert"\n    missing(1 / 0)\n  end\n  expect 3 :: MissingType\nend\n(t.name,t.expected.e,t.expected.type)';
  assert.equal(run(source), '("inert", 3, MissingType)');
});
test("sidefix and deferred-expectation type/value text round trip without evaluation", () => {
  assert.equal(
    run(
      expected +
        'def Entry type :test name :: String :expect value :: ExpectedOutput\nv = Entry`\n  test "round trip"\n  expect\n    (1 + 2) :: MissingType\n  end\nend\nt = parse(Type)(toString(Type)(Entry))\nw = parse(t)(toString(Entry)(v))\nv == w',
    ),
    "True",
  );
});
test("typed quote interpolation is explicit evaluation and grammar matching rejects bad trees", () => {
  assert.equal(
    run(expected + "x = 3\no = ExpectedOutput$` $x :: MissingType\no.e"),
    "3",
  );
  assert.throws(() => run(expected + "ExpectedOutput` 3"), /expected|match/);
  assert.throws(
    () => run("Unknown` value"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_UNBOUND_NAME",
  );
  assert.throws(() => run("t = 3\nt` value"), /expected a type/);
});
test("type pattern bodies remain opaque while nested type forms remain valid", () => {
  assert.equal(
    run("def O type O(type :: Expression)\nv = O(:x) :: O\nv.type"),
    "x",
  );
  assert.equal(run("type type Int"), "Int");
  const grammar = readFileSync(
    new URL("../default.pattern", import.meta.url),
    "utf8",
  );
  const i = new Interpreter(grammar);
  assert.equal(
    displayResults(
      i.run(expected + "o = ExpectedOutput` 3 :: UnknownType\no.type"),
    ),
    "UnknownType",
  );

  assert.equal(parseSurface("T` value").kind, "block");
});
