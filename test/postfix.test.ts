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

test("tight @ is postfix, prefix @ remains apply", () => {
  const post = parseExpression('"foo"@');
  const pre = parseExpression('@("bar")');
  assert.equal(post.kind, "postfix");
  assert.equal(pre.kind, "apply");
  assert.notEqual(syntaxKey(post), syntaxKey(pre));
  assert.equal(normal(post), '"foo"@');
  assert.equal(normal(pre), '@("bar")');
  assert.throws(
    () => encodeSyntax(post),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_VALUE_SERIALIZATION",
  );
});

test("postfix @ values match and differ from prefix application", () => {
  assert.equal(
    run(`
def PostfixAt type (String)@
def PrefixAt type (@(String))
(x :: PostfixAt) = "foo"@
match x
  (s :: String)@ -> s
end
`),
    '"foo"',
  );
  assert.throws(
    () =>
      run(`
def PostfixAt type (String)@
def PrefixAt type (@(String))
(x :: PostfixAt) = "foo"@
(y :: PrefixAt) = @("bar")
x == y
`),
    (e: unknown) =>
      e instanceof LanguageError &&
      e.diagnostic.code === "E_INCOMPARABLE_TYPES" &&
      e.message.includes("Can't compare types"),
  );
});
