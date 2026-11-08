import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { single, unwrap } from "../src/values.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));
const recursive = "def A type :End | :A(B)\ndef B type :B(A)\n";
const math =
  "def Sum type\n  (a :: MathExp) :+ (b :: MathExp)\nend\ndef Product type\n  (a :: MathExp) :* (b :: MathExp)\nend\ndef MathExp UnionType(Sum,Product,Symbol,Number)\n";

test("consecutive function definitions form a mutually recursive lexical group", () => {
  assert.equal(
    run(
      "def even(n) if n == 0 True else odd(n - 1)\ndef odd(n) if n == 0 False else even(n - 1)\n(even(8),odd(7),even(7))",
    ),
    "(True, True, False)",
  );
  assert.equal(
    run(
      "def make(x)\n  def left(n) if n == 0 x else right(n - 1)\n  def right(n) if n == 0 x else left(n - 1)\n  n -> left(n)\nend\na = make(3)\nb = make(7)\n(a(2),b(3))",
    ),
    "(3, 7)",
  );
});
test("mutually recursive constructor and parameterized types complete before validation", () => {
  assert.equal(run(recursive + "A(B(:End)) :: A"), "A(B(End))");
  assert.equal(
    run(
      "def A(T :: Type) type :End | :A(T,B(T))\ndef B(T :: Type) type :B(A(T))\nA(1,B(:End)) :: A(Int)",
    ),
    "A(1, B(End))",
  );
  assert.equal(
    run(recursive + "t = parse(Type)(toString(Type)(A))\nt == A"),
    "True",
  );
});
test("recursive UnionType preserves concrete members and has portable finite syntax", () => {
  assert.equal(
    run(math + "(x :: MathExp) = 1 :: Number\n(x :: Number) == (1 :: Number)"),
    "True",
  );
  for (const name of ["MathExp", "Sum", "Product"]) {
    const i = new Interpreter();
    const text = unwrap(single(i.run(math + "toString(Type)(" + name + ")")));
    assert.equal(text.kind, "literal");
    const other = new Interpreter();
    other.env.bindings.set("text", text);
    assert.equal(
      displayResults(other.run("toString(Type)(parse(Type)(text)) == text")),
      "True",
    );
  }
});
test("binding and macro boundaries end groups; failed groups roll back", () => {
  assert.throws(
    () => run("def first() second()\nbarrier = 0\ndef second() 2\nfirst()"),
    /unbound name/,
  );
  assert.throws(
    () => run("def first() later\nlater = 3\nfirst()"),
    /unbound name/,
  );
  const i = new Interpreter();
  assert.throws(() => i.run(recursive + "missing", "repl"));
  assert.throws(() => i.run("A", "repl"), /unbound name/);
  assert.equal(
    displayResults(i.run(recursive + "A(B(:End)) :: A")),
    "A(B(End))",
  );
});
test("nonproductive recursive groups reject with source locations", () => {
  assert.throws(
    () => run("def A B\ndef B A\nA"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_UNGUARDED_TYPE" &&
      !!e.diagnostic.primary,
  );
});
test("local type-value inspection expands roots and names nested references", () => {
  const i = new Interpreter();
  assert.equal(i.inspect(i.run("Code")), "TreeGrammar(SyntaxNode) :: Type");
  assert.equal(i.inspect(i.run("Type(Int)")), "Type(Int) :: Type");
  assert.equal(i.inspect(i.run("type :Empty")), "Type(:Empty) :: Type");
  assert.equal(
    i.inspect(
      i.run(
        "def Circle type :Circle(Float)\ndef Picture type :Picture(Circle)\nPicture",
      ),
    ),
    "Type(Picture(Circle)) :: Type",
  );
  const j = new Interpreter();
  assert.match(j.inspect(j.run(recursive + "A")), /\bB\b/);
  assert.equal(
    displayResults(j.run('parseLocal(Type)("Type(A(B))") == (type :A(B))')),
    "True",
  );
  assert.equal(
    run(
      "def Circle type :Circle(Float)\ndef Picture type :Picture(Circle)\ntoString(Type)(Picture)",
    ),
    '"Type(Picture(Type(Circle(Float))))"',
  );
});
test("generated type patterns honor the lexical origin of aliases and private names", () => {
  for (const binding of [
    "t = Int",
    "(T :: Type) = Int",
    "def Hidden type :Hidden(Int)",
  ]) {
    const name = binding.startsWith("t")
      ? "t"
      : binding.startsWith("(")
        ? "T"
        : "Hidden";
    assert.match(
      run(
        "def build()\n  " +
          binding +
          "\n  Code` type Box(" +
          name +
          ")\nend\nmacro :make Args()\n  build()\nend\nmake Args()",
      ),
      /Type\(Box\(/,
    );
  }
});
test("raw colon data is not renamed by macro hygiene", () => {
  for (const quote of [":x", ":(x)", ":(Box(x))"]) {
    const ordinary = run("f = x -> " + quote + "\nf(1)");
    assert.equal(
      run(
        "macro :make Args() Code` (x -> " +
          quote +
          ")\nf = make Args()\nf(1)",
      ),
      ordinary,
    );
  }
  assert.equal(
    run(
      "n = 5\nmacro :make Args() Code$` (x -> :(Box(x,$n)))\nf = make Args()\nf(1)",
    ),
    "Box(:x, 5)",
  );
});
test("named macro helpers bind their own parameters; defaults still see outer dependencies", () => {
  assert.equal(
    run(
      "def outer(x)\n  macro :answer Args()\n    def helper(x) Code$` $x\n    helper(7)\n  end\n  answer Args()\nend\nouter(99)",
    ),
    "7",
  );
  assert.throws(
    () =>
      run(
        "def outer(x)\n  macro :answer Args()\n    def helper(value: x = x) Code$` $x\n    helper()\n  end\n  answer Args()\nend\nouter(99)",
      ),
    /runtime binding/,
  );
});

test("overload constraints can refer to later siblings and still reject same-space refinements", () => {
  assert.equal(
    run(
      "def f(x :: B) 2\ndef f(x :: A) 1\ndef A type :A\ndef B type :B\n(f(:A),f(:B))",
    ),
    "(1, 2)",
  );
  assert.throws(
    () =>
      run(
        "def f(x :: P) 1\ndef f(x :: N) 2\ndef P Int .where (n -> n > (0 :: Int))\ndef N Int .where (n -> n < (0 :: Int))\n0",
      ),
    /overloads cannot differ only by refinements/,
  );
});
