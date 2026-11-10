import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTests, runTest } from "../src/test-suite.ts";
import { Interpreter } from "../src/runtime.ts";

const fixturePath = fileURLToPath(
  new URL("./fixtures/test-runner-diagnostics.test", import.meta.url),
);
const fixtureSource = readFileSync(fixturePath, "utf8");
const cli = fileURLToPath(new URL("../src/test-cli.ts", import.meta.url));
const fixtureReports = () => {
  const cases = loadTests({ "fixtures/diagnostics.test": fixtureSource });
  return new Map(cases.map((c) => [c.name, runTest(c)]));
};
/** 1-based line/column of the first occurrence of `text` in `source`. */
function where(source: string, text: string): string {
  const offset = source.indexOf(text);
  assert.notEqual(offset, -1, text);
  const before = source.slice(0, offset).split("\n");
  return before.length + ":" + (before.at(-1)!.length + 1);
}
const run = (source: string, file = "case.test") =>
  loadTests({ [file]: source }).map((c) => runTest(c));

test("a failed equality names its file, line, column, source and both operands", () => {
  const report = fixtureReports().get("Failed equality")!;
  assert.equal(report.status, "failed");
  const at =
    "fixtures/diagnostics.test:" + where(fixtureSource, "assert left == right");
  assert.ok(report.message.includes(at), report.message);
  assert.ok(report.message.includes("assert left == right"), report.message);
  assert.ok(report.message.includes("left: 1 :: Rational"), report.message);
  assert.ok(report.message.includes("right: 2 :: Rational"), report.message);
  const check = report.checks[0];
  assert.deepEqual(check.location, {
    file: "fixtures/diagnostics.test",
    line: Number(where(fixtureSource, "assert left == right").split(":")[0]),
    column: 3,
    source: "assert left == right",
  });
  assert.deepEqual(check.operands, {
    operator: "==",
    left: { expression: "left", actual: "1 :: Rational" },
    right: { expression: "right", actual: "2 :: Rational" },
  });
});

test("a failed inequality identifies the != assertion and both equal operands", () => {
  const report = fixtureReports().get("Failed inequality")!;
  assert.equal(report.status, "failed");
  assert.ok(report.message.includes("assert left != right"), report.message);
  assert.ok(report.message.includes("left: 1 :: Rational"), report.message);
  assert.ok(report.message.includes("right: 1 :: Rational"), report.message);
  assert.equal(report.checks[0].operands?.operator, "!=");
});

test("a failed pattern match shows the actual value and the actual RHS pattern value", () => {
  const report = fixtureReports().get("Failed pattern match")!;
  assert.equal(report.status, "failed");
  assert.ok(
    report.message.includes("assert candidate .matches Rational"),
    report.message,
  );
  assert.ok(
    report.message.includes('candidate: "hello" :: String'),
    report.message,
  );
  assert.ok(
    report.message.includes("Rational: Rational :: ReservedSymbol"),
    report.message,
  );
  assert.equal(report.checks[0].operands?.operator, ".matches");
});

test("a fulfilled todo names the todo that must be removed", () => {
  const report = fixtureReports().get("Fulfilled todo")!;
  assert.equal(report.status, "failed");
  assert.match(report.message, /remove todo/);
  assert.equal(report.checks[0].operands, undefined);
  assert.ok(report.message.includes("todo assert 1 == 1"), report.message);
  assert.ok(
    report.message.includes(
      "fixtures/diagnostics.test:" + where(fixtureSource, "todo assert 1 == 1"),
    ),
    report.message,
  );
});

test("the deliberately failing fixtures produce distinct reports", () => {
  const messages = [...fixtureReports().values()].map((r) => r.message);
  assert.equal(new Set(messages).size, messages.length);
  for (const [name, report] of fixtureReports())
    assert.equal(report.status, "failed", name);
});

test("a todo assertion that still fails stays quiet", () => {
  const [report] = run(
    'test "Future"\n  left = 1\n  todo assert left == 2\n  todo expect 1 is 2\n  assert left == 1\nend',
  );
  assert.equal(report.status, "passed", report.message);
  assert.deepEqual(
    report.checks.map((c) => [c.status, c.message]),
    [
      ["expected-failure", ""],
      ["expected-failure", ""],
      ["passed", "matched"],
    ],
  );
  assert.equal(
    report.checks.find((c) => c.status === "expected-failure")?.operands,
    undefined,
  );
});

