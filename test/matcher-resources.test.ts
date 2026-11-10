import test from "node:test";
import assert from "node:assert/strict";
import { Matcher, Mismatch } from "../src/pattern.ts";
import type { Pattern, Adapter } from "../src/pattern.ts";
import { LanguageError } from "../src/syntax.ts";
import { Interpreter, displayResults } from "../src/index.ts";

type Tree = string | { head: Tree; body: { label: string; value: Tree }[] };
const adapter: Adapter<Tree> = {
  equal: Object.is,
  decompose: (value) => (typeof value === "string" ? undefined : value),
  rebuild: (_value, head, body) => ({ head, body }),
};
const field = (value: Tree) => [{ label: "_1", value }];
const literal = (expected: string): Pattern<Tree> => ({
  kind: "test",
  name: expected,
  test: (value) => value === expected,
});

test("administrative pattern wrappers do not consume a nesting allowance", () => {
  let pattern: Pattern<Tree> = literal("ok");
  for (let i = 0; i < 10000; i++)
    pattern = { kind: "map", pattern, transform: (fields) => fields };
  assert.equal(
    new Matcher(adapter).match(pattern, field("ok")).fields[0].value,
    "ok",
  );
});

test("deep reference chains do not repeatedly search every enclosing reference", () => {
  let pattern: Pattern<Tree> = literal("ok");
  for (let i = 0; i < 10000; i++) {
    const child = pattern;
    pattern = { kind: "ref", key: i, name: "Layer", resolve: () => child };
  }
  const matcher = new Matcher(adapter);
  assert.equal(matcher.match(pattern, field("ok")).end, 1);
  assert.equal(matcher.active.length, 0);
});

test("productive recursive structure is matched using the work stack", () => {
  let value: Tree = ":End";
  for (let i = 0; i < 400; i++) value = { head: "Next", body: field(value) };
  const recursive: Pattern<Tree> = {
    kind: "ref",
    key: "chain",
    name: "Chain",
    resolve: () => ({
      kind: "union",
      choices: [
        literal(":End"),
        {
          kind: "node",
          head: literal("Next"),
          body: {
            kind: "fields",
            parts: [{ kind: "label", label: "_1", pattern: recursive }],
          },
        },
      ],
    }),
  };
  assert.equal(new Matcher(adapter).match(recursive, field(value)).end, 1);
});

test("nonproductive references reject and release their recursion guards", () => {
  const recursive: Pattern<Tree> = {
    kind: "ref",
    key: "loop",
    name: "Loop",
    resolve: () => recursive,
  };
  const matcher = new Matcher(adapter);
  assert.throws(() => matcher.match(recursive, field("x")), Mismatch);
  assert.equal(matcher.active.length, 0);
  assert.equal(matcher.match(literal("x"), field("x")).end, 1);
});

test("the total work budget reports a language diagnostic and unwinds pending guards", () => {
  let pattern: Pattern<Tree> = literal("x");
  for (let i = 0; i < 100001; i++)
    pattern = { kind: "map", pattern, transform: (fields) => fields };
  const child = pattern;
  pattern = {
    kind: "ref",
    key: "budget-root",
    name: "Root",
    resolve: () => child,
  };
  const matcher = new Matcher(adapter);
  assert.throws(
    () => matcher.match(pattern, field("x")),
    (error: unknown) => {
      assert(error instanceof LanguageError);
      assert.equal(error.diagnostic.code, "E_MATCH_LIMIT");
      return true;
    },
  );
  assert.equal(matcher.active.length, 0);
});

test("nested portable type descriptions survive schema validation and round trips", () => {
  const depth = 20;
  const pattern = "Box(".repeat(depth) + "Int" + ")".repeat(depth);
  assert.equal(
    displayResults(
      new Interpreter().run(
        "t = Type(:(" + pattern + "))\nparse(Type)(toString(Type)(t)) == t",
      ),
    ),
    "True",
  );
});
