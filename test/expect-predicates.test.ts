import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTests, runTest } from "../src/test-suite.ts";

const fixture = (name: string) =>
  loadTests({
    [name]: readFileSync(
      new URL("./fixtures/" + name, import.meta.url),
      "utf8",
    ),
  });
const reports = (name: string) =>
  new Map(fixture(name).map((value) => [value.name, runTest(value)]));
const run = (source: string) => runTest(loadTests({ "case.test": source })[0]);

test("is and fails fixtures are executable checks", () => {
  const all = reports("expect-predicates.test");
  assert.deepEqual(
    [...all].map(([name, report]) => [name, report.passed]),
    [
      ["Equality expectation uses is", true],
      ["Equality expectation without a type uses the subject type", true],
      ["Failure expectation uses fails", true],
    ],
  );
  const [equality, untyped, failure] = [...all.values()];
  assert.equal(untyped.checks.length, 2);
  assert.deepEqual(
    equality.checks.map((c) => [c.kind, c.status]),
    [["is", "passed"]],
  );
  assert.deepEqual(
    failure.checks.map((c) => [c.kind, c.status]),
    [["fails", "passed"]],
  );
  assert.equal(failure.expectedError, "E_NOT_CALLABLE");
});

test("the replaced result and error delimiters are not expectation syntax", () => {
  for (const old of [
    "expect 1 result 1 :: NumericValue",
    'expect 1(1) error "E_NOT_CALLABLE"',
    "legacy expect 1 result 1 :: NumericValue",
    'todo expect 1(1) error "E_NOT_CALLABLE"',
  ])
    assert.throws(
      () => loadTests({ "old.test": `test "Old"\n  ${old}\nend` }),
      /incomplete assert\/expect\/todo\/legacy form/,
      old,
    );
});

const passing = [
  "contains finds exact contiguous text",
  "contains accepts a computed String",
  "contains treats punctuation literally",
];
const failedComparison = [
  ["contains fails when the substring is absent", '"hello world"', '"goodbye"'],
  ["contains does not match a noncontiguous subsequence", '"abcdef"', '"ace"'],
  ["contains requires exact letter case", '"hello"', '"Hello"'],
  ["contains does not interpret a regular expression", '"abc"', '"a.c"'],
];
const operandErrors = [
  [
    "contains rejects a numeric subject instead of stringifying it",
    /subject is not a String/,
  ],
  [
    "contains rejects a numeric needle instead of stringifying it",
    /needle is not a String/,
  ],
  ["contains rejects a collection subject", /subject is not a String/],
] as const;

test("contains fixture cases report their authored outcomes", () => {
  const all = reports("expect-contains.test");
  assert.equal(all.size, 10);
  assert.equal(
    fixture("expect-contains.test")
      .flatMap((value) => value.steps)
      .filter((step) => step.kind === "contains").length,
    14,
  );
  for (const name of passing) {
    const report = all.get(name)!;
    assert.equal(report.status, "passed", name);
    assert.ok(
      report.checks.every(
        (c) => c.kind === "contains" && c.status === "passed",
      ),
      name,
    );
  }
  assert.equal(all.get(passing[0])!.checks.length, 4);
  assert.equal(all.get(passing[2])!.checks.length, 2);
  for (const [name, subject, needle] of failedComparison) {
    const report = all.get(name)!;
    assert.equal(report.status, "failed", name);
    assert.equal(report.phase, "comparison", name);
    // The reason leads; the failed assertion's location and source follow it.
    assert.equal(
      report.message.split("\n")[0],
      `expected ${subject} to contain ${needle}`,
      name,
    );
    assert.equal(report.checks[0].location?.file, "expect-contains.test", name);
    assert.match(
      report.checks[0].location!.source,
      /^expect .* contains /,
      name,
    );
    assert.doesNotMatch(report.message, /E_TEST_OPERAND_TYPE/, name);
    assert.equal(report.checks[0].kind, "contains");
    assert.equal(report.checks[0].status, "failed");
    assert.equal(report.checks[0].actual, subject);
    assert.equal(report.checks[0].expected, needle);
  }
  for (const [name, reason] of operandErrors) {
    const report = all.get(name)!;
    assert.equal(report.status, "failed", name);
    assert.match(report.message, /E_TEST_OPERAND_TYPE/, name);
    assert.match(report.message, reason, name);
    assert.doesNotMatch(report.message, /to contain/, name);
  }
  assert.equal(all.get(operandErrors[1][0])!.phase, "expectation");
  assert.equal(all.get(operandErrors[0][0])!.phase, "comparison");
});

test("contains follows the todo and legacy modes of other expectations", () => {
  const todo = run('test "Future"\n  todo expect "abc" contains "z"\nend');
  assert.equal(todo.passed, true, todo.message);
  assert.equal(todo.checks[0].status, "expected-failure");
  const fulfilled = run('test "Done"\n  todo expect "abc" contains "b"\nend');
  assert.equal(fulfilled.passed, false);
  assert.match(fulfilled.message, /remove todo/);
  const legacy = run('test "Old"\n  legacy expect "abc" contains "bc"\nend');
  assert.equal(legacy.passed, true, legacy.message);
  assert.equal(legacy.checks[0].mode, "legacy");
});

test("contains needles are literal authored String data", () => {
  const name = run('test "Name"\n  expect "ab" contains ab\nend');
  assert.equal(name.passed, false);
  assert.match(name.message, /E_TEST_OPERAND_TYPE.*needle is not a String/);
  const space = run('test "Space"\n  expect "a b" contains " "\nend');
  assert.equal(space.passed, true, space.message);
});
