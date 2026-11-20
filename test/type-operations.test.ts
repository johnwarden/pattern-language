import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  parseSurface,
  normal,
  LanguageError,
} from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const errorCode = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => e instanceof LanguageError && e.diagnostic.code === code,
  );

test("where and matches have no reserved surface syntax", () => {
  for (const name of ["where", "matches", "custom"])
    assert.equal(normal(parseExpression(`a .${name} b`)), `${name}(a)(b)`);
  for (const name of ["where", "matches"]) {
    const tree = parseSurface(`a ${name} b`);
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") throw new Error("expected a block");
    const line = tree.lines[0];
    assert.equal(line.kind, "sequence");
    if (line.kind === "sequence") assert.equal(line.items.length, 3);
    assert.throws(() => run(`a ${name} b`), /expected.*registered sidefix/);
  }
  assert.equal(run("where = 7\nmatches = 9\n(where,matches)"), "(7, 9)");
});

test("refinement is an ordinary call that can be partially applied and wrapped", () => {
  assert.equal(
    run("small = (type Int) .where (x -> (x < (5 :: Int)))\n3 :: small"),
    "3",
  );
  assert.equal(
    run(
      "restrict = where(type Int)\nsmall = restrict(x -> (x < (5 :: Int)))\n3 :: small",
    ),
    "3",
  );
  assert.equal(
    run(
      "def refine(base)(p) base .where p\ndef Small refine(type Int)(x -> (x < (5 :: Int)))\n3 :: Small",
    ),
    "3",
  );
  assert.equal(
    run("def Small where(type Int)(x -> (x < (5 :: Int)))\n3 :: Small"),
    "3",
  );
  errorCode("where((type Int),x -> True)", "E_NO_METHOD");
});

test("computed type aliases preserve recursive identity", () => {
  assert.equal(
    run(
      "def identity(x) x\ndef A type :Nil | :Cons(Int,A)\nb = identity(type A)\n(type A) == b",
    ),
    "True",
  );
  errorCode("def makeType() 3\ndef Wrong makeType()\n0", "E_EXPECTED_TYPE");
});

test("refinement predicates are lexical closures and never create accessors", () => {
  const source =
    "def lessThan(limit) x -> (x < limit)\ndef Small\n  (type Int) .where lessThan(5 :: Int)\nend\n";
  assert.equal(run(source + "3 :: Small"), "3");
  assert.throws(() => run(source + "5 :: Small"), /subset/);
  errorCode(
    "def NoInt Int? .where (v -> (v .matches :None))\nv",
    "E_UNBOUND_NAME",
  );
  errorCode(
    "def isSmall(x) x < 5\ndef Small\n  (type Int) .where isSmall\nend\n0",
    "E_FUNCTION_NOT_VALUE",
  );
  errorCode("def NoInt Int? .where (_ .matches :None)\n0", "E_UNBOUND_NAME");
});

test("matches evaluates both arguments and uses the shared pattern specification", () => {
  assert.equal(
    run("def makePattern() type :Some(Int)\nSome(3) .matches makePattern()"),
    "True",
  );
  assert.equal(
    run(
      "p = (type :Pair(Int,Int)) .where (Pair(a,b) -> (a == b))\n(Pair(1,1) .matches p,Pair(1,2) .matches p)",
    ),
    "(True, False)",
  );
  assert.equal(
    run(
      "def P type :Box(size: Int,color: c :: Symbol)\n(Box(size: 3,color: :Black) :: P) .matches (type P)",
    ),
    "True",
  );
  assert.equal(
    run(
      "def P type [first :: Int,rest... :: Int*]\n([1,2] .matches (type P),[1,:Red] .matches (type P))",
    ),
    "(True, False)",
  );
  assert.equal(
    run("testValue = matches(Some(3))\ntestValue(type :Some(Int))"),
    "True",
  );
  assert.equal(run("(:x .matches :x,42 .matches :x)"), "(True, False)");
  assert.equal(run("(1 :: Float) .matches (type Int)"), "False");
  assert.equal(run("(1 :: Float) .matches (1 :: Int)"), "False");
  assert.equal(run("Some(3) .matches :(Some(Int))"), "False");
  assert.equal(run("p = :(f(missing))\n:(f(missing)) .matches p"), "True");
});

test("type values retain their lexical pattern references", () => {
  assert.equal(
    run(
      "p =\n  def Item type :Thing(Int)\n  type :Some(Item)\nend\nSome(Thing(3)) .matches p",
    ),
    "True",
  );
  assert.equal(
    run(
      "def makePattern(element) type :Box(size: value :: element)\ndef P makePattern(type Int)\n(Box(size: 3) :: P) .matches (type P)",
    ),
    "True",
  );
});

test("ordinary dispatch reports competing where and matches definitions", () => {
  errorCode(
    "def where(base)(p) base\n(type Int) .where (x -> True)",
    "E_AMBIGUOUS_CALL",
  );
  errorCode(
    "def matches(value)(pattern) False\nSome(3) .matches (type :Some(Int))",
    "E_AMBIGUOUS_CALL",
  );
  errorCode(
    "matches = v -> (p -> False)\nSome(3) .matches (type :Some(Int))",
    "E_AMBIGUOUS_CALL",
  );
});

test("bad refinement arguments and predicate results are diagnosed at the call", () => {
  errorCode("3 .where (x -> True)", "E_EXPECTED_TYPE");
  errorCode("(type Float) .where 3", "E_EXPECTED_PREDICATE");
  errorCode(
    "def Bad\n  (type Int) .where (x -> 7)\nend\n1 :: Bad",
    "E_PREDICATE_RESULT",
  );
  assert.throws(
    () => run("def Bad where(type Int)(x -> missing)\n1 :: Bad"),
    (e: unknown) => {
      assert.ok(e instanceof LanguageError);
      assert.equal(e.diagnostic.code, "E_UNBOUND_NAME");
      assert.equal(e.diagnostic.primary?.line, 1);
      return true;
    },
  );
});
