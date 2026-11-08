import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  renderDiagnostic,
} from "../src/index.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));

test("duplicate captures are rejected across language contexts", () => {
  for (const source of [
    "Pair(x,x) = Pair(1,1)\nx",
    "def f(x,x) x\n0",
    "f = (x,x) -> x\n0",
    "def f(x)(x) x\n0",
    "def f(x,x: Int) x\n0",
    "match Pair(1,1)\n  Pair(x,x) -> x\nend",
    "type :Pair(x :: Int,x :: Int)",
    "macro (:twice (x :: Expression) (x :: Expression)) Code` 0\n0",
  ])
    assert.throws(() => run(source), /duplicate capture/, source);
});

test("literal symbols, ignored fields, and separate alternatives remain patterns", () => {
  assert.equal(run("Pair(:x,:x) = Pair(:x,:x)\nTrue"), "True");
  assert.equal(run("Rect(_,h) = Rect(3,4)\nh"), "4");
  assert.equal(run("def second(_,h) h\nsecond(3,4)"), "4");
  assert.equal(run("match B(2)\n  (:A(x) | :B(x)) -> x\nend"), "2");
  assert.equal(
    run(
      "def Inner type :Inner(x :: Int)\ndef Outer type :Outer(x :: Int,Inner)\nOuter(1,Inner(2)) :: Outer",
    ),
    "Outer(1, Inner(2))",
  );
});

test("untyped type captures require inference rather than implying Any", () => {
  for (const source of [
    "def Foo(t :: Type) type :Foo(_)\n0",
    "type :Foo(_)",
    "type :Foo(_ :: Int)",
    "type :Foo(_... :: Int*)",
  ])
    assert.throws(
      () => run(source),
      /not allowed in a type definition|field type directly/,
      source,
    );
  for (const source of [
    "type :Foo(x)",
    "type :Foo(rest...)",
    "type :Foo(label: x)",
    "type :Outer(:Foo(x))",
    "def Foo(t :: Type) type :Foo(x)\n0",
  ])
    assert.throws(
      () => run(source),
      /type inference is not implemented/,
      source,
    );
  assert.equal(run("Foo(x) = Foo(1)\nx"), "1");
  assert.equal(run("def f(Foo(x)) x\nf(Foo(1))"), "1");
  assert.equal(run("match Foo(1)\n  Foo(x) -> x\nend"), "1");
  assert.equal(
    run("type :Rect(w :: Number,h :: Number)"),
    "Type(Rect(Float, Float))",
  );
  assert.equal(
    run("(type :Rect(w :: Number,h :: Number)) == (type :Rect(Number,Number))"),
    "True",
  );
  assert.equal(
    run("t = type :Box(Any)\nparse(Type)(toString(Type)(t)) == t"),
    "True",
  );
  for (const source of ["Type(:_)", 'parse(Type)("Type(Foo(_))")'])
    assert.throws(() => run(source), /invalid type-description shape/);
  // These names no longer carry capture-slot semantics.
  assert.equal(run("t = type :Bind(Int,Int)\nBind(0,1) .matches t"), "True");
});

test("recursive indexes skip ordinary type scopes and select the intended binder", () => {
  assert.equal(
    run(
      "t = Type(:(Recursive(Box(Type(Recursive(Pair(Recur(0),Recur(1))))))))\nparse(Type)(toString(Type)(t)) == t",
    ),
    "True",
  );
  for (const source of [
    "Type(:Recur(0))",
    "Type(:Recursive(Box(Type(Recur(1)))))",
    "Type(:Recursive(Box(Type(Recursive(Pair(Recur(0),Recur(2)))))))",
  ])
    assert.throws(() => run(source), /outside its binder/);
});

test("scope failures report a descriptor path and source location", () => {
  assert.throws(
    () => run("Type(:(Outer(Type(Inner(Recur(3))))))"),
    (error: unknown) => {
      assert(error instanceof LanguageError);
      assert.equal(error.diagnostic.code, "E_TYPE_DESCRIPTION");
      assert.deepEqual(error.diagnostic.path, ["Type", "_1", "Type", "_1"]);
      assert.equal(error.diagnostic.primary?.line, 1);
      assert.match(
        renderDiagnostic(error),
        /In type description: Type → _1 → Type → _1/,
      );
      return true;
    },
  );
});
