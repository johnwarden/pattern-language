import { loadTests } from "../src/test-suite.ts";
import { sourceFiles } from "./source-files.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interpreter, displayResults } from "../src/index.ts";
import { single, unwrap, equal } from "../src/values.ts";
import { parseExpression } from "../src/parser.ts";
import { normal, syntaxKey, LanguageError } from "../src/syntax.ts";

const bodyGrammar = readFileSync(
  new URL("../examples/body-grammar.pattern", import.meta.url),
  "utf8",
).replace(/Body\s*$/, "");
const todo = "def TodoList type :todo\n  todos :: String*\n  ...\nend\n";
const matrix = "def Matrix type [\n  values... :: Float**\n  ...\n]\n";
const run = (source: string) => displayResults(new Interpreter().run(source));
function rejects(source: string, code: string) {
  assert.throws(
    () => run(source),
    (error: unknown) =>
      error instanceof LanguageError && error.diagnostic.code === code,
  );
}

test("row boundaries survive canonical source without flattening comma packs", () => {
  for (const source of [
    "[\n  1,2\n  3,4\n]",
    "[\n]\n",
    "[\n ()\n]",
    "(\n  (1,2)\n  (3,4)\n)",
  ]) {
    const tree = parseExpression(source);
    assert.equal(syntaxKey(parseExpression(normal(tree))), syntaxKey(tree));
    assert.notEqual(syntaxKey(tree), syntaxKey(parseExpression("[1,2,3,4]")));
  }
  assert.equal(
    syntaxKey(parseExpression("[\n 1,\n 2,\n 3\n]")),
    syntaxKey(parseExpression("[1,2,3]")),
  );
});

test("vertical string captures are typed lists with empty and nonempty collections", () => {
  assert.equal(
    run(
      todo +
        't = TodoList`\n todo\n  "one"\n  "two"\n end\nend\n(toString(String*)(t.todos),parse(TodoList)(toString(TodoList)(t)) == t)',
    ),
    '("[\\"one\\", \\"two\\"]", True)',
  );
  assert.equal(
    run(
      todo + "t = TodoList` todo (\n\n)\n(t.todos, toString(String*)(t.todos))",
    ),
    '([], "[]")',
  );
});

test("horizontal and vertical captures preserve two dimensions, including empty rows", () => {
  assert.equal(
    run(
      matrix +
        "(m :: Matrix) = [\n 1,2\n 3,4\n]\n(toString(Float**)(m.values),parse(Matrix)(toString(Matrix)(m)) == m)",
    ),
    '("[[1, 2], [3, 4]]", True)',
  );
  assert.equal(
    run(
      matrix +
        "m = Matrix` [\n ()\n (1,)\n 2,3,4\n]\ntoString(Float**)(m.values)",
    ),
    '"[[], [1], [2, 3, 4]]"',
  );
  assert.equal(
    run(matrix + "m = Matrix` [\n]\n(m.values,toString(Matrix)(m))"),
    '([], "[\\n\\n]")',
  );
});

test("row collection literals evaluate their fields while preserving every row", () => {
  assert.equal(
    run(
      matrix +
        "x = 3\n(m :: Matrix) = [\n x, x + 1\n x * 2, 9\n]\n(toString(Float**)(m.values),parse(Matrix)(toString(Matrix)(m)) == m)",
    ),
    '("[[3, 4], [6, 9]]", True)',
  );
});

test("repeated application rows collect heads and argument packs independently", () => {
  assert.equal(
    run(
      "def Calls type\n (heads :: Symbol*)(arguments... :: Float**)\n ...\nend\nx = Calls`\n f(1,2)\n g(3)\nend\n(toString(Symbol*)(x.heads),toString(Float**)(x.arguments))",
    ),
    '("[f, g]", "[[1, 2], [3]]")',
  );
});

test("row reconstruction retains numeric interpretation through serialization", () => {
  assert.equal(
    run(
      "def Matrix type [\n xs... :: Float32**\n ...\n]\n(m :: Matrix) = [\n 3.14, 1\n]\n(m.xs,toString(Matrix)(m),parse(Matrix)(toString(Matrix)(m)) == m)",
    ),
    '([[3.140000104904175, 1]], "[\\n  (3.140000104904175, 1)\\n]", True)',
  );
});

test("the playground Body case uses the published source grammar", () => {
  const example = loadTests(
    sourceFiles(new URL("../tests/examples/", import.meta.url)),
  ).find(
    (value) => value.name === "Vertical spreading: Inspect a nested Body",
  )!.source;
  const prefix = example.split("\n\n")[0];
  assert.equal(prefix.trim(), bodyGrammar.trim());
});

