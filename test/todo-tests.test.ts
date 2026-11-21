import test from "node:test";
import assert from "node:assert/strict";
import { loadTests, runTest } from "../src/test-suite.ts";
import { Interpreter } from "../src/runtime.ts";

const read = (body: string) =>
  loadTests({ "inbox/future.test": `todo test "Future"\n${body}\nend` })[0];

test("a file containing one whole-test todo is discoverable without execution", () => {
  const value = read("  x = missing()\n  expect x is 1 :: NumericValue");
  assert.equal(value.id, "inbox/future#future");
  assert.equal(value.name, "Future");
  assert.equal(value.mode, "todo");
  assert.equal(value.program, false);
  assert.deepEqual(
    value.steps.map((s) => s.mode),
    ["check", "check"],
  );
  assert.match(value.source, /x = missing\(\)/);
});

test("test and todo test blocks coexist with stable IDs and shared duplicate checks", () => {
  const ordinary = 'test "Supported"\n  assert True\nend';
  const future = 'todo test "Future"\n  assert False\nend';
  const cases = loadTests({ "mixed.test": ordinary + "\n" + future });
  assert.deepEqual(
    cases.map((v) => v.mode),
    ["check", "todo"],
  );
  for (const value of cases) assert.equal(runTest(value).passed, true);
  const reordered = loadTests({ "mixed.test": future + "\n" + ordinary });
  assert.deepEqual(
    cases.map((v) => v.id).sort(),
    reordered.map((v) => v.id).sort(),
  );
  assert.equal(
    loadTests({ "mixed.test": ordinary.replace('test "', 'todo test "') })[0]
      .id,
    cases[0].id,
  );
  assert.throws(
    () =>
      loadTests({
        "mixed.test":
          ordinary + "\n" + ordinary.replace('test "', 'todo test "'),
      }),
    /duplicate case ID/,
  );
});

test("a whole-test todo tolerates partial progress and executes remaining assertions", () => {
  const result = runTest(
    read("  assert True\n  expect 1 is 2 :: NumericValue\n  assert True"),
  );
  assert.equal(result.status, "expected-failure");
  assert.equal(result.passed, true);
  assert.deepEqual(
    result.checks.map((c) => c.status),
    ["passed", "failed", "passed"],
  );
  assert.match(result.message, /expected 2/);
});

test("a language failure in whole-test todo setup is expected and case-local", () => {
  const value = read("  partial = 99\n  x = missing()\n  assert True");
  const result = runTest(value);
  assert.equal(result.passed, true);
  assert.equal(result.status, "expected-failure");
  assert.equal(result.phase, "setup");
  const next = loadTests({
    "next.test": 'test "Fresh"\n  expect partial fails "E_UNBOUND_NAME"\nend',
  })[0];
  assert.equal(runTest(next).passed, true);
});

test("a completed whole-test todo fails, including a successful error expectation", () => {
  for (const body of [
    "  assert True",
    '  expect missing() fails "E_UNBOUND_NAME"',
  ]) {
    const result = runTest(read(body));
    assert.equal(result.passed, false);
    assert.equal(result.status, "failed");
    assert.equal(result.message, "This test now passes; remove todo.");
  }
});

test("whole-test todo cannot hide fulfilled assertion or setup todos", () => {
  for (const body of [
    "  assert False\n  todo assert True",
    "  todo assert True\n  assert False",
    "  todo x = 1\n  assert False",
  ]) {
    const result = runTest(read(body));
    assert.equal(result.passed, false);
    assert.equal(result.status, "failed");
    assert.match(result.message, /remove todo/);
    assert.ok(result.checks.some((c) => c.message.includes("remove todo")));
  }
});

test("whole-test todo never absorbs fixture, host, malformed-file or missing-check failures", () => {
  const value = read("  assert False");
  const fixture = runTest(value, "missing()");
  assert.equal(fixture.passed, false);
  assert.equal(fixture.phase, "fixture");
  const original = Interpreter.prototype.evaluateCode;
  Interpreter.prototype.evaluateCode = () => {
    throw new Error("host trap");
  };
  try {
    const result = runTest(value);
    assert.equal(result.passed, false);
    assert.match(result.message, /host trap/);
  } finally {
    Interpreter.prototype.evaluateCode = original;
  }
  for (const body of ["  x = 1", "  x = missing()"])
    assert.equal(runTest(read(body)).passed, false);
  for (const source of [
    'todo test "Bad"\n  assert (\nend',
    'todo test "Bad"\n  assert False',
    'test "Outer"\n  todo test "Nested"\n    assert False\n  end\nend',
    'legacy test "Bad"\n  assert True\nend',
  ])
    assert.throws(() => loadTests({ "bad.test": source }));
});

