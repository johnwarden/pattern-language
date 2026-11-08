import test from "node:test";
import assert from "node:assert/strict";
import {
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

const isBlockEnd = (error: unknown) =>
  error instanceof LanguageError && error.diagnostic.code === "E_BLOCK_END";

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
