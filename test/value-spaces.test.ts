import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const incomparable = (source: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_INCOMPARABLE_TYPES",
  );

test("type identity excludes declaration and capture names", () => {
  assert.equal(
    run(
      "a = type :Rect(w :: Number,h :: Number)\nb = type :Rect(width :: Number,height :: Number)\na == b",
    ),
    "True",
  );
});
test("recursive identity is alpha invariant and finite", () => {
  assert.equal(
    run(
      "a =\n  def A type :Nil | :Cons(Int,A)\n  type A\nend\nb =\n  def B type :Nil | :Cons(Int,B)\n  type B\nend\na == b",
    ),
    "True",
  );
  assert.equal(
    run(
      "def A type :Nil | :Cons(Int,A)\ndef B type :Nil | :Cons(String,B)\n(type A) == (type B)",
    ),
    "False",
  );
});
test("physical labels matter but their order does not", () => {
  assert.equal(
    run("(type :R(x: Int,y: String)) == (type :R(y: String,x: Int))"),
    "True",
  );
  assert.equal(run("(type :R(x: Int)) == (type :R(y: Int))"), "False");
});
test("same syntax in different optional spaces is incomparable", () => {
  const option = "def Option(T :: Type) type :None | Some(T)\n";
  incomparable(
    option + "a = :None :: Option(Int)\nb = :None :: Option(String)\na == b",
  );
  incomparable(
    option + "a = :None :: Option(Int)\nb = :None :: Option(String)\na < b",
  );
  incomparable(
    option +
      "def Empty type :None\na = :None :: Empty\nb = :None :: Option(Int)\na == b",
  );
});
test("annotation cannot silently convert an already interpreted value", () => {
  assert.throws(
    () =>
      run(
        "def Option(T :: Type) type :None | Some(T)\nx = :None :: Option(Int)\nx :: Option(String)",
      ),
    /different concrete type/,
  );
});
test("equal types in independent scopes interoperate through local accessors", () => {
  assert.equal(
    run(
      "def produce()\n  def A type :Rect(w :: Int,h :: Int)\n  Rect(3,4) :: A\nend\na = produce()\ndef B type :Rect(width :: Int,height :: Int)\n(b :: B) = Rect(3,4)\n(a == b,width(a),height(b))",
    ),
    "(True, 3, 4)",
  );
});
test("generic arguments participate in identity even for empty containers", () => {
  incomparable(
    "def Vector(t :: Type) type [values... :: *(t)]\na = [] :: Vector(Int)\nb = [] :: Vector(String)\na == b",
  );
});
test("a subset preserves its base concrete space", () => {
  assert.equal(
    run(
      "def Option(T :: Type) type :None | Some(T)\ndef NoInt Option(Int) .where (v -> v .matches :None)\na = :None :: NoInt\nb = :None :: Option(Int)\na == b",
    ),
    "True",
  );
  assert.throws(
    () =>
      run(
        "def Option(T :: Type) type :None | Some(T)\ndef NoInt Option(Int) .where (v -> v .matches :None)\nSome(3) :: NoInt",
      ),
    /subset/,
  );
});
test("numeric spaces have explicit conversion and different arithmetic", () => {
  incomparable("x = 10 :: Number\ny = 10 :: Int\nx == y");
  assert.equal(
    run(
      "x = 10 :: (Number .where (n -> isInt64(n)))\ny = 10 :: Int\nx.toInt == y",
    ),
    "True",
  );
  assert.equal(run("x = 5 :: Int\ny = 2 :: Int\nx / y"), "2");
  assert.equal(run("x = 5 :: Number\ny = 2 :: Number\nx / y"), "2.5");
  incomparable("(1 :: Float32) == (1 :: Number)");
});
test("typed arithmetic preserves identity", () => {
  incomparable("x = 1 :: Int\ny = 2 :: Int\nz = x + y\nz == (3 :: Number)");
});
test("type-producing blocks keep recursive self references alive", () => {
  assert.equal(
    run(
      "(x :: (\n  def List(t :: Type) type :Nil | :Cons(t,List(t))\n  List(Int)\n)) = Cons(5,:Nil)\nx",
    ),
    "Cons(5, :Nil)",
  );
});
test("union ambiguity still propagates rather than choosing the first branch", () => {
  assert.throws(
    () => run("def Bad type :None | :None\n:None :: Bad"),
    /ambiguous/,
  );
});
test("aliases and recursive aliases preserve their concrete identity", () => {
  assert.equal(
    run(
      "def A type :Nil | :Cons(Int,A)\nt = type A\n(a :: A) = Cons(1,:Nil)\n(b :: t) = Cons(1,:Nil)\na == b",
    ),
    "True",
  );
  assert.equal(
    run(
      "def Option(T :: Type) type :None | Some(T)\ndef NoInt Option(Int) .where (v -> v .matches :None)\nemptyInt = type NoInt\na = :None :: emptyInt\nb = :None :: Option(Int)\na == b",
    ),
    "True",
  );
});
test("capture names erase completely and duplicate declarations fail", () => {
  assert.equal(
    run("(type :Pair(x :: Int,y :: Int)) == (type :Pair(a :: Int,b :: Int))"),
    "True",
  );
  assert.equal(
    run("(type :Pair(x :: Int,y :: Int)) == (type :Pair(Int,Int))"),
    "True",
  );
  assert.throws(
    () => run("type :Pair(x :: Int,x :: Int)"),
    /duplicate capture/,
  );
});
test("ordinary type values reject binding defaults", () => {
  assert.throws(
    () => run("a = type :R(x: Int = 1)\n0"),
    /defaults are only allowed in binding patterns/,
  );
  assert.equal(
    run("a = type :R(x: Int)\nb = type :R(x: value :: Int)\na == b"),
    "True",
  );
});
test("refinement failures and arithmetic mismatches report errors", () => {
  assert.throws(
    () => run("10.5 :: (Number .where (n -> isInt64(n)))"),
    /subset/,
  );
  incomparable("(1 :: Number) + (2 :: Int)");
  assert.equal(run("(1 :: Number) .matches (type Int)"), "False");
});
test("a failed refinement does not suppress a different union alternative", () => {
  assert.equal(
    run(
      "def Small (type Int) .where (x -> x < (5 :: Int))\ndef Choice type Small | :Other\n:Other :: Choice",
    ),
    ":Other",
  );
  assert.throws(
    () =>
      run(
        "def Small (type Int) .where (x -> x < (5 :: Int))\ndef Large (type Int) .where (x -> x >= (5 :: Int))\ndef Choice UnionType(type Small,type Large)\n9 :: Choice",
      ),
    /same concrete space/,
  );
  assert.equal(
    run(
      "def Choice UnionType(type Int,type String)\n(x :: Choice) = (9 :: Int)\nx",
    ),
    "9",
  );
});
