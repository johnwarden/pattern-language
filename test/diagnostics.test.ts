import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  LanguageError,
  renderDiagnostic,
  normal,
} from "../src/index.ts";
const fail = (
  source: string,
  interpreter = new Interpreter(),
  name = "example.pattern",
) => {
  try {
    interpreter.run(source, "program", name);
  } catch (e) {
    assert.ok(e instanceof LanguageError);
    return e;
  }
  throw new Error("expected diagnostic");
};
test("unbound names carry exact range and source excerpt", () => {
  const error = fail("x = 1\nx + unknown");
  assert.equal(error.diagnostic.code, "E_UNBOUND_NAME");
  assert.equal(error.diagnostic.primary?.line, 2);
  assert.equal(error.diagnostic.primary?.column, 5);
  assert.equal(error.diagnostic.primary?.start, 10);
  assert.equal(error.diagnostic.primary?.end, 17);
  assert.match(renderDiagnostic(error), /example.pattern:2:5/);
  assert.match(renderDiagnostic(error), /\^\^\^\^\^\^\^/);
});
test("nested mismatch reports actual field and method definition", () => {
  const error = fail("def f(Rect(width: Int)) width\nf(Rect(width: :Red))");
  assert.equal(error.diagnostic.code, "E_NO_METHOD");
  assert.match(
    renderDiagnostic(error),
    /argument 1.width: expected Int, received Red/,
  );
  assert.equal(error.diagnostic.primary?.column, 15);
  assert.equal(error.diagnostic.related[0].span?.line, 1);
});
test("missing label reports call and requirement locations", () => {
  const error = fail("def f(size: Int) size\nf()");
  assert.equal(error.diagnostic.code, "E_MISSING_FIELD");
  assert.match(
    renderDiagnostic(error),
    /missing required labeled argument `size`/,
  );
  assert.equal(error.diagnostic.primary?.line, 2);
  assert.equal(error.diagnostic.related.at(-1)?.span?.column, 7);
});
test("ambiguity lists both definitions", () => {
  const error = fail("def f(x) 1\ndef f(:Red) 2\nf(:Red)");
  assert.equal(error.diagnostic.code, "E_AMBIGUOUS_CALL");
  assert.deepEqual(
    error.diagnostic.related.map((r) => r.span?.line),
    [1, 2],
  );
});
test("duplicate label has parse phase and points at second label", () => {
  const error = fail("R(a: 1,a: 2)");
  assert.equal(error.diagnostic.code, "E_DUPLICATE_LABEL");
  assert.equal(error.diagnostic.phase, "parse");
  assert.equal(error.diagnostic.primary?.column, 8);
});
test("REPL closures retain original source for later runtime failures", () => {
  const interpreter = new Interpreter();
  interpreter.run("def f(x) unknown", "repl", "repl#1");
  const error = fail("f(1)", interpreter, "repl#2");
  assert.equal(error.diagnostic.primary?.source?.name, "repl#1");
  assert.match(renderDiagnostic(error), /def f\(x\) unknown/);
});
test("source metadata does not change canonical syntax", () => {
  const i = new Interpreter();
  assert.equal(
    normal(i.parse("R(a: 1)", "program", "a")),
    normal(i.parse("R(a: 1)", "program", "b")),
  );
  assert.ok(
    !JSON.stringify(i.parse("R(a: 1)"), (_k, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ).includes('"source"'),
  );
});
test("invalid factory parameter patterns fail at declaration even without use", () => {
  for (const source of [
    "def Bad(x :: Type,x :: Type) type x\n0",
    "def Bad(t :: Type,t :: Type) type t\n0",
    "def Bad(ts... :: Type*,t :: Type) type t\n0",
  ]) {
    const error = fail(source);
    assert.equal(error.diagnostic.phase, "declaration");
    assert.equal(error.diagnostic.primary?.line, 1);
  }
});
test("multiple rejected methods retain separate reasons", () => {
  const error = fail("def f(x :: Int) x\ndef f(x :: String) x\nf(:Red)");
  assert.equal(error.diagnostic.notes.length, 2);
  assert.match(error.diagnostic.notes[0], /expected Int/);
  assert.match(error.diagnostic.notes[1], /expected String/);
});
