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

test("the source optional convention is unwrapped T | :None", () => {
  assert.equal(run('(present :: String?) = "Hello"\npresent'), '"Hello"');
  assert.equal(run("(absent :: String?) = :None\nabsent"), "None");
  rejects('(tagged :: String?) = Some("Hello")\ntagged', "E_PATTERN_MISMATCH");
});

test("nested postfix String?? designates a unique String", () => {
  assert.equal(run('(outer :: String??) = "Hello"\nouter'), '"Hello"');
  assert.equal(run('"Hello" .matches (type String??)'), "True");
  assert.equal(run("(type String??) == (type String?)"), "False");
});

test("nested absence selects outer None unless an inner member is explicit", () => {
  assert.equal(
    run(`(outer :: String??) = :None
(inner :: String??) = :None :: String?
(same :: String??) = :None :: String??
(outer == same, outer == inner)`),
    "(True, False)",
  );
});

test("match projects one postfix option boundary", () => {
  const outer = '(outer :: String??) = "Hello"\n';
  assert.equal(
    run(
      outer +
        `match outer
  (inner :: String?) -> inner
end`,
    ),
    '"Hello"',
  );
  rejects(
    outer +
      `match outer
  (s :: String) -> s
end`,
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
