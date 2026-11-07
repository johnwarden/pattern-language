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
  assert.equal(program.stdout, "Widget :: TitleCaseSymbol\n");
  const repl = invoke(":Widget\n\n:quit\n", "--repl");
  assert.equal(repl.status, 0);
  assert.equal(repl.stdout, program.stdout);
});
test("program output annotates every result in a complete labeled pack", () => {
  const result = invoke('(1 :: Int,word: "hello" :: String)');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '(1 :: Int, word: "hello" :: String)\n');
  assert.equal(invoke("()").stdout, "()\n");
  assert.equal(invoke("3").stdout, "3 :: Expression\n");
});
test("parse-only output remains surface syntax and errors retain source locations", () => {
  const parsed = invoke("1 + 2", "--parse");
  assert.equal(parsed.status, 0);
  assert.equal(parsed.stdout, "1 + 2\n");
  const failed = invoke("x = 1\nx + missing");
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /stdin:2:5/);
});
