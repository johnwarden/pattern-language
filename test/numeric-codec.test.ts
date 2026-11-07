import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { equal, single } from "../src/values.ts";

/**
 * Regression tracking for the numeric SyntaxNode / Code codec. Not a fix.
 *
 * Reproduction at PR8@b4ced55 (do not treat these observations as the contract):
 *   0.1 == 0f0.1                                 False   (exact values; pin)
 *   syntaxTree(0.1) == syntaxTree(0f0.1)         True    (silent collapse)
 *   syntaxExpression(syntaxTree(0.1)) == 0.1     False   (round-trip is 0f)
 *   (Code$` $(0.1)) == (Code` 0.1)               True    (do not todo; already true)
 *   evaluateCode(quote 0.1) vs splice of 0.1     0.1 vs 0x1.999999999999Ap-4
 *   syntaxTree(0x20000000000001)                 NumberLiteral(9007199254740992)
 *   1 / 3                                        E_VALUE_SERIALIZATION
 *
 * Forbidden: silent collapse, and equal Code that evaluates differently.
 * Acceptable adapter outcomes (Jonathan): exact preservation through the codec,
 * or explicit E_VALUE_SERIALIZATION. Do not invent 1/3 fraction spelling, and
 * do not assume NumberLiteral grows a spelling field until that schema choice
 * is decided.
 *
 * Known-bug invariants that currently fail are source `todo` assertions in
 * tests/numeric/codec.test (must fail today; a success asks to remove todo).
 * This host file only pins paths that already hold.
 */
const run = (source: string) => displayResults(new Interpreter().run(source));
const quoteEval = (source: string) => {
  const interpreter = new Interpreter();
  return displayResults(
    interpreter.evaluateCode(single(interpreter.run(source))),
  );
};

test("exact 0.1 is a different Rational from 0f0.1", () => {
  assert.equal(run("0.1 == 0f0.1"), "False");
  assert.equal(run("0.5 == 0f0.5"), "True");
  assert.equal(run("0.1"), "0.1");
  assert.equal(run("0f0.1"), "0x1.999999999999Ap-4");
});

test("1/3 stays exact internally and has no structural spelling yet", () => {
  assert.equal(run("((1 / 3) * 3) == 1"), "True");
  assert.throws(
    () => run("1 / 3"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_VALUE_SERIALIZATION",
  );
});

test("hex integers above 2^53 evaluate exactly from source and from a Code quote", () => {
  assert.equal(run("0x20000000000001"), "9007199254740993");
  assert.equal(run("0x20000000000001 == 0x20000000000000"), "False");
  assert.equal(quoteEval("Code` 0x20000000000001"), "9007199254740993");
});

test("Float64-exact literals round-trip through syntaxTree", () => {
  assert.equal(run("syntaxExpression(syntaxTree(0.5)) == 0.5"), "True");
  assert.equal(run("syntaxExpression(syntaxTree(0f0.1)) == 0f0.1"), "True");
  assert.notEqual(run("syntaxTree(0f0.1)"), "NumberLiteral(0)");
});

test("source Code quotes of 0.1 and 0f0.1 evaluate to the denoted Rationals", () => {
  assert.equal(quoteEval("Code` 0.1"), "0.1");
  assert.equal(quoteEval("Code` 0f0.1"), "0x1.999999999999Ap-4");
  assert.notEqual(quoteEval("Code` 0.1"), quoteEval("Code` 0f0.1"));
});

test("Float64-exact Code splice evaluates the same as the quoted literal", () => {
  const interpreter = new Interpreter();
  const quoted = single(interpreter.run("Code` 0.5"));
  const spliced = single(interpreter.run("Code$` $(0.5)"));
  assert.equal(run("(Code$` $(0.5)) == (Code` 0.5)"), "True");
  assert.ok(equal(quoted, spliced));
  assert.equal(displayResults(interpreter.evaluateCode(quoted)), "0.5");
  assert.equal(displayResults(interpreter.evaluateCode(spliced)), "0.5");
});

test("Code splice of 0.1 compares equal to the exact source quote", () => {
  assert.equal(run("(Code$` $(0.1)) == (Code` 0.1)"), "True");
});
