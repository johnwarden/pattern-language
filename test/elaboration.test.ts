import test from "node:test";
import assert from "node:assert/strict";
import { Grammar, Interpreter, parseSurface } from "../src/index.ts";
import { elaborateBlock } from "../src/elaboration.ts";
import { readBootstrap } from "../src/bootstrap.ts";

test("surface syntax is independent of installed language forms", () => {
  const source = "choose 1 otherwise 2";
  const surface = parseSurface(source);
  assert.equal(surface.kind, "block");
  if (surface.kind !== "block") return;
  assert.equal(surface.lines[0].kind, "sequence");
  const grammar = new Grammar(
    "def Choice type :choose (a :: Expression) :otherwise (b :: Expression)",
  );
  const form = grammar.parseAs(source, "Form");
  assert.equal(form.kind, "form");
  if (form.kind === "form") assert.equal(form.name, "Choice");
  assert.deepEqual(parseSurface(source), surface);
});

test("elaboration accepts each form before recognizing the next", () => {
  const block = parseSurface("first\nsecond");
  assert.equal(block.kind, "block");
  if (block.kind !== "block") return;
  const events: string[] = [];
  elaborateBlock(block, {
    read(items, pos) {
      events.push("read " + pos);
      if (pos === 1) assert.equal(events[1], "accept");
      return [{ end: pos + 1, fields: [items[pos]], captures: new Map() }];
    },
    accept() {
      events.push("accept");
    },
    finish() {
      events.push("finish");
    },
  });
  assert.deepEqual(events, ["read 0", "accept", "read 1", "accept", "finish"]);
});

test("generic block elaboration does not impose the language's final-result policy", () => {
  const block = parseSurface("x = 1");
  if (block.kind !== "block") assert.fail();
  assert.doesNotThrow(() =>
    elaborateBlock(block, {
      read: (items, pos) => [
        { end: pos + 1, fields: [items[pos]], captures: new Map() },
      ],
      accept() {},
    }),
  );
  assert.throws(
    () => new Interpreter().parse("x = 1"),
    /must end with a result/,
  );
});

test("bootstrap declarations can describe def without an installed def grammar", () => {
  const [declaration] = readBootstrap(
    "def Definition type :def (signature :: Signature) (body :: Body)",
  );
  assert.equal(declaration.name.name, "Definition");
  assert.equal(declaration.pattern.length, 3);
  assert.throws(() => readBootstrap("def lowercase type :x"), /type name/);
});

test("elaboration rejects non-progressing recognizers", () => {
  const block = parseSurface("x");
  if (block.kind !== "block") assert.fail();
  assert.throws(
    () =>
      elaborateBlock(block, {
        read: (items, pos) => [
          { end: pos, fields: [items[pos]], captures: new Map() },
        ],
        accept() {},
      }),
    /does not match/,
  );
});
