import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";
import { TYPE_SCHEMA } from "../src/type-schema.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const schema = readFileSync(
  new URL("../examples/type-descriptions.pattern", import.meta.url),
  "utf8",
);

test("documented schema is the exact runtime bootstrap source", () => {
  assert.equal(schema, TYPE_SCHEMA);
});

test("language schema gates descriptor shapes without consulting the user scope", () => {
  // These shapes previously fell through the host decoder as ordinary nodes,
  // despite using heads reserved by the descriptor grammar.
  for (const source of ["Type(:String(:A))", "Literal(:String)"])
    assert.throws(
      () => run(source),
      (e: unknown) =>
        e instanceof LanguageError && e.diagnostic.code === "E_QUOTED_PRIMITIVE",
    );
  assert.throws(() => run("Type(:|(:A,:B))"), /invalid type-description shape/);
  assert.equal(
    run(
      "def ordinaryHead(h) False\ndef TypeDescription type :Nope\nType(:Box(Int)) == (type :Box(Int))",
    ),
    "True",
  );
  assert.throws(
    () => run("def ordinaryHead(h) True\nType(:|(:A,:B))"),
    /invalid type-description shape/,
  );
  // Explicit Apply describes a literal reserved head. Quoted primitive names
  // are E_QUOTED_PRIMITIVE (D20); the unquoted reserved symbol is the tag.
  assert.equal(
    run("Type(Apply(Literal(:Box),Fields(:A))) == (type :Box(:A))"),
    "True",
  );
});

test("schema validation work budgets reset across operations and sessions", () => {
  for (let session = 0; session < 3; session++) {
    const interpreter = new Interpreter();
    for (let i = 0; i < 300; i++)
      assert.equal(
        displayResults(
          interpreter.run(
            "Type(:Box(:A,:B,:C,:D,:E,:F,:G,:H)) == (type :Box(:A,:B,:C,:D,:E,:F,:G,:H))",
          ),
        ),
        "True",
      );
  }
});

test("recursive pattern schema covers portable descriptors without Expression placeholders", () => {
  assert(!schema.includes(":: Expression"));
  for (const expression of [
    "type :Rect(x: Int,y: String)",
    "type :Some(Int) | :None",
    "type :Pair(x :: Int,y :: Int)",
    "type [rest... :: Int*]",
    "type String([65])",
    "UnionType(Int,String)",
  ]) {
    assert.equal(
      run(schema + "\n(" + expression + ") .matches (type TypeDescription)"),
      "True",
      expression,
    );
  }
  assert.equal(
    run(
      schema +
        "\ndef List(t :: Type) type :Nil | :Cons(t,List(t))\n(type List(Int)) .matches (type TypeDescription)",
    ),
    "True",
  );
});

test("pattern schema rejects malformed reserved constructors rather than accepting a generic node", () => {
  for (const data of [
    ":(Type(Fields(Int)))",
    ":(Type(Repeat(Int)))",
    ":(Type(Apply(X,Y)))",
    ":(Type(Recur(-(1))))",
    ":(Type(_))",
    ":(UnionType())",
    ":(UnionType(Int,Bogus))",
  ])
    assert.equal(
      run(schema + "\n(" + data + ") .matches (type TypeDescription)"),
      "False",
      data,
    );
});

test("quoted operator heads are literal patterns across matching contexts", () => {
  assert.equal(run("def split(:|(a)(b))\n  (a,b)\nend\nsplit(:(X | Y))"), "(X, Y)");
  assert.equal(run(":|(a)(b) = :(X | Y)\n(a,b)"), "(X, Y)");
  assert.equal(run("match :(X | Y)\n  :|(a)(b) -> (a,b)\nend"), "(X, Y)");
  assert.equal(
    run("t =\n  type\n    :|(Symbol)(Symbol)\n  end\nend\nx = :(X | Y)\nx .matches t"),
    "True",
  );
  assert.equal(
    run("x = :name\nmatch x\n  :name -> True\n  _ -> False\nend"),
    "True",
  );
});

test("alternative branch captures erase without shared slots", () => {
  assert.equal(
    run(
      "t = type :A(x :: Int) | :B(x :: Int)\nu = parse(Type)(toString(Type)(t))\n(t == u,A(1) .matches u,B(2) .matches u)",
    ),
    "(True, True, True)",
  );
  assert.equal(
    run(
      "t = type :Pair((:A(x :: Int) | :B(y :: Int)),z :: Int)\nPair(A(1),2) .matches t",
    ),
    "True",
  );
});

