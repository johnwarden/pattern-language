import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  normal,
} from "../src/index.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));

test("an indented typed quote requires an explicit aligned end", () => {
  assert.throws(
    () => new Interpreter().parse("Code`\n  1"),
    /explicit aligned end/,
  );
});
test("unknown reader functions produce a source-located name error", () => {
  assert.throws(
    () => run("unknown' text"),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_UNBOUND_NAME" &&
      error.diagnostic.primary?.line === 1,
  );
});
test("canonical source retains explicit templates and residual dollar holes", () => {
  const source = 'name = "Jo"\n$"Hi $name; $$name; $$(1)"';
  const tree = new Interpreter().parse(source);
  assert.equal(tree.kind, "block");
  if (tree.kind === "block")
    assert.equal(
      run(tree.lines.map((line) => normal(line)).join("\n")),
      run(source),
    );
});
test("hole errors identify the actual interpolation expression", () => {
  assert.throws(
    () => run('x = 1\ny = 2\n$"Hi $missing"'),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.primary?.line === 3 &&
      error.diagnostic.primary.column === 7,
  );
});
