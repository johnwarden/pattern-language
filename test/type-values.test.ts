import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { single, unwrap, valLiteral, valSymbol } from "../src/values.ts";
import { term } from "../src/type-data.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const stringResult = (i: Interpreter, s: string) => {
  const v = unwrap(single(i.run(s)));
  assert.equal(v.kind, "literal");
  if (v.kind !== "literal" || typeof v.value !== "string")
    throw Error("expected text");
  return v.value;
};
const transfer = (text: string) => {
  const other = new Interpreter();
  other.env.bindings.set("text", valLiteral(text));
  return other;
};

test("type values construct, destructure, and rebuild using ordinary patterns", () => {
  assert.equal(
    run(
      "def Rectangle type :Rect(w :: Number,h :: Number)\nt = Type(Rect(Float,Float))\nType(p) = t\n(Type(p) == t,t == (type Rectangle))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("def R Type(Rect(Float,Float))\nRect(3,4) :: R"),
    "Rect(3, 4)",
  );
  assert.equal(
    run(
      "def shape(Type(Rect(w,h))) Type(Rect(h,w))\nshape(type :Rect(Int,String)) == (type :Rect(String,Int))",
    ),
    "True",
  );
  assert.equal(
    run(
      "t = type :Rect(Int,String)\nmatch t\n  Type(Rect(a,b)) -> Type(Rect(b,a))\nend",
    ),
    "Type(Rect(String, Int))",
  );
});

test("equal structural types have equal global text across names and capture names", () => {
  assert.equal(
    run(
      "def left()\n  def A type :Rect(w :: Number,h :: Number)\n  type A\nend\ndef right()\n  def B type :Rect(x :: Number,y :: Number)\n  type B\nend\ntoString(Type)(left()) == toString(Type)(right())",
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

test("recursive and parameterized types travel to a fresh interpreter as finite data", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def List(t :: Type) type :Nil | :Cons(t,List(t))\ntoString(Type)(type List(Int))",
  );
  assert.equal(text, "Type(Recursive(:Nil | Cons(Int, Recur(0))))");
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = Cons(5,:Nil)\nparse(t)(toString(t)(x)) == x",
      ),
    ),
    "True",
  );
  assert.equal(stringResult(j, "toString(Type)(t)"), text);
  assert.equal(
    displayResults(
      i.run("a = type List(Int)\nparse(Type)(toString(Type)(a)) == a"),
    ),
    "True",
  );
});

test("postfix type descriptions round-trip inhabitants across interpreters", () => {
  const i = new Interpreter();
  const text = stringResult(i, "def T type (Int)@\ntoString(Type)(T)");
  assert.equal(text, "Type(Postfix(:@, Int))");
  assert.equal(
    displayResults(
      i.run(
        "t = parse(Type)(toString(Type)(T))\n(T == t, 1@ .matches T, 1@ .matches t, Postfix(:@, 1) .matches t)",
      ),
    ),
    "(True, True, True, False)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = 1@\n(1@ .matches t, Postfix(:@, 1) .matches t, parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, False, True)",
  );
  assert.throws(
    () => j.run("t = parse(Type)(text)\nPostfix(:@, 1) :: t"),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_PATTERN_MISMATCH",
  );
  assert.equal(stringResult(j, "toString(Type)(t)"), text);
});

test("postfix values can be type-factory arguments", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def Box(x) type :Box(x)\ntoString(Type)(Box(1@))",
  );
  assert.equal(text, "Type(Box(Postfix(:@, 1)))");
  assert.equal(
    displayResults(
      i.run(
        "t = Box(1@)\n(t == parse(Type)(toString(Type)(t)), :Box(1@) .matches t, :Box(Postfix(:@, 1)) .matches t)",
      ),
    ),
    "(True, True, False)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = :Box(1@)\n(:Box(1@) .matches t, :Box(Postfix(:@, 1)) .matches t, parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, False, True)",
  );
});

test("primitive, union, list, labeled and capture-free type descriptions round trip", () => {
  for (const pattern of [
    "Int",
    "Float32",
    "Number",
    "String",
    "Symbol",
    "Any",
    "Type",
    "Bool",
    ":None | :Some(Int)",
    "[_... :: Int*]",
    ":Pair(x :: Int,y :: Int)",
    ":Triple(a :: Int,b :: Int,c :: Int)",
    ":R(a: Int,z: String)",
    "[rest... :: Int*]",
    ":(Recursive(Int))",
    ":Literal(Int)",
    ":Float64(Int)",
    ":Float",
    ":(Type(Int))",
  ]) {
    assert.equal(
      run(`t = type (${pattern})
parse(Type)(toString(Type)(t)) == t`),
      "True",
      pattern,
    );
  }
});

