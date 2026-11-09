import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter } from "../src/runtime.ts";
import { LanguageError, renderDiagnostic } from "../src/diagnostics.ts";

test("incomplete built-in forms show the active expected grammar and input location", () => {
  assert.throws(
    () => new Interpreter().run("if True 1", "program", "example.pattern"),
    (error: unknown) => {
      assert.ok(error instanceof LanguageError);
      const message = renderDiagnostic(error);
      assert.match(message, /incomplete or invalid IfExpression/);
      assert.match(message, /expected.*:else/);
      assert.match(message, /found if True 1/);
      assert.match(message, /example\.pattern:1:1/);
      return true;
    },
  );
});
test("user-defined forms contribute their own signature to diagnostics", () => {
  const i = new Interpreter();
  i.run(
    "macro :choose a :: Expression :otherwise b :: Expression Code$` $(a)",
    "repl",
  );
  assert.throws(
    () => i.run("choose 1"),
    /expected.*:choose.*:otherwise.*found choose 1/,
  );
});
