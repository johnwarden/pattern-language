import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const run = (source: string) => displayResults(new Interpreter().run(source));
const expression = `def Atom unionType Number | String | Symbol
def Application type
  (head :: ValueExpr)(args... :: ValueExpr*)
end
def ValueExpr unionType Atom | Application
`;

test("surface symbols have intrinsic concrete classes", () => {
  for (const [symbol, type] of [
    [":a", "LowerCamelSymbol"],
    [":fooBar", "LowerCamelSymbol"],
    [":Rect", "UpperCamelSymbol"],
    [":+", "PunctuationSymbol"],
    [":…", "PunctuationSymbol"],
  ]) {
    const i = new Interpreter();
    assert.equal(
      i.inspect(i.run("x = " + symbol + "\nx")),
      symbol.slice(1) + " :: " + type,
    );
  }
  assert.equal(
    run(
      "Symbol == (unionType LowerCamelSymbol | UpperCamelSymbol | UpperSnakeSymbol | PunctuationSymbol)",
    ),
    "True",
  );
});
test("quoted symbol atoms and self-evaluating type values retain their identities in Any", () => {
  assert.equal(
    run(
      "(symbol :: Any) = :Int\n(typeValue :: Any) = Int\nsymbol == typeValue",
    ),
    "False",
  );
});
test("unionType evaluates type alternatives and normalizes just like UnionType", () => {
  assert.equal(
    run("(unionType String | Int) == UnionType(Int,String)"),
    "True",
  );
  assert.equal(
    run("(unionType Int | String | Int) == UnionType(String,Int)"),
    "True",
  );
  assert.throws(() => run("unionType Int | foo"), /unbound/);
});
test("unannotated raw union values select and retain exactly one concrete member", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(
      i.run("def MathExp unionType Symbol | Number\n(a :: MathExp) = :a\na"),
    ),
    "a :: LowerCamelSymbol",
  );
  assert.equal(
    run(
      'def U unionType Int | String\n(x :: U) = 3\n(y :: U) = "three"\n((x :: Int), (y :: String))',
    ),
    '(3, "three")',
  );
});
test("union text and union container text omit redundant concrete tags", () => {
  assert.equal(
    run(
      'def U unionType Int | String\n(x :: U) = 3\n(xs :: U*) = [1,"two"]\n(toString(U)(x),toString(U*)(xs),parse(U*)(toString(U*)(xs)) == xs)',
    ),
    '("3", "[1, \\"two\\"]", True)',
  );
  assert.equal(
    run(
      'def U unionType Symbol | Number\n(x :: U) = :foo\n(toString(U)(x),parse(U)("foo") == x)',
    ),
    '("foo", True)',
  );
});
test("facets and Any still retain required concrete metadata", () => {
  assert.throws(() => run("(x :: Any) = Rect(2,3)\nx"), /explicit concrete/);
  assert.throws(() => run('parse(Any)("3")'), /explicit concrete/);
  assert.equal(run("(x :: Any) = 3 :: Int\ntoString(Any)(x)"), '"3 :: Int"');
});
test("ordinary recursive expression grammar exposes concrete applications and symbols", () => {
  const i = new Interpreter();
  assert.equal(
    i.inspect(i.run(expression + "ValueExpr` a + b")),
    "a + b :: Application",
  );
  assert.equal(
    run(
      expression +
        "(head :: ValueExpr)(args... :: ValueExpr*) = ValueExpr` a + b\n(operator :: ValueExpr)(left... :: ValueExpr*) = head\n(toString(ValueExpr)(head),toString(ValueExpr*)(args),toString(ValueExpr)(operator),toString(ValueExpr*)(left))",
    ),
    '("+(a)", "[b]", "+", "[a]")',
  );
  assert.equal(
    run(
      expression +
        "e = ValueExpr` f(5)\nparse(ValueExpr)(toString(ValueExpr)(e)) == e",
    ),
    "True",
  );
});
test("contextual interpretation of a symbol literal differs from converting a bound typed variable", () => {
  assert.equal(run("def Color type :Red | :Black\n:Red :: Color"), ":Red");
  assert.throws(
    () => run("def Color type :Red | :Black\nr = :Red\nr :: Color"),
    /different concrete/,
  );
});
