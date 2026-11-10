import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Interpreter,
  displayResults,
  LanguageError,
  SYNTAX_SCHEMA,
  LANGUAGE_SCHEMA,
} from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));

test("syntax inspection and language transport share one executable schema", () => {
  assert.ok(LANGUAGE_SCHEMA.startsWith(SYNTAX_SCHEMA));
  assert.equal(
    readFileSync(
      new URL("../examples/syntax-tree.pattern", import.meta.url),
      "utf8",
    ),
    SYNTAX_SCHEMA + "SyntaxNode\n",
  );
  assert.equal(
    run("t = syntaxTree(:(missing(1 / 0)))\nt .matches syntaxSchema()"),
    "True",
  );
});

test("ordinary patterns inspect computed heads and complete argument packs", () => {
  const source = readFileSync(
    new URL("../examples/inspect-expression.pattern", import.meta.url),
    "utf8",
  );
  assert.equal(
    run(source),
    '("factory", 1, 2, "color", factory(1)(3, color: Red), True)',
  );
});

test("inspection distinguishes symbols, empty calls and successive packs", () => {
  assert.equal(
    run(
      "a = syntaxTree(:f)\nb = syntaxTree(Code` f())\nc = syntaxTree(Code` f(1)(2))\nd = syntaxTree(Code` f(1,2))\n(a,b,c == d)",
    ),
    '(Name("f", False), Apply(Name("f", False), []), False)',
  );
});

test("canonical field order is retained in the structural view", () => {
  assert.equal(
    run(
      "a = syntaxTree(:(f(1,z: 3,a: 2)))\nb = syntaxTree(:(f(1,a: 2,z: 3)))\nApply(_,fields) = a\n(a == b,fields)",
    ),
    '(True, [Field("_1", NumberLiteral(1)), Field("a", NumberLiteral(2)), Field("z", NumberLiteral(3))])',
  );
});

test("syntax reconstruction is inert and rejects malformed fields and variants", () => {
  assert.equal(
    run(
      'syntaxExpression(Apply(Name("missing",False),[Field("_1",NumberLiteral(1))]))',
    ),
    "missing(1)",
  );
  for (const source of [
    "syntaxExpression(Unknown())",
    'syntaxExpression(Apply(Name("f",False),[],:extra))',
    'syntaxExpression(Name("x",3))',
    'syntaxExpression(Apply(Name("f",False),[Field("a",NumberLiteral(1)),Field("a",NumberLiteral(2))]))',
    'syntaxExpression(Apply(Name("f",False),[Field("a",NumberLiteral(1)),Field("_1",NumberLiteral(2))]))',
  ])
    assert.throws(() => run(source), LanguageError);
});

