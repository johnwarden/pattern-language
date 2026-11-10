import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  encodeSyntax,
  decodeSyntax,
  LanguageError,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

test("tight type packs retain their own syntax and canonical spacing", () => {
  for (const source of ["Box<String>", "Pair<Box<String>, String>"]) {
    const tree = parseExpression(source);
    assert.equal(tree.kind, "apply");
    assert.equal(tree.kind === "apply" && tree.typeArguments, true);
    assert.equal(normal(tree), source);
    assert.equal(syntaxKey(parseExpression(normal(tree))), syntaxKey(tree));
    assert.equal(syntaxKey(decodeSyntax(encodeSyntax(tree))), syntaxKey(tree));
    assert.notEqual(
      syntaxKey(tree),
      syntaxKey(parseExpression(source.replace(/</g, "(").replace(/>/g, ")"))),
    );
  }
  assert.equal(
    normal(parseExpression("Pair<String,String>")),
    "Pair<String, String>",
  );
  assert.equal(normal(parseExpression("1 < 2")), "1 < 2");
  assert.notEqual(
    syntaxKey(parseExpression("Box < String")),
    syntaxKey(parseExpression("Box<String>")),
  );
});

test("angle arguments require Type values and do not consume constructor value packs", () => {
  assert.equal(
    run(
      'type Box<T> concrete Box(T)\n(Box("a") :: Box<String>) == (Box("a") :: (concrete Box(String)))',
    ),
    "True",
  );
  assert.throws(
    () => run('type Box<T> concrete Box(T)\nBox<"a">'),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_TYPE_ARGUMENTS",
  );
  assert.equal(
    run("type Box<T> concrete Box(T)\nCode` Box<String>"),
    "Box<String>",
  );
});
