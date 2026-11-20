#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { collectTestFiles } from "./test-files.ts";
import { loadTests, runTest, isAssertion } from "./test-suite.ts";
import { renderDiagnostic } from "./diagnostics.ts";
import { decodeSource } from "./source-encoding.ts";

let list = false,
  fixture = "";
const paths: string[] = [];
try {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--list") list = true;
    else if (arg === "--fixture") {
      if (!args[i + 1]) throw new Error("--fixture requires a source file");
      const path = args[++i];
      fixture = decodeSource(readFileSync(path), path);
    } else if (arg === "--help") {
      console.log(
        "node src/test-cli.ts [--list] [--fixture FILE] [FILE|DIRECTORY ...]\nDefault: discover .test files under tests/ and bare, pattern, or pattern test fences under specs/. Discovery reads source only. Todo assertions and whole todo tests run and must fail; legacy assertions must pass.",
      );
      process.exit(0);
    } else if (arg.startsWith("--")) throw new Error("unknown option " + arg);
    else paths.push(arg);
  }
  const files = collectTestFiles(paths.length ? paths : undefined);
  let testCount = 0,
    failures = 0,
    passed = 0,
    assertions = 0,
    legacy = 0,
    expectedFailures = 0,
    todoTests = 0;
  for (const [name, source] of Object.entries(files)) {
    let tests;
    try {
      tests = loadTests({ [name]: source });
    } catch (error) {
      if (!list) console.log("FILE " + name);
      console.error("FAIL " + name + "\n" + renderDiagnostic(error));
      failures++;
      continue;
    }
    testCount += tests.length;
    if (!tests.length) continue;
    if (!list) console.log("FILE " + name);
    for (const value of tests) {
      if (list) {
        const counts = value.steps
          .filter(isAssertion)
          .reduce(
            (a, s) => ({ ...a, [s.mode]: (a[s.mode] ?? 0) + 1 }),
            {} as Record<string, number>,
          );
        console.log(
          value.id +
            " · " +
            value.name +
            " · " +
            (value.mode === "todo" ? "todo test · " : "") +
            Object.entries(counts)
              .map(([mode, n]) => n + " " + mode)
              .join(", "),
        );
      } else {
        const report = runTest(value, fixture);
        const label =
          report.status === "expected-failure"
            ? "TODO "
            : report.passed
              ? "PASS "
              : "FAIL ";
        console.log(label + report.id + " · " + report.name);
        assertions += report.checks.filter((c) => c.status === "passed").length;
        legacy += report.checks.filter(
          (c) => c.mode === "legacy" && c.status === "passed",
        ).length;
        expectedFailures += report.checks.filter(
          (c) => c.status === "expected-failure",
        ).length;
        if (report.status === "expected-failure") todoTests++;
        else if (report.passed) passed++;
        else {
          failures++;
          console.log(report.phase + ": " + report.message);
        }
      }
    }
  }
  if (!testCount && !failures) throw new Error("no source tests found");
  if (!list)
    console.log(
      `${passed} tests passed, ${failures} tests failed; ${assertions} assertions passed (${legacy} legacy), ${expectedFailures} todo assertions failed as expected` +
        (todoTests ? `; ${todoTests} todo tests failed as expected` : ""),
    );
  if (failures) process.exitCode = 1;
} catch (error) {
  console.error(renderDiagnostic(error));
  process.exitCode = 1;
}
