import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
  normal,
  encodeSyntax,
  decodeSyntax,
} from "../src/index.ts";
import { syntaxKey } from "../src/syntax.ts";

test("postfix question mark has no optional meaning without a source definition", () => {
  const bare = new Interpreter(undefined, false, "");
  assert.equal(displayResults(bare.run("1? :: (type Rational?)")), "1?");
  const custom = new Interpreter(
    undefined,
    false,
    "def (n :: Rational)? n + 1\n",
  );
  assert.equal(displayResults(custom.run("2?")), "3");
});

test("every accepted suffix survives syntax and typed value transport", () => {
  for (const op of "~!@$%^&*?") {
    const tree = parseExpression(`"x"${op}`);
    assert.equal(tree.kind, "postfix", op);
    assert.equal(
      syntaxKey(decodeSyntax(encodeSyntax(tree))),
      syntaxKey(tree),
      op,
    );
    const i = new Interpreter(undefined, false, "");
    const pattern = op === "*" || op === "^" ? "(payload :: String)" : "String";
    assert.equal(
      displayResults(
        i.run(`def Suffix type ${pattern}${op}
(x :: Suffix) = "x"${op}
parse(Suffix)(toString(Suffix)(x)) == x`),
      ),
      "True",
      op,
    );
  }
});

test("hash always starts a comment, tight or separated", () => {
  assert.equal(normal(parseExpression("x#")), "x");
  assert.equal(normal(parseExpression("x #")), "x");
});
