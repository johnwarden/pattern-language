import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTests, runTest } from "../src/test-suite.ts";
import { Interpreter } from "../src/runtime.ts";
import type { Syntax } from "../src/syntax.ts";

const source = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const check = (text: string, file = "checks.test") =>
  runTest(loadTests({ [file]: text })[0]);

test("is uses the subject type for inert expected data, including indented forms", () => {
  const report = check(`test "Inferred data"
  expect 1 is 1
  expect 3 :: Int is 3
  expect "hello" is "hello"
  expect :Ready is Ready
  type Rectangle concrete Rect(width :: Rational, height :: Rational)
  rectangle = Rect(2, 3) :: Rectangle
  expect rectangle is Rect(2, 3)
  expect rectangle is Rect(2, 3) :: Rectangle
  expect
    4 :: Int
  is
    4
  end
end`);
  assert.equal(report.passed, true, report.message);
  assert.equal(report.checks.length, 7);
});

test("is rejects data mismatch, explicit type mismatch, and code disguised as data", () => {
  const cases = [
    ["expect 1 is 2", /expected 2.*received 1/s],
    ["expect 3 :: Int is 3 :: Rational", /Int.*Rational|Rational.*Int/s],
    ["expect 2\n  is\n    (1 + 1)\n  end", /expected|data syntax|invalid|E_/i],
  ] as const;
  for (const [clause, message] of cases) {
    const report = check(`test "Bad expected data"\n  ${clause}\nend`);
    assert.equal(report.passed, false, clause);
    assert.match(report.message, message);
    assert.match(report.message, /checks\.test:\d+:\d+/);
    assert.match(
      report.message,
      /expect 1 is 2|expect 3 :: Int is 3 :: Rational|expect 2/s,
    );
  }
});

test("contains fixtures have authored passing, mismatch, and type-error outcomes", () => {
  const cases = loadTests({ "contains.test": source("expect-contains.test") });
  assert.deepEqual(
    cases.map((c) => c.name),
    [
      "contains finds exact contiguous text",
      "contains accepts a computed String",
      "contains treats punctuation literally",
      "contains fails when the substring is absent",
      "contains does not match a noncontiguous subsequence",
      "contains requires exact letter case",
      "contains does not interpret a regular expression",
      "contains rejects a numeric subject instead of stringifying it",
      "contains rejects a numeric needle instead of stringifying it",
      "contains rejects a collection subject",
    ],
  );
  const reports = cases.map((c) => runTest(c));
  assert.deepEqual(
    reports.map((r) => r.passed),
    [true, true, true, false, false, false, false, false, false, false],
  );
  for (const r of reports.slice(3)) {
    assert.match(r.message, /contains\.test:\d+:\d+/);
    assert.match(r.message, /expect .* contains /s);
  }
  for (const r of reports.slice(7)) assert.match(r.message, /String/);
});

test("failed direct comparison predicates name expressions, values, and location", () => {
  const cases = [
    [
      "left = 1\n  right = 2\n  assert left == right",
      /left: 1 :: Rational.*right: 2 :: Rational/s,
    ],
    [
      "left = 1\n  right = 1\n  assert left != right",
      /left: 1 :: Rational.*right: 1 :: Rational/s,
    ],
    ["assert 1 .matches (type String)", /1: 1 :: Rational.*type String/s],
  ] as const;
  for (const [body, operands] of cases) {
    const text = `test "Predicate"\n  ${body}\nend`;
    const report = check(text, "predicates.test");
    assert.equal(report.passed, false, body);
    assert.match(report.message, /predicates\.test:\d+:\d+/);
    assert.match(
      report.message,
      /assert (left == right|left != right|1 \.matches \(type String\))/,
    );
    assert.match(report.message, operands);
  }
});

test("predicate operands run once in their original left-to-right evaluation", () => {
  const original = Reflect.get(Interpreter.prototype, "evaluate") as (
    tree: Syntax,
    scope: unknown,
  ) => unknown;
  for (const predicate of ["==", "!=", ".matches"]) {
    const observed: string[] = [];
    Reflect.set(
      Interpreter.prototype,
      "evaluate",
      function (this: Interpreter, tree: Syntax, scope: unknown) {
        const span = tree.span;
        if (
          span?.source?.name === "evaluation.test" &&
          span.start !== undefined &&
          span.end !== undefined
        ) {
          const expression = span.source.text.slice(span.start, span.end);
          if (expression === "left()" || expression === "right()")
            observed.push(expression);
        }
        return original.call(this, tree, scope);
      },
    );
    try {
      const report = check(
        `test "Once"
  def left() 1
  def right() ${predicate === "!=" ? "1" : predicate === ".matches" ? "String" : "2"}
  assert left() ${predicate} right()
end`,
        "evaluation.test",
      );
      assert.equal(report.passed, false, report.message);
      assert.deepEqual(observed, ["left()", "right()"], predicate);
    } finally {
      Reflect.set(Interpreter.prototype, "evaluate", original);
    }
  }
});

test("a throwing operand keeps its original language diagnostic", () => {
  for (const predicate of ["==", "!=", ".matches"]) {
    const report = check(
      `test "Throwing"
  assert 1 ${predicate} missing()
end`,
      "throwing.test",
    );
    assert.equal(report.passed, false);
    assert.match(report.message, /E_UNBOUND_NAME/);
    assert.match(report.message, /throwing\.test:\d+:\d+/);
    assert.match(report.message, /assert 1 /);
  }
});

test("every failure identifies its own assertion and a fulfilled todo identifies removal", () => {
  const report = check(
    `test "Several"
  assert 1 == 2
  expect "abc" contains "z"
  todo assert 1 == 1
  expect 3 is 4
end`,
    "many.test",
  );
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["failed", "failed", "failed", "failed"],
  );
  for (const [index, clause] of [
    "assert 1 == 2",
    'expect "abc" contains "z"',
    "todo assert 1 == 1",
    "expect 3 is 4",
  ].entries()) {
    assert.match(report.checks[index].message, /many\.test:\d+:\d+/);
    assert.ok(report.checks[index].message.includes(clause));
  }
  assert.match(report.checks[2].message, /remove todo/);
});

test("fails spelling preserves error matching and todo silence", () => {
  const report = check(`test "Failures"
  expect missing() fails "E_UNBOUND_NAME"
  todo expect 1 fails "E_UNBOUND_NAME"
  todo expect missing() fails "E_UNBOUND_NAME"
end`);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["passed", "expected-failure", "failed"],
  );
  assert.equal(report.checks[1].message, "");
  assert.match(
    report.checks[2].message,
    /todo expect missing\(\) fails.*remove todo/s,
  );
});

test("CLI prints each failed assertion with its own source location", () => {
  const dir = mkdtempSync(join(tmpdir(), "pattern-predicate-reports-"));
  try {
    const path = join(dir, "multiple.test");
    writeFileSync(
      path,
      `test "Several"
  assert 1 == 2
  expect "abc" contains "z"
  todo assert True
end`,
    );
    const cli = fileURLToPath(new URL("../src/test-cli.ts", import.meta.url));
    const result = spawnSync(process.execPath, [cli, path], {
      encoding: "utf8",
    });
    assert.equal(result.status, 1);
    for (const clause of [
      "assert 1 == 2",
      'expect "abc" contains "z"',
      "todo assert True",
    ])
      assert.ok(result.stdout.includes(clause), result.stdout);
    assert.match(result.stdout, /multiple\.test:2:\d+/);
    assert.match(result.stdout, /multiple\.test:3:\d+/);
    assert.match(result.stdout, /multiple\.test:4:\d+/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
