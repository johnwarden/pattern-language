import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  normal,
  parseExpression,
  LanguageError,
} from "../src/index.ts";
import { displayString } from "../src/string-format.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
test("sidefix spread is rejected at declaration", () => {
  for (const tail of ["", "1", "1 2"])
    assert.throws(
      () => run("macro :all xs... :: Int* Code` 0\nall " + tail),
      (e: unknown) => {
        assert.ok(e instanceof LanguageError);
        assert.equal(e.diagnostic.code, "E_SIDEFIX_SPREAD");
        return true;
      },
    );
});
test("named pattern grammar respects block scope and failed REPL transactions", () => {
  const i = new Interpreter();
  i.run("def Point type :Point(x :: Int)", "repl");
  i.run("macro :take p :: Point Code$` $(p)", "repl");
  assert.equal(displayResults(i.run("take Point(2)")), "Point(2)");
  assert.throws(() => i.run("def Hidden type :Hidden(Int)\nmissing"));
  assert.throws(() =>
    i.run("macro :hidden p :: Hidden Code` 0\nhidden Hidden(1)"),
  );
});
test("source formatting preserves raw multiline strings and both quote characters", () => {
  for (const text of ["a\nb", 'He said "it\'s"', "a\\b", "x\nend\ny"]) {
    const syntax = { kind: "literal" as const, value: text };
    assert.equal(run(normal(syntax)), displayString(text));
  }
});
test("source formatting round trips boundary whitespace and backslashes", () => {
  for (const text of ["\nleading newline", "trailing newline\n", "a\\b"]) {
    const syntax = { kind: "literal" as const, value: text };
    assert.equal(run(normal(syntax)), displayString(text));
  }
});
test("a bare name is a symbol, not a sequence pattern", () => {
  assert.equal(parseExpression("x").kind, "symbol");
});
