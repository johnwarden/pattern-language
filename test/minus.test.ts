import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  LanguageError,
} from "../src/index.ts";
import { single } from "../src/values.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const evaluate = (source: string) => {
  const interpreter = new Interpreter();
  return displayResults(
    interpreter.evaluateCode(single(interpreter.run(source))),
  );
};

test("prefix minus negates; infix minus subtracts", () => {
  assert.equal(normal(parseExpression("-1")), "-(1)");
  assert.equal(normal(parseExpression("-(x)")), "-(x)");
  assert.equal(normal(parseExpression("1 - x")), "1 - x");
  assert.equal(normal(parseExpression("1 - -x")), "1 - -(x)");
  assert.equal(run("-1"), "-1");
  assert.equal(run("-(1)"), "-1");
  assert.equal(run("x = 3\n-x"), "-3");
  assert.equal(run("x = 3\n-(x)"), "-3");
  assert.equal(run("x = 3\n1 - x"), "-2");
  assert.equal(run("x = 3\n1 - -x"), "4");
  assert.equal(run("1 - -2"), "3");
});

test("quoted Code of prefix and infix minus evaluates the same trees", () => {
  assert.equal(evaluate("Code` -1"), "-1");
  assert.equal(evaluate("x = 3\nCode` -(x)"), "-3");
  assert.equal(evaluate("x = 3\nCode` 1 - x"), "-2");
  assert.equal(evaluate("x = 3\nCode` 1 - -x"), "4");
  assert.equal(evaluate("Code$` 1 - 2"), "-1");
  assert.equal(evaluate("x = 3\nCode$` 1 - $x"), "-2");
  assert.equal(
    run("c = Code` -1\nparse(Code)(toString(Code)(c)) == c"),
    "True",
  );
  assert.equal(
    run("c = Code` 1 - -x\nparse(Code)(toString(Code)(c)) == c"),
    "True",
  );
});

test("infix minus validates the first pack before evaluating its right operand", () => {
  assert.throws(
    () => run("Int - missing()"),
    (error: unknown) =>
      error instanceof LanguageError && error.diagnostic.code === "E_NO_METHOD",
  );
  assert.throws(
    () => evaluate("Code` Int - missing()"),
    (error: unknown) =>
      error instanceof LanguageError && error.diagnostic.code === "E_NO_METHOD",
  );
});
