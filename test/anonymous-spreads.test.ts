import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter } from "../src/index.ts";
import { single, unwrap } from "../src/values.ts";
import { patternCaptures } from "../src/pattern-captures.ts";

// Bootstrap still accepts the pre-consolidation rest spelling. Destination
// contracts in specs/spreads-and-argpacks.md use (Float32*)... / (Float32**)....
test("anonymous repeated patterns create no synthetic capture binding", () => {
  for (const source of [
    "concrete [... :: Float32*]",
    "concrete [\n ... :: Float32**\n ...\n]",
  ]) {
    const value = unwrap(single(new Interpreter().run(source)));
    assert.equal(value.kind, "type");
    if (value.kind !== "type") continue;
    assert.deepEqual([...patternCaptures(value.pattern())], []);
  }
});
