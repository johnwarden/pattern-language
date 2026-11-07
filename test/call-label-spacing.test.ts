import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  LanguageError,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const tree = (source: string, sidefix = false) =>
  syntaxKey(parseExpression(source, sidefix));

test("tight f(x) is application; spaced f (x) is a sequence", () => {
  assert.equal(tree("f(x)"), tree("f(x)"));
  assert.notEqual(tree("f(x)"), tree("f (x)", true));
  assert.equal(parseExpression("f (x)", true).kind, "sequence");
  assert.equal(parseExpression("f(x)").kind, "apply");
  assert.equal(parseExpression("f()").kind, "apply");
  assert.equal(parseExpression("f ()", true).kind, "sequence");
  assert.equal(run("def id(x) x\nid(3)"), "3");
  assert.throws(
    () => run("def id(x) x\nid (3)"),
    (error: unknown) =>
      error instanceof LanguageError &&
      /expected a complete expression or registered sidefix grammar form/.test(
        error.message,
      ),
  );
});

test("a field colon must touch its label", () => {
  assert.equal(tree("Rect(w: 1)"), tree("Rect(w:1)"));
  assert.notEqual(tree("Rect(w: 1)"), tree("Rect(w :(1))"));
  const labeled = parseExpression("Rect(w: 1)");
  const spacedQuote = parseExpression("Rect(w :(1))");
  assert.equal(labeled.kind, "apply");
  assert.equal(spacedQuote.kind, "apply");
  if (labeled.kind === "apply" && spacedQuote.kind === "apply") {
    assert.equal(labeled.body[0].label, "w");
    assert.equal(spacedQuote.body[0].label, "_1");
  }
  assert.throws(
    () => parseExpression("Rect(w : 1)"),
    /quotation requires :\(expression\)/,
  );
  assert.equal(run("Rect(w: 1, h: 2)"), "Rect(h: 2, w: 1)");
  assert.throws(
    () => run("Rect(w : 1, h: 2)"),
    /quotation requires :\(expression\)/,
  );
});
