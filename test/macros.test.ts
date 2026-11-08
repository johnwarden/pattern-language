import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  normal,
  LanguageError,
} from "../src/index.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));
const fails = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (error: unknown) => {
      assert.ok(error instanceof LanguageError);
      assert.equal(error.diagnostic.code, code);
      return true;
    },
  );

test("quotation yields structural data without evaluating the application", () => {
  assert.equal(
    run("def f(x) 2 * x\nb = :f(1)\nc = :(f(1))\n(b == c,b)"),
    "(True, f(1))",
  );
  assert.equal(run(":(f(unknown))"), "f(unknown)");
  assert.equal(run("x = 7\n:(Box(x))"), "Box(x)");
  assert.equal(run(":f()"), "f()");
  assert.equal(run("(:f == :f())"), "False");
});
test("ordinary functions may return quoted data without becoming macros", () => {
  assert.equal(run("def data(x) :(f(x))\ndata(7)"), "f(x)");
  assert.equal(run("x = 7\nExpression$` Box($(x))"), "Box(7)");
  fails("$x", "E_UNQUOTE_CONTEXT");
});
test("sidefix macros receive unevaluated arguments and recursively expand Code", () => {
  assert.equal(
    run("macro :twice Args(x) Code$` $(x) + $(x)\n(twice Args(3))"),
    "6",
  );
  assert.equal(
    run("macro :ignore Args(x) Code` 42\n(ignore Args(unknown(1 / 0)))"),
    "42",
  );
  assert.equal(
    run(
      "macro :twice Args(x) Code$` $(x) + $(x)\nmacro :outer Args(x) Code$` twice Args($(x))\n(outer Args(4))",
    ),
    "8",
  );
  assert.equal(
    run(
      "macro :choose Args(c,a,b) Code$` if $(c) $(a) else $(b)\n(choose Args(True,42,1 / 0))",
    ),
    "42",
  );
});
test("macro patterns match expression structure and labels", () => {
  assert.equal(
    run("macro :peel Args(:Some(x)) Code$` $(x)\n(peel Args(Some(2 + 3)))"),
    "5",
  );
  assert.equal(
    run(
      "macro :take Args(value: x :: Expression,**) Code$` $(x)\n(take Args(extra: missing,value: 5))",
    ),
    "5",
  );
  fails(
    "macro :peel Args(:Some(x)) Code$` $(x)\n(peel Args(:None))",
    "E_LANGUAGE",
  );
  fails(
    "macro :f Args(x) Code$` $(x)\nmacro :f Args(y) Code$` $(y)\n(f Args(3))",
    "E_SIDEFIX_KEYWORD",
  );
});
test("macros and ordinary functions cannot share a method name in either order", () => {
  fails(
    "def f(x) x\nmacro :f Args(x) Code$` $(x)\n0",
    "E_MACRO_FUNCTION_CONFLICT",
  );
  fails(
    "macro :f Args(x) Code$` $(x)\ndef f(x) x\n0",
    "E_MACRO_FUNCTION_CONFLICT",
  );
  fails(
    "macro :toString Args(x) Code$` $(x)\n0",
    "E_MACRO_FUNCTION_CONFLICT",
  );
  fails(
    "macro :w Args(x) Code$` $(x)\ndef R type :Rect(w :: Int)\n0",
    "E_MACRO_FUNCTION_CONFLICT",
  );
  fails(
    "f = x -> x\nmacro :f Args(x) Code$` $(x)\n0",
    "E_MACRO_FUNCTION_CONFLICT",
  );
  fails("macro f(x)(y) Code$` $(x)\n0", "E_MACRO_SIGNATURE");
});
test("sidefix signatures define syntax for inline expressions and blocks", () => {
  const def =
    "macro :unless c :: Expression v :: Body Code$` if $(c) 0 else $(v)\n";
  assert.equal(run(def + "unless False 9"), "9");
  assert.equal(run(def + "unless True 1 / 0"), "0");
  assert.equal(run(def + "unless False\n  x = 3\n  x + 1\nend"), "4");
  fails("macro :unless c :: Expression 42\nunless True", "E_MACRO_RESULT");
});
test("a user-defined if expands into match and keeps the other branch unevaluated", () => {
  assert.equal(
    run(
      "macro :if c :: Expression v :: Body :else a :: Body\n  Code$`\n    match $(c)\n      True -> $(v)\n      False -> $(a)\n    end\n  end\nend\nif True 42 else 1 / 0",
    ),
    "42",
  );
});
test("quotation keeps caller names separate from template lambda binders", () => {
  assert.equal(
    run(
      "macro :withTemp Args(x) Code$` (temp -> $(x))(99)\ntemp = 7\n(withTemp Args(temp))",
    ),
    "7",
  );
  assert.equal(
    run(
      "macro :twice Args(x) Code$` (temp -> temp + temp)($(x))\n(twice Args(5))",
    ),
    "10",
  );
});
test("template free functions resolve in the macro definition scope", () => {
  assert.equal(
    run(
      "def helper(x) x + 1\nmacro :wrap Args(x) Code$` helper($(x))\ndef f(x)\n  helper = x -> 99\n  (wrap Args(x))\nend\nf(4)",
    ),
    "5",
  );
});
test("macro grammar survives REPL entries, but parse-only and failed entries do not mutate it", () => {
  const interpreter = new Interpreter();
  const def =
    "macro :unless c :: Expression v :: Body Code$` if $(c) 0 else $(v)";
  interpreter.parse(def, "repl");
  assert.throws(() => interpreter.run("unless False 7"));
  interpreter.run(def, "repl");
  assert.equal(displayResults(interpreter.run("unless False 7")), "7");
  assert.throws(() =>
    interpreter.run("macro :oops x :: Expression Code$` $(x)\nmissing"),
  );
  assert.throws(() => interpreter.run("oops 7"));
  assert.equal(displayResults(interpreter.run("unless False 8")), "8");
});
test("macro errors include call and definition locations; recursive expansion is bounded", () => {
  const interpreter = new Interpreter();
  interpreter.run(
    "macro :broken Args(x) Code$` unknown($(x))",
    "repl",
    "definitions",
  );
  assert.throws(
    () => interpreter.run("(broken Args(3))", "program", "call"),
    (error: unknown) => {
      assert.ok(error instanceof LanguageError);
      assert.ok(
        error.diagnostic.related.some((r) => r.span?.source?.name === "call"),
      );
      assert.ok(
        error.diagnostic.related.some(
          (r) => r.span?.source?.name === "definitions",
        ),
      );
      return true;
    },
  );
  fails(
    "macro :loop Args(x) Code$` loop Args($(x))\n(loop Args(1))",
    "E_MACRO_LIMIT",
  );
});
test("macro syntax normal form parses back to the same result", () => {
  const source = "macro :twice Args(x) Code$` $(x) + $(x)\n(twice Args(5))";
  const interpreter = new Interpreter(),
    tree = interpreter.parse(source);
  assert.equal(tree.kind, "block");
  if (tree.kind === "block")
    assert.equal(run(tree.lines.map((n) => normal(n)).join("\n")), "10");
});

