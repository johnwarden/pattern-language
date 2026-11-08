import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  LanguageError,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => e instanceof LanguageError && e.diagnostic.code === code,
  );

test("Boolean constants and native predicates have a known Bool result type", () => {
  const i = new Interpreter();
  assert.equal(i.inspect(i.run("1 == 1")), "True :: Bool");
  assert.equal(
    i.inspect(
      i.run(
        "(True,False,1 != 1,1 < 2,2 > 1,1 <= 2,2 >= 1,isInt64(3),2 .matches Int)",
      ),
    ),
    "(True :: Bool, False :: Bool, False :: Bool, True :: Bool, True :: Bool, True :: Bool, True :: Bool, True :: Bool, True :: Bool)",
  );
  assert.equal(i.inspect(i.run(":True")), ":True :: UpperCamelSymbol");
});

test("primitive names evaluate as type values in ordinary expressions", () => {
  const i = new Interpreter();
  assert.equal(i.inspect(i.run("r = Int\nr")), "Int :: Type");
  assert.equal(
    run("(Int == (type Int),Float == Number,Bool == (type Bool))"),
    "(True, True, True)",
  );
  rejects("x = Foo\nx", "E_UNBOUND_NAME");
});

test("bound TitleCase names evaluate to their type values", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(i.run("def Rect type Rect(Float,Float)\nr = Rect\nr")),
    "Type(Rect(Float, Float)) :: Type",
  );
  assert.equal(
    run("def Rect type Rect(Float,Float)\nr = Rect(2,2) :: Rect\nr"),
    "Rect(2, 2)",
  );
});

test("constructor heads stay tags while bare symbols need quotation", () => {
  assert.equal(run("(Foo(1), :Foo)"), "(Foo(1), :Foo)");
  assert.equal(
    run("def Rect type Rect(Float,Float)\nType(Rect(Float,Float)) == Rect"),
    "True",
  );
  rejects("def Wrong Foo\n0", "E_UNBOUND_NAME");
});

test("ordinary argument packs specialize a function over a type value", () => {
  assert.equal(
    run(
      "def nonZero(t :: Type)(n :: t) n != (0 :: t)\n(nonZero(Int)(5),nonZero(Int)(0),nonZero(Float)(0.5))",
    ),
    "(True, False, True)",
  );
  assert.equal(
    run("def nonZero(t :: Type)(n :: t) n != (0 :: t)\nf = nonZero(Int)\nf(5)"),
    "True",
  );
  rejects(
    'def nonZero(t :: Type)(n :: t) n != (0 :: t)\nnonZero(Int)("five")',
    "E_NO_METHOD",
  );
});

test("ordinary packs remain separate from one combined argument pack", () => {
  assert.equal(run("def f(t :: Type)(x :: t,y :: t) x + y\nf(Int)(2,3)"), "5");
  rejects("def f(t :: Type)(x :: t,y :: t) x + y\nf(Int,2,3)", "E_NO_METHOD");
});

test("type factories use the same parameter-pattern matcher", () => {
  assert.equal(
    run(
      "def Option(t :: Type) type :None | Some(t)\nt = Option(Int)\n(:None :: t,Some(3) :: t,t)",
    ),
    "(:None, Some(3), Type(:None | Some(Int)))",
  );
  assert.equal(
    run(
      "def Vector(t :: Type) type [values... :: *(t)]\nv = [1,2] :: Vector(Int)\nv.values",
    ),
    "[1, 2]",
  );
  assert.equal(
    run('def Tuple(ts... :: *(Type)) type {ts...}\n{1,"a"} :: Tuple(Int,String)'),
    '{1, "a"}',
  );
});

test("recursive factories retain finite descriptors and fresh-context round trips", () => {
  assert.equal(
    run(
      "def List(t :: Type) type :Nil | Cons(t,List(t))\nt = List(Int)\ns = toString(Type)(t)\nu = parse(Type)(s)\nv = Cons(5,:Nil) :: u\n(parse(u)(toString(u)(v)) == v,u == t)",
    ),
    "(True, True)",
  );
});

test("lazy factory accessors remain visible to previously defined functions", () => {
  assert.equal(
    run(
      'def Box(t :: Type) type Box(value: t)\ndef f(b :: Box(Int)) b.value\ndef g(b :: Box(String)) b.value\n(f(Box(value: 3)),g(Box(value: "hi")))',
    ),
    '(3, "hi")',
  );
});

test("bound values are substituted in type patterns without an evaluation mode", () => {
  assert.equal(run("t = Int\ndef Box type Box(t)\nBox(3) :: Box"), "Box(3)");
  assert.equal(run("n = 3\nt = type Box(n)\nBox(3) :: t"), "Box(3)");
});

test("type construction sees the same value through abstract storage", () => {
  assert.equal(run("(t :: Any) = Int\nType(t) == Type(Int)"), "True");
});

