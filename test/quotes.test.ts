import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  normal,
} from "../src/index.ts";
import { displayString } from "../src/string-format.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));

test("head-only and whole-expression quotation remain distinct", () => {
  assert.equal(
    run("def f(x) 2 * x\nb = :f(1)\nc = :(f(1))\n(b == c,b)"),
    "(True, f(1))",
  );
  assert.equal(run("x = 3\n(:Box(x),:(Box(x)))"), "(Box(3), Box(x))");
});
test("typed quote blocks expand macro templates with explicit interpolation", () => {
  assert.equal(
    run(
      "macro :addOne Args(x)\n  Code$`\n    y = $x\n    y + 1\n  end\nend\n(addOne Args(4))",
    ),
    "5",
  );
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
test("reader blocks preserve raw punctuation and indented end content", () => {
  const source =
    "def inspect(fragments,values) fragments\ninspect'\n  \" ' \\ $x\n    end\n  tail\nend # close";
  assert.equal(
    run(source),
    "[" + displayString("\" ' \\ $x\n  end\ntail") + "]",
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
