import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
test("explicit TitleCase captures specialize ordinary function and type factories", () => {
  assert.equal(
    run(
      "def nonZero(T :: Type)(n :: T) n != (0 :: T)\n(nonZero(Int)(5),nonZero(Int)(0))",
    ),
    "(True, False)",
  );
  assert.equal(
    run(
      "def List(T :: Type) type :Nil | Cons(T,List(T))\nCons(3,:Nil) :: List(Int)",
    ),
    "Cons(3, Nil)",
  );
});
test("TitleCase captures work in bindings, labeled parameters and match arms", () => {
  assert.equal(run("(T :: Type) = Int\nx = 3 :: T\nx"), "3");
  assert.equal(
    run(
      "def identity(elementType: T :: Type)(x :: T) x\nidentity(elementType: Int)(3)",
    ),
    "3",
  );
  assert.equal(run("match Int\n  (T :: Type) -> T\nend"), "Int");
});
test("type-valued captures generate ordinary accessors without changing type identity", () => {
  assert.equal(
    run(
      "def Box type Box(T :: Type)\nb = Box(Int) :: Box\n(b.T,T(b),Box == (type Box(Type)))",
    ),
    "(Int, Int, True)",
  );
});
test("bare TitleCase parameters remain references and never infer Type", () => {
  assert.throws(() => run("def f(T) T\nf(Int)"), /unbound type name: T/);
  assert.equal(run("(T :: Type) = Int\ndef f(T) 7\nf(3)"), "7");
});
test("TitleCase captures reject non-type annotations, reserved names and duplicates", () => {
  assert.throws(
    () => run("(T :: Int) = 3\nT"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_CAPTURE_TYPE",
  );
  assert.throws(
    () => run("def f(Int :: Type) Int\nf(Int)"),
    /reserved self-evaluating name/,
  );
  assert.throws(
    () => run("def f(T :: Type,T :: Type) T\nf(Int,Int)"),
    /duplicate capture/,
  );
  assert.throws(
    () => run("def f(T :: Type) T\nf(3)"),
    /no applicable function/,
  );
});
test("hygienic templates preserve TitleCase binding and validation rules", () => {
  assert.equal(
    run(
      "macro :make Args() Code` (T :: Type) -> (x :: T) -> x\n(T :: Type) = String\nf = (make Args())\nf(Int)(3)",
    ),
    "3",
  );
  assert.throws(
    () =>
      run(
        "macro :make Args() Code` (T :: Int) -> T\nf = (make Args())\nf(3)",
      ),
    /must be annotated with Type/,
  );
});
