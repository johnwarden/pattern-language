import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { float64ToRational, rationalToNumber } from "../src/rational.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));

test("NumericValue-to-binary64 conversion keeps the smallest subnormal and small normals", () => {
  const minSub = Number.MIN_VALUE;
  const smallNormal = 2 ** -1022;
  assert.equal(rationalToNumber(float64ToRational(minSub)), minSub);
  assert.equal(rationalToNumber(float64ToRational(smallNormal)), smallNormal);
  assert.equal(rationalToNumber(float64ToRational(0.1)), 0.1);
});

test("numeric syntax encoding keeps the exact Float64-rounded NumericValue", () => {
  const setup = "NumberLiteral(n) = syntaxTree(0f0.1)\n";
  assert.equal(run(setup + "n == 0x1.999999999999Ap-4"), "True");
  assert.equal(run(setup + "n != 0.1"), "True");
});

test("numeric syntax payloads preserve large integers and unary-minus structure", () => {
  const setup =
    "large = syntaxTree(9007199254740993)\n" +
    "NumberLiteral(n) = large\n" +
    "NumberLiteral(negative) = NumberLiteral(0 - 0.1)\n" +
    'Apply(Name("-", False), [Field("_1", NumberLiteral(magnitude))]) = syntaxTree(:(-(0.1)))\n';
  assert.equal(run(setup + "n == 9007199254740993"), "True");
  assert.equal(run(setup + "large != syntaxTree(9007199254740992)"), "True");
  assert.equal(run(setup + "negative == (0 - 0.1)"), "True");
  assert.equal(run(setup + "magnitude == 0.1"), "True");
  assert.equal(
    run("syntaxTree(9007199254740993)"),
    "NumberLiteral(9007199254740993)",
  );
});

test("nonterminating Rationals retain their exact numeric syntax payload", () => {
  assert.equal(
    run("NumberLiteral(n) = NumberLiteral((1 / 3) * 1)\n(n * 3) == 1"),
    "True",
  );
});

test("a complex NumberLiteral transports both exact coefficients", () => {
  assert.equal(
    run('NumberLiteral(n) = syntaxTree(:(-1.25+0.5i))\n(n == (-1.25+0.5i))'),
    "True",
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