test("vertical annotations account for every dimension and duplicate declarations reject", () => {
  rejects(
    "def Wrong type [\n values... :: Float*\n ...\n]\n0",
    "E_SPREAD_DIMENSION",
  );
  rejects("def Wrong type\n ...\nend\n0", "E_VERTICAL_SPREAD");
  rejects(
    "def Wrong type\n x :: String*\n ...\n x :: String\nend\n0",
    "E_DUPLICATE_CAPTURE",
  );
});

test("bad vertical elements are rejected with their source location", () => {
  assert.throws(
    () => run(todo + 't = TodoList`\n todo\n  "valid"\n  7\n end\nend\nt'),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_PATTERN_MISMATCH" &&
      error.diagnostic.primary?.line === 8 &&
      error.diagnostic.primary?.column === 3,
  );
  rejects(matrix + 'Matrix` [\n 1,"wrong"\n]', "E_PATTERN_MISMATCH");
});

test("competing row partitions are errors rather than greedy selection", () => {
  rejects(
    'def Ambiguous type\n a :: String*\n ...\n b :: String*\n ...\nend\nAmbiguous`\n "x"\nend',
    "E_AMBIGUOUS_PATTERN",
  );
});

test("typed Body exposes prefix statements and a multi-expression result row", () => {
  assert.equal(
    run(
      bodyGrammar +
        "b = Body`\n y = 2\n z = 3\n (y * z,y)\nend\n(toString(Binding*)(b.bindings),toString(ValueExpression*)(b.resultExpression))",
    ),
    '("[y = 2, z = 3]", "[y * z, y]")',
  );
});

test("direct binding destructuring extracts a nested Body without resolving free names", () => {
  assert.equal(
    run(
      bodyGrammar +
        "b = DestructuringBinding`\n (a,b) =\n  y = 2\n  z = 3\n  (y * z,y)\n end\nend\n((first :: SentenceCaseSymbol,second :: SentenceCaseSymbol) := (body :: Body)) = b\n(first,second,toString(Binding*)(body.bindings))",
    ),
    '(:a, :b, "[y = 2, z = 3]")',
  );
});

test("Body admits definitions and nested RHS bodies without installing or evaluating them", () => {
  const source =
    bodyGrammar +
    "b = Body`\n def missing(x) x * 2\n y =\n  z = 3\n  z\n end\n y\nend\n(parse(Body)(toString(Body)(b)) == b,parse(Type)(toString(Type)(Body)) == Body)";
  const interpreter = new Interpreter();
  assert.equal(displayResults(interpreter.run(source)), "(True, True)");
  for (const expression of ["missing(1)", "y", "z"])
    assert.throws(
      () => interpreter.run(expression),
      (error: unknown) =>
        error instanceof LanguageError &&
        error.diagnostic.code === "E_UNBOUND_NAME",
    );
});

test("Body requires a final row even when that row is an empty result pack", () => {
  assert.equal(
    run(bodyGrammar + "b = Body`\n ()\nend\n(b.bindings,b.resultExpression)"),
    "([], [])",
  );
  for (const rows of ["x = 2", "2\nx = 3", "def f(x) x * 2"])
    rejects(
      bodyGrammar +
        "b = Body`\n" +
        rows
          .split("\n")
          .map((x) => " " + x)
          .join("\n") +
        "\nend\nb",
      "E_PATTERN_MISMATCH",
    );
});

test("vertical type/value descriptions transfer to a fresh interpreter without capture names", () => {
  for (const source of [
    todo + 'TodoList`\n todo\n  "a"\n end\nend',
    matrix + "Matrix` [\n 1,2\n 3,4\n]",
    bodyGrammar + "Body`\n y = 2\n y\nend",
  ]) {
    const first = new Interpreter();
    const value = single(first.run(source));
    const name = source.startsWith(todo)
      ? "TodoList"
      : source.startsWith(matrix)
        ? "Matrix"
        : "Body";
    const type = unwrap(single(first.run(name)));
    assert.equal(type.kind, "type");
    if (type.kind !== "type") continue;
    const text = single(
      first.call(
        "toString",
        [{ label: "_1", value: type }],
        [{ label: "_1", value }],
      ),
    );
    const description = single(first.run("toString(Type)(" + name + ")"));
    const fresh = new Interpreter();
    const literal = unwrap(description),
      data = unwrap(text);
    assert.equal(literal.kind, "literal");
    assert.equal(data.kind, "literal");
    if (literal.kind !== "literal" || data.kind !== "literal") continue;
    const restored = unwrap(
      fresh.readValue(
        unwrap(single(fresh.run("Type"))) as typeof type,
        String(literal.value),
      ),
    );
    assert.equal(restored.kind, "type");
    if (restored.kind === "type")
      assert.ok(equal(value, fresh.readValue(restored, String(data.value))));
  }
});
