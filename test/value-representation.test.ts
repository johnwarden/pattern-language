import test from "node:test";
import assert from "node:assert/strict";
import { Interpreter, displayResults } from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));

test("compiled types compare as their ordinary value trees, including nested values", () => {
  assert.equal(
    run(
      "a = Type(Rect(Int))\nb = :(Type(Rect(Int)))\n(a == b,[a] == [b],Type(10) < Type(2))",
    ),
    "(True, True, False)",
  );
  assert.equal(
    run("UnionType(Int,String) == :(UnionType(Int,String))"),
    "True",
  );
  assert.equal(run("Type(Int) == Int"), "False");
});
