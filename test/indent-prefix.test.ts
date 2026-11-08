import test from "node:test";
import assert from "node:assert/strict";
import {
  indentBeyond,
  indentRelation,
  lineIndent,
  stripLinePrefix,
} from "../src/indent.ts";

test("indent prefixes use exact tab/space strings, not tabstop width", () => {
  assert.equal(lineIndent(" \t  x"), " \t  ");
  assert.equal(indentRelation("  ", "  "), "same");
  assert.equal(indentRelation("  \t", "  "), "nested");
  assert.equal(indentRelation("\t", "\t\t"), "dedented");
  assert.equal(indentRelation("\t", "  "), "incompatible");
  assert.equal(indentRelation(" \t", "\t "), "incompatible");
  assert.equal(indentBeyond("\t  ", "\t"), true);
  assert.equal(indentBeyond("  ", "\t"), false);
  assert.equal(stripLinePrefix("\t  hello", "\t  "), "hello");
  assert.equal(stripLinePrefix("  hello", "\t"), "");
});
