import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { equal, single, unwrap, valLiteral } from "../src/values.ts";
import { term } from "../src/type-data.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const transfer = (text: string) => {
  const other = new Interpreter();
  other.env.bindings.set("text", valLiteral(text));
  return other;
};

test("type values construct, destructure, and rebuild using ordinary patterns", () => {
  assert.equal(
    run(
      "def Rectangle type :Rect(w :: Float,h :: Float)\nt = Struct(Rect(Float64,Float64))\nStruct(p) = t\n(Struct(p) == t,t == (type Rectangle))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("def R Struct(Rect(Float64,Float64))\nRect(3,4) :: R"),
    "Rect(3, 4)",
  );
  assert.equal(
    run(
      "def shape(Struct(Rect(w,h))) Struct(Rect(h,w))\nshape(type :Rect(Int,String)) == (type :Rect(String,Int))",
    ),
    "True",
  );
  assert.equal(
    run(
      "t = type :Rect(Int,String)\nmatch t\n  Struct(Rect(a,b)) -> Struct(Rect(b,a))\nend",
    ),
    "Struct(Rect(String, Int64))",
  );
});

test("equal structural types have equal global text across names and capture names", () => {
  assert.equal(
    run(
      "def left()\n  def A type :Rect(w :: Float,h :: Float)\n  type A\nend\ndef right()\n  def B type :Rect(x :: Float,y :: Float)\n  type B\nend\ntoString(Type)(left()) == toString(Type)(right())",
    ),
    "True",
  );
  assert.equal(
    run(
      "toString(Type)(type :R(z: Int,a: String)) == toString(Type)(type :R(a: String,z: Int))",
    ),
    "True",
  );
});

test("global text does not depend on names; local aliases resolve in the caller scope", () => {
  assert.equal(
    run(
      "def Rectangle type :Rect(Float,Float)\nt = type Rectangle\n(toStringLocal(Type)(t),parseLocal(Type)(toStringLocal(Type)(t)) == t)",
    ),
    '("Rectangle", True)',
  );
  const source =
    "def Rectangle type :Rect(Float,Float)\nt = type Rectangle\ndef f()\n  def Rectangle type :Other\n  (toStringLocal(Type)(t),parseLocal(Type)(toStringLocal(Type)(t)) == t)\nend\nf()";
  assert.equal(run(source), '("Struct(Rect(Float64, Float64))", True)');
  assert.equal(
    run(
      'def Rectangle type :Rect(Float,Float)\nparseLocal(Symbol)("Rectangle")',
    ),
    "Rectangle",
  );
});

test("an exact local alias prints a whole refinement without transporting its predicate", () => {
  const source =
    "type Rectangle concrete Rect(width :: Int, height :: Int)\n" +
    "square = Rectangle .where (s -> width(s) == height(s))\n" +
    "(toStringLocal(Type)(square),toStringLocal(Type)(parseLocal(Type)(toStringLocal(Type)(square))))";
  assert.equal(run(source), '("square", "square")');
  assert.throws(
    () =>
      run(
        source.replace("toStringLocal(Type)(square)", "toString(Type)(square)"),
      ),
    /portable predicate description/,
  );
});

test("local refinement aliases resolve the identical value and stop after shadowing", () => {
  const i = new Interpreter();
  const original = i.run(
    "type Rectangle concrete Rect(width :: Int, height :: Int)\n" +
      "square = Rectangle .where (s -> width(s) == height(s))\n" +
      "square",
  )[0].value;
  assert.equal(i.inspect([{ label: "_1", value: original }]), "square :: Type");
  assert.strictEqual(
    unwrap(i.run('parseLocal(Type)("square")')[0].value),
    original,
  );
  i.env.bindings.set("square", i.run("Int")[0].value);
  assert.throws(
    () => i.inspect([{ label: "_1", value: original }]),
    /portable predicate description/,
  );
});

test("local inspection keeps nested type values structural in raw data", () => {
  const i = new Interpreter();
  i.run("type Rectangle concrete Rect(width :: Int)\nRectangle");
  const rectangle = single(i.run("Rectangle"));
  const value = term("Box", rectangle);
  assert.equal(
    i.inspect([{ label: "_1", value }]),
    "Box(Struct(Rect(Int64))) :: Expression",
  );
  const restored = single(
    i.run('parseLocal(Expression)("Box(Struct(Rect(Int64)))")'),
  );
  assert.equal(equal(restored, value), true);
});

test("primitive atoms are ordinary self-evaluating type values", () => {
  assert.equal(
    run("(Int,Float,Bool,Int == (type Int))"),
    "(Int64, Float64, Bool, True)",
  );
  assert.equal(run("def accept(t :: Type) t\naccept(String)"), "String");
  assert.throws(() => run("Imaginary"), /unbound name/);
  assert.throws(() => run("5 :: Bool"), /expected Bool/);
});

test("explicit Type wrappers and primitive atoms have different value trees", () => {
  assert.equal(
    run("(Struct(Int) == Int,Struct(Struct(Int)) == Struct(Int))"),
    "(False, True)",
  );
  assert.equal(
    run("(Struct(Float) == (type Float),Float == Struct(Float))"),
    "(False, False)",
  );
});

test("primitive text is independent of lexical primitive bindings", () => {
  const i = new Interpreter();
  i.env.bindings.delete("Int64");
  assert.equal(
    displayResults(i.run("parse(Type)(toString(Type)(Int64)) == (type Int64)")),
    "True",
  );
  assert.throws(
    () => run("def Int64 type :Other\n0"),
    /primitive type names are reserved/,
  );
});

test("referenced types remain nested values in unions and constructor fields", () => {
  const source =
    "def Circle type :Circle(Float)\ndef Square type :Square(Float)\nshape = UnionType(type Circle,type Square)\n";
  assert.equal(
    run(source + "shape"),
    "UnionType(Struct(Circle(Float64)), Struct(Square(Float64)))",
  );
  assert.equal(
    run(source + "parse(Type)(toString(Type)(shape)) == shape"),
    "True",
  );
  assert.equal(
    run(
      source +
        "UnionType(a,b) = shape\n(Struct(a) == (type Circle),Struct(b) == (type Square))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("def Circle type :Circle(Float)\ntype :Box(Circle)"),
    "Struct(Box(Struct(Circle(Float64))))",
  );
  assert.equal(
    run(source + "shape == (type :Circle(Float) | :Square(Float))"),
    "False",
  );
});

test("root aliases collapse while nested aliases preserve one type boundary", () => {
  assert.equal(
    run(
      "def A type :Point(x :: Int)\nb = type A\n(type :Box(A)) == (type :Box(b))",
    ),
    "True",
  );
  assert.equal(
    run(
      "boxA =\n  def A type :Point(x :: Int)\n  type :Box(A)\nend\nboxC =\n  def C type :Point(y :: Int)\n  type :Box(C)\nend\ntoString(Type)(boxA) == toString(Type)(boxC)",
    ),
    "True",
  );
  for (const text of [
    "Struct(Struct(Fields(Int)))",
    "Struct(Recursive(Repeat(Int)))",
  ])
    assert.throws(
      () => transfer(text).run("parse(Type)(text)"),
      /invalid type-description shape/,
    );
});

test("parse never calls functions, executes bindings, or evaluates interpolation", () => {
  assert.equal(
    run('def explode(x) 1 / 0\nparse(Expression)("explode(1)")'),
    "explode(1)",
  );
  for (const text of ['$"$missing"', '$"$(1 / 0)"', "def f(x) x", "x = 1\nx"]) {
    const i = transfer(text);
    assert.throws(() => i.run("parse(Expression)(text)"), LanguageError);
  }
  assert.throws(() => run('parse(Int)("hello")'), /expected/);
  assert.throws(() => run("Struct(Recur(0))"), /outside its binder/);
});

test("unsupported predicate environments fail explicitly", () => {
  for (const source of ["toString(Type)((type Int) .where (n -> n < 5))"])
    assert.throws(
      () => run(source),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_TYPE_SERIALIZATION",
    );
  assert.throws(
    () => run("toString(Expression)(x -> x)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_VALUE_SERIALIZATION",
  );
});

test("capture names do not create constraints across mutually exclusive alternatives", () => {
  assert.equal(
    run(
      "t =\n  def T type :A(x :: Int) | :B(x :: Int)\n  type T\nend\nt == (type :A(Int) | :B(Int))",
    ),
    "True",
  );
});

