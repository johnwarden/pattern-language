import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  LanguageError,
} from "../src/index.ts";
import { unwrap } from "../src/values.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => e instanceof LanguageError && e.diagnostic.code === code,
  );

test("type construction sees the same value through abstract storage", () => {
  assert.equal(run("(t :: Any) = Int\nStruct(t) == Struct(Int)"), "True");
});

test("canonical enum type text can also be evaluated as an ordinary type value", () => {
  const i = new Interpreter();
  const encoded = unwrap(i.run("toString(Type)(type :Red | :Black)")[0].value);
  assert.equal(encoded.kind, "literal");
  if (encoded.kind !== "literal" || typeof encoded.value !== "string")
    throw new Error("expected text");
  assert.equal(run("(" + encoded.value + ") == (type :Red | :Black)"), "True");
});

test("local names abbreviate REPL type annotations, not structural type values", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(
      i.run("def Color type :Red | :Green\n(v :: (:Green | :Red)) = :Red\nv"),
    ),
    "Red :: Color",
  );
  assert.equal(i.inspect(i.run("r = Color\nr")), "Struct(:Green | :Red) :: Type");
});

test("angle brackets no longer introduce a second application form", () => {
  assert.throws(
    () => parseExpression("f<Int>(5)"),
    /infix operators require spaces/,
  );
  assert.equal(run("(1 < 2,3 > 2)"), "(True, True)");
});

test("postfix type modifiers are distinct trees from prefix application", () => {
  for (const [suffix, prefix] of [
    ["Int*", "*(Int)"],
    ["Int?", "?(Int)"],
    ["Int^", "^(Int)"],
    ["Int$", "$(Int)"],
    ["Int&", "&(Int)"],
    ["Int~", "~(Int)"],
  ]) {
    assert.notEqual(
      syntaxKey(parseExpression(suffix)),
      syntaxKey(parseExpression(prefix)),
    );
    assert.equal(parseExpression(suffix).kind, "postfix");
    assert.equal(parseExpression(prefix).kind, "apply");
    assert.equal(normal(parseExpression(suffix)), suffix);
    assert.equal(normal(parseExpression(prefix)), prefix);
  }
  assert.equal(run("2 * 3"), "6");
});

test("primitive atoms survive lexical storage changes and are reserved declarations", () => {
  const i = new Interpreter();
  i.env.bindings.delete("Int");
  assert.equal(displayResults(i.run("Int")), "Int");
  rejects("def Int type Box(Float)\n0", "E_RESERVED_PRIMITIVE");
});

test("language constants self-evaluate independently of lexical storage", () => {
  const i = new Interpreter();
  i.env.bindings.delete("True");
  assert.equal(
    displayResults(i.run("(True,False,True .matches Bool)")),
    "(True, False, True)",
  );
  rejects("def True type Box(Int)\n0", "E_RESERVED_CONSTANT");
});

test("equal compiled and raw type trees have equal canonical strings", () => {
  for (const expression of [
    "Struct(Rect(Float,Float))",
    "Struct(Int)",
    "UnionType(Int,String)",
  ]) {
    assert.equal(
      run(
        "a = " +
          expression +
          "\nb = :(" +
          expression +
          ")\n(a == b,toString(Expression)(a) == toString(Expression)(b))",
      ),
      "(True, True)",
    );
  }
});
