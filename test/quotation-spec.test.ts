import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  parseSurface,
  parseExpression,
  normal,
  LanguageError,
} from "../src/index.ts";
import { unwrap, single, equal, displayResults } from "../src/values.ts";
import { syntaxKey } from "../src/syntax.ts";
import { stringSource } from "../src/string-format.ts";
import { decodeSource } from "../src/source-encoding.ts";

function text(source: string): string {
  const value = unwrap(single(new Interpreter().run(source)));
  assert.equal(value.kind, "literal");
  if (value.kind !== "literal" || typeof value.value !== "string")
    throw new Error("String expected");
  return value.value;
}
const run = (source: string) => displayResults(new Interpreter().run(source));
function execute(source: string) {
  const interpreter = new Interpreter(),
    code = single(interpreter.run(source));
  return displayResults(interpreter.evaluateCode(code));
}
test("raw/escaped strings are inert; explicit interpolation opts in", () => {
  assert.equal(text("'raw \\n $name'"), "raw \\n $name");
  assert.equal(text('"escaped\\n$name"'), "escaped\n$name");
  assert.equal(text('name = "John"\n$"Hello, $name"'), "Hello, John");
  assert.equal(text("name = 'John'\n$'Hello, $name'"), "Hello, John");
  assert.equal(text('$"\\u0024name / \\u0024(name)"'), "$name / $(name)");
  assert.equal(text("name = '$other'\n$'$name'"), "$other");
});
test("escape vocabulary is exact and scalar-valued", () => {
  const escapes: Record<string, string> = {
    n: "\n",
    r: "\r",
    t: "\t",
    v: "\v",
    b: "\b",
    f: "\f",
    "0": "\0",
    '"': '"',
    "\\": "\\",
    x41: "A",
    u00E9: "é",
    U0001F642: "🙂",
  };
  for (const [escape, value] of Object.entries(escapes))
    assert.equal(text('"\\' + escape + '"'), value, escape);
  for (const escape of [
    "$",
    "'",
    "a",
    "1",
    "x80",
    "x1",
    "uD800",
    "uDC00",
    "U00110000",
    "u12G4",
  ])
    assert.throws(() => text('"\\' + escape + '"'), LanguageError, escape);
  assert.throws(() => parseExpression('"\uD800"'), /surrogate/);
  assert.throws(() => parseExpression('"\uDC00"'), /surrogate/);
  assert.equal(text('"é" == "e\\u0301"\n"ok"'), "ok");
  assert.equal(run('"é" == "e\\u0301"'), "False");
});
test("inline source separators reject while escaped/runtime CRLF remains exact", () => {
  for (const separator of [
    "\n",
    "\r",
    "\v",
    "\f",
    "\u0085",
    "\u2028",
    "\u2029",
  ])
    assert.throws(
      () => parseExpression("'x" + separator + "y'"),
      /line separator/,
    );
  assert.equal(text('"x\\r\\ny"'), "x\r\ny");
  assert.equal(text('s = "\\r\\n"\n$"$s"'), "\r\n");
  assert.equal(text("'\r\n  x\r\n  y\r\nend"), "x\ny");
  assert.equal(text("'\n  x\r\r\n\nend"), "x\r\n");
});
test("text blocks preserve every non-framing blank line and relative indentation", () => {
  for (const [lines, value] of [
    [[""], ""],
    [["", ""], "\n"],
    [["  y"], "y"],
    [["  y", ""], "y\n"],
    [["", "  y", ""], "\ny\n"],
    [["", "", "  foo", "", ""], "\n\nfoo\n\n"],
    [["  y", "    z"], "y\n  z"],
    [["  end"], "end"],
    [["  y", "    "], "y\n  "],
    [[" \tvalue", " \t\tother"], "value\n\tother"],
  ] as [string[], string][])
    assert.equal(
      text("'\n" + lines.join("\n") + "\nend # closing comment"),
      value,
    );
  assert.throws(() => parseExpression("'\nend"), /at least one/);
  assert.throws(() => parseExpression("'\n  x"), /explicit aligned end/);
  assert.throws(() => parseExpression("'\n  x\nnext"), /explicit aligned end/);
  assert.throws(() => parseExpression("'\n \n  x\nend"), /indentation prefix/);
  assert.throws(() => parseExpression("'\n  x\n \nend"), /indentation prefix/);
  assert.equal(text("'\n\thello\n\t  world\nend"), "hello\n  world");
  assert.equal(text("'\n \thello\n \t  world\nend"), "hello\n  world");
  assert.equal(
    text("f = x ->\n  y = '\n  \tkeep\n  \t  payload\n  end\n  y\nend\nf(1)"),
    "keep\n  payload",
  );
  assert.throws(
    () => parseExpression("'\n  x\n\ty\nend"),
    /indentation prefix/,
  );
});
test("holes balance nested strings and do not read a postfix chain implicitly", () => {
  assert.equal(text('$"Value: $("a)" + "b")"'), "Value: a)b");
  assert.equal(text("$'Value: $('a)' + 'b')'"), "Value: a)b");
  assert.equal(
    text(
      'def Person type {name: String}\nperson = {name: "Jo"} :: Person\n$"$(person.name)"',
    ),
    "Jo",
  );
  assert.equal(text('name = "Jo"\n$"$name.suffix"'), "Jo.suffix");
  assert.throws(() => text('$"bad $!"'), /interpolation requires/);
  assert.throws(() => text('$"bad \\$name"'), /invalid escape/);
});
test("holes interpret sidefix code using the active lexical grammar", () => {
  assert.equal(text('$"$(if True 1 else 2)"'), "1");
  assert.equal(run("Code$` $(if True 1 else 2)"), "1");
  assert.equal(
    text('macro :choose x :: Expression Code$` $x\n$"$(choose 4)"'),
    "4",
  );
  assert.equal(
    text(
      'def f()\n  macro :choose x :: Expression Code$` $x\n  $"$(choose 7)"\nend\nf()',
    ),
    "7",
  );
});
test("colon quotes are raw; a quoted head is not callable", () => {
  assert.throws(() => run("x = 3\n:Box(x)"), /not callable/);
  assert.equal(run("x = 3\n:(Box(x))"), "Box(x)");
  assert.equal(run("x = 3\nExpression$` Box($x)"), "Box(3)");
  assert.equal(run("x = 3\n:(Box($x))"), "Box($(x))");
  assert.equal(run("x = 3\nCode` $x + 1"), "$(x) + 1");
  assert.equal(run("x = 3\nCode$` $x + 1"), "3 + 1");
});
test("an outer explicit pass traverses nested template/quote syntax once", () => {
  assert.equal(
    execute('name = "Jim"\nCode$`\n  name = "Jo"\n  $"Hello, $name"\nend'),
    '"Hello, Jim"',
  );
  assert.equal(
    execute('name = "Jim"\nCode$`\n  name = "Jo"\n  $"Hello, $$name"\nend'),
    '"Hello, Jo"',
  );
  assert.equal(
    execute('name = "$secret"\nCode$` $"Hello, $name"'),
    '"Hello, $secret"',
  );
  assert.equal(run("x = :a\nCode$` (Code$` $x)"), "Code$` a");
  assert.equal(run("x = :a\nCode$` $(Code$` $x)"), "a");
  assert.equal(text("$'$$name'"), "$name");
  assert.equal(text("$'$$(name)'"), "$(name)");
  assert.equal(text("$'$$$name'"), "$$name");
});
test("sidefix data uses the same outer interpolation pass through a Code field", () => {
  const i = new Interpreter();
  i.run("def QuotedTest type :test name :: String code :: Code", "repl");
  const source =
    'name = "Jim"\nt = QuotedTest$`\n  test "staging"\n    name = "Jo"\n    $"Hello, $$name"\n  end\nend\nt.code';
  assert.equal(
    displayResults(i.evaluateCode(single(i.run(source)))),
    '"Hello, Jo"',
  );
});
test("typed interpolation retains tree structure, pack boundaries and grammar checks", () => {
  assert.equal(run("a = Code` x + 1\nCode$` $a * 2"), "(x + 1) * 2");
  assert.equal(
    run("args = [Code` 1,Code` 2]\nCode$` f($(args...))(3)"),
    "f(1, 2)(3)",
  );
  assert.equal(
    run(
      "def MathExp type Symbol | Float | :sum(MathExp,MathExp)\nx = MathExp` sum(a,b)\nMathExp$` sum($x,c)",
    ),
    "sum(sum(a, b), c)",
  );
  assert.throws(
    () =>
      run(
        'def MathExp type Symbol | Float | :sum(MathExp,MathExp)\nx = "bad" :: String\nMathExp$` $x',
      ),
    /expected|different concrete/,
  );
});
test("readers receive inert fragments and separate typed values, with the same modes", () => {
  const prelude =
    'def html(fragments,values) {fragments,values}\nname = "<strong>Jo</strong>"\n';
  assert.equal(run(prelude + "html' <p>$name</p>"), '{["<p>$name</p>"], []}');
  assert.equal(
    run(prelude + "html$' <p>$name</p>"),
    '{["<p>", "</p>"], ["<strong>Jo</strong>"]}',
  );
  assert.equal(
    run(prelude + 'html$"<p>$name</p>\\n"'),
    '{["<p>", "</p>\\n"], ["<strong>Jo</strong>"]}',
  );
});
test("outer reader interpolation preserves the fragment/value boundary", () => {
  assert.equal(
    execute(
      'def html(fragments,values) {fragments,values}\nname = "<strong>Jim</strong>" :: String\nCode$` html$"<p>$name</p>"',
    ),
    '{["<p>", "</p>"], ["<strong>Jim</strong>"]}',
  );
  assert.equal(
    execute(
      'def Rect type Rect(Int,Int)\ndef html(fragments,values)\n  [value] = values\n  value == (Rect(2,3) :: Rect)\nend\nx = Rect(2,3) :: Rect\nCode$` html$"$x"',
    ),
    "True",
  );
});
test("holes run left to right once, while parse-only leaves them inert", () => {
  const interpreter = new Interpreter();
  let calls = 0;
  interpreter.env.functions.set("next", [
    {
      kind: "native",
      id: -1,
      name: "next",
      arities: [0],
      test: (args) => !args.length,
      invoke: () => [
        { label: "_1", value: { kind: "literal", value: ++calls } },
      ],
    },
  ]);
  interpreter.parse('$"$(next()) / $(next())"');
  assert.equal(calls, 0);
  assert.equal(
    displayResults(interpreter.run('$"$(next()) / $(next())"')),
    '"1 / 2"',
  );
  assert.equal(calls, 2);
  assert.equal(
    displayResults(interpreter.run("Code$` Pair($(next()),$(next()))")),
    "Pair(3, 4)",
  );
  assert.equal(calls, 4);
});
test("UTF-8 decoding is strict and leaves exactly-one-BOM normalization to the parser", () => {
  assert.throws(() => decodeSource(new Uint8Array([0xc0, 0xaf])), /UTF-8/);
  const encoded = new TextEncoder().encode("\uFEFF\uFEFF1");
  assert.equal(decodeSource(encoded), "\uFEFF\uFEFF1");
  assert.throws(() => parseSurface(decodeSource(encoded)), LanguageError);
});
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
