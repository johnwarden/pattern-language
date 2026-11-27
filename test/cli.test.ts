import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));
function invoke(source: string, ...args: string[]) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    input: source,
  });
}
test("program output uses the same annotated display as the REPL", () => {
  const program = invoke(":Widget");
  assert.equal(program.status, 0, program.stderr);
  assert.equal(program.stdout, "Widget :: UpperCamelSymbol\n");
  const repl = invoke(":Widget\n\n:quit\n", "--repl");
  assert.equal(repl.status, 0);
  assert.equal(repl.stdout, program.stdout);
});
test("REPL evaluates a finished form on its last line without a blank line", () => {
  const repl = invoke(":Widget\n:quit\n", "--repl");
  assert.equal(repl.status, 0, repl.stderr);
  assert.equal(repl.stdout, "Widget :: UpperCamelSymbol\n");
  const complete = invoke("if True 1 else 2\n:quit\n", "--repl");
  assert.equal(complete.status, 0, complete.stderr);
  assert.equal(complete.stdout, "1 :: NumericValue\n");
});
test("REPL does not evaluate an incomplete clause-bearing form on the last pending line", () => {
  const incomplete = invoke("if True 1\n", "--repl");
  assert.match(incomplete.stderr, /incomplete or invalid IfExpression/);
});
test("program output annotates every result in a complete labeled pack", () => {
  const result = invoke('(1 :: Int,word: "hello" :: String)');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '(1 :: Int64, word: "hello" :: String)\n');
  assert.equal(invoke("()").stdout, "()\n");
  assert.equal(invoke("3").stdout, "3 :: NumericValue\n");
});
test("parse-only output remains surface syntax and errors retain source locations", () => {
  const parsed = invoke("1 + 2", "--parse");
  assert.equal(parsed.status, 0);
  assert.equal(parsed.stdout, "1 + 2\n");
  const failed = invoke("x = 1\nx + missing");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /stdin:2:5/);
});

test("program and REPL group annotated infix values before the type tag", () => {
  const source = ":(a + (b + c))";
  const program = invoke(source);
  const repl = invoke(source + "\n:quit\n", "--repl");
  assert.equal(program.status, 0, program.stderr);
  assert.equal(program.stdout, "(a + b + c) :: Expression\n");
  assert.equal(repl.status, 0, repl.stderr);
  assert.equal(repl.stdout, program.stdout);

  const left = invoke(":((a + b) + c)");
  assert.equal(left.status, 0, left.stderr);
  assert.equal(left.stdout, "((a + b) + c) :: Expression\n");
  const pack = invoke("(:(a + b), second: :(c * d))");
  assert.equal(pack.status, 0, pack.stderr);
  assert.equal(
    pack.stdout,
    "((a + b) :: Expression, second: (c * d) :: Expression)\n",
  );
});

test("CLI local text uses exact aliases, and unaliased refinements fail explicitly", () => {
  const named = invoke(
    "type Rectangle concrete Rect(width :: Int, height :: Int)\n" +
      "square = Rectangle .where (s -> width(s) == height(s))\n" +
      "square",
  );
  assert.equal(named.status, 0, named.stderr);
  assert.equal(named.stdout, "square :: Type\n");

  const anonymous = invoke(
    "type Rectangle concrete Rect(width :: Int, height :: Int)\n" +
      "Rectangle .where (s -> width(s) == height(s))",
  );
  assert.equal(anonymous.status, 1);
  assert.match(anonymous.stderr, /portable predicate description/);
  assert.doesNotMatch(anonymous.stdout, /type where/);
});
