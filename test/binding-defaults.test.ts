import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults, LanguageError } from "../src/index.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const rectangle = "def Rectangle type :Rect(w :: Int,h :: Int,color: String)\n";
const factory =
  rectangle +
  'def rectangle(w :: Int,h :: Int,color: String = "black") Rect(w,h,color: color) :: Rectangle\n';

test("type defaults are rejected in named, generic, anonymous, nested, and refined patterns", () => {
  for (const source of [
    "def R type :R(x: Int = 1)\n0",
    "def R(t :: Type) type :R(x: t = missing)\n0",
    "t = type :R(x: Int = 1)\n0",
    "type :Outer(:Inner(x: Int = 1))",
    "type :Outer(inner: (type :Inner(x: Int = 1)))",
    "def R\n  (type :R(x: Int = 1)) .where (r -> True)\nend\n0",
    "def make() type :R(x: Int = 1)\nmake()",
    "type :R(x: Int = 1) | :None",
    "type :R(x: n :: Int = 1)",
    "type :R(x: _ :: Int = 1)",
  ]) {
    assert.throws(
      () => run(source),
      (error: unknown) =>
        fails instanceof LanguageError &&
        error.diagnostic.code === "E_TYPE_DEFAULT",
      source,
    );
  }
});

test("rejected type defaults are located and never evaluated", () => {
  assert.throws(
    () => run("# located declaration\ndef R type :R(color: Int = missing)\n0"),
    (error: unknown) => {
      assert.ok(error instanceof LanguageError);
      assert.equal(error.diagnostic.code, "E_TYPE_DEFAULT");
      assert.equal(error.diagnostic.phase, "declaration");
      assert.equal(error.diagnostic.primary?.line, 2);
      assert.match(error.message, /ordinary factory function/);
      return true;
    },
  );
});

test("ascriptions, bindings, and typed parameters require complete fields", () => {
  for (const tail of [
    "Rect(2,3) :: Rectangle",
    "(r :: Rectangle) = Rect(2,3)\nr",
    "def use(r :: Rectangle) r\nuse(Rect(2,3))",
    "f = (r :: Rectangle) -> r\nf(Rect(2,3))",
  ])
    assert.throws(() => run(rectangle + tail), /missing required/);
});

test("membership, matches, and parsing inspect existing complete fields", () => {
  assert.equal(
    run(
      factory +
        "(Rect(2,3) .matches (type Rectangle),rectangle(2,3) .matches (type Rectangle))",
    ),
    "(False, True)",
  );
  assert.equal(
    run(
      factory +
        "match Rect(2,3)\n  (r :: Rectangle) -> False\n  _ -> True\nend",
    ),
    "True",
  );
  assert.throws(
    () => run(factory + 'parse(Rectangle)("Rect(2,3)")'),
    /missing required/,
  );
  assert.equal(
    run(
      factory +
        "r = rectangle(2,3)\nparse(Rectangle)(toString(Rectangle)(r)) == r",
    ),
    "True",
  );
});

test("ambiguous overloads do not evaluate omitted defaults", () => {
  for (const defaults of [
    ["(1 / 0)", "2"],
    ["2", "(1 / 0)"],
  ])
    assert.throws(
      () =>
        run(
          `def f(x: Int = ${defaults[0]}) 1\ndef f(y: Int = ${defaults[1]}) 2\nf()`,
        ),
      /ambiguous call/,
    );
});

test("defaults remain lazy and execute once only after selection", () => {
  const interpreter = new Interpreter();
  let calls = 0;
  interpreter.env.functions.set("nextDefault", [
    {
      kind: "native",
      id: -1,
      name: "nextDefault",
      arities: [0],
      test: (args) => args.length === 0,
      invoke: () => [
        { label: "_1", value: { kind: "literal", value: ++calls } },
      ],
    },
  ]);
  assert.equal(
    displayResults(interpreter.run("def f(x: Int = nextDefault()) x\nf()")),
    "1",
  );
  assert.equal(calls, 1);
  assert.equal(displayResults(interpreter.run("f(x: 9)")), "9");
  assert.equal(calls, 1);
});

test("a failed type-default declaration leaves no binding or accessor behind", () => {
  const interpreter = new Interpreter();
  assert.throws(
    () => interpreter.run("def R type :R(x: Int = 1)\n0"),
    /defaults are only allowed/,
  );
  assert.equal(displayResults(interpreter.run("R()")), "R()");
  assert.throws(() => interpreter.run("R().x"), /unbound name/);
});

test("factory defaults and type descriptions remain separate ordinary values", () => {
  assert.equal(
    run(
      factory +
        "t = type Rectangle\n(toString(Type)(t),parse(Type)(toString(Type)(t)) == t)",
    ),
    '("Type(Rect(Int, Int, color: String))", True)',
  );
});
