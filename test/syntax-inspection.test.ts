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

// Moved verbatim from tests/layout/call-label-spacing.test: native SyntaxNode
// shapes of tight calls and label colons belong to the host. The source cases
// state the same spacing rules with quoted patterns, Code text and equality.
for (const [source, expected] of [
  ["f(x)", 'Apply(Name("f", False), [Field("_1", Name("x", False))])'],
  ["f()", 'Apply(Name("f", False), [])'],
  ["Rect(w: 1)", 'Apply(Name("Rect", False), [Field("w", NumberLiteral(1))])'],
  ["Rect(w:1)", 'Apply(Name("Rect", False), [Field("w", NumberLiteral(1))])'],
  [
    "Rect(w: (1))",
    'Apply(Name("Rect", False), [Field("w", NumberLiteral(1))])',
  ],
  [
    "Rect(w :(1))",
    'Apply(Name("Rect", False), [Field("_1", Sequence([Name("w", False), Quote(NumberLiteral(1))]))])',
  ],
]) {
  test("syntaxTree of :(" + source + ") is the documented SyntaxNode", () => {
    assert.equal(
      run("syntaxTree(:(" + source + ")) == (" + expected + " :: SyntaxNode)"),
      "True",
    );
  });
}

// Moved from tests/examples/expressions.test "Inspect and rebuild syntax",
// including the former `legacy expect` on syntaxExpression(changed).
test("syntaxTree destructures an application and syntaxExpression rebuilds it", () => {
  const setup =
    "tree = syntaxTree(:(factory(1)(2, color: :Red)))\n" +
    "Apply(function, arguments) = tree\n" +
    'changed = Apply(function, [Field("_1", NumberLiteral(3)), Field("color", Name("Red", True))])\n';
  assert.equal(
    run(setup + "syntaxExpression(changed) == :(factory(1)(3, color: :Red))"),
    "True",
  );
  assert.equal(
    run(setup + "syntaxExpression(changed)"),
    "factory(1)(3, color: Red)",
  );
});

// Moved from tests/examples/types.test "Inspect a typed code binding without
// evaluating it": the AST-shaped predicate and destructuring of the binding.
test("a typed Code binding is inspected through its syntaxTree without evaluation", () => {
  const source = [
    "def isBinding(e)",
    "  match syntaxTree(e)",
    '    Apply(Apply(Name("=", False), _), _) -> True',
    "    _ -> False",
    "  end",
    "end",
    "def Binding Code .where (e -> isBinding(e))",
    "",
    "code = Code` f = x -> (x * 2)",
    "(patternText, bodyText) =",
    "  match code",
    "    (binding :: Binding) ->",
    "      Apply(Apply(_, left), right) = syntaxTree(binding)",
    '      [Field("_1", pattern)] = left',
    '      [Field("_1", value)] = right',
    "      (toString(Code)(Code(syntaxExpression(pattern))), toString(Code)(Code(syntaxExpression(value))))",
    "    end",
    '    _ -> panic("Expected a binding")',
    "  end",
    "end",
    "(patternText, bodyText)",
  ].join("\n");
  assert.equal(run(source), '("f", "x -> (x * 2)")');
});