test("quoted rest insertion preserves all arguments, including singleton and empty lists", () => {
  const def = "macro :list Args(xs...) Code$` [$(…(xs))]\n";
  assert.equal(run(def + "(list Args(1,2 + 3))"), "[1, 5]");
  assert.equal(run(def + "(list Args(1))"), "[1]");
  assert.equal(run(def + "(list Args())"), "[]");
});
test("template block bindings and defaulted lambda labels are hygienic", () => {
  assert.equal(
    run(
      "macro :withTemp Args(x)\n  Code$` (\n  (temp = 99)\n  (temp + $(x))\n)\nend\ntemp = 7\n(withTemp Args(temp))",
    ),
    "106",
  );
  assert.equal(
    run(
      "macro :make Args(x) Code` (size: Int = 3) -> size\nf = (make Args(1))\nf()",
    ),
    "3",
  );
});
test("local sidefix declarations do not escape their function block", () => {
  assert.equal(
    run(
      "def f()\n  macro :answer x :: Expression Code$` $(x)\n  answer 7\nend\nf()",
    ),
    "7",
  );
  assert.throws(() =>
    run(
      "def f()\n  macro :answer x :: Expression Code$` $(x)\n  answer 7\nend\nanswer 8",
    ),
  );
});

test("macro templates retain locally declared sidefix grammars", () => {
  assert.equal(
    run(
      "def f()\n  macro :answer x :: Expression Code$` $(x)\n  macro :wrap Args(x) Code$` answer $(x)\n  (wrap Args(7))\nend\nf()",
    ),
    "7",
  );
});
test("macro expansion supports definitions in a generated local block", () => {
  assert.equal(
    run(
      "macro :make Args() Code` (\n  def f(x) x\n  (f(1))\n)\n(make Args())",
    ),
    "1",
  );
});
