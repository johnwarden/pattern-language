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

test("a vertical spread evaluates its row-list operand once", () => {
  const interpreter = new Interpreter();
  const rows = single(
    interpreter.run(
      "type Matrix concrete [\n cells... :: Float32**\n ...\n]\n" +
        "source = ([\n 0.5, 1\n 2\n] :: Matrix)\nsource.cells",
    ),
  );
  let calls = 0;
  interpreter.env.functions.set("nextRows", [
    {
      kind: "native",
      id: -1,
      name: "nextRows",
      arities: [0],
      test: (args) => args.length === 0,
      invoke: () => {
        calls++;
        return [{ label: "_1", value: rows }];
      },
    },
  ]);

  assert.equal(
    displayResults(
      interpreter.run(
        "rebuilt = ([\n nextRows()...\n ...\n] :: Matrix)\nrebuilt.cells",
      ),
    ),
    "[[0.5, 1], [2]]",
  );
  assert.equal(calls, 1);
});

test("empty collection rows do not admit empty executable programs", () => {
  assert.equal(
    run(
      "type Matrix concrete [\n cells... :: Float32**\n ...\n]\n" +
        "([\n] :: Matrix).cells",
    ),
    "[]",
  );
  rejects("", "E_SYNTAX");
});

test("invalid vertical value dimensions fail with a located language error", () => {
  for (const [source, line] of [
    ["rows = 1\n[\n rows...\n ...\n]", 3],
    ["rows = [1, 2]\n[\n rows...\n ...\n]", 3],
    ["[\n ...\n]", 2],
  ] as const) {
    assert.throws(
      () => run(source),
      (error: unknown) => {
        assert.ok(error instanceof LanguageError);
        assert.equal(error.diagnostic.code, "E_VERTICAL_SPREAD");
        assert.equal(error.diagnostic.primary?.line, line);
        assert.equal(error.diagnostic.primary?.column, 2);
        return true;
      },
    );
  }
});

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

test("vertical string captures reject a spaced parenthesis after the constructor", () => {
  assert.throws(
    () =>
      run(
        todo +
          "t = TodoList` todo (\n\n)\n(t.todos, toString(String*)(t.todos))",
      ),
    (error: unknown) =>
      error instanceof LanguageError &&
      /a term cannot be followed by a spaced '\('/.test(
        (error as LanguageError).message,
      ),
  );
});

test("row reconstruction retains numeric interpretation through serialization", () => {
  assert.equal(
    run(
      "def Matrix type [\n xs... :: Float32**\n ...\n]\n(m :: Matrix) = [\n float32(3.14), 1\n]\n(m.xs,toString(Matrix)(m),parse(Matrix)(toString(Matrix)(m)) == m)",
    ),
    '([[3.140000104904175, 1]], "[\\n  (0x1.91EB86p1, 1)\\n]", True)',
  );
  rejects(
    "def Matrix type [\n xs... :: Float32**\n ...\n]\n(m :: Matrix) = [\n 3.14, 1\n]",
    "E_PATTERN_MISMATCH",
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

test("Body admits definitions without installing or evaluating them in the host session", () => {
  const source =
    bodyGrammar +
    "b = Body`\n def missing(x) x * 2\n y =\n  z = 3\n  z\n end\n y\nend\n0";
  const interpreter = new Interpreter();
  assert.equal(displayResults(interpreter.run(source)), "0");
  for (const expression of ["missing(1)", "y", "z"])
    assert.throws(
      () => interpreter.run(expression),
      (error: unknown) =>
        error instanceof LanguageError &&
        error.diagnostic.code === "E_UNBOUND_NAME",
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
        unwrap(single(fresh.run("type Type"))) as typeof type,
        String(literal.value),
      ),
    );
    assert.equal(restored.kind, "type");
    if (restored.kind === "type")
      assert.ok(equal(value, fresh.readValue(restored, String(data.value))));
  }
});
