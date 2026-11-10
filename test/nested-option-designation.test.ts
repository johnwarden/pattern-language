import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (error: unknown) =>
      fails instanceof LanguageError && error.diagnostic.code === code,
  );

const nested = `type Inner concrete String | :None
type Nested concrete Inner | :None
(outer :: Nested) = "Hello"
`;

test("ordinary binding and dispatch keep the Nested boundary", () => {
  rejects(nested + "(inner :: Inner) = outer\ninner", "E_PATTERN_MISMATCH");
  rejects(nested + "def take(x :: Inner) x\ntake(outer)", "E_NO_METHOD");
});

test("match-arm defaults and predicates do not inherit projection", () => {
  const take = nested + "def take(x :: Inner) True\n";
  rejects(take + "take(outer)", "E_NO_METHOD");
  rejects(
    take +
      `match :Unit
  (_, missing: v = take(outer)) -> v
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

test("the source optional convention rejects a tagged Some payload", () => {
  rejects('(tagged :: String?) = Some("Hello")\ntagged', "E_PATTERN_MISMATCH");
});

test("match does not skip two postfix option boundaries", () => {
  rejects(
    '(outer :: String??) = "Hello"\nmatch outer\n  (s :: String) -> s\nend',
    "E_PATTERN_MISMATCH",
  );
});

test("ordinary binding and match-arm defaults do not unwrap String??", () => {
  const outer = '(outer :: String??) = "Hello"\ndef take(x :: String?) True\n';
  rejects(outer + "(inner :: String?) = outer\ninner", "E_PATTERN_MISMATCH");
  rejects(outer + "take(outer)", "E_NO_METHOD");
  rejects(
    outer +
      `match :Unit
  (_, missing: v = take(outer)) -> v
end`,
    "E_PATTERN_MISMATCH",
  );
  rejects(
    outer +
      `def Refined String?? .where (x -> take(outer))
match outer
  (v :: Refined) -> v
end`,
    "E_PATTERN_MISMATCH",
  );
});
