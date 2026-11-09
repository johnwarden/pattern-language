import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  Grammar,
  displayResults,
  LanguageError,
  normal,
} from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const unavailable = (s: string) =>
  assert.throws(
    () => run(s),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_MACRO_RUNTIME_CAPTURE",
  );

test("omitted destructuring defaults retain the availability of their inputs", () => {
  unavailable(
    "def outer(x)\n  (value: y = x) = ()\n  macro :bad Args() Code$` $(y)\n  (bad Args())\nend\nouter(7)",
  );
});
test("match captures retain runtime scrutinee availability", () => {
  unavailable(
    "def outer(x)\n  match x\n    y ->\n      macro :bad Args() Code$` $(y)\n      (bad Args())\n    end\n  end\nend\nouter(7)",
  );
});
test("helper defaults are checked when registering a macro, even before invocation", () => {
  unavailable(
    "def outer(x)\n  def build(value: e = x) Code$` $(e)\n  macro :bad Args()\n    build()\n  end\n  0\nend\nouter(7)",
  );
});
test("helper annotations and ordinary type-factory parameters cannot hide runtime captures", () => {
  unavailable(
    "def outer(T :: Type)\n  def build(x :: T) Code` 1\n  macro :bad Args()\n    build(3)\n  end\n  0\nend\nouter(Int)",
  );
  unavailable(
    "def F(T :: Type)\n  macro :bad Args() Code$` $(T)\n  type Box(T)\nend\nF(Int)",
  );
});
test("quoted root heads parse as grammar literals", () => {
  const literal = new Grammar("def Q type :(x)");
  assert.throws(() => literal.parseAs("anything", "Q"));
  assert.equal(normal(literal.parseAs("x", "Q")), "x");
  const operator = new Grammar("def Op type\n  :|(Int)(Int)\nend");
  assert.equal(normal(operator.parseAs("1 | 2", "Op")), "1 | 2");
  assert.throws(() => operator.parseAs("1", "Op"));
});

test("a quoted annotation default still captures runtime availability", () => {
  unavailable(
    "def outer(x)\n  match Box()\n    :Box(value: y = x) ->\n      macro :bad Args() Code$` $(y)\n      (bad Args())\n    end\n  end\nend\nouter(7)",
  );
});
