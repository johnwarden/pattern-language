import test from "node:test";
import assert from "node:assert/strict";
import { loadTests, runTest, type TestCase } from "../src/test-suite.ts";
import { renderDiagnostic } from "../src/diagnostics.ts";

/** A malformed source file is a named failure, not an uncaught module-load error. */
export function registerSourceTests(files: Record<string, string>): TestCase[] {
  const parsed: TestCase[] = [];
  for (const [file, source] of Object.entries(files).sort(([a], [b]) =>
    a.localeCompare(b, "en"),
  )) {
    let cases: TestCase[];
    try {
      cases = loadTests({ [file]: source });
    } catch (error) {
      test("source file: " + file, () => {
        assert.fail(file + "\n" + renderDiagnostic(error));
      });
      continue;
    }
    parsed.push(...cases);
    for (const value of cases) {
      test("source conformance: " + value.id + " (" + file + ")", () => {
        const result = runTest(value);
        assert.equal(
          result.passed,
          true,
          file + "\n" + result.phase + ": " + result.message,
        );
      });
    }
  }
  return parsed;
}
