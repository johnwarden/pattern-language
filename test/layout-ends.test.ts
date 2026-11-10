import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseSurface,
  Grammar,
} from "../src/index.ts";

const isBlockEnd = (error: unknown) =>
  fails instanceof LanguageError && error.diagnostic.code === "E_BLOCK_END";
const isUnexpectedEnd = (error: unknown) =>
  fails instanceof LanguageError &&
  error.diagnostic.code === "E_UNEXPECTED_END";

test("clause keywords come from the active grammar object, not a hardcoded else list", () => {
  const otherwise = new Grammar(
    "def IfExpression type :if condition :: Expression consequent :: Body :otherwise alternative :: Body",
  ).layoutForms();
  parseSurface(
    `if True
  1
otherwise
  2
end`,
    "program",
    { layoutForms: otherwise },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
else
  2
end`,
        "program",
        { layoutForms: otherwise },
      ),
    isBlockEnd,
  );
  parseSurface(
    `if True
  1
else
  2
end`,
    "program",
    { layoutForms: new Grammar().layoutForms() },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
otherwise
  2
end`,
        "program",
        { layoutForms: new Grammar().layoutForms() },
      ),
    isBlockEnd,
  );
  parseSurface(
    `if 1 == 1 '
    Hello
otherwise '
    there
end`,
    "program",
    { layoutForms: otherwise },
  );
});

test("a grammar object's layout forms close probe/then without end", () => {
  const forms = new Grammar(
    "def Probe type :probe body :: Body :then result :: Expression\ndef Hold type :hold body :: Body",
  ).layoutForms();
  parseSurface(
    `probe
  1
then 2`,
    "program",
    { layoutForms: forms },
  );
  parseSurface("probe 1\nthen 2", "program", { layoutForms: forms });
  parseSurface(
    `hold
  1
end`,
    "program",
    { layoutForms: forms },
  );
  assert.throws(
    () =>
      parseSurface(
        `hold
  1`,
        "program",
        { layoutForms: forms },
      ),
    isBlockEnd,
  );
  assert.throws(
    () =>
      parseSurface(
        `probe
  1
then 2
end`,
        "program",
        { layoutForms: forms },
      ),
    isUnexpectedEnd,
  );
});

test("session macros make probe/then complete without end; hold still needs end", () => {
  const i = new Interpreter();
  i.run(
    "macro :probe body :: Body :then result :: Expression Code$` $(result)",
    "repl",
  );
  i.run("macro :hold body :: Body Code$` $(body)", "repl");
  assert.equal(
    displayResults(
      i.run(
        `probe
  1
then 2`,
        "repl",
      ),
    ),
    displayResults(i.run("probe 1 then 2", "repl")),
  );
  assert.equal(
    displayResults(
      i.run(
        `hold
  1 + 1
end`,
        "repl",
      ),
    ),
    "2",
  );
  assert.throws(
    () =>
      i.parse(
        `hold
  1`,
        "repl",
      ),
    isBlockEnd,
  );
  assert.throws(
    () =>
      i.parse(
        `probe
  1
then 2
end`,
        "repl",
      ),
    isUnexpectedEnd,
  );
});

test("session hold rejects a wholly parenthesized operand and accepts a continuing group", () => {
  const i = new Interpreter();
  i.run("macro :hold x :: Expression Code$` $(x)", "repl");
  assert.throws(
    () => i.parse("hold (1)", "repl"),
    (error: unknown) =>
      fails instanceof LanguageError &&
      error.message.includes(
        "a keyword operand cannot be a single parenthesized group",
      ),
  );
  assert.equal(displayResults(i.run("hold (1) + 2", "repl")), "3");
});
