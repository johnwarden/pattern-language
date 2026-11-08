import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Interpreter,
  displayResults,
  CODE_SCHEMA,
  LanguageError,
} from "../src/index.ts";
import { equal, single, unwrap, valSymbol } from "../src/values.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const evaluate = (source: string) => {
  const interpreter = new Interpreter();
  return displayResults(
    interpreter.evaluateCode(single(interpreter.run(source))),
  );
};

test("Code has a source-defined structural tree grammar and ordinary type identity", () => {
  assert.equal(
    readFileSync(
      new URL("../examples/code-grammar.pattern", import.meta.url),
      "utf8",
    ),
    CODE_SCHEMA,
  );
  assert.equal(run("Code == TreeGrammar(syntaxSchema())"), "True");
  assert.equal(run("t = parse(Type)(toString(Type)(Code))\nt == Code"), "True");
  const i = new Interpreter();
  assert.equal(
    i.inspect(i.run("Code` missing(1 / 0)")),
    "missing(1 / 0) :: Code",
  );
});

test("a syntax grammar is selected by its type value, not the name Code", () => {
  assert.equal(
    run("def Names TreeGrammar(type Name(String,Bool))\nx = Names` foo\nx"),
    "foo",
  );
  assert.throws(
    () => run("def Names TreeGrammar(type Name(String,Bool))\nNames` foo(1)"),
    /expected|match/,
  );
  assert.throws(
    () => evaluate("def Names TreeGrammar(type Name(String,Bool))\nNames` foo"),
    /requires.*Code/,
  );
});

test("typed Code interpolation inserts trees without Code constructors", () => {
  assert.equal(
    run("a = Code` x + 1\nb = Code$` $a * 2\nc = Code$` 2 * $a\n(b,c)"),
    "((x + 1) * 2, 2 * x + 1)",
  );
  assert.equal(
    evaluate(
      "def wrap(n,e :: Code)\n  if n == 0 e else\n    inner = wrap(n - 1,e)\n    Code$` inc($inner)\n  end\nend\ndef inc(x) x + 1\nwrap(3,Code` 1)",
    ),
    "4",
  );
});

test("typed Code positional splices preserve packs and check every inserted grammar", () => {
  assert.equal(
    run("args = [Code` 1,Code` 2]\nc = Code$` f($(args...))(color: :Red)\nc"),
    "f(1, 2)(color: :Red)",
  );
  const prelude =
    "def Names TreeGrammar(type Name(String,Bool))\nn = Names` foo\n";
  for (const expression of ["Code$` $n", "args = [n]\nCode$` f($(args...))"])
    assert.throws(
      () => run(prelude + expression),
      (e: unknown) =>
        e instanceof LanguageError && e.diagnostic.code === "E_QUOTE_GRAMMAR",
    );
});

test("primitive lifting preserves the value's concrete interpretation", () => {
  for (const value of ["3 :: Int", "negate(3) :: Int"]) {
    const i = new Interpreter();
    const [original, code] = i.run("n = " + value + "\nc = Code$` $n\n(n,c)");
    assert.ok(equal(single(i.evaluateCode(code.value)), original.value), value);
    assert.equal(
      displayResults(i.run("parse(Code)(toString(Code)(c)) == c")),
      "True",
    );
  }
  assert.equal(
    run("c = Code$` $(negate(3))\nparse(Code)(toString(Code)(c)) == c"),
    "True",
  );
});

test("macro results require interpreted Code, not a similarly spelled tag", () => {
  assert.equal(run("macro :answer Args() Code` 42\nanswer Args()"), "42");
  assert.equal(run("macro :answer Args() Code` 42\nanswer Args()"), "42");
  assert.throws(
    () => run("macro :fake Args()\n  :Code(42)\nend\nfake Args()"),
    (e: unknown) =>
      e instanceof LanguageError && e.diagnostic.code === "E_MACRO_RESULT",
  );
});

test("host Code evaluation is explicit, scope-isolated, and preserves result packs", () => {
  const i = new Interpreter();
  const code = single(
    i.run("x = 2\nCode`\n  x = 3\n  (x,x + 1,color: :Red)\nend"),
  );
  assert.equal(displayResults(i.evaluateCode(code)), "(3, 4, color: Red)");
  assert.equal(displayResults(i.run("x")), "2");
  assert.equal(i.evaluateCode(single(i.run("Code` ()"))).length, 0);
  assert.throws(
    () => evaluate("Code`\n  x = 1\nend"),
    /final|last|result|binding/,
  );
  assert.throws(() => i.evaluateCode(valSymbol("Code")), /requires.*Code/);
  const local = single(i.run("Code`\n  def local(x) x\n  local(3)\nend"));
  assert.equal(displayResults(i.evaluateCode(local)), "3");
  assert.throws(() => i.run("local(3)"), /unbound|not callable/);
});

