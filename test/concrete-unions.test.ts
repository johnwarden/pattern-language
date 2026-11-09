import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { single } from "../src/values.ts";

const run = (source: string, interpreter = new Interpreter()) =>
  displayResults(interpreter.run(source));

test("an explicit inner absence does not match as outer absence", () => {
  assert.throws(
    () =>
      run(`(x :: String??) = :None
match x
  (inner :: String?) -> inner
end`),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_PATTERN_MISMATCH",
  );
});

test("explicit members survive transport to a fresh interpreter", () => {
  const first = new Interpreter();
  const text = single(
    first.run(`type MyType concrete String? | Float?
(inner :: MyType) = :None :: String?
toString(MyType)(inner)`),
  );
  const next = new Interpreter();
  next.env.bindings.set("text", text);
  assert.equal(
    run(
      `type MyType concrete String? | Float?
x = parse(MyType)(text)
(stringMember :: MyType) = :None :: String?
(floatMember :: MyType) = :None :: Float?
(x == stringMember, x == floatMember, toString(MyType)(x) == text)`,
      next,
    ),
    "(True, False, True)",
  );
});

test("peer ambiguity does not depend on source order", () => {
  for (const branches of ["String? | Float?", "Float? | String?"])
    assert.throws(
      () =>
        run(`type MyType concrete ${branches}
:None :: MyType`),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_AMBIGUOUS_PATTERN",
    );
});

test("nested annotation payloads remain data in the test DSL", async () => {
  const { loadTests, runTest } = await import("../src/test-suite.ts");
  const [value] = loadTests({
    "inner.test": `test "Inner"
  type Box concrete :Box(Rational)
  type Outer concrete Box | :None
  (x :: Outer) = Box(2) :: Box
  expect x result (Box(1 + 1) :: Box) :: Outer
end`,
  });
  const result = runTest(value);
  assert.equal(result.passed, false);
  assert.equal(result.phase, "expectation");
});
