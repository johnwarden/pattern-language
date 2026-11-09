import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const installer =
  "macro :install Args() Code` macro :answer x :: Expression Code$` $(x)";

test("generated grammar is local and reusable on separate function invocations", () => {
  const i = new Interpreter();
  i.run(installer + "\ndef f(x)\n  (install Args())\n  answer x\nend", "repl");
  assert.equal(displayResults(i.run("(f(8),f(9))")), "(8, 9)");
  assert.throws(() => i.run("answer 1"), /grammar|form/);
});
test("failed submissions roll back generated grammar and generated methods together", () => {
  const i = new Interpreter();
  i.run(installer, "repl");
  assert.throws(() => i.run("(install Args())\nmissingName"), /unbound name/);
  assert.throws(() => i.run("answer 1"), /grammar|form/);
  assert.equal(displayResults(i.run("(install Args())\nanswer 4")), "4");
  assert.equal(displayResults(i.run("answer 5")), "5");
});
test("parse-only never runs an installer or commits its declaration", () => {
  const i = new Interpreter();
  i.run(installer, "repl");
  assert.throws(() => i.parse("(install Args())\nanswer 1"), /grammar|form/);
  assert.throws(() => i.run("answer 1"), /grammar|form/);
});