test("canonical enum type text can also be evaluated as an ordinary type value", () => {
  const i = new Interpreter();
  const encoded = i.run("toString(Type)(type :Red | :Black)")[0].value;
  assert.equal(encoded.kind, "literal");
  if (encoded.kind !== "literal") throw new Error("expected text");
  assert.equal(run("(" + encoded.value + ") == (type :Red | :Black)"), "True");
});

test("type is idempotent and does not add a wrapper to primitive atoms", () => {
  assert.equal(
    run("(type Int,type type Int,type type type Int)"),
    "(Int, Int, Int)",
  );
  assert.equal(
    run(
      "def Rect type Rect(Float,Float)\n(type Rect,type type Rect,Type(Rect),Type(Type(Rect)))",
    ),
    "(Type(Rect(Float, Float)), Type(Rect(Float, Float)), Type(Rect(Float, Float)), Type(Rect(Float, Float)))",
  );
});

test("explicit Type(Int) preserves its distinct ordinary value tree", () => {
  assert.equal(
    run("(Type(Int),Type(Int) == Int,Type(Type(Int)) == Type(Int))"),
    "(Type(Int), False, True)",
  );
  assert.equal(
    run("t = Type(Int)\nparse(Type)(toString(Type)(t)) == t"),
    "True",
  );
  assert.equal(
    run("t = Type(Box(Type(Int)))\nparse(Type)(toString(Type)(t)) == t"),
    "True",
  );
});

test("canonical alternatives put symbols before literals and applications", () => {
  assert.equal(
    run("type Some(Int) | 10 | :None | 2"),
    "Type(:None | 2 | 10 | Some(Int))",
  );
  assert.equal(run("(type :Red | :Black) == (type :Black | :Red)"), "True");
});

test("local names abbreviate REPL type annotations, not structural type values", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(
      i.run("def Color type :Red | :Green\n(v :: :Green | :Red) = :Red\nv"),
    ),
    ":Red :: Color",
  );
  assert.equal(i.inspect(i.run("r = Color\nr")), "Type(:Green | :Red) :: Type");
});

test("type evaluation installs local accessor products separately from identity", () => {
  assert.equal(
    run(
      "t = type Rect(w :: Float,h :: Float)\nr = Rect(2,3) :: t\n(r.w,h(r),t == (type Rect(Float,Float)))",
    ),
    "(2, 3, True)",
  );
});

test("type defaults remain rejected while binding defaults remain capture-only", () => {
  rejects(
    "type Rect(w :: Float,h :: Float,color: Symbol = :Red)",
    "E_TYPE_DEFAULT",
  );
  assert.equal(run("(x,color: c :: Symbol = :Red) = (1)\n(x,c)"), "(1, :Red)");
});

test("angle brackets no longer introduce a second application form", () => {
  assert.throws(
    () => parseExpression("f<Int>(5)"),
    /infix operators require spaces/,
  );
  assert.equal(run("(1 < 2,3 > 2)"), "(True, True)");
});

test("postfix type modifiers are distinct trees from prefix application", () => {
  for (const [suffix, prefix] of [
    ["Int*", "*(Int)"],
    ["Int?", "?(Int)"],
    ["Int^", "^(Int)"],
    ["Int$", "$(Int)"],
    ["Int&", "&(Int)"],
    ["Int~", "~(Int)"],
  ]) {
    assert.notEqual(
      syntaxKey(parseExpression(suffix)),
      syntaxKey(parseExpression(prefix)),
    );
    assert.equal(parseExpression(suffix).kind, "postfix");
    assert.equal(parseExpression(prefix).kind, "apply");
    assert.equal(
      run(
        suffix === "Int$" || suffix === "Int?"
          ? "(type (" + suffix + ")) == (type (" + prefix + "))"
          : suffix + " == " + prefix,
      ),
      "False",
    );
    assert.equal(normal(parseExpression(suffix)), suffix);
    assert.equal(normal(parseExpression(prefix)), prefix);
  }
  assert.equal(run("2 * 3"), "6");
});

test("primitive atoms survive lexical storage changes and are reserved declarations", () => {
  const i = new Interpreter();
  i.env.bindings.delete("Int");
  assert.equal(displayResults(i.run("Int")), "Int");
  rejects("def Int type Box(Float)\n0", "E_RESERVED_PRIMITIVE");
});

test("language constants self-evaluate independently of lexical storage", () => {
  const i = new Interpreter();
  i.env.bindings.delete("True");
  assert.equal(
    displayResults(i.run("(True,False,True .matches Bool)")),
    "(True, False, True)",
  );
  rejects("def True type Box(Int)\n0", "E_RESERVED_CONSTANT");
});

test("equal compiled and raw type trees have equal canonical strings", () => {
  for (const expression of [
    "Int",
    "Type(Rect(Float,Float))",
    "Type(Int)",
    "UnionType(Int,String)",
  ]) {
    assert.equal(
      run(
        "a = " +
          expression +
          "\nb = :" +
          expression +
          "\n(a == b,toString(Expression)(a) == toString(Expression)(b))",
      ),
      "(True, True)",
    );
  }
});