test("String constructor patterns round trip without becoming string literals", () => {
  for (const pattern of ["String([65])", "String(Int)", "String()"])
    assert.equal(
      run("t = type " + pattern + "\nparse(Type)(toString(Type)(t)) == t"),
      "True",
    );
});

test("refinements preserve the concrete member selected by unions and Any", () => {
  assert.equal(
    run(
      "u = UnionType(type Int,type String)\nr = u .where (x -> True)\n(a :: r) = (1 :: Int)\n(a .matches (type Int),a .matches u)",
    ),
    "(True, True)",
  );
  assert.equal(
    run(
      "u = UnionType(type Int,type String)\nr = u .where (x -> True)\n(a :: r) = (1 :: Int)\n(a :: Int) == (1 :: Int)",
    ),
    "True",
  );
  assert.equal(
    run(
      "r = (type Any) .where (x -> True)\n(x :: r) = (1 :: Int)\nx .matches (type Int)",
    ),
    "True",
  );
});

test("failed dispatch candidates do not evaluate defaults", () => {
  assert.equal(
    run(
      'def f(A(y: Int = 1 / 0),x: Int) 1\ndef f(A(),x: String) 2\nf(A(),x: "hello")',
    ),
    "2",
  );
  assert.equal(run("def f(A(x: Int = 1 / 0)) 1\ndef f(B()) 2\nf(B())"), "2");
  assert.equal(
    run('def f(x: Int,y: Int = 1 / 0) 1\ndef f(x: String) 2\nf(x: "hello")'),
    "2",
  );
});

test("public type equality requires value trees, never host closure identity", () => {
  assert.throws(
    () => run("Type(Apply(:A,Int))"),
    /invalid type-description shape/,
  );
  assert.throws(
    () => run("t = (type Int) .where (n -> True)\nt == t"),
    /value has no structural representation/,
  );
  assert.equal(run("(type :A | :B) == (type :B | :A)"), "True");
});

test("schema and decoder agree on generated single-value and argument-pack positions", () => {
  const interpreter = new Interpreter();
  interpreter.run(schema);
  const check = (descriptor: string, accepted: boolean) => {
    assert.equal(
      displayResults(
        interpreter.run(
          ":(" + descriptor + ") .matches (type TypeDescription)",
        ),
      ),
      accepted ? "True" : "False",
      "schema: " + descriptor,
    );
    const construct = () => interpreter.run(descriptor);
    if (accepted) {
      assert.doesNotThrow(construct, "decoder: " + descriptor);
      assert.equal(
        displayResults(
          interpreter.run(
            "parse(Type)(toString(Type)(" +
              descriptor +
              ")) == (" +
              descriptor +
              ")",
          ),
        ),
        "True",
        "round trip: " + descriptor,
      );
    } else
      assert.throws(
        construct,
        /invalid type-description shape/,
        "decoder: " + descriptor,
      );
  };
  const leaves = [":A", "Int", "Type(Box(String))", "Literal(:A)"];
  const contexts = [
    (p: string) => "Type(" + p + ")",
    (p: string) => "Type(Box(" + p + "))",
    (p: string) => "Type(Apply(" + p + ",Fields()))",
    (p: string) => "Type(Apply(:Box,Fields(Repeat(" + p + "))))",
    (p: string) => "Type(Bind(0," + p + "))",
    (p: string) => "Type(Union(:Z," + p + "))",
    (p: string) => "Type(Recursive(Box(" + p + ")))",
  ];
  for (const context of contexts) {
    for (const leaf of leaves) check(context(leaf), true);
    for (const pack of ["Fields()", "OpenFields()"])
      check(context(pack), false);
  }
  // Repetition belongs directly in a pack, never in a scalar position or
  // inside another repetition. Direct pack repetition remains valid.
  for (const descriptor of [
    "Type(Repeat(:A))",
    "Type(Apply(Repeat(:A),Fields()))",
    "Type(Apply(:Box,Fields(Repeat(Repeat(:A)))))",
    "Type(Union(:A,Repeat(:A)))",
  ])
    check(descriptor, false);
  check("Type(Box(Repeat(:A)))", true);
  check(
    "Facet(Apply(:Box,OpenFields(Fields(Repeat(:A)),labels: True,positional: False)))",
    true,
  );
});
