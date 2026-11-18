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
const probe = (interpreter: Interpreter) => {
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
        return [{ label: "_1", value: { kind: "symbol", name: "True" } }];
      },
    },
  ]);
  return state;
};
const union = "b = abstract Int | Float\n";

test("an ambiguous value is blamed with the code, phase and location of its expression", () => {
  const error = ambiguity(union + "x = 1\n3 .matches b");
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.equal(error.diagnostic.phase, "match");
  assert.equal(error.diagnostic.primary?.line, 3);
  assert.equal(error.diagnostic.primary?.column, 1);
  assert.match(error.diagnostic.message, /`3 :: Int`/);
  assert.match(error.diagnostic.message, /`3 :: Float`/);
});

test("the interpretations of an absence are written as source", () => {
  const error = ambiguity(
    "type Foo concrete String? | Float?\n(x :: Foo) = :None\nx",
  );
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.match(error.diagnostic.message, /`:None :: String\?`/);
  assert.match(error.diagnostic.message, /`:None :: Float\?`/);
});

test("every interpretation is a type expression and never a local name", () => {
  const error = ambiguity("u = abstract Int* | Float*\n[] .matches u");
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.match(error.diagnostic.message, /`\[\] :: Float\*`/);
  assert.match(error.diagnostic.message, /`\[\] :: Int\*`/);
  const named = ambiguity("def Number abstract Int | Float\n3 .matches Number");
  assert.match(named.diagnostic.message, /`3 :: Int`/);
  assert.doesNotMatch(named.diagnostic.message, /Number/);
});

test("a message lists two interpretations and counts the rest", () => {
  const error = ambiguity(
    "b = abstract Int | Float | Rational | Float64 | Float32\n3 .matches b",
  );
  assert.equal(
    error.diagnostic.message,
    "ambiguous value 3: please specify `3 :: Float`, `3 :: Float32`, ...and 3 others",
  );
});

test("listing interpretations never evaluates a refinement predicate again", () => {
  for (const tail of ["(x :: u) = 3\nx", "3 .matches u"]) {
    const interpreter = new Interpreter();
    const state = probe(interpreter);
    const error = ambiguity(
      "p = Int .where (n -> probe())\nu = abstract p | Float\n" + tail,
      interpreter,
    );
    assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE", tail);
    assert.equal(state.calls, 1, tail);
  }
});

test("a predicate runs once when dispatch lists a refinement member", () => {
  const interpreter = new Interpreter();
  const state = probe(interpreter);
  const error = ambiguity(
    "p = Int .where (n -> probe())\nu = abstract p | Float\ndef f(n :: u) n\nf(3)",
    interpreter,
  );
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.equal(state.calls, 1);
});

test("dispatch lists a refinement member only when its predicate accepts the value", () => {
  const program = (n: number) =>
    "p = Int .where (n -> n > (5 :: Int))\nu = abstract p | Float\ndef f(n :: u) n\nf(" +
    n +
    ")";
  const rejected = ambiguity(program(3));
  assert.equal(rejected.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.equal(
    rejected.diagnostic.message,
    "ambiguous value 3: please specify `3 :: Float`",
  );
  const accepted = ambiguity(program(7));
  assert.match(accepted.diagnostic.message, /`7 :: Float`/);
  assert.match(accepted.diagnostic.message, /`7 :: Int \.where/);
});

test("a value too large to quote still reports the ambiguity", () => {
  const list = "[" + Array.from({ length: 60 }, (_, i) => i).join(", ") + "]";
  const error = ambiguity(
    "u = abstract Int* | Float*\n" + list + " .matches u",
  );
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.equal(
    error.diagnostic.message,
    "ambiguous value: 2 interpretations match",
  );
});

test("an ambiguity whose value has no text still reports E_AMBIGUOUS_VALUE", () => {
  for (const source of [
    "def f(x | x) 1\nf(1 / 3)",
    "match 1 / 3\n  (x | x) -> 1\nend",
    "(Box(n :: Rational) | Box(n :: Any)) = Box(1 / 3)\nn",
  ]) {
    const error = ambiguity(source);
    assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE", source);
    assert.equal(
      error.diagnostic.message,
      "ambiguous value: 2 interpretations match",
      source,
    );
  }
});

test("alternatives that are not types have no interpretation to list", () => {
  const error = ambiguity("def f(x | x) 1\nf(1)");
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.equal(
    error.diagnostic.message,
    "ambiguous value: 2 interpretations match",
  );
});

test("a grammar ambiguity lists the rules that accept the text", () => {
  const grammar = new Grammar(
    "def R type :item x :: Int\ndef S type :item x :: Int\ndef Q type R | S",
  );
  const error = caught(() => grammar.parseAs("item 3", "Q"));
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_VALUE");
  assert.match(error.diagnostic.message, /`item 3 :: R`/);
  assert.match(error.diagnostic.message, /`item 3 :: S`/);
});
