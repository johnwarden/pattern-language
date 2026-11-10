/**
 * Host round-trip / transport parsing tests.
 *
 * These checks print values to text and parse that text back, often in a
 * fresh Interpreter, to prove the printed text alone carries all information
 * (for example an explicit union member) with no hidden interpreter state.
 * The `.test` language DSL cannot observe a second Interpreter or host env
 * bindings, so this file stays separate from the source specs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseExpression,
  parseSurface,
  normal,
  encodeSyntax,
  decodeSyntax,
} from "../src/index.ts";
import {
  equal,
  single,
  singleton,
  unwrap,
  valLiteral,
  valSymbol,
} from "../src/values.ts";
import { term } from "../src/type-data.ts";
import { TYPE_SCHEMA } from "../src/type-schema.ts";
import { syntaxKey } from "../src/syntax.ts";
import { stringSource } from "../src/string-format.ts";
import { loadTests, type AssertionMode } from "../src/test-suite.ts";
import { TEST_SCHEMA } from "../src/test-schema.ts";

const run = (source: string, interpreter = new Interpreter()) =>
  displayResults(interpreter.run(source));
const stringResult = (i: Interpreter, s: string) => {
  const v = unwrap(single(i.run(s)));
  assert.equal(v.kind, "literal");
  if (v.kind !== "literal" || typeof v.value !== "string")
    throw Error("expected text");
  return v.value;
};
const transfer = (text: string) => {
  const other = new Interpreter();
  other.env.bindings.set("text", valLiteral(text));
  return other;
};
const evaluate = (source: string) => {
  const interpreter = new Interpreter();
  return displayResults(
    interpreter.evaluateCode(single(interpreter.run(source))),
  );
};
function text(source: string): string {
  const value = unwrap(single(new Interpreter().run(source)));
  assert.equal(value.kind, "literal");
  if (value.kind !== "literal" || typeof value.value !== "string")
    throw new Error("String expected");
  return value.value;
}
const full =
  'def Colored type :Rect(Float,Float,color: String)\ndef Rectangular type :Rect(w :: Float,h :: Float,**)\nr = Rect(2,3,color: "black") :: Colored\n';
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => e instanceof LanguageError && e.diagnostic.code === code,
  );
const bodyGrammar = readFileSync(
  new URL("../examples/body-grammar.pattern", import.meta.url),
  "utf8",
).replace(/Body\s*$/, "");
const todo = "def TodoList type :todo\n  todos :: String*\n  ...\nend\n";
const matrix = "def Matrix type [\n  values... :: Float**\n  ...\n]\n";
const expected =
  "def ExpectedOutput type\n  (e :: Expression) ::: (type :: Expression)\nend\n";
const math =
  "def Sum type\n  (a :: MathExp) :+ (b :: MathExp)\nend\ndef Product type\n  (a :: MathExp) :* (b :: MathExp)\nend\ndef MathExp UnionType(Sum,Product,Symbol,Float)\n";
const pad = (text: string) =>
  text
    .split("\n")
    .map((line) => (line ? "    " + line : ""))
    .join("\n");
function sample(body: string, clause: string, mode: AssertionMode = "check") {
  return loadTests({
    "sample.test": `test "Sample"\n  ${mode === "check" ? "" : mode + " "}expect\n${pad(body)}\n  ${clause}\nend`,
  })[0];
}
const read = (body: string) =>
  loadTests({ "inbox/future.test": `todo test "Future"\n${body}\nend` })[0];


// From test/type-values.test.ts

test("recursive and parameterized types travel to a fresh interpreter as finite data", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def List(t :: Type) type :Nil | :Cons(t,List(t))\ntoString(Type)(type List(Int))",
  );
  assert.equal(text, "Type(Recursive(:Nil | Cons(Int, Recur(0))))");
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = Cons(5,:Nil)\nparse(t)(toString(t)(x)) == x",
      ),
    ),
    "True",
  );
  assert.equal(stringResult(j, "toString(Type)(t)"), text);
  assert.equal(
    displayResults(
      i.run("a = type List(Int)\nparse(Type)(toString(Type)(a)) == a"),
    ),
    "True",
  );
});

test("postfix type descriptions round-trip inhabitants across interpreters", () => {
  const i = new Interpreter();
  const text = stringResult(i, "def T type (Int)@\ntoString(Type)(T)");
  assert.equal(text, "Type(Postfix(:@, Int))");
  assert.equal(
    displayResults(
      i.run(
        "t = parse(Type)(toString(Type)(T))\n(T == t, 1@ .matches T, 1@ .matches t, Postfix(:@, 1) .matches t)",
      ),
    ),
    "(True, True, True, False)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = 1@\n(1@ .matches t, Postfix(:@, 1) .matches t, parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, False, True)",
  );
  assert.throws(
    () => j.run("t = parse(Type)(text)\nPostfix(:@, 1) :: t"),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.code === "E_PATTERN_MISMATCH",
  );
  assert.equal(stringResult(j, "toString(Type)(t)"), text);
});

test("primitive, union, list, labeled and capture-free type descriptions round trip", () => {
  for (const pattern of [
    "Int",
    "Float32",
    "Float",
    "String",
    "Symbol",
    "Any",
    "Type",
    "Bool",
    ":None | :Some(Int)",
    "[_... :: Int*]",
    ":Pair(Int,Int)",
    ":Triple(Int,Int,Int)",
    ":R(a: Int,z: String)",
    ":R(Int,**)",
    ":(Recursive(Int))",
    ":Literal(Int)",
    "Float64(Int)",
    "Type(Int)",
  ]) {
    assert.equal(
      run(`t = type (${pattern})
parse(Type)(toString(Type)(t)) == t`),
      "True",
      pattern,
    );
  }
});

test("typed value round trips retain nested concrete spaces and canonical labels", () => {
  assert.equal(
    run(
      "def Rect type :Rect(w :: Float,h :: Float)\nx = Rect(3,4) :: Rect\nparse(Rect)(toString(Rect)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "def Box type :Box(value: Int,extra: Int)\nx = Box(extra: 9,value: 3) :: Box\nparse(Box)(toString(Box)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "x = [1 :: Float32,2 :: Int]\nparse(Expression)(toString(Expression)(x)) == x",
    ),
    "True",
  );
  assert.equal(
    run(
      "(x :: Any) = (1 :: Float32)\ny = parse(Any)(toString(Any)(x))\n(y == x,y .matches (type Float32))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("x = negate(5 :: Int)\nparse(Int)(toString(Int)(x)) == x"),
    "True",
  );
});

test("every Unicode-scalar string shape has lossless text without evaluating interpolation", () => {
  for (const text of [
    "",
    "hello",
    "$name $(1 / 0)",
    "both \" and '",
    "\n",
    "\r\n",
    "\n hello\n",
    "  all indented\n  twice",
    "x\nend\ny",
    "a\\n",
    "😀",
  ]) {
    const i = new Interpreter();
    i.env.bindings.set("value", valLiteral(text));
    const encoded = stringResult(i, "toString(String)(value)");
    const j = transfer(encoded);
    assert.equal(
      stringResult(j, "parse(String)(text)"),
      text,
      JSON.stringify(text),
    );
    assert.equal(
      stringResult(j, "toString(String)(parse(String)(text))"),
      encoded,
    );
  }
});

test("data constructor names and empty applications remain ordinary distinct data", () => {
  for (const v of [
    valSymbol("Foo"),
    term("Foo"),
    valSymbol("[]"),
    term("[]"),
    term("Type", valSymbol("Widget")),
    term("Primitive", valSymbol("Widget")),
    term("String", valLiteral(12)),
    term("Node", valLiteral(2)),
    term("-", valLiteral(1)),
  ]) {
    const i = new Interpreter();
    i.env.bindings.set("value", v);
    assert.equal(
      displayResults(
        i.run("parse(Expression)(toString(Expression)(value)) == value"),
      ),
      "True",
    );
  }
});

test("nested type boundaries round trip with their concrete interpretations", () => {
  const first = new Interpreter();
  const text = stringResult(
    first,
    "def Circle type :Circle(Float32)\ndef Square type :Square(Float32)\ndef Shape UnionType(type Circle,type Square)\ntoString(Type)(type Shape)",
  );
  const second = transfer(text);
  assert.equal(
    displayResults(
      second.run(
        "t = parse(Type)(text)\n(x :: t) = (Circle(0.5) :: (type :Circle(Float32)))\n(parse(t)(toString(t)(x)) == x,toString(Type)(t) == text)",
      ),
    ),
    "(True, True)",
  );
  assert.throws(
    () => run("def Circle type :Circle(Float32)\nCircle(1.2) :: Circle"),
    (e: unknown) =>
      e instanceof LanguageError &&
      /exactly representable|expected Circle/.test(e.message),
  );
});

test("nested recursive boundaries retain references to enclosing binders", () => {
  const first = new Interpreter();
  const text = stringResult(
    first,
    "def Tree type :Leaf(Int) | :Branch([_... :: Tree*])\ntoString(Type)(type Tree)",
  );
  assert.equal(text, "Type(Recursive(Branch([Repeat(Recur(0))]) | Leaf(Int)))");
  const second = transfer(text);
  assert.equal(
    displayResults(
      second.run(
        "t = parse(Type)(text)\n(x :: t) = Branch([Leaf(1),Branch([])])\n(toString(Type)(t) == text,parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, True)",
  );
});

test("singleton types include arbitrary strings and negative numbers", () => {
  for (const value of ["\n", "both \" and '", "\n  leading\n", -4]) {
    const i = new Interpreter();
    i.env.bindings.set("value", valLiteral(value));
    assert.equal(
      displayResults(
        i.run("t = Type(value)\nparse(Type)(toString(Type)(t)) == t"),
      ),
      "True",
    );
  }
  assert.equal(
    run(
      "t =\n  type\n    :-(1)\n  end\nend\nparse(Type)(toString(Type)(t)) == t",
    ),
    "True",
  );
});

test("generic parse and print factories support whole-pack partial application", () => {
  assert.equal(
    run("read = parse(Int)\nwrite = toString(Int)\nread(write(5))"),
    "5",
  );
  assert.equal(
    run("t = type :Rect(Int,String)\nCode$` $t"),
    "Type(Rect(Int, String))",
  );
});

test("local generic aliases are not reused when their argument names are shadowed", () => {
  const source =
    "def Element type :Item(Int)\ndef List(t :: Type) type :Nil | :Cons(t,List(t))\nt = type List(Element)\ndef f()\n  def Element type :Other\n  s = toStringLocal(Type)(t)\n  parseLocal(Type)(s) == t\nend\nf()";
  assert.equal(run(source), "True");
});

test("restored structural types use independently declared local accessors", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def Foreign type :Rect(x :: Float,y :: Float)\ntoString(Any)(Rect(3,4) :: Foreign)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "def Local type :Rect(width :: Float,height :: Float)\nr = parse(Any)(text)\n(r.width,r.height)",
      ),
    ),
    "(3, 4)",
  );
});

test("postfix values can be type-factory arguments", () => {
  const i = new Interpreter();
  const text = stringResult(
    i,
    "def Box(x) type :Box(x)\ntoString(Type)(Box(1@))",
  );
  assert.equal(text, "Type(Box(Postfix(:@, 1)))");
  assert.equal(
    displayResults(
      i.run(
        "t = Box(1@)\n(t == parse(Type)(toString(Type)(t)), parse(t)(\"Box(1@)\") .matches t, :(Box(Postfix(:@, 1))) .matches t)",
      ),
    ),
    "(True, True, False)",
  );
  const j = transfer(text);
  assert.equal(
    displayResults(
      j.run(
        "t = parse(Type)(text)\n(x :: t) = parse(t)(\"Box(1@)\")\n(parse(t)(\"Box(1@)\") .matches t, :(Box(Postfix(:@, 1))) .matches t, parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, False, True)",
  );
});


// From test/type-atoms.test.ts

test("recursive factories retain finite descriptors and fresh-context round trips", () => {
  assert.equal(
    run(
      "def List(t :: Type) type :Nil | Cons(t,List(t))\nt = List(Int)\ns = toString(Type)(t)\nu = parse(Type)(s)\nv = Cons(5,:Nil) :: u\n(parse(u)(toString(u)(v)) == v,u == t)",
    ),
    "(True, True)",
  );
});


// From test/abstract-values.test.ts

test("narrowing preserves concrete identity and abstract text round trips", () => {
  assert.equal(
    run(
      "def Option(T :: Type) type :None | Some(T)\n(x :: Any) = :None :: Option(Int)\n(v :: Option(Int)) = x\n(v == (:None :: Option(Int)),parse(Any)(toString(Any)(x)) == x,x == v)",
    ),
    "(True, True, True)",
  );
  assert.throws(
    () => run("(x :: Any) = 3 :: Int\n(v :: Int) = x\nv == (3 :: Float)"),
    /different concrete types/,
  );
  assert.throws(
    () => run("x = 3 :: Int\n:(v :: t) = x\nv"),
    /expected a constructed value/,
  );
});


// From test/matcher-resources.test.ts

test("nested portable type descriptions survive schema validation and round trips", () => {
  const depth = 20;
  const pattern = "Box(".repeat(depth) + "Int" + ")".repeat(depth);
  assert.equal(
    displayResults(
      new Interpreter().run(
        "t = Type(:(" + pattern + "))\nparse(Type)(toString(Type)(t)) == t",
      ),
    ),
    "True",
  );
});


// From test/postfix-conventions.test.ts

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


// From test/type-unions.test.ts

test("type union values reconstruct in a fresh interpreter", () => {
  const first = new Interpreter();
  const text = unwrap(
    single(
      first.run(
        "def List(t :: Type) type :Nil | :Cons(t,List(t))\ntoString(Type)(UnionType(type List(Int),type String))",
      ),
    ),
  );
  assert.equal(text.kind, "literal");
  const other = new Interpreter();
  other.env.bindings.set("text", text);
  assert.equal(
    displayResults(
      other.run(
        "def List(t :: Type) type :Nil | :Cons(t,List(t))\nt = parse(Type)(text)\n(x :: t) = (Cons(1,:Nil) :: List(Int))\n(toString(Type)(t) == text,parse(t)(toString(t)(x)) == x)",
      ),
    ),
    "(True, True)",
  );
});


// From test/vertical-spread.test.ts

test("vertical type/value descriptions transfer to a fresh interpreter without capture names", () => {
  for (const source of [
    todo + 'TodoList`\n todo\n  "a"\n end\nend',
    matrix + "Matrix` [\n 1,2\n 3,4\n]",
    bodyGrammar + "Body`\n y = 2\n y\nend",
  ]) {
    const first = new Interpreter();
    const value = single(first.run(source));
    const name = source.startsWith(todo)
      ? "TodoList"
      : source.startsWith(matrix)
        ? "Matrix"
        : "Body";
    const type = unwrap(single(first.run(name)));
    assert.equal(type.kind, "type");
    if (type.kind !== "type") continue;
    const text = single(
      first.call(
        "toString",
        [{ label: "_1", value: type }],
        [{ label: "_1", value }],
      ),
    );
    const description = single(first.run("toString(Type)(" + name + ")"));
    const fresh = new Interpreter();
    const literal = unwrap(description),
      data = unwrap(text);
    assert.equal(literal.kind, "literal");
    assert.equal(data.kind, "literal");
    if (literal.kind !== "literal" || data.kind !== "literal") continue;
    const restored = unwrap(
      fresh.readValue(
        unwrap(single(fresh.run("type Type"))) as typeof type,
        String(literal.value),
      ),
    );
    assert.equal(restored.kind, "type");
    if (restored.kind === "type")
      assert.ok(equal(value, fresh.readValue(restored, String(data.value))));
  }
});


// From test/syntax-inspection.test.ts

test("quote and sidefix/block variants survive a fresh-context round trip", () => {
  const producer = new Interpreter();
  const consumer = new Interpreter();
  const samples = [
    ":x",
    "f()(1,color: :Red)",
    "Code` x + 1",
    "if True 1 else 2",
    "(\n  x = 2\n  x + 1\n)",
  ];
  for (const source of samples) {
    const tree = producer.run(`syntaxTree(Expression$\` ${source})`)[0].value;
    consumer.env.bindings.set("tree", tree);
    const result = consumer.run("syntaxTree(syntaxExpression(tree)) == tree");
    assert.equal(displayResults(result), "True", source);
  }
});

test("typed tree text reconstructs in a fresh interpreter without provenance", () => {
  const producer = new Interpreter();
  const text = producer.run(
    "(Tree :: Type) = syntaxSchema()\nt = syntaxTree(:(f(1)(color: :Red)))\ntoString(Tree)(t)",
  )[0].value;
  const consumer = new Interpreter();
  consumer.env.bindings.set("text", text);
  assert.equal(
    displayResults(
      consumer.run(
        "(Tree :: Type) = syntaxSchema()\ntree = parse(Tree)(text)\nsyntaxExpression(tree)",
      ),
    ),
    "f(1)(color: Red)",
  );
});


// From test/code-grammar.test.ts

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


// From test/quotation-spec.test.ts

test("canonical String spelling is total, inert and idempotent", () => {
  const i = new Interpreter(),
    domain = unwrap(single(i.run("type String")));
  assert.equal(domain.kind, "type");
  if (domain.kind !== "type") return;
  const pieces = [
    "",
    "'",
    '"',
    "\\",
    "$name",
    "$$",
    "\0",
    "\u0001",
    "\t",
    "\n",
    "\r",
    "\u0085",
    "\u2028",
    "é",
    "e\u0301",
    "🙂",
  ];
  for (const a of pieces)
    for (const b of pieces) {
      const value = a + b,
        source = stringSource(value);
      assert.equal(text(source), value);
      assert.equal(stringSource(text(source)), source);
      const parsed = i.readValue(domain, source);
      assert.ok(equal(parsed, { kind: "literal", value }));
    }
});

test("templates and staged quotes survive public tree and fresh Code text round trips", () => {
  for (const source of [
    '$"Hi, $name"',
    '$"Hi, $$name"',
    '$"literal \\u0024name / $x"',
    "Code$` $$x",
    "Code` $x",
    'html$"<p>$x</p>"',
  ]) {
    const i = new Interpreter(),
      code = single(i.run("Code` (" + source + ")"));
    i.env.bindings.set("original", code);
    assert.equal(
      run("c = Code` (" + source + ")\nparse(Code)(toString(Code)(c)) == c"),
      "True",
      source,
    );
    assert.equal(
      displayResults(
        i.run(
          "syntaxTree(original) == syntaxTree(syntaxExpression(syntaxTree(original)))",
        ),
      ),
      "True",
      source,
    );
    const tree = parseExpression(source);
    assert.equal(
      syntaxKey(parseExpression(normal(tree))),
      syntaxKey(tree),
      source,
    );
  }
  assert.equal(syntaxKey(parseSurface('"a"')), syntaxKey(parseSurface("'a'")));
});


// From test/typed-grammar-quotes.test.ts

test("sidefix and deferred-expectation type/value text round trip without evaluation", () => {
  assert.equal(
    run(
      expected +
        'def Entry type :test name :: String :expect value :: ExpectedOutput\nv = Entry`\n  test "round trip"\n  expect\n    (1 + 2) :: MissingType\n  end\nend\nt = parse(Type)(toString(Type)(Entry))\nw = parse(t)(toString(Entry)(v))\nv == w',
    ),
    "True",
  );
});


// From test/test-suite.test.ts

test("test-file values retain unresolved operands through data round trips", () => {
  const value = sample("missing()", "is 3 :: MissingType", "todo");
  const i = new Interpreter(),
    type = unwrap(single(i.run(TEST_SCHEMA)));
  if (type.kind !== "type") assert.fail();
  const text = unwrap(
    single(i.call("toString", singleton(type), singleton(value.fileValue))),
  );
  if (text.kind !== "literal" || typeof text.value !== "string") assert.fail();
  assert.ok(equal(i.readValue(type, text.value), value.fileValue));
});


// From test/todo-tests.test.ts

test("whole-test todo file values survive the published schema's typed-text transport", () => {
  const value = read("  expect missing() is 3 :: MissingType");
  const interpreter = new Interpreter();
  const type = unwrap(single(interpreter.run(TEST_SCHEMA)));
  if (type.kind !== "type") assert.fail();
  const text = unwrap(
    single(
      interpreter.call("toString", singleton(type), singleton(value.fileValue)),
    ),
  );
  if (text.kind !== "literal" || typeof text.value !== "string") assert.fail();
  assert.ok(equal(interpreter.readValue(type, text.value), value.fileValue));
});


// From test/milestone-four.test.ts

test("recursive UnionType preserves concrete members and has portable finite syntax", () => {
  assert.equal(
    run(math + "(x :: MathExp) = 1 :: Float\n(x :: Float) == (1 :: Float)"),
    "True",
  );
  for (const name of ["MathExp", "Sum", "Product"]) {
    const i = new Interpreter();
    const text = unwrap(single(i.run(math + "toString(Type)(" + name + ")")));
    assert.equal(text.kind, "literal");
    const other = new Interpreter();
    other.env.bindings.set("text", text);
    assert.equal(
      displayResults(other.run("toString(Type)(parse(Type)(text)) == text")),
      "True",
    );
  }
});


// From test/structural-slots.test.ts

test("facet descriptors and values transfer to an environment with no source type names", () => {
  const producer = new Interpreter();
  const values = producer.run(
    full + "(toString(Type)(type Rectangular),toString(Rectangular)(r))",
  );
  const other = new Interpreter();
  other.env.bindings.set("typeText", single([values[0]]));
  other.env.bindings.set("valueText", single([values[1]]));
  assert.equal(
    displayResults(
      other.run(
        "t = parse(Type)(typeText)\nv = parse(t)(valueText)\n(toString(t)(v) == valueText,toString(Type)(t) == typeText)",
      ),
    ),
    "(True, True)",
  );
});

test("local facet text uses names while global text remains structural", () => {
  assert.equal(
    run(
      full +
        "(p :: Rectangular) = r\n(toStringLocal(Rectangular)(p),parseLocal(Rectangular)(toStringLocal(Rectangular)(p)) == p)",
    ),
    '("Rect(2, 3, color: \\"black\\") :: Colored", True)',
  );
});

test("literal punctuation remains distinct from the labeled-rest marker in portable data", () => {
  for (const value of [":(R(:**))", ":(R(**))", ":**"])
    assert.equal(
      run("v = " + value + "\nparse(Expression)(toString(Expression)(v)) == v"),
      "True",
      value,
    );
  for (const pattern of [":**", ":**(Int)"])
    assert.equal(
      run(
        "v =\n  type\n    " +
          pattern +
          "\n  end\nend\nparse(Expression)(toString(Expression)(v)) == v",
      ),
      "True",
      pattern,
    );
  rejects("def f(**fields) fields\nf(foo: 1)", "E_KEYWORD_REST_UNSUPPORTED");
});

test("facet descriptions are ordinary reconstructible values", () => {
  assert.equal(
    run(
      full +
        "t = type Rectangular\nu = parse(Type)(toString(Type)(t))\nFacet(pattern) = t\n(t == u,Facet(pattern) == t)",
    ),
    "(True, True)",
  );
});

test("recursive facets preserve concrete children and survive descriptor reconstruction", () => {
  const source =
    'def Full type :Nil | :Cons(Float,Full,meta: String)\ndef Sequence type :Nil | :Cons(first :: Float,next :: Sequence,**)\nr = Cons(2,:Nil,meta: "x") :: Full\n';
  assert.equal(
    run(
      source +
        "(p :: Sequence) = r\nt = toString(Sequence)(p)\n(p.first,p.next,p == r,parse(Sequence)(t) == r,parse(Type)(toString(Type)(type Sequence)) == (type Sequence))",
    ),
    "(2, Nil, True, True, True)",
  );
  assert.equal(
    run(
      source +
        "t = parse(Type)(toString(Type)(type Sequence))\n(p :: t) = r\ntoString(t)(p) == toString(Sequence)(r)",
    ),
    "True",
  );
});

test("type-description grammar is a structural facet over cached and reconstructed type values", () => {
  assert.equal(
    run(
      TYPE_SCHEMA +
        "\na = type :R(Int)\nb = parse(Type)(toString(Type)(a))\n(a == b,a .matches (type TypeDescription),b .matches (type TypeDescription))",
    ),
    "(True, True, True)",
  );
});


// From test/value-representation.test.ts

test("equal trees have equal global text regardless of compiled caches", () => {
  for (const expression of ["Type(Rect(Float))", "UnionType(Int,String)"]) {
    assert.equal(
      run(
        "a = " +
          expression +
          "\nb = :(" +
          expression +
          ")\n(a == b,toString(Expression)(a) == toString(Expression)(b),parse(Expression)(toString(Expression)(b)) == b)",
      ),
      "(True, True, True)",
    );
  }
  assert.throws(
    () => run("b = :Int\nparse(Expression)(toString(Expression)(b)) == b"),
    /quoted Int is not a symbol/,
  );
});

test("ordinary type trees work in type positions without a preexisting matcher", () => {
  assert.equal(
    run(
      "t = Int\n(x :: t) = 3\n(t .matches (type Type),x .matches t,parse(t)(toString(t)(x)) == x)",
    ),
    "(True, True, True)",
  );
  assert.equal(
    run("def factory() :(Type(Rect(Int)))\ndef R factory()\nRect(3) :: R"),
    "Rect(3)",
  );
  assert.equal(run("t = Int\nr = t .where (n -> n > (0 :: Int))\n1 :: r"), "1");
  assert.equal(run("def accept(t :: Type) 1 .matches t\naccept(Int)"), "True");
  assert.equal(
    run(
      "def L(t :: Type) type :Nil | :Cons(t,L(t))\nt = Int\nCons(1,:Nil) :: L(t)",
    ),
    "Cons(1, Nil)",
  );
});

test("invalid type-shaped data is not compiled or silently normalized by matching", () => {
  assert.equal(
    run("(:(Primitive(Bogus)) .matches (type Type),Int .matches (type Type))"),
    "(False, True)",
  );
  assert.equal(
    run(
      "x = :(UnionType(1,2))\nparse(Expression)(toString(Expression)(x)) == x",
    ),
    "True",
  );
});

// From test/type-atoms.test.ts

test("explicit Type(Int) preserves its distinct ordinary value tree", () => {
  assert.equal(
    run("(Type(Int),Type(Int) == Int,Type(Type(Int)) == Type(Int))"),
    "(Type(Int), False, True)",
  );
  assert.equal(
    run("t = Type(Int)\nparse(Type)(toString(Type)(t)) == t"),
    "True",
  );
  assert.equal(
    run("t = Type(Box(Type(Int)))\nparse(Type)(toString(Type)(t)) == t"),
    "True",
  );
});

// From test/rational-primitives.test.ts

test("numeric syntax adapters preserve exact decimal and zero payloads", () => {
  const setup =
    "(Tree :: Type) = syntaxSchema()\n" +
    "decimal = syntaxTree(:(0.1))\n" +
    "NumberLiteral(n) = decimal\n" +
    "NumberLiteral(zero) = syntaxTree(:(0))\n";
  assert.equal(run(setup + "n == 0.1"), "True");
  assert.equal(run(setup + "zero == 0"), "True");
  assert.equal(run(setup + "decimal .matches Tree"), "True");
  assert.equal(run(setup + "syntaxExpression(decimal) == :(0.1)"), "True");
  assert.equal(
    run(setup + "syntaxTree(syntaxExpression(decimal)) == decimal"),
    "True",
  );
  assert.equal(
    run(setup + "parse(Tree)(toString(Tree)(decimal)) == decimal"),
    "True",
  );
  assert.equal(run("syntaxTree(:(0.1))"), "NumberLiteral(0.1)");
  assert.equal(run("syntaxTree(:(0))"), "NumberLiteral(0)");
});

test("numeric syntax-tree schema transport distinguishes exact and rounded values", () => {
  const setup =
    "(Tree :: Type) = syntaxSchema()\n" +
    "exact = syntaxTree(0.1)\n" +
    "rounded = syntaxTree(0f0.1)\n" +
    "NumberLiteral(n) = rounded\n" +
    "text = toString(Tree)(exact)\n";
  assert.equal(run(setup + "exact != rounded"), "True");
  assert.equal(run(setup + "n == 0f0.1"), "True");
  assert.equal(run(setup + "n != 0.1"), "True");
  assert.equal(run(setup + "syntaxExpression(exact) == 0.1"), "True");
  assert.equal(run(setup + "syntaxExpression(rounded) == 0f0.1"), "True");
  assert.equal(run(setup + "parse(Tree)(text) == exact"), "True");
});

test("fraction Rational text round-trips in a fresh interpreter", () => {
  const i = new Interpreter();
  const text = stringResult(i, "toString(Rational)(1 / 3)");
  assert.equal(text, "1/3");
  assert.equal(run("parse(Rational)(text)", transfer(text)), "1/3");
  assert.equal(run("parse(Rational)(toString(Rational)(1/3)) == 1/3"), "True");
  assert.equal(
    run("parse(Code)(toString(Code)(Code` 1/3)) == Code` 1/3"),
    "True",
  );
  const tree = parseExpression("1/3");
  assert.equal(normal(tree), "1/3");
  assert.equal(syntaxKey(tree), syntaxKey(parseExpression(normal(tree))));
});


// From test/binding-defaults.test.ts

test("factory defaults and type descriptions remain separate ordinary values", () => {
  assert.equal(
    run(
      'def Rectangle type :Rect(w :: Int,h :: Int,color: String)\ndef rectangle(w :: Int,h :: Int,color: String = "black") Rect(w,h,color: color) :: Rectangle\nt = type Rectangle\n(toString(Type)(t),parse(Type)(toString(Type)(t)) == t)',
    ),
    '("Type(Rect(Int, Int, color: String))", True)',
  );
});


// From test/type-definition-evaluation.test.ts

test("nested accessor names erase from portable type values", () => {
  assert.equal(
    run(
      "a =\n  def A type :Outer(:Leaf(x :: Int))\n  type A\nend\nb =\n  def B type :Outer(:Leaf(y :: Int))\n  type B\nend\n(a == b,parse(Type)(toString(Type)(a)) == a)",
    ),
    "(True, True)",
  );
});

// From test/concrete-unions.test.ts

test("explicit members survive transport to a fresh interpreter", () => {
  const first = new Interpreter();
  const text = single(
    first.run(`type MyType concrete String? | Float?
(inner :: MyType) = :None :: String?
toString(MyType)(inner)`),
  );
  const next = new Interpreter();
  next.env.bindings.set("text", text);
  assert.equal(
    run(
      `type MyType concrete String? | Float?
x = parse(MyType)(text)
(stringMember :: MyType) = :None :: String?
(floatMember :: MyType) = :None :: Float?
(x == stringMember, x == floatMember, toString(MyType)(x) == text)`,
      next,
    ),
    "(True, False, True)",
  );
});
