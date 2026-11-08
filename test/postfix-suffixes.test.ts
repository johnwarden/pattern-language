import test from "node:test";
import assert from "node:assert/strict";
import { parseExpression, normal, LanguageError } from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const tree = (source: string) => syntaxKey(parseExpression(source));
const rejectsInfixSpaces = (source: string) =>
  assert.throws(
    () => parseExpression(source),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.message.includes("infix operators require spaces"),
    source,
  );

test("tight suffixes wrap one character at a time as ordinary application", () => {
  assert.equal(normal(parseExpression("Int**")), "*(*(Int))");
  assert.equal(tree("Int**"), tree("*(*(Int))"));
  assert.equal(normal(parseExpression("String?*^!")), "!(^(*(?(String))))");
  assert.equal(tree("String?*^!"), tree("!(^(*(?(String))))"));
});

test("prefix plus forms are the same tree; tight Int+ is not", () => {
  assert.equal(tree("+Int"), tree("+(Int)"));
  assert.equal(normal(parseExpression("+Int")), "+(Int)");
  assert.equal(normal(parseExpression("+(Int)")), "+(Int)");
  rejectsInfixSpaces("Int+");
  rejectsInfixSpaces("Int*+");
  rejectsInfixSpaces("a+");
});

test("spaced plus and star remain infix", () => {
  assert.equal(normal(parseExpression("T * U")), "T * U");
  assert.equal(normal(parseExpression("a + b")), "a + b");
});

test("bare keyword-rest ** is not a postfix list operator", () => {
  assert.equal(normal(parseExpression("Rect(w,h,**)")), "Rect(w, h, **)");
  assert.equal(normal(parseExpression("x...")), "…(x)");
});
