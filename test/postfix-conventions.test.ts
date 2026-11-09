import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  parseExpression,
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
  const ordinary = new Interpreter();
  assert.equal(
    displayResults(
      ordinary.run("def (n :: Rational)? n + 1\n(2?, :None :: String?)"),
    ),
    "(3, :None)",
  );
});

test("every accepted suffix survives syntax and typed value transport", () => {
  for (const op of "~!@#$%^&*?") {
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

test("bootstrap list and result conventions remain usable", () => {
  assert.equal(
    displayResults(new Interpreter().run("([1, 2] :: Int*, Ok(1) :: Int^)")),
    "([1, 2], Ok(1))",
  );
});

test("a tight hash and separated comments share the interpolation lexer", () => {
  const i = new Interpreter();
  assert.equal(displayResults(i.run('x = "x"# # comment\nx')), '"x"#');
  assert.equal(displayResults(i.run('$"$("x"#)"')), '"\\\"x\\\"#"');
});
