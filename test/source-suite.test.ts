import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEST_SCHEMA } from "../src/test-schema.ts";
import { loadTests, runTest } from "../src/test-suite.ts";
import { sourceFiles } from "./source-files.ts";

test("the published Test schema is the source used by the harness", () => {
  assert.equal(
    readFileSync(
      new URL("../examples/test-schema.pattern", import.meta.url),
      "utf8",
    ),
    TEST_SCHEMA,
  );
});
for (const value of loadTests(
  sourceFiles(new URL("../tests/", import.meta.url)),
)) {
  test("source conformance: " + value.id, () => {
    const result = runTest(value);
    assert.equal(result.passed, true, result.phase + ": " + result.message);
  });
}

// These source cases retain the former host canonical-source checks.
import { Interpreter } from "../src/runtime.ts";
import { normal } from "../src/syntax.ts";
test("every legacy assertion has a same-subject todo or an explicit unresolved decision", () => {
  const inventory = readFileSync(
    new URL("../design/LEGACY-ASSERTIONS.md", import.meta.url),
    "utf8",
  );
  const documented = [...inventory.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|/gm)]
    .map((m) => m[1] + " :: " + m[2])
    .sort();
  const unresolved: string[] = [];
  for (const value of loadTests(
    sourceFiles(new URL("../tests/", import.meta.url)),
  )) {
    for (const legacy of value.steps.filter(
      (s) => s.mode === "legacy" && s.kind !== "setup",
    )) {
      if (
        !value.steps.some(
          (s) =>
            s.mode === "todo" && normal(s.subject) === normal(legacy.subject),
        )
      )
        unresolved.push(value.id + " :: " + normal(legacy.subject));
    }
  }
  assert.deepEqual(
    unresolved.sort(),
    documented,
    "pair legacy with a real replacement, or document the specific unresolved decision",
  );
});
for (const value of loadTests(
  sourceFiles(new URL("../tests/conformance/", import.meta.url)),
)) {
  test("canonical source: " + value.id, () => {
    const tree = new Interpreter().parse(value.source);
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") return;
    const canonical = tree.lines.map((n) => normal(n)).join("\n");
    assert.equal(new Interpreter().parse(canonical).kind, "block");
    const original = new Interpreter(),
      roundTrip = new Interpreter();
    assert.equal(
      original.inspect(original.run(value.source)),
      roundTrip.inspect(roundTrip.run(canonical)),
    );
  });
}

test("all 27 decision-record cases execute from the synchronized specification corpus", () => {
  const record = readFileSync(
    new URL("../design/LANGUAGE-DECISIONS.md", import.meta.url),
    "utf8",
  );
  const excerpts = [
    ...record.matchAll(/```text\n(test "C(\d\d)[\s\S]*?)\n```/g),
  ];
  const files = sourceFiles(
    new URL("../tests/specification/", import.meta.url),
  );
  const cases = loadTests(files);
  assert.equal(excerpts.length, 27);
  assert.equal(cases.length, 27);
  for (const excerpt of excerpts) {
    assert.ok(
      Object.values(files).some((source) => source.includes(excerpt[1])),
      excerpt[2],
    );
    const candidate = cases.find((value) =>
      value.name.startsWith("C" + excerpt[2] + " "),
    );
    assert.ok(candidate);
    const report = runTest(candidate);
    assert.equal(report.passed, true, report.message);
    assert.ok(report.checks.length > 0);
  }
});
