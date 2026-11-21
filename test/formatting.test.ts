import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  normal,
  parseExpression,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

test("binary punctuation has one infix normal form and preserves syntax trees", () => {
  const cases = [
    ["->(n)(<(n)(5))", "n -> n < 5"],
    ["*(+(a)(b))(c)", "(a + b) * c"],
    ["+(a)(*(b)(c))", "a + (b * c)"],
    ["<=(a)(b)", "a <= b"],
    ["=>(A)(B)", "A => B"],
    ["::(a)(T)", "a :: T"],
    ["+(a, b)(c, d)", "(a, b) + (c, d)"],
    ["+(a, z: 3, b: 2)(y: 4)", "(a, b: 2, z: 3) + (y: 4)"],
    ["->(x)()", "x -> ()"],
    ["+()(x)", "() + x"],
    ["+()()", "() + ()"],
    ["+(a)", "+(a)"],
    ["+(a, b)", "+(a, b)"],
    ["+(*)(b)", "(*) + b"],
    ["+(a)(b)(c)", "(a + b)(c)"],
    ["(a + b)(T)", "(a + b)(T)"],
    ["f(a + b, c)", "f(a + b, c)"],
    ["a :+ b", "a :+ b"],
    [":(a + b)", ":(a + b)"],
    ["[a + b, {c * d}]", "[a + b, {c * d}]"],
    ["a .plus b", "plus(a)(b)"],
    ["::(+(a)(+(b)(c)))(Type)", "(a + b + c) :: Type"],
    ["::(+(+(a)(b))(c))(Type)", "((a + b) + c) :: Type"],
    ["::(f(a + b)(c * d))(Type)", "f(a + b)(c * d) :: Type"],
    ["+(a)(+(b)(c))", "a + b + c"],
    ["+(+(a)(b))(c)", "(a + b) + c"],
  ];
  for (const [source, expected] of cases) {
    const tree = parseExpression(source);
    const text = normal(tree);
    assert.equal(text, expected, source);
    const reparsed = parseExpression(text);
    assert.equal(syntaxKey(reparsed), syntaxKey(tree), source);
    assert.equal(normal(reparsed), text, source);
  }
});

test("quoted expression values use the same punctuation notation and round trip as data", () => {
  for (const [source, expected] of [
    ["n -> n < 5", "n -> n < 5"],
    ["(a + b) * c", "(a + b) * c"],
    ["a + (b * c)", "a + (b * c)"],
    ["(a, b) + (c, d)", "(a, b) + (c, d)"],
    ["(a, z: 3, b: 2) + (y: 4)", "(a, b: 2, z: 3) + (y: 4)"],
    ["x -> ()", "x -> ()"],
    ["() + ()", "() + ()"],
    ["+(a)", "+(a)"],
    ["+(a, b)", "+(a, b)"],
    ["(*) + b", "(*) + b"],
    ["(a + b)(c)", "(a + b)(c)"],
    ["[a + b, {c * d}]", "[a + b, {c * d}]"],
  ]) {
    const displayed = run(":(" + source + ")");
    assert.equal(displayed, expected, source);
    assert.equal(
      run(":(" + source + ") == :(" + displayed + ")"),
      "True",
      source,
    );
  }
});

test("refinement arrows and their comparison bodies share infix formatting", () => {
  assert.equal(
    run("(type Int) .where (n -> n < 5)"),
    "Int .where (n -> n < 5)",
  );
  assert.equal(
    run("(type Int) .where (n -> (n + 1) < 5)"),
    "Int .where (n -> (n + 1) < 5)",
  );
});

test("canonical commas have one following space without changing string contents", () => {
  assert.equal(
    normal(parseExpression("Rectangle(2, 3, color: :Black)")),
    "Rectangle(2, 3, color: :Black)",
  );
  assert.equal(
    run("Rectangle(2, 3, color: :Black)"),
    "Rectangle(2, 3, color: Black)",
  );
  assert.equal(
    normal(parseExpression("[1, {x: 2, y: 3}]")),
    "[1, {x: 2, y: 3}]",
  );
  assert.equal(run('"left,right"'), '"left,right"');
  assert.equal(normal(parseExpression('"left,right"')), '"left,right"');
});
