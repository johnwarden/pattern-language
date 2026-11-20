import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  lowerBlock,
  displayResults,
  LanguageError,
  renderDiagnostic,
} from "../src/index.ts";

function compile(i: Interpreter, source: string, repl = false) {
  const tree = i.parse(source, repl ? "repl" : "program", "example");
  assert.equal(tree.kind, "block");
  if (tree.kind !== "block") assert.fail();
  return lowerBlock(tree, repl);
}
const examples = [
  "x = 5\ny = 1\nx + y",
  "Rect(w,h) = Rect(3,4)\n(w,h)",
  '(x,foo: f :: String = "fallback") = (1)\n(x,f)',
  '(x,foo: f :: String = "fallback") = (1,foo: "chosen",extra: True)\n(x,f)',
  "[y,rest...] = [1,2]\n(y,rest)",
  "[y,rest...] = [1]\n(y,rest)",
  "(x :: Int) = 5\nx",
  "x = 1\nf = () -> x\nx + 10\n(f(),x)",
  "(x,y) = (1,2)\n(y,x,label: True)",
  "x = 1\n()",
  "x = 3\nf = x -> (x + 1)\n(f(8),x)",
];
for (const source of examples)
  test("block and explicit core agree: " + source.split("\n")[0], () => {
    const direct = new Interpreter(),
      lowered = new Interpreter();
    assert.equal(
      displayResults(lowered.runCore(compile(lowered, source))),
      displayResults(direct.run(source, "program", "example")),
    );
  });

function diagnostic(action: () => unknown) {
  try {
    action();
    assert.fail("expected failure");
  } catch (e) {
    assert.ok(e instanceof LanguageError);
    return renderDiagnostic(e);
  }
}
for (const source of [
  "x = (1,2)\nx",
  "(x :: String) = 1\nx",
  "x = 1\nx = 2\nx",
  "[a,b] = [1]\na",
  "(size: s :: Int) = (color: :Red)\ns",
  '(size: s :: Int = "wrong") = ()\ns',
])
  test("lowering preserves diagnostics: " + source.split("\n")[0], () => {
    const direct = new Interpreter(),
      lowered = new Interpreter();
    assert.equal(
      diagnostic(() => lowered.runCore(compile(lowered, source))),
      diagnostic(() => direct.run(source, "program", "example")),
    );
  });

test("failed lowered execution does not commit earlier bindings", () => {
  const i = new Interpreter();
  const core = compile(i, "x = 1\nmissingName");
  assert.throws(() => i.runCore(core), /unbound name/);
  assert.throws(() => i.run("x"), /unbound name/);
});
test("REPL lowering commits bindings and retains binding result behavior", () => {
  const i = new Interpreter();
  assert.equal(displayResults(i.runCore(compile(i, "x = 5", true))), "5");
  assert.equal(displayResults(i.run("x + 1")), "6");
});
test("final binding and declarations cannot be lowered as a definition-free program", () => {
  const i = new Interpreter();
  assert.throws(() => compile(i, "x = 1"), /must end/);
  assert.throws(() => compile(i, "def f(x) x\nf(1)"), /definition-free/);
});
test("lowered blocks keep named type interpretation and accessors", () => {
  const i = new Interpreter();
  i.run("def Rectangle type :Rect(w :: Float,h :: Float)", "repl");
  assert.equal(
    displayResults(
      i.runCore(compile(i, "r = Rect(3,4) :: Rectangle\n(r.w,w(r))")),
    ),
    "(3, 3)",
  );
});
test("a macro may produce binding-shaped data without executing a binding", () => {
  const i = new Interpreter();
  assert.equal(displayResults(i.run("data = :(x = 1)\ndata")), "x = 1");
  assert.throws(() => i.run("x"), /unbound name/);
});

test("lowering cannot bypass incomplete sidefix grammar", () => {
  assert.throws(() => new Interpreter().run("if"), /grammar|form/);
});
test("a local variable called let cannot intercept the core binding primitive", () => {
  assert.equal(
    displayResults(new Interpreter().run("let = 99\nx = 5\nx + let")),
    "104",
  );
});
