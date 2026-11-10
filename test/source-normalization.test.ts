import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  parseSurface,
  LanguageError,
} from "../src/index.ts";
import { tokenize } from "../src/parser.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

test("one leading BOM and CRLF source endings have no semantic effect", () => {
  const unix = "def f(x)\n  y = x + 1\n  y * 2\nend\nf(3)";
  const windows = "\uFEFF" + unix.replace(/\n/g, "\r\n");
  assert.equal(syntaxKey(parseSurface(unix)), syntaxKey(parseSurface(windows)));
  assert.equal(run(unix), run(windows));
  assert.throws(() => parseSurface("\uFEFF\uFEFF1"), LanguageError);
  assert.throws(() => parseSurface("1\uFEFF"), LanguageError);
  assert.equal(run('"a\uFEFFb"'), '"a\uFEFFb"');
});

test("CRLF normalization is one pass and preserves other CR characters", () => {
  const inline = parseExpression("'\n  a\r\n  b\rc\nend");
  assert.equal(inline.kind, "literal");
  if (inline.kind !== "literal") assert.fail();
  assert.equal(inline.value, "a\nb\rc");
  const once = parseExpression("'\n  a\r\r\n\n  b\nend");
  assert.equal(once.kind, "literal");
  if (once.kind !== "literal") assert.fail();
  assert.equal(once.value, "a\r\n\nb");
  const block = parseExpression("'\r\n  a\r\n  b\r\nend");
  assert.equal(block.kind, "literal");
  if (block.kind !== "literal") assert.fail();
  assert.equal(block.value, "a\nb");
});

test("word symbols are ASCII while Unicode strings retain their contents", () => {
  for (const source of [
    "café",
    "cafe\u0301",
    ":café",
    "Rect(café: 3)",
    '$"Hello, $cafe\u0301"',
  ])
    assert.throws(() => parseSurface(source), /ASCII/);
  assert.equal(tokenize("fooBar")[0].text, "fooBar");
  assert.equal(run("'café'"), '"café"');
});

test("NFC never changes literal string content", () => {
  assert.equal(run("'é' == 'e\u0301'"), "False");
  const decomposed = parseExpression("'e\u0301'");
  assert.equal(decomposed.kind, "literal");
  if (decomposed.kind !== "literal") assert.fail();
  assert.equal(decomposed.value, "e\u0301");
});

test("normalized-source diagnostics keep correct line and column positions", () => {
  assert.throws(
    () => new Interpreter().run("\uFEFFname = 1\r\nmissing"),
    (error: unknown) =>
      fails instanceof LanguageError &&
      error.diagnostic.primary?.line === 2 &&
      error.diagnostic.primary?.column === 1,
  );
});
