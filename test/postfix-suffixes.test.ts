import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const tree = (source: string) => syntaxKey(parseExpression(source));

test("tight postfix suffixes wrap one character at a time", () => {
  assert.equal(normal(parseExpression("Int**")), "*(*(Int))");
  assert.equal(tree("Int**"), tree("*(*(Int))"));
  assert.equal(normal(parseExpression("String?*^!")), "!(^(*(?(String))))");
  assert.equal(tree("String?*^!"), tree("!(^(*(?(String))))"));
  assert.equal(normal(parseExpression("Int+")), "+(Int)");
  assert.equal(tree("Int+"), tree("+(Int)"));
  assert.equal(normal(parseExpression("Int*+")), "+(*(Int))");
  assert.equal(tree("Int*+"), tree("+(*(Int))"));
  assert.equal(normal(parseExpression("Int+*")), "*(+(Int))");
});

test("tight postfix plus is not spaced infix plus", () => {
  assert.equal(normal(parseExpression("T * U")), "T * U");
  assert.equal(run("2 * 3"), "6");
  assert.equal(run("2 + 3"), "5");
  assert.throws(
    () => parseExpression("a+b"),
    /infix operators require spaces/,
  );
  assert.equal(normal(parseExpression("a+")), "+(a)");
});

test("bare keyword-rest ** is not a postfix list operator", () => {
  assert.equal(normal(parseExpression("Rect(w,h,**)")), "Rect(w, h, **)");
  assert.equal(normal(parseExpression("x...")), "…(x)");
});

test("T+ nonempty-list identity is deferred: postfix plus shares prefix plus's tree", () => {
  assert.equal(tree("Int+"), tree("+Int"));
  assert.throws(() => run("Int+"));
});
