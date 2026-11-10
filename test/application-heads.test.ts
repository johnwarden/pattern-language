import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { single, unwrap } from "../src/values.ts";

test("stored Code with a non-callable head fails during evaluation, not reading", () => {
  const interpreter = new Interpreter();
  interpreter.run("def Tagged type :Tag(Rational)", "repl");
  interpreter.run("head = True", "repl");
  interpreter.run("def truth() 1 == 1", "repl");
  interpreter.run("value = Tag(1) :: Tagged", "repl");
  interpreter.run("def data() Tag(1) :: Tagged", "repl");
  const codeType = unwrap(single(interpreter.run("Code")));
  if (codeType.kind !== "type") assert.fail("Code must be a grammar type");

  for (const source of [
    "1(1)",
    '"x"(1)',
    "(1 + 1)(1)",
    "True(1)",
    "False(1)",
    "head(1)",
    "truth()(1)",
    "value(2)",
    "data()(2)",
  ]) {
    const code = interpreter.readValue(codeType, source);
    assert.throws(
      () => interpreter.evaluateCode(code),
      (error: unknown) =>
        error instanceof LanguageError &&
        error.diagnostic.code === "E_NOT_CALLABLE" &&
        error.diagnostic.phase === "evaluate",
      source,
    );
  }
});

test("stored Code may evaluate its head to a returned closure", () => {
  const interpreter = new Interpreter();
  interpreter.run("def make()\n  n -> n\nend", "repl");
  const codeType = unwrap(single(interpreter.run("Code")));
  if (codeType.kind !== "type") assert.fail("Code must be a grammar type");
  const code = interpreter.readValue(codeType, "make()(7)");
  assert.equal(displayResults(interpreter.evaluateCode(code)), "7");
});
