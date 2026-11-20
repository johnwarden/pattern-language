import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Interpreter, displayResults } from "../src/index.ts";
import { valLiteral } from "../src/values.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));

test("the type-description syntax schema is defined in the source language", () => {
  const prelude = readFileSync(
    new URL("../examples/type-descriptions.pattern", import.meta.url),
    "utf8",
  );
  assert.equal(
    run(
      prelude +
        "\np = type TypeDescription\n(Int .matches p,UnionType(Int,String) .matches p,(type :Some(Int) | :None) .matches p,:(Primitive(Unknown)) .matches p)",
    ),
    "(True, True, True, False)",
  );
});

test("type unions preserve member spaces across overlapping unions", () => {
  assert.equal(
    run(
      "def A UnionType(type Int,type String)\ndef B UnionType(type Int,type Bool)\n(x :: A) = (3 :: Int)\n(y :: B) = (3 :: Int)\nmatch x\n  (a :: Int) -> match y\n    (b :: Int) -> (a == b)\n    _ -> False\n  end\n  _ -> False\nend",
    ),
    "True",
  );
  assert.equal(
    run(
      'def U UnionType(type Int,type String)\n(x :: U) = (3 :: Int)\n(y :: U) = ("3" :: String)\nx == y',
    ),
    "False",
  );
});

test("option spaces stay distinct and their overlapping union is rejected", () => {
  const option = "def Option(T :: Type) type :None | Some(T)\n";
  assert.throws(
    () =>
      run(
        option +
          "a = :None :: Option(Int)\nb = :None :: Option(String)\na == b",
      ),
    /different concrete types/,
  );
});

test("type unions flatten, deduplicate, and have order independent canonical text", () => {
  assert.equal(
    run(
      "a = UnionType(Int,String)\nb = UnionType(String,a,Int)\n(a == b,toString(Type)(a) == toString(Type)(b))",
    ),
    "(True, True)",
  );
  assert.equal(
    run("def A UnionType(type Int,type String)\nUnionType(type A,Int)"),
    "UnionType(Int, String)",
  );
  assert.equal(run("UnionType(Int,Int)"), "UnionType(Int)");
});

test("concrete pattern unions remain distinct from abstract type unions", () => {
  assert.equal(run("type Int | String"), "Type(Int | String)");
  const interpreter = new Interpreter();
  interpreter.env.bindings.set("text", valLiteral("Type(Int | String)"));
  assert.equal(
    displayResults(interpreter.run("parse(Type)(text)")),
    "Type(Int | String)",
  );
  assert.throws(() => run("UnionType(1)"), /type values/);
  assert.equal(run("type :Some(Int) | :None"), "Type(:None | Some(Int))");
});

test("union descriptions support normal destructuring and preserve literal data escapes", () => {
  assert.equal(
    run(
      "UnionType(a,b) = UnionType(Int,String)\nUnionType(a,b) == UnionType(String,Int)",
    ),
    "True",
  );
  assert.equal(
    run(
      "x = :(UnionType(1,2))\nparse(Expression)(toString(Expression)(x)) == x",
    ),
    "True",
  );
});
