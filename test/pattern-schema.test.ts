import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interpreter, displayResults } from "../src/index.ts";
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
  for (const source of ["Type(:(String(:A)))", "Type(:(|(:A,:B)))"])
    assert.throws(() => run(source), /invalid type-description shape/);
  assert.equal(
    run(
      "def ordinaryHead(h) False\ndef TypeDescription type :Nope\nType(:(Box(Int))) == (type :Box(Int))",
    ),
    "True",
  );
  assert.throws(
    () => run("def ordinaryHead(h) True\nType(:(|(:A,:B)))"),
    /invalid type-description shape/,
  );
});

test("schema validation work budgets reset across operations and sessions", () => {
  for (let session = 0; session < 3; session++) {
    const interpreter = new Interpreter();
    for (let i = 0; i < 300; i++)
      assert.equal(
        displayResults(
          interpreter.run(
            "Type(:(Box(:A,:B,:C,:D,:E,:F,:G,:H))) == (type :Box(:A,:B,:C,:D,:E,:F,:G,:H))",
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
    "type :Pair(Int,Int)",
    "type [_... :: Int*]",
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

test("public type equality rejects invalid Type constructors", () => {
  assert.throws(
    () => run("Type(Apply(:A,Int))"),
    /invalid type-description shape/,
  );
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
