import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseSurface,
  Grammar,
} from "../src/index.ts";
import {
  indentBeyond,
  indentRelation,
  lineIndent,
  stripLinePrefix,
} from "../src/indent.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const parse = (source: string) => new Interpreter().parse(source);
const forms = new Grammar().layoutForms();

test("indent prefixes use exact tab/space strings, not tabstop width", () => {
  assert.equal(lineIndent(" \t  x"), " \t  ");
  assert.equal(indentRelation("  ", "  "), "same");
  assert.equal(indentRelation("  \t", "  "), "nested");
  assert.equal(indentRelation("\t", "\t\t"), "dedented");
  assert.equal(indentRelation("\t", "  "), "incompatible");
  assert.equal(indentRelation(" \t", "\t "), "incompatible");
  assert.equal(indentBeyond("\t  ", "\t"), true);
  assert.equal(indentBeyond("  ", "\t"), false);
  assert.equal(stripLinePrefix("\t  hello", "\t  "), "hello");
  assert.equal(stripLinePrefix("  hello", "\t"), "");
});

test("pure spaces, pure tabs, and mixed prefixes share one layout relation", () => {
  assert.equal(
    run(`if True
  1
else
  2
end`),
    "1",
  );
  assert.equal(run("if True\n\t1\nelse\n\t2\nend"), "1");
  assert.equal(run("if True\n \t1\nelse\n \t2\nend"), "1");
  assert.equal(
    run(`if True
\t  if False
\t    0
\t  else
\t    1
\t  end
else
\t  2
end`),
    "1",
  );
  assert.throws(
    () => parse("if True\n  1\n\t2\nend"),
    /inconsistent indentation/,
  );
  assert.throws(
    () => parse("if True\n\t1\n  2\nend"),
    /inconsistent indentation/,
  );
});

test("quoted branches keep payload after mixed quote-indent stripping", () => {
  assert.equal(
    run("if 1 == 1 '\n    Hello\nelse '\n    there\nend"),
    displayResults(new Interpreter().run('"Hello"')),
  );
  assert.equal(
    run("if 1 == 0 '\n    Hello\nelse '\n    there\nend"),
    displayResults(new Interpreter().run('"there"')),
  );
  assert.equal(
    run("if 1 == 1 '\n\tHello\nelse '\n\tthere\nend"),
    displayResults(new Interpreter().run('"Hello"')),
  );
  assert.equal(
    run("if 1 == 1 '\n \tHello\nelse '\n \tthere\nend"),
    displayResults(new Interpreter().run('"Hello"')),
  );
  assert.equal(
    run("if 1 == 1 '\n\t  Hello\n\t    World\nelse '\n\t  there\nend"),
    displayResults(new Interpreter().run('"Hello\\n  World"')),
  );
  parseSurface(
    "f = x ->\n\t  if 1 == 1 '\n\t    Hello\n\t  else '\n\t    there\n\t  end\nend",
    "program",
    { layoutForms: forms },
  );
  assert.equal(
    run("if 1 == 1 '\n  Hello\nelse '\n\tthere\nend"),
    displayResults(new Interpreter().run('"Hello"')),
  );
  assert.throws(
    () => parse("if 1 == 1 '\n  Hello\n\tWorld\nelse '\n  there\nend"),
    (error: unknown) =>
      error instanceof LanguageError &&
      (error.message.includes("indentation prefix") ||
        error.diagnostic.code === "E_QUOTE_INDENT"),
  );
});