test("typed value round trips retain nested concrete spaces and canonical labels", () => {
  assert.equal(
    run(
      "def Rect type :Rect(w :: Number,h :: Number)\nx = Rect(3,4) :: Rect\nparse(Rect)(toString(Rect)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "def Box type :Box(value: Int,extra: Int)\nx = Box(extra: 9,value: 3) :: Box\nparse(Box)(toString(Box)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "x = [1 :: Float32,2 :: Int]\nparse(Expression)(toString(Expression)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "(x :: Any) = (1 :: Float32)\ny = parse(Any)(toString(Any)(x))\n(y == x,y .matches (type Float32))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("x = negate(5 :: Int)\nparse(Int)(toString(Int)(x)) == x"),
    "True",
  );
});

test("global text does not depend on names; local aliases resolve in the caller scope", () => {
  assert.equal(
    run(
      "def Rectangle type :Rect(Number,Number)\nt = type Rectangle\n(toStringLocal(Type)(t),parseLocal(Type)(toStringLocal(Type)(t)) == t)",
    ),
    '("Rectangle", True)',
  );
  const source =
    "def Rectangle type :Rect(Number,Number)\nt = type Rectangle\ndef f()\n  def Rectangle type :Other\n  (toStringLocal(Type)(t),parseLocal(Type)(toStringLocal(Type)(t)) == t)\nend\nf()";
  assert.equal(run(source), '("Type(Rect(Float, Float))", True)');
  assert.equal(
    run(
      'def Rectangle type :Rect(Number,Number)\nparseLocal(Symbol)("Rectangle")',
    ),
    "Rectangle",
  );
});

test("every Unicode-scalar string shape has lossless text without evaluating interpolation", () => {
  for (const text of [
    "",
    "hello",
    "$name $(1 / 0)",
    "both \" and '",
    "\n",
    "\r\n",
    "\n hello\n",
    "  all indented\n  twice",
    "x\nend\ny",
    "a\\n",
    "😀",
  ]) {
    const i = new Interpreter();
    i.env.bindings.set("value", valLiteral(text));
    const encoded = stringResult(i, "toString(String)(value)");
    const j = transfer(encoded);
    assert.equal(
      stringResult(j, "parse(String)(text)"),
      text,
      JSON.stringify(text),
    );
    assert.equal(
      stringResult(j, "toString(String)(parse(String)(text))"),
      encoded,
    );
  }
});

test("data constructor names and empty applications remain ordinary distinct data", () => {
  for (const v of [
    valSymbol("Foo"),
    term("Foo"),
    valSymbol("[]"),
    term("[]"),
    term("Type", valSymbol("Number")),
    term("Primitive", valSymbol("Number")),
    term("String", valLiteral(12)),
    term("Node", valLiteral(2)),
    term("-", valLiteral(1)),
  ]) {
    const i = new Interpreter();
    i.env.bindings.set("value", v);
    assert.equal(
      displayResults(
        i.run("parse(Expression)(toString(Expression)(value)) == value"),
      ),
      "True",
    );
  }
});

test("primitive atoms are ordinary self-evaluating type values", () => {
  assert.equal(
    run("(Int,Float,Bool,Int == (type Int))"),
    "(Int, Float, Bool, True)",
  );
  assert.equal(run("def accept(t :: Type) t\naccept(String)"), "String");
  assert.throws(() => run("Imaginary"), /unbound name/);
  assert.throws(() => run("5 :: Bool"), /expected Bool/);
});

test("explicit Type wrappers and primitive atoms have different value trees", () => {
  assert.equal(
    run("(Type(Int) == Int,Type(Type(Int)) == Type(Int))"),
    "(False, True)",
  );
  assert.equal(
    run("(Type(Float) == (type :Float),Float == Type(Float))"),
    "(False, False)",
  );
});

test("primitive text is independent of lexical primitive bindings", () => {
  const i = new Interpreter();
  i.env.bindings.delete("Int");
  assert.equal(
    displayResults(i.run("parse(Type)(toString(Type)(Int)) == Int")),
    "True",
  );
  assert.throws(
    () => run("def Int type :Other\n0"),
    /primitive type names are reserved/,
  );
});

test("referenced types remain nested values in unions and constructor fields", () => {
  const source =
    "def Circle type :Circle(Number)\ndef Square type :Square(Number)\nshape = UnionType(type Circle,type Square)\n";
  assert.equal(
    run(source + "shape"),
    "UnionType(Type(Circle(Float)), Type(Square(Float)))",
  );
  assert.equal(
    run(source + "parse(Type)(toString(Type)(shape)) == shape"),
    "True",
  );
  assert.equal(
    run(
      source +
        "UnionType(a,b) = shape\n(Type(a) == (type Circle),Type(b) == (type Square))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("def Circle type :Circle(Number)\ntype :Box(Circle)"),
    "Type(Box(Type(Circle(Float))))",
  );
  assert.equal(
    run(source + "shape == (type :Circle(Number) | :Square(Number))"),
    "False",
  );
});

test("nested type boundaries round trip with their concrete interpretations", () => {
  const first = new Interpreter();
  const text = stringResult(
    first,
    "def Circle type :Circle(Float32)\ndef Square type :Square(Float32)\ndef Shape UnionType(type Circle,type Square)\ntoString(Type)(type Shape)",
  );
  const second = transfer(text);
  assert.equal(
    displayResults(
      second.run(
        "t = parse(Type)(text)\n(x :: t) = (Circle(0.5) :: (type :Circle(Float32)))\n(parse(t)(toString(t)(x)) == x,toString(Type)(t) == text)",
      ),
    ),
    "(True, True)",
  );
  assert.throws(
    () => run("def Circle type :Circle(Float32)\nCircle(1.2) :: Circle"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /exactly representable|expected Circle/.test(e.message),
  );
});

test("nested recursive boundaries retain references to enclosing binders", () => {
  const first = new Interpreter();
  const text = stringResult(
    first,
    "def Tree type :Leaf(Int) | :Branch([_... :: Tree*])\ntoString(Type)(type Tree)",
  );
  assert.equal(text, "Type(Recursive(Branch([Repeat(Recur(0))]) | Leaf(Int)))");
  const second = transfer(text);
  assert.equal(
    displayResults(
      second.run(
        "t = parse(Type)(text)\n(x :: t) = Branch([Leaf(1),Branch([])])\n(toString(Type)(t) == text,parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, True)",
  );
});

test("root aliases collapse while nested aliases preserve one type boundary", () => {
  assert.equal(
    run(
      "def A type :Point(x :: Int)\nb = type A\n(type :Box(A)) == (type :Box(value :: b))",
    ),
    "True",
  );
  assert.equal(
    run(
      "def A type :Point(x :: Int)\nc = type :Point(y :: Int)\ntoString(Type)(type :Box(A)) == toString(Type)(type :Box(value :: c))",
    ),
    "True",
  );
  for (const text of [
    "Type(Type(Fields(Int)))",
    "Type(Recursive(Repeat(Int)))",
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
  assert.throws(() => run("Type(Recur(0))"), /outside its binder/);
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
    run("(type :A(x :: Int) | :B(x :: Int)) == (type :A(Int) | :B(Int))"),
    "True",
  );
});

test("singleton types include arbitrary strings and negative numbers", () => {
  for (const value of ["\n", "both \" and '", "\n  leading\n", -4]) {
    const i = new Interpreter();
    i.env.bindings.set("value", valLiteral(value));
    assert.equal(
      displayResults(
        i.run("t = Type(value)\nparse(Type)(toString(Type)(t)) == t"),
      ),
      "True",
    );
  }
  assert.equal(
    run(
      "t =\n  type\n    :-(1)\n  end\nend\nparse(Type)(toString(Type)(t)) == t",
    ),
    "True",
  );
});

test("generic parse and print factories support whole-pack partial application", () => {
  assert.equal(
    run("read = parse(Int)\nwrite = toString(Int)\nread(write(5))"),
    "5",
  );
  assert.equal(
    run("t = type :Rect(Int,String)\nCode$` $t"),
    "Type(Rect(Int, String))",
  );
});

test("local generic aliases are not reused when their argument names are shadowed", () => {
  const source =
    "def Element type :Item(Int)\ndef List(t :: Type) type :Nil | :Cons(t,List(t))\nt = type List(Element)\ndef f()\n  def Element type :Other\n  s = toStringLocal(Type)(t)\n  parseLocal(Type)(s) == t\nend\nf()";
  assert.equal(run(source), "True");
});

test("restored structural types use independently declared local accessors", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def Foreign type :Rect(x :: Number,y :: Number)\ntoString(Any)(Rect(3,4) :: Foreign)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "def Local type :Rect(width :: Number,height :: Number)\nr = parse(Any)(text)\n(r.width,r.height)",
      ),
    ),
    "(3, 4)",
  );
});
