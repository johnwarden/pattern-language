import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseSurface,
  Grammar,
  TEST_SCHEMA,
  loadTests,
  runTest,
} from "../src/index.ts";
import {
  layoutFormsFromBlock,
  mergeLayoutForms,
  parseTestSource,
} from "../src/parser.ts";
import { normal } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const parse = (source: string) => new Interpreter().parse(source);
const isBlockEnd = (error: unknown) =>
  error instanceof LanguageError && error.diagnostic.code === "E_BLOCK_END";

test("an indented function cannot terminate at EOF", () => {
  assert.throws(() => parse("def f(x)\n  x"), isBlockEnd);
});

test("a nested block needs its own aligned end", () => {
  assert.throws(
    () =>
      parse(`main = x ->
  f = y ->
    y
  x
end
main`),
    isBlockEnd,
  );
  assert.throws(
    () =>
      parse(`main = x ->
  f = y ->
    y
    x
end
main`),
    isBlockEnd,
  );
});

test("if/else remains one form closed by a single aligned end", () => {
  assert.equal(
    run(`if 1 < 2
  x = 1
  x + 1
else
  3
end`),
    "2",
  );
});

test("a final end can close a string and its surrounding if", () => {
  assert.equal(
    run(`s = if True '
  Hello, World!
else '
  What is cooking?
end
s`),
    displayResults(new Interpreter().run('"Hello, World!"')),
  );
});

test("a shared string stops at a custom grammar clause and may share end", () => {
  const otherwise = new Grammar(
    "def IfExpression type :if (condition :: Expression) (consequent :: Body) :otherwise (alternative :: Body)",
  ).layoutForms();
  const tree = parseSurface(
    `s = if True '
  Hello
otherwise '
  World
end
s`,
    "program",
    { layoutForms: otherwise },
  );
  assert.match(normal(tree), /"Hello"/);
  assert.match(normal(tree), /otherwise "World"/);
  assert.throws(
    () =>
      parseSurface(
        `s = if True '
  Hello
else '
  World
end
s`,
        "program",
        { layoutForms: otherwise },
      ),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_QUOTE_INDENT",
  );
});

test("a nested function with its own aligned end runs", () => {
  assert.equal(
    run(`main = x ->
  f = y ->
    y
  end
  f(x)
end
main(3)`),
    "3",
  );
});

test("parentheses are not an implicit-dedent escape for a layout block", () => {
  assert.throws(
    () =>
      parse(`main = x ->
  f = y ->
    y
  (x)
end
main`),
    isBlockEnd,
  );
  assert.equal(
    run(`f = (
  1
)
f`),
    "1",
  );
});

test("a match block requires an aligned end", () => {
  assert.throws(
    () =>
      parse(`match 1
  1 -> 2
  _ -> 0
`),
    isBlockEnd,
  );
  assert.equal(
    run(`match 1
  1 -> 2
  _ -> 0
end`),
    "2",
  );
});

test("a closed expectation under Test layout forms is valid", () => {
  const testLayoutForms = mergeLayoutForms(
    new Grammar().layoutForms(),
    layoutFormsFromBlock(parseSurface(TEST_SCHEMA, "test schema")),
  );
  parseTestSource(
    `test "closed"
  expect
    4
  result
    4 :: Expression
  end
end`,
    "closed.test",
    { layoutForms: testLayoutForms },
  );
  assert.throws(
    () =>
      parseTestSource(
        `test "open"
  expect
    4
  result
    4 :: Expression
end`,
        "open.test",
        { layoutForms: testLayoutForms },
      ),
    isBlockEnd,
  );
  const [closed] = loadTests({
    "closed.test": `test "closed"
  expect
    4
  result
    4 :: Expression
  end
end`,
  });
  const report = runTest(closed);
  assert.equal(report.passed, true, report.message);
});

test("clause keywords come from the active grammar, not a hardcoded else list", () => {
  const otherwise = new Grammar(
    "def IfExpression type :if (condition :: Expression) (consequent :: Body) :otherwise (alternative :: Body)",
  ).layoutForms();
  parseSurface(
    `if True
  1
otherwise
  2
end`,
    "program",
    { layoutForms: otherwise },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
else
  2
end`,
        "program",
        { layoutForms: otherwise },
      ),
    isBlockEnd,
  );
  parseSurface(
    `if True
  1
else
  2
end`,
    "program",
    { layoutForms: new Grammar().layoutForms() },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
otherwise
  2
end`,
        "program",
        { layoutForms: new Grammar().layoutForms() },
      ),
    isBlockEnd,
  );
});
