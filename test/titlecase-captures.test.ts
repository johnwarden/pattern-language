import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
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
      run("macro :make Args() Code` (T :: Int) -> T\nf = (make Args())\nf(3)"),
    /must be annotated with Type/,
  );
});
