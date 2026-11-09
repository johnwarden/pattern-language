import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));

test("compiled types compare as their ordinary value trees, including nested values", () => {
  assert.equal(
    run("a = Type(Rect(Int))\nb = :(Type(Rect(Int)))\n[a] == [b]"),
    "True",
  );
});

test("equal trees have equal global text regardless of compiled caches", () => {
  for (const expression of [
    "Type(Rect(Float))",
    "UnionType(Int,String)",
  ]) {
    assert.equal(
      run(
        "b = :(" +
          expression +
          ")\nparse(Expression)(toString(Expression)(b)) == b",
      ),
      "True",
    );
  }
  assert.throws(
    () => run("b = :Int\nparse(Expression)(toString(Expression)(b)) == b"),
    /quoted Int is not a symbol/,
  );
});

test("ordinary type trees work in type positions without a preexisting matcher", () => {
  assert.equal(run("t = Int\nr = t .where (n -> n > (0 :: Int))\n1 :: r"), "1");
});
