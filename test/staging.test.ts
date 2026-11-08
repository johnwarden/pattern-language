import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const installer =
  "macro :install Args() Code` macro :answer x :: Expression Code$` $(x)";
const run = (source: string) => displayResults(new Interpreter().run(source));

test("a generated sidefix definition recognizes the following source line", () => {
  assert.equal(run(installer + "\n(install Args())\nanswer 7"), "7");
});
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
test("generated function parameters cannot capture inserted caller expressions", () => {
  assert.equal(
    run(
      "macro :install Args(value) Code$` def add(x) x + $(value)\nx = 10\n(install Args(x))\nadd(2)",
    ),
    "12",
  );
});
test("generated macro retains its own interpolation stage and parameter scope", () => {
  assert.equal(
    run(
      "macro :install Args() Code` macro :twice Args(x) Code$` $(x) + $(x)\n(install Args())\n(twice Args(6))",
    ),
    "12",
  );
});
test("parse-only never runs an installer or commits its declaration", () => {
  const i = new Interpreter();
  i.run(installer, "repl");
  assert.throws(() => i.parse("(install Args())\nanswer 1"), /grammar|form/);
  assert.throws(() => i.run("answer 1"), /grammar|form/);
});
test("ordinary functions retain their definition-time grammar", () => {
  assert.equal(
    run(
      "def f()\n  if True 1 else 2\nend\nmacro :if x :: Expression y :: Expression :else z :: Expression Code` 99\nf()",
    ),
    "1",
  );
});

test("a generated final definition is still invalid as a program result", () => {
  assert.throws(
    () => run(installer + "\n(install Args())"),
    /must end with a result/,
  );
});
test("a generated structural type participates in subsequent sidefix patterns", () => {
  assert.equal(
    run(
      "macro :install Args() Code` def Point type :Point(x :: Int)\n(install Args())\nmacro :use p :: Point Code` 7\nuse Point(1)",
    ),
    "7",
  );
});
