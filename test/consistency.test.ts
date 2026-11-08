import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  normal,
  parseExpression,
  LanguageError,
} from "../src/index.ts";
import { displayString } from "../src/string-format.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
test("sidefix spread is rejected at declaration but argument-pack spread remains valid", () => {
  for (const tail of ["", "1", "1 2"])
    assert.throws(
      () => run("macro (:all (xs... :: Int*)) Code` 0\nall " + tail),
      (e: unknown) => {
        assert.ok(e instanceof LanguageError);
        assert.equal(e.diagnostic.code, "E_SIDEFIX_SPREAD");
        return true;
      },
    );
  for (const [args, expected] of [
    ["", "[]"],
    ["1", "[1]"],
    ["1,2", "[1, 2]"],
  ]) {
    assert.equal(
      run(
        "macro (:all Pair(xs... :: Int*)) Code$` $(xs)\nall Pair(" + args + ")",
      ),
      expected,
    );
    assert.equal(
      run(
        "macro (:all Args(xs... :: Int*)) Code$` $(xs)\nall Args(" + args + ")",
      ),
      expected,
    );
  }
});
test("a list annotation means a list in direct and constructor-shaped sidefix parameters", () => {
  assert.equal(
    run("macro (:show Args(x :: [_... :: Int*])) Code$` $(x)\n(show Args([1,2]))"),
    "[1, 2]",
  );
  assert.equal(
    run("macro (:show (x :: [_... :: Int*])) Code$` $(x)\nshow [1,2]"),
    "[1, 2]",
  );
  assert.throws(() => run("macro (:show (x :: [_... :: Int*])) Code` 0\nshow 1 2"));
});
test("a named structural pattern works in all five contexts with private internal captures", () => {
  const prelude = "def Point type :Point(x :: Int)\n";
  assert.equal(run(prelude + "Point(1) :: Point"), "Point(1)");
  assert.equal(run(prelude + "(p :: Point) = Point(1)\np"), "Point(1)");
  assert.equal(run(prelude + "def f(p :: Point) p\nf(Point(1))"), "Point(1)");
  assert.equal(
    run(
      prelude + "macro (:f Args(p :: Point)) Code$` $(p)\n(f Args(Point(1)))",
    ),
    "Point(1)",
  );
  assert.equal(
    run(
      prelude +
        "macro (:f (p :: Point) (q :: Point)) Code$` $(p)\nf Point(1) Point(2)",
    ),
    "Point(1)",
  );
  assert.equal(
    run(prelude + "match Point(1)\n  (p :: Point) -> p\nend"),
    "Point(1)",
  );
});
test("named pattern grammar respects block scope and failed REPL transactions", () => {
  const i = new Interpreter();
  i.run("def Point type :Point(x :: Int)", "repl");
  i.run("macro (:take (p :: Point)) Code$` $(p)", "repl");
  assert.equal(displayResults(i.run("take Point(2)")), "Point(2)");
  assert.throws(() => i.run("def Hidden type :Hidden(Int)\nmissing"));
  assert.throws(() =>
    i.run("macro (:hidden (p :: Hidden)) Code` 0\nhidden Hidden(1)"),
  );
});
test("head quoting and explicit structural interpolation can produce the same data", () => {
  for (const source of [":foo(x)", "Expression$` foo($x)"])
    assert.equal(run("x = 3\n" + source), "foo(3)");
});
test("source formatting preserves raw multiline strings and both quote characters", () => {
  for (const text of ["a\nb", 'He said "it\'s"', "a\\b", "x\nend\ny"]) {
    const syntax = { kind: "literal" as const, value: text };
    assert.equal(run(normal(syntax)), displayString(text));
  }
});
test("source formatting round trips boundary whitespace and backslashes", () => {
  for (const text of ["\nleading newline", "trailing newline\n", "a\\b"]) {
    const syntax = { kind: "literal" as const, value: text };
    assert.equal(run(normal(syntax)), displayString(text));
  }
});
test("no sequence repetition or alternation extension is introduced", () => {
  assert.throws(() => run("macro (:many (Int Int)) Code` 0\nmany 1 2"));
  assert.equal(parseExpression("x").kind, "symbol");
});