test("every failing assertion in a file is reported with its own location", () => {
  const source = [
    'test "First"',
    "  assert 1 == 2",
    "  assert 2 == 2",
    "  assert 3 != 3",
    "  expect 4 is 5",
    "end",
    "",
    'test "Second"',
    "  assert False",
    "end",
    "",
  ].join("\n");
  const reports = run(source, "many.test");
  assert.deepEqual(
    reports.map((r) => r.status),
    ["failed", "failed"],
  );
  const first = reports[0].message;
  for (const text of ["assert 1 == 2", "assert 3 != 3", "expect 4 is 5"])
    assert.ok(first.includes("many.test:" + where(source, text)), first);
  assert.ok(!first.includes("assert 2 == 2"), first);
  assert.ok(reports[1].message.includes("many.test:9:3"), reports[1].message);
  assert.equal(
    reports[0].checks.filter((c) => c.status === "failed").length,
    3,
  );

  const directory = mkdtempSync(join(tmpdir(), "runner-diagnostics-"));
  try {
    writeFileSync(join(directory, "many.test"), source);
    const result = spawnSync(process.execPath, [cli, directory], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    for (const text of [
      "assert 1 == 2",
      "assert 3 != 3",
      "expect 4 is 5",
      "assert False",
    ])
      assert.ok(result.stdout.includes(text), result.stdout);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("operands are evaluated once, left before right, and never re-run for the report", () => {
  const original = (Interpreter.prototype as any).invoke;
  for (const [operator, clause] of [
    ["==", "assert lhs() == rhs()"],
    ["!=", "assert lhs() != rhs()"],
    [".matches", "assert lhs() .matches rhs()"],
  ]) {
    const calls: string[] = [];
    (Interpreter.prototype as any).invoke = function (fn: any, ...rest: any[]) {
      if (fn?.kind === "overload" && ["lhs", "rhs"].includes(fn.name))
        calls.push(fn.name);
      return original.call(this, fn, ...rest);
    };
    try {
      const body =
        operator === "!="
          ? "def lhs()\n    1\n  end\n  def rhs()\n    1\n  end\n  " + clause
          : operator === "=="
            ? "def lhs()\n    1\n  end\n  def rhs()\n    2\n  end\n  " + clause
            : "def lhs()\n    1\n  end\n  def rhs()\n    String\n  end\n  " +
              clause;
      const [report] = run('test "Counts"\n  ' + body + "\nend");
      assert.equal(report.status, "failed", operator + report.message);
      assert.deepEqual(calls, ["lhs", "rhs"], operator);
      assert.equal(report.checks[0].operands?.left.expression, "lhs()");
      assert.equal(report.checks[0].operands?.right.expression, "rhs()");
    } finally {
      (Interpreter.prototype as any).invoke = original;
    }
  }
});

test("a passing assertion captures nothing observable and evaluates operands once", () => {
  const original = (Interpreter.prototype as any).invoke;
  const calls: string[] = [];
  (Interpreter.prototype as any).invoke = function (fn: any, ...rest: any[]) {
    if (fn?.kind === "overload" && fn.name === "once") calls.push(fn.name);
    return original.call(this, fn, ...rest);
  };
  try {
    const [report] = run(
      'test "Once"\n  def once()\n    1\n  end\n  assert once() == once()\nend',
    );
    assert.equal(report.status, "passed", report.message);
    assert.deepEqual(calls, ["once", "once"]);
    assert.equal(report.checks.at(-1)?.operands, undefined);
  } finally {
    (Interpreter.prototype as any).invoke = original;
  }
});

test("a thrown operand keeps the original diagnostic and its location", () => {
  const source =
    'test "Thrown"\n  assert missing() == 1\n  assert 1 == missing()\nend';
  const [report] = run(source, "thrown.test");
  assert.equal(report.status, "failed");
  assert.match(report.message, /E_UNBOUND_NAME/);
  assert.ok(report.message.includes("thrown.test:2:10"), report.message);
  assert.ok(report.message.includes("thrown.test:3:15"), report.message);
  assert.ok(report.message.includes("assert missing() == 1"), report.message);
  assert.ok(report.message.includes("assert 1 == missing()"), report.message);
  assert.equal(
    report.checks.filter(
      (c) => c.status === "failed" && c.operands === undefined,
    ).length,
    2,
  );
});

test("a multiline assertion reports its first line and its complete original source", () => {
  const source = [
    'test "Multiline"',
    "  assert",
    "    match 1",
    "      1 -> False",
    "      _ -> True",
    "    end",
    "  end",
    "  expect",
    "    1",
    "  is",
    "    2",
    "  end",
    "end",
    "",
  ].join("\n");
  const [report] = run(source, "multi.test");
  assert.equal(report.status, "failed", report.message);
  const [first, second] = report.checks;
  assert.equal(first.location?.line, 2);
  assert.equal(first.location?.column, 3);
  assert.equal(
    first.location?.source,
    "assert\n  match 1\n    1 -> False\n    _ -> True\n  end\nend",
  );
  assert.equal(second.location?.line, 8);
  assert.ok(
    second.location?.source.startsWith("expect\n  1\nis"),
    second.location?.source,
  );
  assert.ok(
    second.location?.source.endsWith("2\nend"),
    second.location?.source,
  );
  assert.ok(report.message.includes("multi.test:2:3"), report.message);
  assert.ok(report.message.includes("multi.test:8:3"), report.message);
});

test("repeated runs of one loaded case give identical reports", () => {
  const [value] = loadTests({
    "again.test": 'test "Again"\n  left = 1\n  assert left == 2\nend',
  });
  const first = runTest(value),
    second = runTest(value);
  assert.equal(second.message, first.message);
  assert.deepEqual(
    second.checks.map((c) => [c.location, c.operands]),
    first.checks.map((c) => [c.location, c.operands]),
  );
  const [passing] = loadTests({
    "again.test": 'test "Passing"\n  assert 1 == 1\nend',
  });
  assert.equal(runTest(passing).status, "passed");
  assert.equal(runTest(value).message, first.message);
});

test("non-direct predicates still report their location and source without operands", () => {
  const [report] = run(
    'test "Negation"\n  assert not(1 == 1)\nend',
    "neg.test",
  );
  assert.equal(report.status, "failed");
  assert.ok(report.message.includes("neg.test:2:3"), report.message);
  assert.ok(report.message.includes("assert not(1 == 1)"), report.message);
  assert.equal(report.checks[0].operands, undefined);
});

test("a failed setup todo names the todo setup", () => {
  const [report] = run(
    'test "Setup"\n  todo x = 1\n  assert True\nend',
    "setup.test",
  );
  assert.equal(report.status, "failed");
  assert.match(report.message, /remove todo/);
  assert.ok(report.message.includes("setup.test:2:3"), report.message);
  assert.ok(report.message.includes("todo x = 1"), report.message);
});

// Optional expected type -----------------------------------------------------

const outcome = (body: string) =>
  run('test "Optional"\n' + body + "\nend", "optional.test")[0];

test("expected data without an annotation uses the actual subject type", () => {
  for (const body of [
    "  expect 1 is 1",
    "  expect 3 :: Int is 3",
    '  expect "hello" is "hello"',
    "  expect :Ready is Ready",
    "  expect 1 is\n    1\n  end",
    "  expect\n    1\n  is 1",
    "  legacy expect 3 :: Int is 3",
  ]) {
    const report = outcome(body);
    assert.equal(report.status, "passed", body + "\n" + report.message);
  }
});

test("an unannotated expected value still requires the same value", () => {
  const report = outcome("  expect 1 is 2");
  assert.equal(report.status, "failed");
  assert.equal(report.phase, "comparison");
  assert.match(
    report.message,
    /expected 2 :: Rational; received 1 :: Rational/,
  );
  assert.ok(report.message.includes("optional.test:2:3"), report.message);
  assert.ok(report.message.includes("expect 1 is 2"), report.message);
  assert.equal(report.checks[0].expected, "2 :: Rational");
  assert.equal(report.checks[0].actual, "1 :: Rational");
});

test("an explicit type mismatch remains a failure", () => {
  const report = outcome("  expect 3 :: Int is 3 :: Rational");
  assert.equal(report.status, "failed");
  assert.match(
    report.message,
    /is type mismatch: expected Rational; received Int/,
  );
});

test("omitting the annotation does not coerce or reinterpret the expected data", () => {
  for (const body of [
    "  expect 3 :: Int is 3.5",
    '  expect 1 is "1"',
    "  expect 3 :: Int is 4",
  ])
    assert.equal(outcome(body).status, "failed", body);
});

test("unannotated expected data is inert and never evaluated", () => {
  for (const body of [
    "  expect 2 is\n    (1 + 1)\n  end",
    "  expect 2 is\n    1 + 1\n  end",
    "  expect 2 is\n    missing()\n  end",
  ]) {
    const report = outcome(body);
    assert.equal(report.status, "failed", body);
    assert.equal(report.phase, "expectation", body);
  }
});

test("an is expectation still requires exactly one positional value without an annotation", () => {
  const report = outcome("  def two()\n    (1, 2)\n  end\n  expect two() is 1");
  assert.equal(report.status, "failed");
  assert.match(report.message, /exactly one positional value/);
});

test("todo and legacy modes treat an unannotated expectation like an ordinary one", () => {
  const stillFailing = outcome("  todo expect 1 is 2\n  assert True");
  assert.equal(stillFailing.status, "passed", stillFailing.message);
  assert.equal(stillFailing.checks[0].status, "expected-failure");
  const fulfilled = outcome("  todo expect 1 is 1");
  assert.equal(fulfilled.status, "failed");
  assert.match(fulfilled.message, /remove todo/);
  assert.ok(
    fulfilled.message.includes("todo expect 1 is 1"),
    fulfilled.message,
  );
  const legacy = outcome("  legacy expect 1 is 2");
  assert.equal(legacy.status, "failed");
  assert.equal(legacy.checks[0].mode, "legacy");
  assert.equal(outcome("  legacy expect 1 is 1").status, "passed");
  const wholeTest = run(
    'todo test "Whole"\n  expect 1 is 2\nend',
    "whole.test",
  )[0];
  assert.equal(wholeTest.status, "expected-failure");
});
