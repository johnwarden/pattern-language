import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

test("definition bodies evaluate normally and TitleCase results must be types", () => {
  assert.equal(run("def r :(Rect(Float))\nr"), "Rect(Float)");
  for (const body of [":(Rect(Float))", "Rect(Float)", "3"])
    assert.throws(
      () => run("def R " + body + "\n0"),
      (error: unknown) => {
        assert(error instanceof LanguageError);
        assert.equal(error.diagnostic.code, "E_EXPECTED_TYPE");
        assert.match(
          error.message,
          /TitleCase definition R must return a type/,
        );
        return true;
      },
    );
  assert.equal(run("def R type :Rect(Float)\ntype R"), "Struct(Rect(Float64))");
  assert.equal(
    run("def make() type :Rect(Float)\ndef R make()\nRect(3) :: R"),
    "Rect(3)",
  );
  assert.equal(run("def make() :(Rect(Float))\ndef r make()\nr"), "Rect(Float)");
});

test("named type declarations retain generated local accessors", () => {
  assert.equal(
    run(
      "def R type :Rect(width :: Float)\nr = Rect(3) :: R\n(r.width,width(r))",
    ),
    "(3, 3)",
  );
  assert.equal(
    run(
      "def Positive where(type :P(n :: Int))(P(n) -> n > (0 :: Int))\np = P(3) :: Positive\np.n",
    ),
    "3",
  );
  assert.equal(
    run("def R type :Rect(w :: Float)\nr = Rect(3) :: R\nr.w"),
    "3",
  );
});

test("named nested types own their accessors; constructor subpatterns share the enclosing scope", () => {
  assert.equal(
    run(
      "def Left type :Left(x :: Int)\ndef Right type :Right(x :: Int)\ndef Outer type :Outer(Left,Right)\nr = Outer(Left(2),Right(3)) :: Outer\nOuter(left,right) = r\n(left.x,x(right))",
    ),
    "(2, 3)",
  );
  assert.equal(
    run(
      "def Inner type :Inner(x :: Int)\ndef Outer type :Outer(x :: Int,inner :: Inner)\nr = Outer(1,Inner(2)) :: Outer\n(r.x,r.inner.x)",
    ),
    "(1, 2)",
  );
  assert.equal(
    run(
      "def Outer type :Outer(:Middle(:Leaf(n :: Int)))\nr = Outer(Middle(Leaf(7))) :: Outer\nr.n",
    ),
    "7",
  );
  assert.throws(
    () => run("Outer(Left(x),Right(x)) = Outer(Left(2),Right(3))\nx"),
    /duplicate capture/,
  );
  assert.throws(
    () => run("type :Rect(x :: Int,x :: Int)"),
    /duplicate capture/,
  );
});

test("registered syntax types keep nested accessor scopes private to their types", () => {
  assert.equal(
    run(
      "def Left type :Left(x :: Int)\ndef Right type :Right(x :: Int)\ndef Outer type :Outer(Left,Right)\nmacro :get r :: Outer Code` 1\nget Outer(Left(2),Right(3))",
    ),
    "1",
  );
});

test("generic type specialization exports deep accessors without duplicate methods", () => {
  assert.equal(
    run(
      "def Inner(t :: Type) type :Inner(x :: t)\ndef Outer(t :: Type) type :Outer(inner :: Inner(t))\na = Outer(Inner(2)) :: Outer(Int)\nb = Outer(Inner(3)) :: Outer(Int)\n(a.inner.x,b.inner.x)",
    ),
    "(2, 3)",
  );
  assert.equal(
    run("def V(t :: Type) type :V(x :: t)\nv = V(3) :: V(Int)\nv.x"),
    "3",
  );
});

test("repeated parameter interpretation reuses its local accessor definitions", () => {
  assert.equal(
    run(
      "def Rect type :Rect(w :: Float,h :: Float)\ndef get(r :: Rect) r.w\n(get(Rect(1,2)),get(Rect(3,4)))",
    ),
    "(1, 3)",
  );
});

test("nested type accessor declarations do not leak from function-local evaluation", () => {
  assert.throws(
    () =>
      run(
        "def build()\n  def R type :R(:Leaf(hidden :: Int))\n  R(Leaf(3)) :: R\nend\nr = build()\nR(leaf) = r\nleaf.hidden",
      ),
    /unbound name/,
  );
});

test("named declarations install accessors independently of cached unions", () => {
  assert.equal(
    run(
      "a = UnionType(type :R(Int))\ndef R type :R(y :: Int)\ndef B UnionType(type R)\nr = R(3) :: R\nr.y",
    ),
    "3",
  );
});
