import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { float64ToRational, rationalToNumber } from "../src/rational.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));

test("Rational-to-binary64 conversion keeps the smallest subnormal and small normals", () => {
  const minSub = Number.MIN_VALUE;
  const smallNormal = 2 ** -1022;
  assert.equal(rationalToNumber(float64ToRational(minSub)), minSub);
  assert.equal(rationalToNumber(float64ToRational(smallNormal)), smallNormal);
  assert.equal(rationalToNumber(float64ToRational(0.1)), 0.1);
});

test("hex Rational syntax encoding keeps the exact Float64-rounded Rational", () => {
  assert.notEqual(run("syntaxTree(0f0.1)"), "NumberLiteral(0)");
  assert.equal(run("syntaxTree(0f0.1)"), "NumberLiteral(0x1.999999999999Ap-4)");
});

test("unspellable 1/3 is an exact serialization failure", () => {
  assert.throws(
    () => run("1 / 3"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_VALUE_SERIALIZATION",
  );
});

test("0.5 :: Int remains a generic mismatch until D07 integer designation", () => {
  assert.throws(
    () => run("0.5 :: Int"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_PATTERN_MISMATCH" &&
      /expected Int/.test(e.message),
  );
});
