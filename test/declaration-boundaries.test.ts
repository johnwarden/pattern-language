import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (error: unknown) =>
      error instanceof LanguageError && error.diagnostic.code === code,
  );
const picture =
  "def Picture type :Picture(color: (type :Red | :Black),shape: Rectangle(w :: Float,h :: Float))\np = Picture(color: :Red,shape: Rectangle(3,4)) :: Picture\n";

test("constructor subpatterns expose captures on Picture, not on a synthetic shape type", () => {
  assert.equal(run(picture + "(p.color,p.w,h(p))"), "(Red, 3, 4)");
  rejects(picture + "p.shape", "E_UNBOUND_NAME");
  assert.equal(
    run(picture + "Picture(shape: Rectangle(a,b),**) = p\n(a,b)"),
    "(3, 4)",
  );
  assert.equal(
    run(picture + "type Picture"),
    "Type(Picture(color: Type(:Black | :Red), shape: Rectangle(Float, Float)))",
  );
});

test("a named nested type supplies a typed field and owns its own accessors", () => {
  assert.equal(
    run(`def Rectangle type :Rectangle(w :: Float,h :: Float)
def Picture type :Picture(shape: Rectangle)
p = Picture(shape: Rectangle(3,4)) :: Picture
(p.shape.w,p.shape.h)`),
    "(3, 4)",
  );
});

test("captures cannot cross an inline type boundary, but may be deeply nested patterns", () => {
  for (const field of [
    "inner: (type :Inner(x :: Int))",
    "inner: (type :Inner(x: Int))",
  ])
    rejects(
      "def Outer type :Outer(" + field + ")\n0",
      "E_NESTED_TYPE_DECLARATION",
    );
  assert.equal(
    run(
      "def Outer type :Outer(:Middle(:Leaf(n :: Int)))\no = Outer(Middle(Leaf(7))) :: Outer\no.n",
    ),
    "7",
  );
  rejects(
    "type :Outer(:Left(x :: Int),:Right(x :: Int))",
    "E_DUPLICATE_CAPTURE",
  );
});

test("labeled structural patterns introduce only their own captures in every binding context", () => {
  assert.equal(run("(shape: Rect(w,h)) = (shape: Rect(3,4))\n(w,h)"), "(3, 4)");
  assert.equal(run("def f(shape: Rect(w,h)) w + h\nf(shape: Rect(3,4))"), "7");
  assert.equal(
    run("match Box(shape: Rect(3,4))\n  Box(shape: Rect(w,h)) -> w + h\nend"),
    "7",
  );
  rejects("(shape: Rect(w,h)) = (shape: Rect(3,4))\nshape", "E_UNBOUND_NAME");
  assert.equal(
    run("(color: (type :Red | :Black)) = (color: :Red)\ncolor"),
    "Red",
  );
});

test("match arms are ordered pattern-expression pairs and never evaluated as function values", () => {
  assert.equal(run('match 0\n  0 -> "zero"\n  _ -> "other"\nend'), '"zero"');
  assert.equal(run('match 0\n  _ -> "first"\n  0 -> missing\nend'), '"first"');
  assert.throws(() => run("arm = x -> x\nmatch 3\n  arm\nend"), /arm|grammar/);
  rejects(
    "def positive(n :: Int) n > 0\np = positive\np",
    "E_FUNCTION_NOT_VALUE",
  );
});

test("equal declarations are rejected across visible scopes even when captures agree", () => {
  rejects(
    "def A type :R(x: Int)\ndef B type :R(x: Int)\n0",
    "E_DUPLICATE_TYPE",
  );
  rejects(
    "def A type :R(x :: Int)\ndef f()\n  def B type :R(y :: Int)\n  0\nend\nf()",
    "E_DUPLICATE_TYPE",
  );
  rejects("def Alias type Int\n0", "E_DUPLICATE_TYPE");
  assert.equal(
    run(
      "def V(t :: Type) type :V(x :: t)\na = V(1) :: V(Int)\nb = V(2) :: V(Int)\n(a.x,b.x)",
    ),
    "(1, 2)",
  );
});

test("plain type construction cannot declare captures or install accessors", () => {
  rejects("t = type :R(x :: Int)\n0", "E_PLAIN_TYPE_CAPTURE");
  rejects("t = type :R(x: Int)\n(r :: t) = R(x: 3)\nr.x", "E_UNBOUND_NAME");
  rejects("def make() type :R(x :: Int)\nmake()", "E_PLAIN_TYPE_CAPTURE");
  rejects(
    "def make() type :R(x: Int)\ndef R make()\nr = R(x: 3) :: R\nr.x",
    "E_UNBOUND_NAME",
  );
  assert.throws(
    () => run("def make() type :R(x: Int)\ndef R make()\nR() :: R"),
    /missing required/,
  );
  assert.equal(run("def R type :R(x: Int)\nr = R(x: 1) :: R\nr.x"), "1");
});

test("abstract positions require a concrete interpretation without guessing a visible type", () => {
  rejects("(x :: Any) = Rect(3,4)\nx", "E_CONCRETE_TYPE_REQUIRED");
  assert.equal(
    run("def U UnionType(type Int,type String)\n(x :: U) = 3\nx"),
    "3",
  );
  assert.equal(
    run("def U UnionType(type Int,type String)\n(x :: U) = 3 :: Int\nx"),
    "3",
  );
  rejects("(xs :: Any) = []\nxs", "E_CONCRETE_TYPE_REQUIRED");
});

test("type construction sorts alternatives without redefining ordinary tree equality", () => {
  assert.equal(
    run(
      "a = type :C | :A | :B\nb = type :B | :C | :A\n(a == b,toString(Type)(a) == toString(Type)(b),parse(Type)(toString(Type)(a)) == a)",
    ),
    "(True, True, True)",
  );
  assert.equal(run("Type(:(B | A)) == (type :A | :B)"), "True");
  assert.equal(run(":(A | B) == :(B | A)"), "False");
  assert.equal(run("def Bad type :A | :A\nBad == (type :A)"), "True");
  assert.equal(run("t = type :A | :A\nt == (type :A)"), "True");
  assert.equal(run("type :A | :B | :A"), "Type(:A | :B)");
  assert.equal(run(":None .matches (type :None | :None)"), "True");
});

test("failed submissions roll back generic declaration products", () => {
  const interpreter = new Interpreter();
  interpreter.run("def V(t :: Type) type :V(x :: t)", "repl");
  assert.throws(
    () => interpreter.run("v = V(1) :: V(Int)\nmissing"),
    /unbound name/,
  );
  assert.equal(displayResults(interpreter.run("v = V(2) :: V(Int)\nv.x")), "2");
});

test("nested constructor patterns retain accessors without completing fields", () => {
  assert.equal(
    run(
      "def Outer type :Outer(:Middle(color: Int))\no = Outer(Middle(color: 4)) :: Outer\n(o,o.color)",
    ),
    "(Outer(Middle(color: 4)), 4)",
  );
});

test("match arms and anonymous functions preserve a single labeled result", () => {
  const interpreter = new Interpreter();
  const arm = interpreter.run("match 3\n  x -> (answer: x)\nend");
  assert.equal(arm[0].label, "answer");
  assert.equal(displayResults(arm), "3");
  const lambda = interpreter.run("f = x -> (answer: x)\nf(3)");
  assert.equal(lambda[0].label, "answer");
  assert.equal(displayResults(lambda), "3");
});
