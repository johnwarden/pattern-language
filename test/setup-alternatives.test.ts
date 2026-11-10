import test from "node:test";
import assert from "node:assert/strict";
import { loadTests, runTest } from "../src/test-suite.ts";
import { Interpreter } from "../src/runtime.ts";

const read = (body: string) =>
  loadTests({
    "setup.test": 'test "Setup alternatives"\n' + body + "\nend",
  })[0];

test("a todo result pack remains a trial instead of becoming playground output", () => {
  const report = runTest(read("  todo\n    (1, 2)\n  end"));
  assert.equal(report.passed, false);
  assert.match(report.message, /setup now succeeds/);
});

test("future generic setup uses its source schema and keeps the current definition", () => {
  const value = read(`  legacy def Color type :Black | :White
  todo type Color<T> concrete :Black | :White
  expect Color is Type(:Black | :White) :: Type`);
  assert.deepEqual(
    value.steps.map((s) => [s.kind, s.mode]),
    [
      ["setup", "legacy"],
      ["setup", "todo"],
      ["result", "check"],
    ],
  );
  const report = runTest(value);
  assert.equal(report.passed, true, report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["expected-failure", "passed"],
  );
  assert.equal(value.source, "def Color type :Black | :White\nColor");
});

test("ordinary type declarations are setup rather than obsolete assertion clauses", () => {
  const value = read(`  type Color concrete :Black | :White
  expect :Black :: Color is Black :: Color`);
  assert.equal(value.steps[0].kind, "setup");
  assert.equal(value.steps[0].mode, "check");
  const report = runTest(value);
  assert.equal(report.passed, true, report.message);
});
test("an implemented replacement is not hidden by the legacy type's duplicate name", () => {
  const report = runTest(
    read(`  legacy def Color type :Black | :White
  todo def Color type :Black | :White
  expect Color is Type(:Black | :White) :: Type`),
  );
  assert.equal(report.passed, false);
  assert.match(report.message, /setup now succeeds; remove todo/);
  assert.equal(report.checks.at(-1)?.status, "passed");
});
test("failed setup groups do not leak partial bindings", () => {
  const report = runTest(
    read(`  legacy n = 1 :: Int
  todo n = 99 :: Int
  todo future = missing()
  expect n is 1 :: Int
  expect future fails "E_UNBOUND_NAME"`),
  );
  assert.equal(report.passed, true, report.message);
  assert.equal(report.checks[0].status, "expected-failure");
});
test("alternatives retain incoming setup and fixture bindings", () => {
  const report = runTest(
    read(`  base = fixtureValue
  legacy n = base :: Int
  todo n = base :: Int
  expect n is 2 :: Int`),
    "fixtureValue = 2 :: Int",
  );
  assert.equal(report.passed, false);
  assert.match(report.message, /setup now succeeds/);
  assert.equal(report.checks.at(-1)?.status, "passed");
});
test("consecutive declaration alternatives preserve mutually recursive groups", () => {
  const report = runTest(
    read(`  legacy def even(n) if n == 0 True else odd(n - 1)
  legacy def odd(n) if n == 0 False else even(n - 1)
  todo def even(n) if n == 0 True else odd(n - 1)
  todo def odd(n) if n == 0 False else even(n - 1)
  assert even(2)`),
  );
  assert.equal(report.passed, false);
  assert.match(report.message, /setup now succeeds/);
  assert.equal(report.checks.at(-1)?.status, "passed");
});
test("setup alternatives preserve unsupported source spelling and reject malformed assertions", () => {
  const value = read("  todo def Future<T> T");
  assert.equal(value.steps[0].source, "def Future<T> T");
  assert.equal(runTest(value).passed, true);
  for (const body of ["  todo expect", "  todo x = (", "  legacy assert"])
    assert.throws(() => read(body));
  const report = runTest(read("  legacy n = missing()\n  todo n = 1"));
  assert.equal(report.passed, false);
  assert.equal(report.phase, "setup");
});
test("host failures in a setup trial cannot be swallowed by todo", () => {
  const value = read("  todo future = missing()");
  const original = Interpreter.prototype.run;
  Interpreter.prototype.run = function (source, mode, name) {
    if (name?.endsWith(":todo setup")) throw new Error("host trial failure");
    return original.call(this, source, mode, name);
  };
  try {
    const report = runTest(value);
    assert.equal(report.passed, false);
    assert.match(report.message, /host trial failure/);
  } finally {
    Interpreter.prototype.run = original;
  }
});
