import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const prefix = "def U UnionType(type Int,type String)\n";

test("disjoint union positions omit annotations and preserve value identity", () => {
  assert.equal(
    run(prefix + "(x :: U) = 3 :: Int\n(x,toString(U)(x),toStringLocal(U)(x))"),
    '(3, "3", "3")',
  );
  assert.equal(
    run(prefix + "(x :: U) = 3 :: Int\nparse(U)(toString(U)(x)) == x"),
    "True",
  );
  assert.equal(
    run(
      prefix +
        "def Box type :Box(U)\nx = Box(3 :: Int) :: Box\n(toString(Box)(x),parse(Box)(toString(Box)(x)) == x)",
    ),
    '("Box(3)", True)',
  );
});

test("abstract ordering compares concrete type before payload", () => {
  assert.equal(
    run(
      prefix +
        '(a :: U) = 99 :: Int\n(b :: U) = "0" :: String\n(a < b,b > a,a == b,a < (100 :: Int))',
    ),
    "(True, True, False, True)",
  );
  assert.equal(
    run(
      "(a :: Any) = :None :: Int?\n(b :: Any) = :None :: String?\n(a == b,a < b,b > a)",
    ),
    "(False, True, True)",
  );
  assert.equal(run(prefix + "(a :: U) = 3 :: Int\na == (3 :: Int)"), "True");
});

test("disjoint union parsing selects its member and facet parsing still requires metadata", () => {
  assert.equal(run(prefix + 'parse(U)("3") == (3 :: Int)'), "True");
  assert.equal(
    run(
      prefix + 'def Box type :Box(U)\nparse(Box)("Box(3)") == (Box(3) :: Box)',
    ),
    "True",
  );
  assert.throws(() => run('parse(Any)("3")'), /requires an explicit concrete/);
  assert.throws(
    () => run(prefix + 'parseLocal(U)("(3 :: Int) :: U")'),
    /must identify a concrete type/,
  );
});

test("abstract slots narrow through parameter and match patterns", () => {
  assert.equal(
    run(prefix + "def f(x :: Int) x + 1\n(a :: U) = 3 :: Int\nf(a)"),
    "4",
  );
  assert.equal(
    run(
      prefix +
        "(a :: U) = 3 :: Int\nmatch a\n  (x :: Int) -> x + 1\n  (x :: String) -> x\nend",
    ),
    "4",
  );
});

test("same-space refinement union members are rejected independent of overlap", () => {
  const defs =
    "def Positive (type Int) .where (x -> x > 0)\ndef Negative (type Int) .where (x -> x < 0)\n";
  for (const body of [
    "UnionType(type Positive,type Negative)",
    "UnionType(type Int,type Positive)",
    "UnionType(UnionType(type String,type Positive),type Negative)",
  ])
    assert.throws(
      () => run(defs + body),
      (e: unknown) =>
        e instanceof LanguageError && e.diagnostic.code === "E_REFINED_UNION",
    );
  assert.equal(
    run(
      defs +
        "u = UnionType(type Positive,type String)\n(x :: u) = 2 :: Int\n(x :: Int) == (2 :: Int)",
    ),
    "True",
  );
});

test("refinements cannot distinguish overloads with the same whole pack domain", () => {
  const defs =
    "def Positive (type Int) .where (x -> x > 0)\ndef Negative (type Int) .where (x -> x < 0)\n";
  assert.throws(
    () => run(defs + "def f(x :: Positive) 1\ndef f(y :: Negative) 2\n0"),
    /cannot differ only by refinements/,
  );
  assert.throws(
    () => run(defs + "def f(x :: Int) 1\ndef f(y :: Positive) 2\n0"),
    /cannot differ only by refinements/,
  );
  assert.equal(
    run(
      defs +
        'def f(x :: Positive,y :: String) 1\ndef f(x :: Negative,y :: Bool) 2\n(f(1,"a"),f(negate(1),True))',
    ),
    "(1, 2)",
  );
  assert.throws(
    () => run(defs + "def f(x :: Positive) 1\ndef f(x) 2\nf(negate(1))"),
    /ambiguous call/,
  );
  assert.throws(
    () => run(defs + "def f(x :: Positive) 1\nf(negate(1))"),
    /subset/,
  );
});

test("abstract slots narrow with typed patterns rather than annotation-tree inspection", () => {
  const value = "(x :: Any) = 3 :: Int\n";
  assert.equal(run(value + "(n :: Int) = x\nn"), "3");
  assert.equal(run(value + "def inspect(n :: Int) n\ninspect(x)"), "3");
  assert.equal(run(value + "match x\n  (n :: Int) -> n\nend"), "3");
  assert.throws(
    () => run(value + ":(v :: t) = x\nv"),
    /expected a constructed value/,
  );
  assert.equal(
    run(value + "match x\n  :(v :: t) -> False\n  _ -> True\nend"),
    "True",
  );
});

test("narrowing preserves concrete identity and abstract text round trips", () => {
  assert.equal(
    run(
      "(x :: Any) = :None :: Int?\n(v :: Int?) = x\n(v == (:None :: Int?),parse(Any)(toString(Any)(x)) == x,x == v)",
    ),
    "(True, True, True)",
  );
  assert.throws(
    () => run("(x :: Any) = 3 :: Int\n(v :: Int) = x\nv == (3 :: Number)"),
    /different concrete types/,
  );
  assert.throws(
    () => run("x = 3 :: Int\n:(v :: t) = x\nv"),
    /expected a constructed value/,
  );
});
