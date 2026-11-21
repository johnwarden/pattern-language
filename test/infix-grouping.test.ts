import test from "node:test";
import assert from "node:assert/strict";
import { parenthesesRequiredMessage } from "../src/infix-grouping.ts";
import { parseExpression, parseSurface } from "../src/parser.ts";

test("Write suggestions cover only the offending infix expression", () => {
  assert.throws(
    () => parseExpression("f(a * b + c, d)"),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(
        message,
        /Write `\(a \* b\) \+ c` or `a \* \(b \+ c\)`\./,
      );
      assert.doesNotMatch(message, /Write `f\(/);
      return true;
    },
  );
  assert.throws(
    () => parseSurface("x = 1\ny = a + b * c"),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(
        message,
        /Write `\(a \+ b\) \* c` or `a \+ \(b \* c\)`\./,
      );
      assert.doesNotMatch(message, /Write `x = 1/);
      assert.doesNotMatch(message, /y =/);
      return true;
    },
  );
});

test("missing operand spans fall back to printed forms", () => {
  const message = parenthesesRequiredMessage(
    "",
    [
      { printed: "left" },
      { printed: "mid" },
      { printed: "right" },
    ],
    [
      { text: "+", display: "+" },
      { text: "*", display: "*" },
    ],
    0,
  );
  assert.equal(
    message,
    "Syntax error. Write `(left + mid) * right` or `left + (mid * right)`.\n" +
      "Mixing + and * requires parentheses.",
  );
  assert.doesNotMatch(message, /Write `\(\)|\(\) /);
});
