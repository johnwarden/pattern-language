import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (error: unknown) =>
      error instanceof LanguageError && error.diagnostic.code === code,
  );

const nested = `def Inner type String | :None
def Nested type Inner | :None
(outer :: Nested) = "Hello"
`;

test("unwrapped nested option designates a unique String", () => {
  assert.equal(run(nested + "outer"), '"Hello"');
  assert.equal(run(nested + '"Hello" .matches Nested'), "True");
  assert.equal(run(nested + "(type Nested) == (type Inner)"), "False");
});

test("match projects one unwrapped option boundary", () => {
  assert.equal(
    run(
      nested +
        `match outer
  (inner :: Inner) -> inner
end`,
    ),
    '"Hello"',
  );
});

test("ordinary binding and dispatch keep the Nested boundary", () => {
  rejects(nested + "(inner :: Inner) = outer\ninner", "E_PATTERN_MISMATCH");
  rejects(nested + "def take(x :: Inner) x\ntake(outer)", "E_NO_METHOD");
});

test("match-arm defaults and predicates do not inherit projection", () => {
  const take = nested + "def take(x :: Inner) True\n";
  rejects(take + "take(outer)", "E_NO_METHOD");
  rejects(
    take +
      `match ()
  (missing: v = take(outer)) -> v
end`,
    "E_PATTERN_MISMATCH",
  );
  rejects(
    take +
      `def Refined Nested .where (x -> take(outer))
match outer
  (v :: Refined) -> v
end`,
    "E_PATTERN_MISMATCH",
  );
});

test("tagged postfix option does not wrap or strip Some", () => {
  rejects('(outer :: String??) = "Hello"\nouter', "E_PATTERN_MISMATCH");
  assert.equal(run('Some(Some("Hello")) :: String??'), 'Some(Some("Hello"))');
  rejects(
    `match Some("Hello")
  (s :: String) -> s
end`,
    "E_PATTERN_MISMATCH",
  );
});
