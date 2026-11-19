import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { collectTestFiles, TEST_ROOT } from "../src/test-files.ts";
const cli = fileURLToPath(new URL("../src/test-cli.ts", import.meta.url));
function temporary(run: (directory: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), "pattern-test-"));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
const invoke = (...args: string[]) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
test("CLI discovery reads names without executing future assertions", () =>
  temporary((dir) => {
    writeFileSync(
      join(dir, "discovery.test"),
      'test "Discovery"\n expect missing() is 1 :: MissingType\nend',
    );
    const listed = invoke("--list", dir);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /discovery#discovery · Discovery/);
    const run = invoke(dir);
    assert.equal(run.status, 1);
    assert.match(run.stdout, /expectation:.*E_UNBOUND_NAME/);
  }));
test("CLI recursively finds .test files and reports multiple cases and expected failures", () =>
  temporary((dir) => {
    for (const group of ["a", "b"]) mkdirSync(join(dir, group));
    writeFileSync(
      join(dir, "a", "same.test"),
      'test "Value"\n todo assert missing()\n expect 4 is 4 :: Rational\nend\ntest "Future"\n todo assert missing()\nend',
    );
    writeFileSync(
      join(dir, "b", "same.test"),
      'test "Unavailable"\n todo assert FutureType<T>\nend',
    );
    writeFileSync(join(dir, "ignored.pattern"), "invalid source");
    symlinkSync(dir, join(dir, "a", "loop"), "dir");
    assert.deepEqual(Object.keys(collectTestFiles([dir])), [
      "a/same.test",
      "b/same.test",
    ]);
    assert.equal(
      Object.keys(collectTestFiles([dir, join(dir, "a", "same.test")], dir))
        .length,
      2,
    );
    const result = invoke(dir);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(
      result.stdout,
      /3 tests passed, 0 tests failed; 1 assertions passed \(0 legacy\), 3 todo assertions failed as expected/,
    );
    assert.match(result.stdout, /PASS b\/same#unavailable/);
  }));
test("CLI success and failure exit codes reflect active outcomes", () =>
  temporary((dir) => {
    const file = join(dir, "case.test");
    writeFileSync(file, 'test "Value"\n expect 4 is 4 :: Rational\nend');
    assert.equal(invoke(file).status, 0);
    writeFileSync(file, 'test "Value"\n expect 4 is 5 :: Rational\nend');
    const failure = invoke(file);
    assert.equal(failure.status, 1);
    assert.match(failure.stdout, /comparison: expected 5/);
  }));
test("CLI rejects empty, malformed, and unsupported explicit files", () =>
  temporary((dir) => {
    assert.equal(invoke(dir).status, 1);
    const file = join(dir, "bad.test");
    writeFileSync(file, 'test "Bad"\n (\nend');
    const result = invoke(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /E_/);
    const listed = invoke("--list", dir);
    assert.equal(listed.status, 1, listed.stderr + listed.stdout);
    assert.match(listed.stderr, /E_/);
    writeFileSync(file, "");
    assert.equal(invoke(dir).status, 1);
    const other = join(dir, "bad.txt");
    writeFileSync(other, "anything");
    assert.equal(invoke(other).status, 1);
  }));

test("CLI discovers nested tests and reports malformed files alongside valid cases", () =>
  temporary((dir) => {
    const inbox = join(dir, "inbox");
    mkdirSync(inbox);
    writeFileSync(join(inbox, "broken.test"), 'test "Broken"\n  (\nend');
    writeFileSync(
      join(dir, "valid.test"),
      'test "Valid"\n  expect 4 is 4 :: Rational\nend',
    );
    assert.deepEqual(Object.keys(collectTestFiles([dir])), [
      "inbox/broken.test",
      "valid.test",
    ]);
    const result = invoke(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /FAIL inbox\/broken\.test/);
    assert.match(result.stderr, /inbox\/broken\.test:\d+:\d+/);
    assert.match(result.stdout, /PASS valid#valid/);
  }));

test("selecting a project group retains the same IDs as default discovery", () => {
  const full = collectTestFiles();
  const subset = collectTestFiles([join(TEST_ROOT, "bindings")]);
  const bindings = Object.keys(full).filter((name) =>
    name.startsWith("bindings/"),
  );
  assert.deepEqual(Object.keys(subset), bindings);
  for (const name of bindings) assert.equal(subset[name], full[name]);
});

test("CLI runs named tests in both Pattern fence forms at Markdown coordinates", () =>
  temporary((dir) => {
    const file = join(dir, "example.md");
    writeFileSync(
      file,
      [
        "# Example",
        "  ```pattern",
        '  test "Implicit"',
        "   assert False",
        "  end",
        "```",
        "",
        "  ~~~pattern test",
        '  todo test "Future"',
        "    assert False",
        "  end",
        "  ~~~",
        "",
        "```pattern test",
        'test "Failure"',
        "  expect 4 is 5",
        "end",
        "```",
      ].join("\r\n"),
    );
    const listed = invoke("--list", dir);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /example\.md#future · Future · todo test/);
    assert.match(listed.stdout, /example\.md#failure · Failure/);
    assert.match(listed.stdout, /example\.md#implicit · Implicit/);
    const run = invoke(file);
    assert.equal(run.status, 1);
    assert.match(run.stdout, /at example\.md:4:4/);
    assert.match(run.stdout, /TODO example\.md#future/);
    assert.match(run.stdout, /at example\.md:16:3/);
  }));

test("CLI rejects malformed Markdown test fences and duplicate case IDs", () =>
  temporary((dir) => {
    const file = join(dir, "broken.md");
    const fence = '```pattern test\ntest "Same case"\n  assert True\nend\n';
    writeFileSync(file, "# Heading\n\n" + fence);
    const unclosedTest = invoke(file);
    assert.equal(unclosedTest.status, 1);
    assert.match(
      unclosedTest.stderr,
      /broken\.md:3:1: unclosed pattern test fence/,
    );
    writeFileSync(file, "# Heading\n\n```pattern\nillustrative\n");
    const unclosedPlain = invoke(file);
    assert.equal(unclosedPlain.status, 1);
    assert.match(
      unclosedPlain.stderr,
      /broken\.md:3:1: unclosed Markdown fence/,
    );
    writeFileSync(
      file,
      [
        "# Heading",
        "",
        "```pattern",
        "illustrative",
        "",
        "```pattern test",
        'test "Swallowed"',
        "  assert True",
        "end",
        "```",
        "",
      ].join("\n"),
    );
    const swallowed = invoke(file);
    assert.equal(swallowed.status, 1);
    assert.match(
      swallowed.stderr,
      /broken\.md:6:1: pattern test fence nested inside another fence/,
    );
    assert.doesNotMatch(swallowed.stdout, /Swallowed/);
    writeFileSync(
      join(dir, "good.test"),
      'test "Good"\n  assert True\nend\n',
    );
    const mixed = invoke(dir);
    assert.equal(mixed.status, 1);
    assert.match(
      mixed.stderr,
      /broken\.md:6:1: pattern test fence nested inside another fence/,
    );
    assert.match(mixed.stdout, /PASS good#good/);
    writeFileSync(file, fence + "```\n\n" + fence + "```\n");
    const duplicate = invoke("--list", file);
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /E_TEST_ID · broken\.md:8:\d+/);
    writeFileSync(file, '  ```pattern\n  test "Example"\n    expect (]\n  end\n  ```\n');
    const malformed = invoke(file);
    assert.equal(malformed.status, 1);
    assert.match(malformed.stderr, /broken\.md:3:13: unmatched closing delimiter/);
  }));

test("CLI runs and lists a file containing a single todo test", () =>
  temporary((dir) => {
    const file = join(dir, "future.test");
    writeFileSync(
      file,
      'todo test "Future"\n  assert True\n  expect missing() is 1 :: Rational\nend',
    );
    const listed = invoke("--list", file);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /future#future · Future · todo test/);
    const result = invoke(file);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /FILE future\.test/);
    assert.match(result.stdout, /TODO future#future/);
    assert.match(result.stdout, /0 tests passed, 0 tests failed/);
    assert.match(result.stdout, /1 todo tests failed as expected/);
    writeFileSync(file, 'todo test "Future"\n  assert True\nend');
    const fulfilled = invoke(file);
    assert.equal(fulfilled.status, 1);
    assert.match(fulfilled.stdout, /FAIL future#future/);
    assert.match(fulfilled.stdout, /This test now passes; remove todo/);
  }));