test("Code evaluation does not install a source-language evaluator", () => {
  for (const name of ["run", "evaluate"]) {
    assert.throws(() => run("c = Code` 1\nc." + name), /unbound|not callable/);
    assert.equal(run("def " + name + "(x) x\n" + name + "(3)"), "3");
  }
});

test("failed host Code evaluation rolls back scoped declarations", () => {
  const i = new Interpreter();
  const code = single(
    i.run("x = 2\nCode`\n  def local(x) x\n  x = 9\n  missing(1)\nend"),
  );
  assert.throws(() => i.evaluateCode(code), /unbound|not callable/);
  assert.equal(displayResults(i.run("x")), "2");
  assert.throws(() => i.run("local(1)"), /unbound|not callable/);
});

test("closed Code has fresh-context inert text round trips", () => {
  for (const expression of [
    "f",
    "f()",
    "f(1,2)",
    "f(1)(2)",
    "(if True f else g)(1)",
    "if True 1 else missing(1 / 0)",
    ":x",
    "Code` x + 1",
    "(\n  x = 3\n  x + 2\n)",
  ]) {
    const producer = new Interpreter();
    const code = producer.run("Code` " + expression)[0].value;
    producer.env.bindings.set("c", code);
    const text = producer.run("toString(Code)(c)")[0].value;
    const consumer = new Interpreter();
    consumer.env.bindings.set("text", text);
    consumer.env.bindings.set("original", code);
    assert.equal(
      displayResults(
        consumer.run("restored = parse(Code)(text)\nrestored == original"),
      ),
      "True",
      expression,
    );
  }
});

test("typed Code fields and abstract slots reconstruct without evaluation", () => {
  assert.equal(
    run(
      "def Box type Box(Code)\nc = Box(Code` x + 1) :: Box\ns = toString(Box)(c)\nparse(Box)(s) == c",
    ),
    "True",
  );
  assert.equal(
    run(
      "c = Code` x + 1\n(v :: Any) = c\ns = toString(Any)(v)\nparse(Any)(s) == v",
    ),
    "True",
  );
});

test("Test data can contain typed Code and deferred expected syntax", () => {
  const source =
    'def ExpectedOutput type\n  (e :: Expression) ::: (type :: Expression)\nend\ndef Test type :test name :: String code :: Code :expect expected :: ExpectedOutput\nt = Test`\n  test "body"\n    x = 3\n    x + 1\n  end\n  expect 4 :: Int\nend\n';
  assert.equal(
    run(
      source +
        "text = toString(Test)(t)\nu = parse(Test)(text)\n(t == u,u.name,u.expected.e)",
    ),
    '(True, "body", 4)',
  );
  assert.equal(evaluate(source + "t.code"), "4");
});

test("ordinary patterns inspect application syntax in Code", () => {
  assert.equal(
    run(
      "c = Code` f(1)(2,color: :Red)\n(head :: Expression)(b,color: color) = c\nf(a) = head\n(a,b,color)",
    ),
    "(1, 2, Red)",
  );
  assert.equal(
    run(
      "c = Code` f(1)\n(function :: Symbol)(argument) = c\n(function,argument)",
    ),
    "(:f, 1)",
  );
});

test("Code categories are source-defined subsets of the existing space", () => {
  const source = readFileSync(
    new URL("../examples/code-categories.pattern", import.meta.url),
    "utf8",
  );
  assert.equal(
    run(source),
    '(factory(1), [Field("color", Name("Red", True))])',
  );
});

test("facet inspection interprets captures without rewriting Code", () => {
  assert.equal(
    run(
      "def NumericCall type :f(x :: Float32,**)\nc = Code` f(0.5)\n(p :: NumericCall) = c\np == c",
    ),
    "True",
  );
  assert.throws(
    () =>
      run(
        "def NumericCall type :f(x :: Float32,**)\nc = Code` f(1.2345678912)\n(p :: NumericCall) = c",
      ),
    (e: unknown) =>
      e instanceof LanguageError &&
      /exactly representable|expected Float32|expected NumericCall/.test(
        e.message,
      ),
  );
});

test("Code scalar patterns and scoped facet accessors use the shared matcher", () => {
  assert.equal(
    run("match Code` 42\n  42 -> True\n  _ -> False\nend"),
    "True",
  );
  assert.equal(
    run(
      "def NumericCall type :f(x :: Int,**)\nc = Code` f(3)\n(p :: NumericCall) = c\n(p.x,x(c),p == c)",
    ),
    "(3, 3, True)",
  );
});

test("Code carries its tree explicitly instead of relying on raw-quote origins", () => {
  const i = new Interpreter();
  const code = unwrap(i.run("Code` f(1)")[0].value);
  assert.equal(code.kind, "code");
  if (code.kind !== "code") assert.fail();
  assert.equal(code.tree.kind, "apply");
  assert.equal(code.portable, true);
});
