import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));
const inspect = (s: string) => {
  const i = new Interpreter();
  return i.inspect(i.run(s));
};

test("float64 converter returns Float64 identity without using syntax adapters", () => {
  assert.equal(inspect("float64(0.5)"), "0.5 :: Float64");
  assert.equal(inspect("float32(0.5)"), "0.5 :: Float32");
  assert.throws(
    () => run("float32(0.5) == float64(0.5)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_INCOMPARABLE_TYPES",
  );
});

test("C13 overlap policy: UnionType keeps Float32 versus Float64 members", () => {
  const prelude =
    "def EitherFloat UnionType(type Float32, type Float64)\n(a :: EitherFloat) = float32(0.5)\n(b :: EitherFloat) = float64(0.5)\n";
  assert.equal(inspect(prelude + "a"), "0.5 :: Float32");
  assert.equal(inspect(prelude + "b"), "0.5 :: Float64");
  assert.equal(run(prelude + "a == b"), "False");
  assert.equal(
    run(prelude + "text = toString(EitherFloat)(a)\nparse(EitherFloat)(text) == a"),
    "True",
  );
  assert.match(run(prelude + "toString(EitherFloat)(a)"), /Float32/);
  assert.throws(
    () => run("def U UnionType(type Float32, type Float64)\n(x :: U) = 0.5"),
    /ambiguous/,
  );
});

test("UnionType type text distinguishes Float64 from Float", () => {
  assert.equal(
    run("toString(Type)(UnionType(Float32, Float64))"),
    '"UnionType(Float32, Float64)"',
  );
  assert.equal(
    run(
      "t = UnionType(Float32, Float64)\nparse(Type)(toString(Type)(t)) == t",
    ),
    "True",
  );
});
