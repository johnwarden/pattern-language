import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseSurface,
  Grammar,
} from "../src/index.ts";

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
