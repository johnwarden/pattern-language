import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadTests, runTest } from "../src/test-suite.ts";
import { collectTestFiles } from "../src/test-files.ts";
import { patternFences } from "../src/markdown-tests.ts";
import { renderDiagnostic } from "../src/diagnostics.ts";

const fence = (body: string, marker = "```", info = "pattern") =>
  marker + info + "\n" + body + "\n" + marker.replace(/ +/g, "");
const PASSING = 'test "Adds"\n  expect 1 + 1 is 2 :: Rational\nend';

test("fence extraction: info string, fence length and ignored fences", () => {
  const md = [
    "# Title",
    "```text",
    PASSING,
    "```",
    "```pattern-language",
    PASSING,
    "```",
    "````pattern",
    PASSING,
    "```",
    "still inside",
    "````",
    "~~~pattern extra words",
    PASSING,
    "~~~",
    "   ```pattern",
    PASSING.replace(/^/gm, "   "),
    "   ```",
    "    ```pattern",
    "    indented code, not a fence",
    "    ```",
    "```ts",
    "```pattern",
    "```",
  ].join("\n");
  const found = patternFences(md);
  assert.deepEqual(
    found.map((f) => f.line),
    [12, 19, 24],
  );
  assert.ok(found.every((f) => f.hasTests));
  // The ```` fence is not closed by a shorter ``` line.
  assert.match(found[0].source, /still inside/);
});

test("fence extraction: a fence without a test declaration is not a test source", () => {
  const [snippet, real] = patternFences(
    "```pattern\n1 + 2\n```\n\n```pattern\n(x :: Int) = 1\ntest \"T\"\n  assert True\n```\n",
  );
  assert.equal(snippet.hasTests, false);
  assert.equal(real.hasTests, true);
  assert.deepEqual(loadTests({ "a.md": "```pattern\n1 + 2\n```\n" }), []);
  assert.deepEqual(
    loadTests({ "a.md": "```pattern\nlet text = \"  test not a declaration\"\n```" }),
    [],
  );
});

test("fence extraction: an unterminated pattern fence is malformed", () => {
  let message = "";
  try {
    loadTests({ "doc.md": "prose\n\n```pattern\n" + PASSING + "\n" });
    assert.fail("expected a failure");
  } catch (error) {
    message = renderDiagnostic(error);
  }
  assert.match(message, /E_TEST_FENCE · doc\.md:3:1/);
  assert.match(message, /unterminated/);
  // Unterminated fences of other languages are not our concern.
  assert.deepEqual(loadTests({ "doc.md": "```text\nno end" }), []);
});

test("tests in fences run like .test files, one case per test, independent fences", () => {
  const md = [
    "Intro prose with test \"not a test\".",
    fence(PASSING),
    "",
    fence('test "Fresh"\n  expect missing is 1\nend'),
  ].join("\n");
  const cases = loadTests({ "doc.md": md });
  assert.deepEqual(
    cases.map((c) => c.id),
    ["doc.md#adds", "doc.md#fresh"],
  );
  assert.equal(runTest(cases[0]).passed, true);
  assert.equal(runTest(cases[1]).passed, false);
  // Same title in two fences: later fence is disambiguated by its line, not renamed in .test files.
  const twice = loadTests({ "doc.md": fence(PASSING) + "\n\n" + fence(PASSING) });
  assert.deepEqual(
    twice.map((c) => c.id),
    ["doc.md#adds", "doc.md#adds@L7"],
  );
  assert.equal(loadTests({ "x.test": PASSING })[0].id, "x#adds");
});

test("failures report the real Markdown file, line and column", () => {
  const md = [
    "# Doc",
    "",
    "Some prose.",
    "",
    "```pattern",
    'test "Wrong"',
    "  expect 1 is 1 :: Rational",
    "  expect",
    "    2 + 2",
    "  is",
    "    5 :: Rational",
    "  end",
    "  assert 1 == 2",
    "end",
    "```",
  ].join("\n");
  const [value] = loadTests({ "guide/doc.md": md });
  const report = runTest(value);
  assert.equal(report.passed, false);
  assert.match(report.message, /guide\/doc\.md:8:3/);
  assert.doesNotMatch(report.message, /doc\.md:3:/);
  const asserted = runTest(
    loadTests({
      "doc.md": md.replace("  expect\n    2 + 2\n  is\n    5 :: Rational\n  end\n", ""),
    })[0],
  );
  assert.match(asserted.message, /doc\.md:8:3/);
});

test("indented fences keep real columns", () => {
  const md = "text\n\n  ```pattern\n  test \"Ind\"\n    expect 1 is 2 :: Rational\n  end\n  ```\n";
  const [value] = loadTests({ "doc.md": md });
  const report = runTest(value);
  assert.equal(report.passed, false);
  assert.match(report.message, /doc\.md:5:5/);
});

