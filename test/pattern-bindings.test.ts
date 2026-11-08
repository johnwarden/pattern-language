import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  Grammar,
  normal,
} from "../src/index.ts";
import {
  bindingPattern,
  validatePatternCaptures,
} from "../src/pattern-compiler.ts";
import { patternBindings } from "../src/pattern-captures.ts";
import type { Pattern } from "../src/pattern.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
test("compiled binding metadata identifies explicit, implicit, typed and rest sites", () => {
  const metadata = patternBindings(
    bindingPattern([
      parseExpression("Box(T :: Type,rest... :: Int*,color: String)"),
    ]),
  );
  assert.deepEqual([...metadata.keys()], ["T", "rest", "color"]);
  assert.deepEqual(
    [...metadata.values()].map(([b]) => [
      b.name,
      !!b.rest,
      b.origin?.implicit,
      b.origin && normal(b.origin.syntax),
    ]),
    [
      ["T", false, false, "T"],
      ["rest", true, false, "rest"],
      ["color", false, true, "String"],
    ],
  );
});
test("annotations, defaults, literal heads and nested type accessors are not binding sites", () => {
  const pattern = parseExpression(
    "Box(T,kind: :Red,inner: (type Inner(hidden :: Int)),size: s :: Int = outside)",
  );
  assert.deepEqual([...validatePatternCaptures([pattern])], ["inner", "s"]);
  assert.deepEqual(
    [...validatePatternCaptures([parseExpression(":literal")])],
    [],
  );
});
test("alternative sites share a binding but duplicates on a matching path fail", () => {
  const metadata = patternBindings(
    bindingPattern([parseExpression("Some(x) | Other(x)")]),
  );
  assert.equal(metadata.get("x")?.length, 2);
  assert.throws(
    () => bindingPattern([parseExpression("Pair(x,x)")]),
    /duplicate capture name/,
  );
});
test("compiled references and local capture maps keep their own binding scopes", () => {
  const hidden: Pattern<never> = {
    kind: "capture",
    name: "hidden",
    pattern: { kind: "any" },
  };
  const ref: Pattern<never> = {
    kind: "ref",
    key: "R",
    name: "R",
    resolve: () => hidden,
  };
  const local: Pattern<never> = {
    kind: "map",
    pattern: hidden,
    localCaptures: true,
    transform: (xs) => xs,
  };
  assert.deepEqual(
    [...patternBindings({ kind: "sequence", parts: [ref, local] }).keys()],
    [],
  );
});
test("one positional and rest pattern agrees across bindings, parameters, arms, types, macros and grammar", () => {
  const spec = "Pair(first :: Int,rest... :: Int*)",
    value = "Pair(1, 2, 3)";
  for (const source of [
    spec + " = " + value + "\nrest",
    "def f(" + spec + ") rest\nf(" + value + ")",
    "match " + value + "\n  " + spec + " -> rest\nend",
    "def P type " + spec + "\np = " + value + " :: P\np.rest",
    "macro :take Args(" +
      spec +
      ") Code$` [$(rest...)]\n(take Args(" +
      value +
      "))",
  ])
    assert.equal(run(source), "[2, 3]", source);
  const grammar = new Grammar("def P type " + spec);
  assert.equal(normal(grammar.parseAs(value, "P")), value);
  assert.deepEqual(
    [...patternBindings(grammar.rules.get("P")!).keys()],
    ["first", "rest"],
  );
});
test("hygiene preserves quoted literal patterns and literal constructor heads", () => {
  assert.equal(
    run("macro :make Args() Code` :foo -> 1\nf = (make Args())\nf(:foo)"),
    "1",
  );
  assert.equal(
    run(
      "macro :make Args() Code` (tag,tag(value)) -> value\nf = (make Args())\nf(1,:tag(3))",
    ),
    "3",
  );
});
test("default expressions use the surrounding scope before binding captures", () => {
  assert.equal(
    run(
      "size = 9\nmacro :make Args() Code` (size: Int = size) -> size\nf = (make Args())\nf()",
    ),
    "9",
  );
});
test("hygiene renames all alternative sites together and leaves inserted patterns in their caller scope", () => {
  assert.equal(
    run(
      "macro :make Args() Code` (:Some(x) | :Other(x)) -> x\nf = (make Args())\n(f(Some(3)),f(Other(4)))",
    ),
    "(3, 4)",
  );
  assert.equal(
    run(
      "macro :make Args(p) Code$` $(p) -> 42\nf = (make Args(:foo))\nf(:foo)",
    ),
    "42",
  );
});
test("alpha-renaming cannot hide duplicate captures in separate parameter packs", () => {
  assert.throws(
    () =>
      run(
        "macro :make Args() Code` (\n  def f(x)(x) x\n  1\n)\n(make Args())",
      ),
    /duplicate capture name/,
  );
});
