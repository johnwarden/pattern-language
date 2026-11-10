import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  Grammar,
  DEFAULT_GRAMMAR,
  normal,
  parseExpression,
} from "../src/index.ts";
import { loadTests } from "../src/test-suite.ts";
import { sourceFiles } from "./source-files.ts";

const run = (s: string) => displayResults(new Interpreter().run(s));
const languageCases = loadTests(
  sourceFiles(new URL("../tests/language/", import.meta.url)),
);

// Printer and empty-pack display programs the source suite cannot express as
// result data. Canonical round trips of ordinary evaluation programs read
// executable cases from tests/language instead of a second program table.
const displayPrograms: [string, string, string][] = [
  ["function value", "f = () -> 42\nf", "<function>"],
  ["empty results", "def f()\n  ()\nend\nf()", "()"],
  ["empty lambda", "f = x -> ()\nf(1)", "()"],
  [
    "lazy names",
    "def List(t :: Type) type :Nil | :Cons(t,List(t))\nList(Int)",
    "Type(Recursive(:Nil | Cons(Int, Recur(0))))",
  ],
];

function canonicalRoundTrip(name: string, source: string, expected?: string) {
  test("canonical roundtrip: " + name, () => {
    const i = new Interpreter(),
      tree = i.parse(source);
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") return;
    const canonical = tree.lines.map((n) => normal(n)).join("\n");
    assert.equal(run(canonical), expected ?? run(source), canonical);
  });
}

for (const [name, source, expected] of displayPrograms) {
  test(name, () => assert.equal(run(source), expected));
  canonicalRoundTrip(name, source, expected);
}

for (const value of languageCases) {
  if (!value.program || value.steps.some((step) => step.kind === "fails"))
    continue;
  canonicalRoundTrip(value.id, value.source);
}

test("empty calls preserve structure", () =>
  assert.notDeepEqual(parseExpression("f"), parseExpression("f()")));
test("outfix versus nested head", () =>
  assert.notDeepEqual(parseExpression("[1, 2]"), parseExpression("[](1,2)")));
test("grammar is authoritative for execution", () => {
  const grammar = DEFAULT_GRAMMAR.replace(":if ", ":when ");
  const i = new Interpreter(grammar);
  assert.equal(displayResults(i.run("when True 1 else 2")), "1");
  assert.throws(() => i.run("if True 1 else 2"), /grammar|macro/);
});
test("custom grammar rejects duplicate captures", () => {
  assert.throws(
    () => new Grammar("def Same type :Pair(x :: Int,x :: Int)"),
    /duplicate capture/,
  );
});
test("grammar repetition", () => {
  const g = new Grammar("def Many type :Many(xs... :: Int*)");
  assert.equal(normal(g.parseAs("Many(1, 2)", "Many")), "Many(1, 2)");
});
test("REPL permits a binding and commits only on success", () => {
  const i = new Interpreter();
  i.run("x = 1", "repl");
  assert.equal(displayResults(i.run("x + 1", "repl")), "2");
  assert.throws(() => i.run("z = 9\n1 / 0", "repl"));
  assert.throws(() => i.run("z", "repl"), /unbound/);
});
test("untyped grammar rejects duplicate captures", () => {
  assert.throws(
    () => new Grammar("def Same type :Pair(x,x)"),
    /duplicate capture/,
  );
});
test("empty grammar repetition", () =>
  assert.equal(
    normal(
      new Grammar("def Many type :Many(xs... :: Int*)").parseAs(
        "Many()",
        "Many",
      ),
    ),
    "Many()",
  ));

test("canonical named fields sort after positional fields", () => {
  assert.equal(normal(parseExpression("R(9,z: 2,a: 1)")), "R(9, a: 1, z: 2)");
  assert.equal(normal(parseExpression("(9,z: 2,a: 1)")), "(9, a: 1, z: 2)");
});

test("duplicate named labels are surface errors including nested packs", () => {
  for (const source of [
    "R(a: 1,a: 2)",
    "(a: 1,a: 2)",
    "def f(a: Int,a: Int) 1\n0",
    "(a: x,a: y) = (a: 1)\n0",
  ]) {
    assert.throws(
      () => parseExpression(source.split("\n")[0].replace(/^def f/, "f")),
      /duplicate/,
    );
  }
});

test("actions reserve postfix exclamation in the surface tree", () => {
  assert.equal(parseExpression("()!").kind, "postfix");
  assert.equal(normal(parseExpression("Int!")), "Int!");
});

test("ASCII camel and upper-snake words have explicit spelling boundaries", () => {
  for (const s of ["foo_bar", "foo_", "_FOO", "A__B", "A_B_", "café"])
    assert.throws(() => parseExpression(s), /ASCII/);
  for (const s of [
    "HTTP",
    "someURL",
    "URLValue",
    "aB",
    "ABc",
    "AB_",
    "A_B",
    "ERR_FILE_NOT_FOUND",
    "foo",
    "fooBar",
    "Http",
    "UserId",
    "Int",
    "T",
    "Ts",
  ])
    assert.doesNotThrow(() => parseExpression(s));
});

test("callable variables compete with accessor methods", () => {
  const setup =
    "def Rectangle type :Rect(w :: Float,h :: Float)\nr = Rect(3,4) :: Rectangle\nw = (r :: Rectangle) -> r.h\n";
  for (const call of ["w(r)", "r.w"]) {
    assert.throws(
      () => run(setup + call),
      (error: any) => {
        assert.equal(error.diagnostic.code, "E_AMBIGUOUS_CALL");
        return true;
      },
    );
  }
  assert.equal(run(setup + "w"), "<function>");
});
