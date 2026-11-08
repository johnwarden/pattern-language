import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));

test("compiled types compare as their ordinary value trees, including nested values", () => {
  assert.equal(
    run(
      "a = Type(Rect(Int))\nb = :(Type(Rect(Int)))\n(a == b,[a] == [b],Type(10) < Type(2))",
    ),
    "(True, True, False)",
  );
  assert.equal(run("Int == :Int"), "True");
  assert.equal(
    run("UnionType(Int,String) == :(UnionType(Int,String))"),
    "True",
  );
  assert.equal(run("Type(Int) == Int"), "False");
});

test("equal trees have equal global text regardless of compiled caches", () => {
  for (const expression of [
    "Int",
    "Type(Rect(Float))",
    "UnionType(Int,String)",
  ]) {
    assert.equal(
      run(
        "a = " +
          expression +
          "\nb = :" +
          expression +
          "\n(a == b,toString(Expression)(a) == toString(Expression)(b),parse(Expression)(toString(Expression)(b)) == b)",
      ),
      "(True, True, True)",
    );
  }
  assert.equal(
    run("b = :Int\nparse(Expression)(toString(Expression)(b)) == b"),
    "True",
  );
});

test("ordinary type trees work in type positions without a preexisting matcher", () => {
  assert.equal(
    run(
      "t = :Int\n(x :: t) = 3\n(t .matches (type Type),x .matches t,parse(t)(toString(t)(x)) == x)",
    ),
    "(True, True, True)",
  );
  assert.equal(
    run("def factory() :(Type(Rect(Int)))\ndef R factory()\nRect(3) :: R"),
    "Rect(3)",
  );
  assert.equal(run("t = :Int\nr = t .where (n -> n > (0 :: Int))\n1 :: r"), "1");
  assert.equal(run("def accept(t :: Type) 1 .matches t\naccept(:Int)"), "True");
  assert.equal(
    run(
      "def L(t :: Type) type :Nil | :Cons(t,L(t))\nt = :Int\nCons(1,:Nil) :: L(t)",
    ),
    "Cons(1, Nil)",
  );
});

test("invalid type-shaped data is not compiled or silently normalized by matching", () => {
  assert.equal(
    run("(:(Primitive(Bogus)) .matches (type Type),:Int .matches (type Type))"),
    "(False, True)",
  );
  assert.equal(
    run(
      "x = :(UnionType(1,2))\nparse(Expression)(toString(Expression)(x)) == x",
    ),
    "True",
  );
});
