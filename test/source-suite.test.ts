import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEST_SCHEMA } from "../src/test-schema.ts";
import { loadTests } from "../src/test-suite.ts";
import { sourceFiles } from "./source-files.ts";
import { Interpreter } from "../src/runtime.ts";
import { normal } from "../src/syntax.ts";

const sourceCases = loadTests(
  sourceFiles(new URL("../tests/", import.meta.url)),
);

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
// host-only canonical-source and specification coverage checks.
for (const value of sourceCases.filter((value) =>
  value.file.startsWith("conformance/"),
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
  const cases = sourceCases.filter((value) =>
    value.file.startsWith("specification/"),
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
