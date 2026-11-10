import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter } from "../src/runtime.ts";
import { LanguageError } from "../src/syntax.ts";
import { loadTests, runTest } from "../src/test-suite.ts";

const run = (body: string) =>
  runTest(
    loadTests({ "unprintable.test": `test "Values"\n  ${body}\nend` })[0],
  );

test("passing direct predicates with unprintable values leave following checks intact", () => {
  const report = run(
    "assert (1 / 3) == (1 / 3)\n  assert (1 / 3) != (2 / 3)\n  assert (1 / 3) .matches Rational\n  assert True",
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
    "macro :third Args() Code` (1 / 3)\n  assert (third Args()) == (1 / 3)\n  assert True",
  );
  assert.equal(report.status, "passed", report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["passed", "passed"],
  );
});

test("failed predicates report unprintable operands without replacing the failure", () => {
  for (const [clause, expectedReason] of [
    ["assert (1 / 3) == (2 / 3)", /assertion is False/],
    ["assert (1 / 3) != (1 / 3)", /assertion is False/],
    ["assert (1 / 3) .matches String", /E_VALUE_SERIALIZATION/],
  ] as const) {
    const report = run(`${clause}\n  assert True`);
    assert.equal(report.status, "failed", clause);
    assert.deepEqual(
      report.checks.map((c) => c.status),
      ["failed", "passed"],
    );
    assert.match(report.message, expectedReason);
    assert.match(report.message, /unprintable\.test:2:3/);
    assert.ok(report.message.includes(clause), report.message);
    assert.match(report.message, /1 \/ 3: <value cannot be printed>/);
    if (!clause.includes(".matches"))
      assert.doesNotMatch(report.message, /E_VALUE_SERIALIZATION/);
  }
});

test("fulfilled todo reports its source and later assertions still execute", () => {
  const report = run("todo assert (1 / 3) == (1 / 3)\n  assert True");
  assert.equal(report.status, "failed");
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["failed", "passed"],
  );
  assert.match(report.message, /remove todo/);
  assert.match(report.message, /todo assert \(1 \/ 3\) == \(1 \/ 3\)/);
  assert.equal(report.checks[0].operands, undefined);
});

test("an unexpected inspect exception while printing operands fails the test", () => {
  const original = Interpreter.prototype.inspect;
  const runWithInspectError = (error: unknown, diagnostic: RegExp) => {
    let calls = 0;
    Interpreter.prototype.inspect = function (values) {
      calls++;
      if (calls === 1) return original.call(this, values);
      throw error;
    };
    try {
      const report = run("assert 1 == 2");
      assert.equal(report.status, "failed");
      assert.match(report.message, diagnostic);
      assert.doesNotMatch(report.message, /cannot be printed/);
      assert.ok(calls > 1);
    } finally {
      Interpreter.prototype.inspect = original;
    }
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
      "assert (1 / 3) == (1 / 3)\n  assert (1 / 3) == (2 / 3)\n  assert 1 == 1",
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
