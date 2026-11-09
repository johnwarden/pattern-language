import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  LanguageError,
  encodeSyntax,
  decodeSyntax,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

const pairs = [
  ['"foo"@', '@("bar")'],
  ["1*", "*(Int)"],
  ['"hi"?', "?(String)"],
  ["2^", "^(Int)"],
  ["3!", "!(Int)"],
  ["1$", "$(Int)"],
  ["2&", "&(Int)"],
  ["3~", "~(Int)"],
];

test("tight suffix punctuation is postfix, prefix remains apply", () => {
  for (const [postSource, preSource] of pairs) {
    const post = parseExpression(postSource);
    const pre = parseExpression(preSource);
    assert.equal(post.kind, "postfix", postSource);
    assert.equal(pre.kind, "apply", preSource);
    assert.notEqual(syntaxKey(post), syntaxKey(pre));
    assert.equal(normal(post), postSource);
    assert.equal(normal(pre), preSource);
    assert.equal(
      syntaxKey(decodeSyntax(encodeSyntax(post))),
      syntaxKey(post),
      postSource,
    );
  }
  assert.equal(parseExpression("2 * 3").kind, "apply");
  assert.equal(normal(parseExpression("2 * 3")), "2 * 3");
  for (const infix of ["1 $ 2", "1 & 2", "1 ~ 2"]) {
    assert.equal(parseExpression(infix).kind, "apply", infix);
    assert.equal(normal(parseExpression(infix)), infix);
  }
  assert.equal(parseExpression("x@(y)").kind, "apply");
  assert.equal(parseExpression("x@(y)").kind, parseExpression("x$(y)").kind);
  assert.equal(normal(parseExpression("x$(y)")), "x$(y)");
  assert.equal(parseExpression("Code$` 1").kind, "typedQuote");
});

test("prefix bang, dollar unquote and spaced dollar stay host diagnostics", () => {
  assert.throws(
    () => run("!(1)"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_RESERVED_OPERATOR",
  );
  assert.throws(
    () => run("$(1)"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_UNQUOTE_CONTEXT",
  );
  assert.throws(
    () => run("1 $ 2"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_UNQUOTE_CONTEXT",
  );
});

test("keyword rest is prefix ** and postfix rest** is two stars", () => {
  assert.equal(parseExpression("**rest").kind, "apply");
  assert.equal(normal(parseExpression("**rest")), "**(rest)");
  assert.throws(
    () => parseExpression("** rest"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.throws(
    () => parseExpression("** x"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.equal(parseExpression("**(x)").kind, "apply");
  assert.equal(normal(parseExpression("**(x)")), "**(x)");
  const post = parseExpression("rest**");
  assert.equal(post.kind, "postfix");
  assert.equal(normal(post), "rest**");
  assert.throws(
    () => run("{**rest} = {a: 1}\n0"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_KEYWORD_REST_UNSUPPORTED",
  );
  assert.throws(
    () => run("{**rest: {**}} = {a: 1}\n0"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_KEYWORD_REST_UNSUPPORTED",
  );
});

test("postfix T* / T** and prefix **x do not share a spaced tree", () => {
  assert.equal(parseExpression("T*").kind, "postfix");
  assert.equal(normal(parseExpression("T*")), "T*");
  assert.throws(
    () => parseExpression("T *"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /Missing second argument to infix operation/.test(e.message),
  );
  assert.equal(parseExpression("T**").kind, "postfix");
  assert.equal(normal(parseExpression("T**")), "T**");
  assert.equal(
    syntaxKey(parseExpression("T**")),
    syntaxKey(parseExpression("(T*)*")),
  );
  assert.equal(parseExpression("**x").kind, "apply");
  assert.equal(normal(parseExpression("**x")), "**(x)");
  assert.throws(
    () => parseExpression("* *x"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.throws(
    () => parseExpression("T * *"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.equal(normal(parseExpression("1 * *x")), "1 * *(x)");
  assert.equal(normal(parseExpression("1 * x*")), "1 * x*");
  assert.equal(normal(parseExpression("x* * 1")), "x* * 1");
  assert.throws(
    () => parseExpression("- (x)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.throws(
    () => parseExpression("* (x)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /must touch their operand/.test(e.message),
  );
  assert.equal(normal(parseExpression("-(x)")), "-(x)");
  assert.equal(normal(parseExpression("-x")), "-(x)");
  assert.equal(normal(parseExpression("1 - (x)")), "1 - x");
});