test("indented fences report parse errors at real columns", () => {
  const md = "x\n\n   ```pattern\n   test \"Broken\"\n     (\n   end\n   ```\n";
  let message = "";
  try {
    loadTests({ "doc.md": md });
    assert.fail("expected a failure");
  } catch (error) {
    message = renderDiagnostic(error);
  }
  assert.match(message, /doc\.md:5:6/, message);
  assert.match(message, /5 \|      \(/, message);
});

test("malformed test source names the Markdown file and line", () => {
  const md = "prose\n\n" + fence('test "Broken"\n  (\nend');
  let message = "";
  try {
    loadTests({ "doc.md": md });
    assert.fail("expected a failure");
  } catch (error) {
    message = renderDiagnostic(error);
  }
  assert.match(message, /E_[A-Z_]+ · doc\.md:(\d+):\d+/);
  const line = Number(/doc\.md:(\d+):/.exec(message)![1]);
  assert.ok(line >= 4 && line <= 6, message);
});

test("todo and legacy modifiers behave as in .test files", () => {
  const md = [
    fence(
      'test "Mixed"\n  expect 1 is 1 :: Rational\n  todo expect 1 is 2 :: Rational\n  legacy expect 2 is 2 :: Rational\nend',
    ),
    fence('todo test "Whole"\n  expect 1 is 2 :: Rational\nend'),
    fence('todo test "Unexpected"\n  expect 1 is 1 :: Rational\nend'),
  ].join("\n\n");
  const [mixed, whole, unexpected] = loadTests({ "doc.md": md });
  const m = runTest(mixed);
  assert.equal(m.passed, true, m.message);
  assert.equal(m.checks.filter((c) => c.status === "expected-failure").length, 1);
  assert.equal(m.checks.filter((c) => c.mode === "legacy").length, 1);
  assert.equal(runTest(whole).status, "expected-failure");
  const u = runTest(unexpected);
  assert.equal(u.passed, false);
  assert.match(u.message, /remove todo/);
});

function tree(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "md-tests-"));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, ".."), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

test("discovery: explicit .md path and directories include .md beside .test", () => {
  const dir = tree({
    "a.test": PASSING,
    "docs/b.md": fence(PASSING),
    "docs/notes.txt": "ignored",
  });
  try {
    assert.deepEqual(Object.keys(collectTestFiles([join(dir, "docs/b.md")])), [
      "b.md",
    ]);
    assert.deepEqual(Object.keys(collectTestFiles([dir])), ["a.test", "docs/b.md"]);
    assert.throws(
      () => collectTestFiles([join(dir, "docs/notes.txt")]),
      /\.test or \.md/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("discovery: inbox .md files are opt-in like inbox .test files", () => {
  const dir = tree({
    "a.md": fence(PASSING),
    "inbox/b.md": fence(PASSING),
    "inbox/c.test": PASSING,
  });
  try {
    assert.deepEqual(Object.keys(collectTestFiles([dir], dir)), ["a.md"]);
    assert.deepEqual(Object.keys(collectTestFiles([join(dir, "inbox")], dir)), [
      "inbox/b.md",
      "inbox/c.test",
    ]);
    assert.deepEqual(Object.keys(collectTestFiles([join(dir, "inbox/b.md")], dir)), [
      "inbox/b.md",
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const cli = fileURLToPath(new URL("../src/test-cli.ts", import.meta.url));
function run(...args: string[]) {
  return spawnSync(
    process.execPath,
    ["--disable-warning=ExperimentalWarning", cli, ...args],
    { encoding: "utf8" },
  );
}

test("the source runner executes .md files, lists them and reports Markdown locations", () => {
  const dir = tree({
    "ok.md": "# Doc\n\n" + fence(PASSING) + "\n\n" + fence("1 + 1"),
    "none.md": "just prose\n",
    "bad.md": "\n\n" + fence('test "Bad"\n  expect 1 is 2 :: Rational\nend'),
    "open.md": "```pattern\n" + PASSING,
  });
  try {
    const ok = run(join(dir, "ok.md"));
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /FILE ok\.md\nPASS ok\.md#adds · Adds/);
    assert.match(ok.stdout, /1 tests passed, 0 tests failed/);

    const none = run(join(dir, "none.md"));
    assert.equal(none.status, 0, none.stdout + none.stderr);
    assert.match(none.stdout, /FILE none\.md/);
    assert.match(none.stdout, /0 tests passed, 0 tests failed/);

    const bad = run(join(dir, "bad.md"));
    assert.equal(bad.status, 1);
    assert.match(bad.stdout, /FAIL bad\.md#bad/);
    assert.match(bad.stdout, /bad\.md:5:3/);

    const open = run(join(dir, "open.md"));
    assert.equal(open.status, 1);
    assert.match(open.stderr, /FAIL open\.md\nE_TEST_FENCE · open\.md:1:1/);

    const listed = run("--list", join(dir, "ok.md"));
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /ok\.md#adds · Adds/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
