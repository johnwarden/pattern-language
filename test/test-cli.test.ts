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
      'test "Discovery"\n expect missing() result 1 :: MissingType\nend',
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
      'test "Value"\n todo assert missing()\n expect 4 result 4 :: Rational\nend\ntest "Future"\n todo assert missing()\nend',
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
    writeFileSync(file, 'test "Value"\n expect 4 result 4 :: Rational\nend');
    assert.equal(invoke(file).status, 0);
    writeFileSync(file, 'test "Value"\n expect 4 result 5 :: Rational\nend');
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

test("CLI names a malformed inbox file and still runs valid files", () =>
  temporary((dir) => {
    const inbox = join(dir, "inbox");
    mkdirSync(inbox);
    writeFileSync(join(inbox, "broken.test"), 'test "Broken"\n  (\nend');
    writeFileSync(
      join(dir, "valid.test"),
      'test "Valid"\n  expect 4 result 4 :: Rational\nend',
    );
    assert.deepEqual(Object.keys(collectTestFiles([dir])), ["valid.test"]);
    const result = invoke(inbox, join(dir, "valid.test"));
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

test("inbox is excluded from broad discovery but explicit file and directory paths opt in", () =>
  temporary((dir) => {
    const inbox = join(dir, "inbox");
    mkdirSync(inbox);
    const draft = join(inbox, "draft.test");
    writeFileSync(draft, 'test "Draft"\n  (\nend');
    writeFileSync(
      join(dir, "stable.test"),
      'test "Stable"\n expect 4 result 4 :: Rational\nend',
    );
    assert.deepEqual(Object.keys(collectTestFiles([dir], dir)), [
      "stable.test",
    ]);
    assert.deepEqual(Object.keys(collectTestFiles([inbox], dir)), [
      "inbox/draft.test",
    ]);
    assert.deepEqual(Object.keys(collectTestFiles([draft], dir)), [
      "inbox/draft.test",
    ]);
    const standard = invoke(dir);
    assert.equal(standard.status, 0, standard.stderr + standard.stdout);
    assert.match(standard.stdout, /FILE stable\.test/);
    assert.doesNotMatch(standard.stdout + standard.stderr, /draft\.test/);
    const explicit = invoke(inbox);
    assert.equal(explicit.status, 1);
    assert.match(explicit.stdout, /FILE draft\.test/);
    assert.match(explicit.stderr, /FAIL draft\.test/);
    assert.equal(invoke(draft).status, 1);
  }));
