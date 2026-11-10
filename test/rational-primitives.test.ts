import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import {
  float64ToRational,
  formatRational,
  parseNumericSpelling,
  rationalToNumber,
  reduceRational,
} from "../src/rational.ts";

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

test("numeric syntax payloads preserve large integers and unary-minus structure", () => {
  const setup =
    "large = syntaxTree(9007199254740993)\n" +
    "NumberLiteral(n) = large\n" +
    "NumberLiteral(negative) = NumberLiteral(0 - 0.1)\n" +
    'Apply(Name("-", False), [Field("_1", NumberLiteral(magnitude))]) = syntaxTree(:(-0.1))\n';
  assert.equal(run(setup + "n == 9007199254740993"), "True");
  assert.equal(run(setup + "large != syntaxTree(9007199254740992)"), "True");
  assert.equal(run(setup + "negative == 0 - 0.1"), "True");
  assert.equal(run(setup + "magnitude == 0.1"), "True");
  assert.equal(
    run("syntaxTree(9007199254740993)"),
    "NumberLiteral(9007199254740993)",
  );
});

test("non-terminating Rationals print as reduced fraction literals", () => {
  assert.equal(
    run("NumberLiteral(n) = NumberLiteral((1 / 3) * 1)\n(n * 3) == 1"),
    "True",
  );
  assert.equal(run("1 / 3"), "1/3");
  assert.equal(run("1/3"), "1/3");
  assert.equal(run("toString(Rational)(1 / 3)"), '"1/3"');
  assert.equal(run("syntaxTree(1/3)"), "NumberLiteral(1/3)");
  assert.deepEqual(parseNumericSpelling("1/3"), { n: 1n, d: 3n });
  assert.deepEqual(parseNumericSpelling("2/4"), { n: 1n, d: 2n });
  assert.equal(parseNumericSpelling("1/0"), undefined);
  assert.equal(formatRational(reduceRational(1n, 3n)), "1/3");
  assert.equal(formatRational(reduceRational(-2n, 6n)), "-1/3");
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
