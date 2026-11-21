import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
} from "../src/index.ts";

test("postfix question mark has no optional meaning without a source definition", () => {
  const bare = new Interpreter(undefined, false, "");
  assert.equal(displayResults(bare.run("1? :: (type NumericValue?)")), "1?");
  const custom = new Interpreter(
    undefined,
    false,
    "def (n :: NumericValue)? n + 1\n",
  );
  assert.equal(displayResults(custom.run("2?")), "3");
});

test("hash always starts a comment, tight or separated", () => {
  assert.equal(normal(parseExpression("x#")), "x");
  assert.equal(normal(parseExpression("x #")), "x");
});
