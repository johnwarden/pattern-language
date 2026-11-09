import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEST_SCHEMA } from "../src/test-schema.ts";
import { loadTests } from "../src/test-suite.ts";
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

// Source-language execution lives in `just test-language`. This file keeps the
// host-only inventory and canonical-source checks that the CLI does not cover.
import { Interpreter } from "../src/runtime.ts";
import { normal } from "../src/syntax.ts";
const allSourceTests = loadTests(
  sourceFiles(new URL("../tests/", import.meta.url)),
);
test("every legacy assertion has a same-subject todo or an explicit unresolved decision", () => {
  const inventory = readFileSync(
    new URL("../design/LEGACY-ASSERTIONS.md", import.meta.url),
    "utf8",
  );
  const documented = [...inventory.matchAll(/^\| `([^`]+)` \| `([^`]+)` \|/gm)]
    .map((m) => m[1] + " :: " + m[2])
    .sort();
  const unresolved: string[] = [];
  for (const value of allSourceTests) {
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

test("specification corpus names design cases C01 through C27", () => {
  const cases = loadTests(
    sourceFiles(new URL("../tests/specification/", import.meta.url)),
  );
  const present = new Set(
    cases.flatMap((value) => {
      const match = /^C(\d\d) /.exec(value.name);
      return match ? [match[1]] : [];
    }),
  );
  for (let n = 1; n <= 27; n++) {
    const id = n.toString().padStart(2, "0");
    assert.ok(present.has(id), "missing design case C" + id);
  }
});
