import test from "node:test";
import assert from "node:assert/strict";
import { loadTests, runTest } from "../src/test-suite.ts";

for (const prefix of ["\t", " \t", "\t  "]) {
  const nest = (source: string) =>
    source
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
  const read = (body: string) =>
    loadTests({
      "indentation.test": `test "Exact indent prefix"\n${nest(body)}\nend`,
    })[0];

  test(`source setup and assertion blocks remove the exact ${JSON.stringify(prefix)} prefix`, () => {
    const value = read(`def add(x :: Rational)
\tx + 1
end
initial = 3

expect
\tanswer = add(initial)
\tanswer
result 4 :: Rational`);
    assert.equal(value.steps[0].source, "def add(x :: Rational)\n\tx + 1\nend");
    assert.equal(value.steps[1].source, "initial = 3\n");
    assert.equal(value.steps[2].source, "answer = add(initial)\nanswer");
    const report = runTest(value);
    assert.equal(report.passed, true, report.message);
  });

  test(`source extraction preserves string payload indentation under ${JSON.stringify(prefix)}`, () => {
    const value = read(`text = '
\tfirst
\t  second
\t  
end
expect text == "first\\n  second\\n  " result True :: Bool`);
    assert.equal(
      value.steps[0].source,
      "text = '\n\tfirst\n\t  second\n\t  \nend",
    );
    const report = runTest(value);
    assert.equal(report.passed, true, report.message);
  });

  test(`todo/legacy setup replay uses the exact ${JSON.stringify(prefix)} prefix`, () => {
    const value = read(`legacy initial = 3
todo initial = missing
expect initial result 3 :: Rational`);
    const report = runTest(value);
    assert.equal(report.passed, true, report.message);
    assert.deepEqual(
      report.checks.map((check) => check.status),
      ["expected-failure", "passed"],
    );
  });
}

test("tab-indented setup from the inbox reaches its assertion", () => {
  const [value] = loadTests({
    "inbox.test":
      'test "Inbox setup"\n\tdef isSquare(r :: Rectangle) r.width == r.height\n\tdef Rectangle type Rect(width :: Int, height :: Int)\n\tassert isSquare(Rect(2, 2))\nend',
  });
  const report = runTest(value);
  assert.equal(report.passed, true, report.message);
});

test("incompatible code indentation remains a syntax error", () => {
  assert.throws(
    () =>
      loadTests({
        "invalid.test":
          'test "Invalid prefix"\n\tvalue = 3\n  assert value == 3\nend',
      }),
    /inconsistent indentation/,
  );
});
