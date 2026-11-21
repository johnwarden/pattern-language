import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

function report(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "source-report-"));
  try {
    const fixture = join(dir, "suite.test.mjs");
    writeFileSync(
      fixture,
      `import {registerSourceTests} from ${JSON.stringify(new URL("./source-suite-runner.ts", import.meta.url).href)};\nregisterSourceTests(${JSON.stringify(files)});\n`,
    );
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(
      process.execPath,
      [
        "--disable-warning=ExperimentalWarning",
        "--test",
        "--test-reporter=tap",
        fixture,
      ],
      { encoding: "utf8", env },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a malformed inbox file reports its path and location while other files run", () => {
  const result = report({
    "inbox/broken.test": 'test "Broken"\n  (\nend',
    "inbox/valid.test": 'test "Valid"\n  expect 4 is 4 :: NumericValue\nend',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /not ok \d+ - source file: inbox\/broken\.test/);
  assert.match(result.stdout, /inbox\/broken\.test:\d+:\d+/);
  assert.match(result.stdout, /E_[A-Z_]+/);
  assert.match(result.stdout, /\^/);
  assert.match(
    result.stdout,
    /ok \d+ - source conformance: inbox\/valid\\#valid/,
  );
});

test("an ordinary failing inbox case remains a failure with its source file", () => {
  const result = report({
    "inbox/wrong.test": 'test "Wrong"\n  expect 4 is 5 :: NumericValue\nend',
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(
    result.stdout,
    /not ok \d+ - source conformance: inbox\/wrong\\#wrong/,
  );
  assert.match(result.stdout, /inbox\/wrong\.test/);
  assert.match(result.stdout, /comparison: expected 5/);
});
