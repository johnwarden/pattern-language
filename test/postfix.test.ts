import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  LanguageError,
  encodeSyntax,
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
    assert.throws(
      () => encodeSyntax(post),
      (e: unknown) =>
        e instanceof LanguageError &&
        e.diagnostic.code === "E_VALUE_SERIALIZATION",
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
  assert.equal(parseExpression('Code$` 1').kind, "typedQuote");
});

test("postfix values match payloads and differ from prefix application", () => {
  assert.equal(
    run(`
def PostfixStar type (Int)*
(star :: PostfixStar) = 1*
match star
  (n :: Int)* -> n
end
`),
    "1",
  );
  assert.throws(
    () =>
      run(`
def PostfixStar type (Int)*
def PrefixStar type (*(Int))
(star :: PostfixStar) = 1*
(xs :: PrefixStar) = [1]
star == xs
`),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_INCOMPARABLE_TYPES" &&
      e.message.includes("Can't compare types"),
  );
  assert.throws(
    () => run("!(1)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_RESERVED_OPERATOR",
  );
  assert.equal(
    run(`
def PostfixAmp type (Int)&
(amp :: PostfixAmp) = 2&
match amp
  (n :: Int)& -> n
end
`),
    "2",
  );
  assert.equal(
    run(`
def PostfixTilde type (Int)~
(tilde :: PostfixTilde) = 4~
match tilde
  (n :: Int)~ -> n
end
`),
    "4",
  );
  assert.equal(
    run(`
def PostfixDollar type (Int)$
(dollar :: PostfixDollar) = 1$
match dollar
  (n :: Int)$ -> n
end
`),
    "1",
  );
  assert.throws(
    () =>
      run(`
def PostfixAmp type (Int)&
def PrefixAmp type (&(Int))
(amp :: PostfixAmp) = 2&
(pre :: PrefixAmp) = &(3)
amp == pre
`),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_INCOMPARABLE_TYPES" &&
      e.message.includes("Can't compare types"),
  );
  assert.throws(
    () => run("$(1)"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_UNQUOTE_CONTEXT",
  );
  assert.throws(
    () => run("1 $ 2"),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_UNQUOTE_CONTEXT",
  );
  assert.equal(run('name = "Jo"\n$"Hi $name"'), '"Hi Jo"');
  assert.equal(run("1 & 2"), "1 & 2");
  assert.equal(run("3 ~ 4"), "3 ~ 4");
});
