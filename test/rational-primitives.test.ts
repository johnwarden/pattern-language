import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));

test("Float32 membership is exact representability, not finite-after-fround", () => {
  assert.equal(run("0.5 .matches Float32"), "True");
  assert.equal(run("0.1 .matches Float32"), "False");
  assert.equal(run("0.5 .matches Float"), "True");
  assert.equal(run("0.1 .matches Float"), "False");
  assert.equal(run("0f0.1 .matches Float"), "True");
  assert.equal(run("0.5 :: Float"), "0.5");
});

test("hex Rational syntax encoding keeps the exact Float64-rounded Rational", () => {
  assert.notEqual(run("syntaxTree(0f0.1)"), "NumberLiteral(0)");
  assert.equal(run("syntaxTree(0f0.1)"), "NumberLiteral(0x1.999999999999Ap-4)");
});

test("non-dyadic Rationals stay exact internally without a ratified spelling", () => {
  assert.equal(run("((1 / 3) * 3) == 1"), "True");
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
