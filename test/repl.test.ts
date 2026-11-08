import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  applyReplLine,
  isIncompleteReplEntry,
  replEntryReady,
  LanguageError,
} from "../src/index.ts";

const parseRepl = (interpreter: Interpreter) => (source: string) =>
  interpreter.parse(source, "repl");
const ready = (source: string, interpreter = new Interpreter()) =>
  replEntryReady(source, parseRepl(interpreter));
const play = (lines: string[], interpreter = new Interpreter()) => {
  const isReady = (source: string) => ready(source, interpreter);
  let pending = "";
  const submitted: string[] = [];
  for (const line of lines) {
    const step = applyReplLine(pending, line, isReady);
    pending = step.pending;
    if (step.submit) submitted.push(step.submit);
    if (step.quit) break;
  }
  return { pending, submitted };
};

test("REPL submits a finished grammar form on its last line", () => {
  const i = new Interpreter();
  assert.equal(ready("1", i), true);
  assert.equal(ready("if True 1 else 2", i), true);
  const { submitted, pending } = play(["1", ":quit"], i);
  assert.deepEqual(submitted, ["1\n"]);
  assert.equal(pending, "");
});

test("REPL waits while a layout block still needs end", () => {
  const i = new Interpreter();
  assert.equal(ready("if True\n  1\n", i), false);
  assert.equal(ready("def f(x)\n  x", i), false);
  const waiting = play(["if True", "  1"], i);
  assert.equal(waiting.submitted.length, 0);
  assert.match(waiting.pending, /if True/);
});

test("REPL does not evaluate a clause-bearing form before the grammar is complete", () => {
  const i = new Interpreter();
  assert.equal(ready("if True 1", i), false);
  assert.equal(ready("if True\n  1\nelse", i), false);
  const early = play(["if True", "  1", "else"], i);
  assert.equal(early.submitted.length, 0);
  const finished = play(["if True", "  1", "else 2"], i);
  assert.equal(finished.submitted.length, 1);
  assert.match(finished.submitted[0], /else 2/);
});

test("REPL is ready after end, and a blank line still force-submits", () => {
  const i = new Interpreter();
  assert.equal(
    ready(
      `if True
  1
else
  2
end`,
      i,
    ),
    true,
  );
  const closed = play(["if True", "  1", "else", "  2", "end"], i);
  assert.equal(closed.submitted.length, 1);
  assert.match(closed.submitted[0], /\nend\n$/);
  const forced = play(["if True", "  1", ""], i);
  assert.equal(forced.submitted.length, 1);
  assert.match(forced.submitted[0], /if True/);
});

test("user-defined grammar drives the same REPL completeness rule", () => {
  const i = new Interpreter();
  i.run(
    "macro (:probe (body :: Body) :then (result :: Expression)) Code$` $(result)",
    "repl",
  );
  i.run("macro (:hold (body :: Body)) Code$` $(body)", "repl");
  assert.equal(ready("probe 1 then 2", i), true);
  assert.equal(ready("probe\n  1\nthen 2", i), true);
  assert.equal(ready("probe\n  1\n", i), false);
  assert.equal(ready("hold\n  1\n", i), false);
  assert.equal(ready("hold\n  1\nend", i), true);
  const probe = play(["probe", "  1", "then 2"], i);
  assert.equal(probe.submitted.length, 1);
  const holdEarly = play(["hold", "  1"], i);
  assert.equal(holdEarly.submitted.length, 0);
  const holdDone = play(["hold", "  1", "end"], i);
  assert.equal(holdDone.submitted.length, 1);
});

test("quoted if/else branches are ready only after the shared end", () => {
  const quoted = `if 1 == 1 '
    Hello
else '
    there`;
  assert.equal(ready(quoted), false);
  assert.equal(ready(quoted + "\nend"), true);
  const tabbed = "if 1 == 1 '\n\tHello\nelse '\n\tthere";
  assert.equal(ready(tabbed), false);
  assert.equal(ready(tabbed + "\nend"), true);
  const mixed = "if 1 == 1 '\n \tHello\nelse '\n \tthere";
  assert.equal(ready(mixed), false);
  const finished = play(["if 1 == 1 '", "    Hello", "else '", "    there", "end"]);
  assert.equal(finished.submitted.length, 1);
  assert.match(finished.submitted[0], /\nend\n$/);
});

test("incomplete parse errors stay incomplete; other errors are ready to report", () => {
  assert.equal(
    isIncompleteReplEntry(
      new LanguageError(
        "an indented block requires an explicit aligned end",
        { start: 0, end: 1, line: 1, column: 1 },
        { code: "E_BLOCK_END", phase: "parse" },
      ),
    ),
    true,
  );
  assert.equal(ready(")"), true);
});
