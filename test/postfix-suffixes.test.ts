import test from "node:test";
import assert from "node:assert/strict";
import { parseExpression, normal } from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

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
  assert.equal(tree("Int+*"), tree("*(+(Int))"));
});

test("tight postfix plus is not spaced infix plus", () => {
  assert.equal(normal(parseExpression("T * U")), "T * U");
  assert.equal(normal(parseExpression("a+")), "+(a)");
});

test("bare keyword-rest ** is not a postfix list operator", () => {
  assert.equal(normal(parseExpression("Rect(w,h,**)")), "Rect(w, h, **)");
  assert.equal(normal(parseExpression("x...")), "…(x)");
});

test("postfix plus currently shares prefix plus's application tree", () => {
  assert.equal(tree("Int+"), tree("+Int"));
});
