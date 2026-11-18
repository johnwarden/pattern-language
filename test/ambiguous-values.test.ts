import test from "node:test";
import assert from "node:assert/strict";
import {
  Grammar,
  Interpreter,
  displayResults,
  LanguageError,
} from "../src/index.ts";

const caught = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof LanguageError, String(error));
    return error;
  }
  return assert.fail("expected an ambiguity");
};
const ambiguity = (source: string, interpreter = new Interpreter()) =>
  caught(() => displayResults(interpreter.run(source)));
const probe = (accept = true) => {
  const interpreter = new Interpreter();
  const state = { calls: 0 };
  interpreter.env.functions.set("probe", [
    {
      kind: "native",
      id: -1,
      name: "probe",
      arities: [0],
      test: (args) => args.length === 0,
      invoke: () => {
        state.calls++;
        return [{
          label: "_1",
          value: { kind: "symbol", name: accept ? "True" : "False" },
        }];
      },
    },
  ]);
  return { interpreter, state };
};
const refinementUnion = "p = Int .where (n -> probe())\nu = abstract p | Float\n";

test("an ambiguous value designator retains its diagnostic code, phase and location", () => {
  const error = ambiguity("b = abstract Int | Float\nx = 1\n3 .matches b");
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE_DESIGNATOR");
  assert.equal(error.diagnostic.phase, "match");
  assert.equal(error.diagnostic.primary?.line, 3);
  assert.equal(error.diagnostic.primary?.column, 1);
});

test("type suggestions do not use the enclosing union's local name", () => {
  const error = ambiguity("def EitherNumber abstract Int | Float\n3 .matches EitherNumber");
  assert.match(error.diagnostic.message, /`3 :: Int`/);
  assert.doesNotMatch(error.diagnostic.message, /EitherNumber/);
});

test("reporting ambiguity does not reevaluate a refinement predicate", () => {
  for (const tail of [
    "(x :: u) = 3\nx",
    "3 .matches u",
    "def f(n :: u) n\nf(3)",
    "g = (n :: u) -> n\ng(3)",
    "match 3\n  (n :: u) -> n\nend",
  ]) {
    const { interpreter, state } = probe();
    const error = ambiguity(refinementUnion + tail, interpreter);
    assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE_DESIGNATOR", tail);
    assert.equal(state.calls, 1, tail);
  }
});

test("a rejecting predicate runs once after a definition is selected", () => {
  for (const tail of [
    "def f(n :: u) toString(u)(n)\nf(3)",
    "g = (n :: u) -> toString(u)(n)\ng(3)",
  ]) {
    const { interpreter, state } = probe(false);
    const result = displayResults(interpreter.run(refinementUnion + tail));
    assert.match(result, /3 :: Float/);
    assert.equal(state.calls, 1, tail);
  }
});

test("a predicate in an unselected overload does not run", () => {
  const { interpreter, state } = probe();
  const result = displayResults(interpreter.run(
    refinementUnion +
      "def f(n :: u, s :: String) 1\ndef f(n :: Rational, s :: Symbol) 2\nf(3, :x)",
  ));
  assert.equal(result, "2");
  assert.equal(state.calls, 0);
});

test("a grammar ambiguity lists the rules that accept the text", () => {
  const grammar = new Grammar(
    "def R type :item x :: Int\ndef S type :item x :: Int\ndef Q type R | S",
  );
  const error = caught(() => grammar.parseAs("item 3", "Q"));
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE_DESIGNATOR");
  assert.match(error.diagnostic.message, /`item 3 :: R`/);
  assert.match(error.diagnostic.message, /`item 3 :: S`/);
});
