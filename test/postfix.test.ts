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
  assert.equal(run("*(2)(3)"), "6");
  assert.equal(run("^(2)(3)"), "8");
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
  assert.equal(run("?(1)"), "?(1)");
  assert.notEqual(run("1?"), run("?(1)"));
  assert.equal(run("1 :: Int?"), "1");
  assert.equal(run(":None :: Int?"), ":None");
  assert.throws(
    () => run("1? :: Int?"),
    (e: unknown) => e instanceof LanguageError,
  );
  assert.throws(
    () => run("Some(1) :: Int?"),
    (e: unknown) => e instanceof LanguageError,
  );
  assert.equal(run('toString(Type)(type String?)'), '"Type(:None | String)"');
  assert.equal(
    run("toString(Type)(type String??)"),
    '"Type(:None | Type(:None | String))"',
  );
});

test("keyword rest is prefix ** and postfix rest** is two stars", () => {
  assert.equal(parseExpression("**rest").kind, "apply");
  assert.equal(normal(parseExpression("**rest")), "**(rest)");
  assert.equal(normal(parseExpression("** rest")), "**(rest)");
  assert.equal(syntaxKey(parseExpression("**x")), syntaxKey(parseExpression("** x")));
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
      /infix operators require spaces on both sides/.test(e.message),
  );
  assert.equal(parseExpression("T**").kind, "postfix");
  assert.equal(normal(parseExpression("T**")), "T**");
  assert.equal(
    syntaxKey(parseExpression("T**")),
    syntaxKey(parseExpression("(T*)*")),
  );
  assert.equal(parseExpression("**x").kind, "apply");
  assert.equal(normal(parseExpression("**x")), "**(x)");
  assert.equal(normal(parseExpression("* *x")), "*(*(x))");
  assert.notEqual(
    syntaxKey(parseExpression("T**")),
    syntaxKey(parseExpression("T * *")),
  );
  assert.notEqual(
    syntaxKey(parseExpression("**x")),
    syntaxKey(parseExpression("* *x")),
  );
});
