import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));
const builder = "def twiceCode(e) Code$` $(e) + $(e)";
const fails = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => {
      assert.ok(e instanceof LanguageError);
      assert.equal(e.diagnostic.code, code);
      return true;
    },
  );

test("a code-producing definition returns data and does not install a macro", () => {
  assert.equal(run(builder + "\ntwiceCode(2 + 3)"), "5 + 5");
  fails(builder + "\ntwiceCode(missing)", "E_UNBOUND_NAME");
});
test("explicit registration composes with an ordinary transformer function", () => {
  assert.equal(
    run(
      builder +
        "\nmacro :twice Args(e)\n  twiceCode(e)\nend\n((twice Args(2 + 3)),twiceCode(2 + 3))",
    ),
    "(10, 5 + 5)",
  );
});
test("ordinary code builders may capture runtime parameters", () => {
  assert.equal(
    run("def outer(x)\n  def build() Code$` $(x)\n  build()\nend\nouter(7)"),
    "7",
  );
});
test("only explicit registration suppresses argument evaluation", () => {
  assert.equal(
    run(
      "def ignoreCode(e) Code` 42\nmacro :ignore Args(e)\n  ignoreCode(e)\nend\n(ignore Args(missing))",
    ),
    "42",
  );
  fails("def ignoreCode(e) Code` 42\nignoreCode(missing)", "E_UNBOUND_NAME");
});
test("the produced value, not its function body's syntax, determines expansion validity", () => {
  assert.equal(
    run(
      "def chooseCode(e)\n  c = Code$` $(e)\n  c\nend\nmacro :chosen Args(e)\n  chooseCode(e)\nend\n(chosen Args(8))",
    ),
    "8",
  );
  fails("macro :invalid Args(e)\n  42\nend\n(invalid Args(1))", "E_MACRO_RESULT");
});
test("sidefix registration can delegate to an ordinary code builder", () => {
  assert.equal(
    run(builder + "\nmacro :twice e :: Expression\n  twiceCode(e)\nend\ntwice 9"),
    "18",
  );
  fails(
    "def :twice e :: Expression Code$` $(e)\n0",
    "E_MACRO_REGISTRATION",
  );
});
test("registered aliases are lexical and leave the original function ordinary", () => {
  const i = new Interpreter();
  i.run(
    builder +
      "\ndef local()\n  macro :twice Args(e)\n    twiceCode(e)\n  end\n  (twice Args(3))\nend",
    "repl",
  );
  assert.equal(displayResults(i.run("local()")), "6");
  assert.equal(displayResults(i.run("twiceCode(3)")), "3 + 3");
  assert.throws(() => i.run("(twice Args(3))"), /grammar|form/);
});
test("registration rejects runtime lexical reads at their source location", () => {
  fails(
    "def outer(x)\n  macro :bad Args() Code$` $(x)\n  0\nend\nouter(7)",
    "E_MACRO_RUNTIME_CAPTURE",
  );
});
test("capture checking follows helper functions rather than banning lexical names", () => {
  fails(
    "def outer(x)\n  def build() Code$` $(x)\n  macro :bad Args()\n    build()\n  end\n  0\nend\nouter(7)",
    "E_MACRO_RUNTIME_CAPTURE",
  );
  assert.equal(
    run(
      "def outer(x)\n  n = 5\n  def build() Code$` $(n) + x\n  macro :answer Args()\n    build()\n  end\n  (answer Args())\nend\nouter(7)",
    ),
    "12",
  );
});
test("runtime dependencies propagate through local bindings", () => {
  fails(
    "def outer(x)\n  n = x + 1\n  macro :bad Args() Code$` $(n)\n  0\nend\nouter(7)",
    "E_MACRO_RUNTIME_CAPTURE",
  );
});
test("raw references and macro syntax arguments do not read runtime values", () => {
  assert.equal(
    run(
      "def outer(x)\n  macro :reference Args() Code` x\n  (reference Args())\nend\nouter(7)",
    ),
    "7",
  );
  assert.equal(
    run(
      builder +
        "\nmacro :twice Args(e)\n  twiceCode(e)\nend\ndef outer(x)\n  (twice Args(x))\nend\nouter(7)",
    ),
    "14",
  );
});
test("macro registration is a declaration and failed registration rolls back", () => {
  fails("macro :answer Args() Code` 1", "E_SYNTAX");
  const i = new Interpreter();
  assert.throws(() =>
    i.run("macro :newWord e :: Expression Code$` $(e)\nmissing"),
  );
  assert.throws(() => i.run("newWord 3"), /grammar|form/);
});
test("runtime code generation no longer has the macro single-pack limitation", () => {
  assert.equal(run("def build(x)(y) Code$` $(x) + $(y)\nbuild(2)(3)"), "2 + 3");
});
test("registered transformers retain hygienic helper references", () => {
  assert.equal(
    run(
      "def helper(x) x + 1\ndef build(e) Code$` helper($(e))\nmacro :wrapped Args(e)\n  build(e)\nend\ndef f(x)\n  helper = x -> 99\n  (wrapped Args(x))\nend\nf(4)",
    ),
    "5",
  );
});

test("runtime captures in macro parameter defaults are rejected on registration", () => {
  fails(
    "def outer(x)\n  macro :bad Args(value: e :: Expression = x) Code$` $(e)\n  0\nend\nouter(7)",
    "E_MACRO_RUNTIME_CAPTURE",
  );
});

test("micro signatures cannot register macros and sidefix signatures cannot define functions", () => {
  fails("macro f(x) Code$` $(x)\n0", "E_MACRO_SIGNATURE");
  fails("def :f x :: Expression Code$` $(x)\n0", "E_MACRO_REGISTRATION");
});
test("registered macros reject micro call syntax", () => {
  fails(
    "macro :twice e :: Expression Code$` $(e) + $(e)\ntwice(3)",
    "E_MACRO_CALL_SYNTAX",
  );
});
