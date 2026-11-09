import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { single } from "../src/values.ts";

const run = (source: string, interpreter = new Interpreter()) =>
  displayResults(interpreter.run(source));

test("binding and expression annotations choose the same direct outer arm", () => {
  assert.equal(
    run(`(x :: Float??) = :None
y = :None :: Float??
(inner :: Float??) = :None :: Float?
(x == y, x == inner)`),
    "(True, False)",
  );
});

test("an explicit inner absence projects once without becoming outer absence", () => {
  assert.equal(
    run(`(x :: String??) = :None :: String?
match x
  (inner :: String?) -> inner == (:None :: String?)
end`),
    "True",
  );
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
    first.run(`def MyType type String? | Float?
(inner :: MyType) = :None :: String?
toString(MyType)(inner)`),
  );
  const next = new Interpreter();
  next.env.bindings.set("text", text);
  assert.equal(
    run(
      `def MyType type String? | Float?
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
        run(`def MyType type ${branches}
:None :: MyType`),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_AMBIGUOUS_PATTERN",
    );
});

test("a direct constructor arm wins over an inward path without source-order priority", () => {
  for (const branches of ["Inner | :Box(String)", ":Box(String) | Inner"])
    assert.equal(
      run(`def Inner type :Box(String) | :Absent
def Outer type ${branches}
(direct :: Outer) = Box("x")
(inner :: Outer) = Box("x") :: Inner
(direct == inner, parse(Outer)(toString(Outer)(inner)) == inner)`),
      "(False, True)",
    );
});

test("already typed payloads can be designated inward without permitting projection in binding", () => {
  assert.equal(
    run(`def Inner type String | :None
def Outer type Inner | :None
(s :: String) = "x"
(outer :: Outer) = s
match outer
  (inner :: Inner) -> match inner
    (payload :: String) -> payload == s
  end
end`),
    "True",
  );
});

test("nested annotation payloads remain data in the test DSL", async () => {
  const { loadTests, runTest } = await import("../src/test-suite.ts");
  const [value] = loadTests({
    "inner.test": `test "Inner"
  def Box type :Box(Rational)
  def Outer type Box | :None
  (x :: Outer) = Box(2) :: Box
  expect x result (Box(1 + 1) :: Box) :: Outer
end`,
  });
  const result = runTest(value);
  assert.equal(result.passed, false);
  assert.equal(result.phase, "expectation");
});
