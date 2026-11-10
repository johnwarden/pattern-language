import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter } from "../src/runtime.ts";
import { LanguageError } from "../src/syntax.ts";
import { loadTests, runTest } from "../src/test-suite.ts";

const run = (body: string) =>
  runTest(
    loadTests({ "unprintable.test": `test "Values"\n  ${body}\nend` })[0],
  );

const originalInspect = Interpreter.prototype.inspect;
/** Keep Bool assertion results printable; throw only when formatting operands. */
function withOperandInspect(error: unknown, body: () => void) {
  let threw = false;
  Interpreter.prototype.inspect = function (values) {
    const text = originalInspect.call(this, values);
    if (/:: Bool\b/.test(text)) return text;
    threw = true;
    throw error;
  };
  try {
    body();
    assert.ok(threw);
  } finally {
    Interpreter.prototype.inspect = originalInspect;
  }
}

test("passing direct predicates with unprintable values leave following checks intact", () => {
  const report = run(
    "assert (x -> x) .matches Any\n  assert (x -> x) .matches Expression\n  assert not((x -> x) .matches String)\n  assert True",
  );
  assert.equal(report.status, "passed", report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["passed", "passed", "passed", "passed"],
  );
  assert.ok(report.checks.every((c) => c.operands === undefined));
});

test("a macro-produced operand keeps the ordinary evaluation result", () => {
  const report = run(
    "macro :identity Args() Code` x -> x\n  assert (identity Args()) .matches Any\n  assert True",
  );
  assert.equal(report.status, "passed", report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["passed", "passed"],
  );
});

test("E_VALUE_SERIALIZATION while printing operands is a placeholder, not the failure", () => {
  withOperandInspect(
    new LanguageError("value has no structural representation yet", undefined, {
      code: "E_VALUE_SERIALIZATION",
    }),
    () => {
      const report = run("assert 1 == 2\n  assert True");
      assert.equal(report.status, "failed");
      assert.deepEqual(
        report.checks.map((c) => c.status),
        ["failed", "passed"],
      );
      assert.match(report.message, /assertion is False/);
      assert.match(report.message, /unprintable\.test:2:3/);
      assert.ok(report.message.includes("assert 1 == 2"), report.message);
      assert.match(report.message, /1: <value cannot be printed>/);
      assert.match(report.message, /2: <value cannot be printed>/);
      assert.doesNotMatch(report.message, /E_VALUE_SERIALIZATION/);
    },
  );
});

test("a failed match of an unprintable function keeps the False result", () => {
  const report = run("assert (x -> x) .matches String\n  assert True");
  assert.equal(report.status, "failed", report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["failed", "passed"],
  );
  assert.match(report.message, /assertion is False/);
  assert.match(report.message, /x -> x: <function>/);
  assert.doesNotMatch(report.message, /E_VALUE_SERIALIZATION/);
});

test("fulfilled todo reports its source and later assertions still execute", () => {
  const report = run("todo assert (x -> x) .matches Any\n  assert True");
  assert.equal(report.status, "failed");
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["failed", "passed"],
  );
  assert.match(report.message, /remove todo/);
  assert.match(report.message, /todo assert \(x -> x\) \.matches Any/);
  assert.equal(report.checks[0].operands, undefined);
});

test("an unexpected inspect exception while printing operands fails the test", () => {
  const runWithInspectError = (error: unknown, diagnostic: RegExp) => {
    withOperandInspect(error, () => {
      const report = run("assert 1 == 2");
      assert.equal(report.status, "failed");
      assert.match(report.message, diagnostic);
      assert.doesNotMatch(report.message, /cannot be printed/);
    });
  };
  runWithInspectError(
    new Error("unexpected inspect failure"),
    /unexpected inspect failure/,
  );
  runWithInspectError(
    new LanguageError("other inspect failure", undefined, {
      code: "E_UNBOUND_NAME",
    }),
    /E_UNBOUND_NAME: other inspect failure/,
  );
});

test("operand observation stops after every assertion, including an unprintable one", () => {
  const original = Interpreter.prototype.observeOperands;
  let active = 0;
  Interpreter.prototype.observeOperands = function (...args) {
    active++;
    const stop = original.apply(this, args);
    return () => {
      stop();
      active--;
    };
  };
  try {
    const report = run(
      "assert (x -> x) .matches Any\n  assert (x -> x) .matches String\n  assert 1 == 1",
    );
    assert.deepEqual(
      report.checks.map((c) => c.status),
      ["passed", "failed", "passed"],
    );
    assert.equal(active, 0);
    assert.equal(run("assert 1 == 1").status, "passed");
    assert.equal(active, 0);
  } finally {
    Interpreter.prototype.observeOperands = original;
  }
});
