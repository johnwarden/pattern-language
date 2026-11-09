import test from "node:test";
import assert from "node:assert/strict";
import {
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
test("a grammar rest pattern keeps compiled first and rest bindings", () => {
  const spec = "Pair(first :: Int,rest... :: Int*)",
    value = "Pair(1, 2, 3)";
  const grammar = new Grammar("def P type " + spec);
  assert.equal(normal(grammar.parseAs(value, "P")), value);
  assert.deepEqual(
    [...patternBindings(grammar.rules.get("P")!).keys()],
    ["first", "rest"],
  );
});
