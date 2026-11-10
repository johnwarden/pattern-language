import test from "node:test";
import assert from "node:assert/strict";
import { loadTests, runTest, type AssertionMode } from "../src/test-suite.ts";
import { Interpreter } from "../src/runtime.ts";
import { TEST_SCHEMA } from "../src/test-schema.ts";
import {
  displayResults,
  singleton,
  valLiteral,
  single,
  unwrap,
  equal,
} from "../src/values.ts";
import { LanguageError } from "../src/diagnostics.ts";

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
const run = (source: string) => runTest(loadTests({ "case.test": source })[0]);

test("discovery reads the source schema without executing subjects or expected types", () => {
  const value = sample("$missing\nmissing(1 / 0)", "result 3 :: MissingType");
  assert.equal(value.source, "$missing\nmissing(1 / 0)");
  const report = runTest(value);
  assert.equal(report.status, "failed");
  assert.equal(report.phase, "expectation");
  assert.match(report.message, /MissingType/);
});
test("a companion todo does not remove a supported playground program", () => {
  const value = loadTests({
    "paired.test": `test "Literal migration"
  legacy expect Bool result Bool :: ReservedSymbol
  todo expect Bool result Bool :: PrimitiveType
end`,
  })[0];
  assert.equal(value.program, true);
  assert.equal(value.source, "Bool");
  const report = runTest(value);
  assert.equal(report.passed, true, report.message);
  assert.deepEqual(
    report.checks.map((c) => c.status),
    ["passed", "expected-failure"],
  );
});
test("playground output includes setup and its final pack, excluding future checks", () => {
  const value = loadTests({
    "paired.test": `test "Captured migration"
  (x, y) = ("a", "b")
  expect x result "a" :: String
  expect y result "b" :: String
  (x, y)
end`,
  })[0];
  assert.equal(value.program, true);
  assert.equal(value.source, '(x, y) = ("a", "b")\n(x, y)');
  const report = runTest(value);
  assert.equal(report.passed, true, report.message);
  const interpreter = new Interpreter();
  assert.equal(
    interpreter.inspect(interpreter.run(value.source)),
    interpreter.inspect(report.results!),
  );
});
test("todo-only cases do not become executable examples", () => {
  const value = loadTests({
    "future.test": `test "Future only"
  todo expect Bool result Bool :: PrimitiveType
  ()
end`,
  })[0];
  assert.equal(value.program, false);
});
test("expected values are data rather than expressions to evaluate", () => {
  assert.equal(
    runTest(sample("x = 3\nx + 1", "result 4 :: Rational")).passed,
    true,
  );
  assert.equal(
    runTest(sample('"Hello, $name"', 'result "Hello, $name" :: String')).passed,
    true,
  );
  const wrong = runTest(
    sample("6 :: Int", "result\n    (3 + 3) :: Int\n  end"),
  );
  assert.equal(wrong.passed, false);
  assert.equal(wrong.phase, "expectation");
});
test("each result requires the stated type and canonical data spelling", () => {
  assert.equal(
    runTest(sample(":Widget", "result Widget :: UpperCamelSymbol")).passed,
    true,
  );
  const wrongType = runTest(sample(":Widget", "result Widget :: Expression"));
  assert.equal(wrongType.passed, false);
  assert.match(
    wrongType.message,
    /type mismatch.*Expression.*UpperCamelSymbol/,
  );
  for (const type of ["Expression", "UpperCamelSymbol"]) {
    const quoted = runTest(sample(":Widget", `result :Widget :: ${type}`));
    assert.equal(quoted.passed, false);
    assert.match(
      quoted.message,
      type === "UpperCamelSymbol"
        ? /E_TEST_VALUE_SYNTAX.*write Widget instead of :Widget/
        : /type mismatch/,
    );
  }
  assert.equal(runTest(sample("3", "result 3 :: Int")).passed, false);
  assert.equal(runTest(sample("3 :: Int", "result 3 :: Int")).passed, true);
});
test("one result is required; multiple and labeled returns must be destructured", () => {
  for (const [body, clause] of [
    ["()", "result 1 :: Rational"],
    ["(1, 2)", "result 1 :: Rational"],
    ["(color: :Red)", "result Red :: UpperCamelSymbol"],
  ])
    assert.match(
      runTest(sample(body, clause)).message,
      /exactly one positional value/,
    );
  const result = run(`test "Separate fields"
    (n, color: c) = (1, color: :Red)
    expect n result 1 :: Rational
    expect c result Red :: UpperCamelSymbol
end`);
  assert.equal(result.passed, true, result.message);
});
test("ordinary destructuring retains empty and exact positional arity checks", () => {
  assert.equal(
    run(`test "Empty"
    assert
      () = (() -> ())()
      True
    end
end`).passed,
    true,
  );
  for (const body of [
    "(x, y) = (1)",
    "(x) = (1, 2)",
    "() = (1)",
    "(x, color: c) = (1)",
  ]) {
    const result = run(
      `test "Bad pack"\n assert\n  ${body}\n  True\n end\nend`,
    );
    assert.equal(result.passed, false, body);
  }
});
test("removed expectation clauses are rejected", () => {
  for (const old of [
    "expect 1 value 1 type Expression",
    "expect (1, 2) results {1 :: Expression, 2 :: Expression}",
  ])
    assert.throws(() =>
      loadTests({ "removed.test": `test "Old"\n ${old}\nend` }),
    );
});
test("grouping preserves symbolic binary expected data and does not evaluate it", () => {
  assert.equal(
    run(
      `test "Tree"\n e = :(1 + 1)\n legacy expect e result\n  (1 + 1) :: Expression\n end\nend`,
    ).passed,
    true,
  );
  const ungrouped = run(
    `test "Wrong grouping"\n e = :(1 + 1)\n legacy expect e result 1 + 1 :: Expression\nend`,
  );
  assert.equal(ungrouped.passed, false);
  assert.equal(ungrouped.phase, "expectation");
  assert.match(ungrouped.message, /E_TEST_VALUE_SYNTAX/);
});
test("expected errors apply only to the subject", () => {
  assert.equal(
    runTest(sample("missing()", 'error "E_UNBOUND_NAME"')).passed,
    true,
  );
  assert.equal(runTest(sample("1", 'error "E_UNBOUND_NAME"')).passed, false);
  assert.equal(
    runTest(sample("1 / 0", 'error "E_UNBOUND_NAME"')).passed,
    false,
  );
  const fixture = runTest(
    sample("missing()", 'error "E_UNBOUND_NAME"'),
    "missing()",
  );
  assert.equal(fixture.passed, false);
  assert.equal(fixture.phase, "fixture");
});
test("fixture types are visible but subject-local declarations do not escape", () => {
  const value = sample(
    "Rect(2,3) :: Rectangle",
    "result Rect(2,3) :: Rectangle",
  );
  assert.equal(runTest(value).passed, false);
  assert.equal(runTest(value, "def Rectangle type Rect(Int,Int)").passed, true);
  const isolated = sample(
    "def Local type Box(Int)\nBox(3) :: Local",
    "result Box(3) :: Local",
  );
  assert.equal(runTest(isolated).phase, "expectation");
});
test("source extraction retains comments, blank lines and nested end markers", () => {
  const body = "# comment\ndef f(x)\n  x + 1\nend\n\nf(2)";
  const value = sample(body, "result 3 :: Rational");
  assert.equal(value.source, body);
  const withSetup = loadTests({
    "comments.test":
      'test "Setup comments"\n  # kept in the editor\n  def f(x) x + 1\n  expect f(2) result 3 :: Rational\nend',
  })[0];
  assert.equal(withSetup.source, "# kept in the editor\ndef f(x) x + 1\nf(2)");
  assert.equal(runTest(value).passed, true);
});
test("repeated execution has fresh fixture and assertion scopes", () => {
  const value = sample("x = x + 1\nx", "result 2 :: Rational");
  assert.equal(runTest(value, "x = 1").passed, true);
  assert.equal(runTest(value, "x = 1").passed, true);
  assert.equal(runTest(sample("x", "result 1 :: Rational")).passed, false);
});
test("sidefix fields preserve deferred expected names inside typed quotes", () => {
  const i = new Interpreter();
  assert.equal(
    displayResults(
      i.run(
        "def Output type\n  (value :: Expression) ::: (expectedType :: Expression)\nend\ndef Expected type :expect subject :: Expression :result output :: Output\nt = Expected` expect missing() result 4 :: MissingType\n(t.output.value,t.output.expectedType)",
      ),
    ),
    "(4, MissingType)",
  );
});
test("host calls preserve successive packs without exposing methods as values", () => {
  const i = new Interpreter();
  i.run("def f(x,y)(z)\n  (x,y,z)\nend\n0");
  assert.throws(() => i.call("f"), /require an argument pack/);
  assert.equal(
    displayResults(
      i.call(
        "f",
        [
          { label: "_1", value: valLiteral(1) },
          { label: "_2", value: valLiteral(2) },
        ],
        singleton(valLiteral(3)),
      ),
    ),
    "(1, 2, 3)",
  );
});
test("invalid test data reports its source file and position", () => {
  assert.throws(
    () => loadTests({ broken: 'test "Bad"\n expect Missing\nend' }),
    (error: unknown) =>
      error instanceof LanguageError &&
      error.diagnostic.primary?.source?.name === "broken.test",
  );
});
test("test-file values retain unresolved operands through data round trips", () => {
  const value = sample("missing()", "result 3 :: MissingType", "todo");
  const i = new Interpreter(),
    type = unwrap(single(i.run(TEST_SCHEMA)));
  if (type.kind !== "type") assert.fail();
  const text = unwrap(
    single(i.call("toString", singleton(type), singleton(value.fileValue))),
  );
  if (text.kind !== "literal" || typeof text.value !== "string") assert.fail();
  assert.ok(equal(i.readValue(type, text.value), value.fileValue));
});
test("files require nonempty test blocks and stable IDs", () => {
  const a = 'test "First case"\n expect 1 result 1 :: Expression\nend';
  const b = 'test "Second case"\n todo assert False\nend';
  const before = loadTests({ "group/a.test": a + "\n" + b }),
    after = loadTests({ "group/a.test": b + "\n" + a });
  assert.deepEqual(
    before.map((t) => t.id).sort(),
    after.map((t) => t.id).sort(),
  );
  assert.equal(before[0].id, "group/a#first-case");
  for (const source of [
    "",
    "x = 1",
    a + "\n" + a,
    'legacy test "Not a test modifier"\n expect 1 result 1 :: Expression\nend',
    'test "Bad nesting"\n todo test "Nested"\n  1\n end\nend',
    'test "Malformed"\n (\nend',
  ])
    assert.throws(() => loadTests({ "bad.test": source }));
});
test("todo assertions actually execute; their language failures produce no diagnostics", () => {
  const t = loadTests({
    "todo.test": 'test "Runs"\n todo assert False\nend',
  })[0];
  const original = Interpreter.prototype.evaluateCode;
  let calls = 0;
  Interpreter.prototype.evaluateCode = function (
    ...args: Parameters<Interpreter["evaluateCode"]>
  ) {
    calls++;
    return original.apply(this, args);
  };
  try {
    const r = runTest(t);
    assert.equal(calls, 1);
    assert.equal(r.passed, true);
    assert.equal(r.checks[0].status, "expected-failure");
    assert.equal(r.checks[0].message, "");
  } finally {
    Interpreter.prototype.evaluateCode = original;
  }
});
test("a fulfilled todo fails and asks for removal, including expected-error assertions", () => {
  for (const source of [
    'test "Bool"\n todo assert True\nend',
    'test "Value"\n todo expect :Widget result Widget :: UpperCamelSymbol\nend',
    'test "Error"\n todo expect missing() error "E_UNBOUND_NAME"\nend',
    'test "Parse"\n todo expect parse(Code)("a+b") error "infix operators require spaces"\nend',
  ]) {
    const r = run(source);
    assert.equal(r.passed, false);
    assert.ok(
      r.message.startsWith("This assertion now passes; remove todo."),
      r.message,
    );
  }
});
test("legacy assertions must pass and never suppress failures", () => {
  assert.equal(
    run(
      'test "Legacy"\n legacy expect 1 result 1 :: Rational\n legacy assert True\nend',
    ).passed,
    true,
  );
  const r = run('test "Legacy"\n legacy assert False\nend');
  assert.equal(r.passed, false);
  assert.equal(r.checks[0].mode, "legacy");
});
test("parse failures of quoted source use ordinary expect parse(Code) error", () => {
  const r = run(`test "infix"
  expect parse(Code)("x + ") error "Missing second argument to infix operation"
end`);
  assert.equal(r.passed, true, r.message);
  assert.equal(r.checks[0].kind, "error");
  const ok = run(`test "valid"
  expect parse(Code)("1 + 1") error "Missing second argument to infix operation"
end`);
  assert.equal(ok.passed, false);
  assert.match(ok.message, /the subject succeeded/);
  assert.equal(ok.checks[0].kind, "error");
});

test("todo operands resolve and execute without leaking bindings or definitions", () => {
  const r = run(
    'test "Isolated"\n  x = 3\n  todo assert\n    x = 9\n    False\n  end\n  todo expect\n    def local() 99\n    macro :future e :: Expression Code$` $(e)\n    missing()\n  result 0 :: Expression\n  expect local() error "E_UNBOUND_NAME"\n  expect x result 3 :: Rational\nend',
  );
  assert.equal(r.passed, true, r.message);
  assert.equal(
    r.checks.filter((c) => c.status === "expected-failure").length,
    2,
  );
});
test("todo does not suppress fixture, shared setup, malformed source, or host failures", () => {
  const t = sample("missing()", "result 1 :: Expression", "todo");
  const fixture = runTest(t, "missing()");
  assert.equal(fixture.passed, false);
  assert.equal(fixture.phase, "fixture");
  const setup = run('test "Bad setup"\n missing()\n todo assert False\nend');
  assert.equal(setup.passed, false);
  assert.equal(setup.phase, "setup");
  assert.throws(() =>
    loadTests({ "bad.test": 'test "Bad"\n todo assert (\nend' }),
  );
  const original = Interpreter.prototype.evaluateCode;
  Interpreter.prototype.evaluateCode = () => {
    throw new Error("host trap");
  };
  try {
    const r = runTest(
      loadTests({ "trap.test": 'test "Trap"\n todo assert False\nend' })[0],
    );
    assert.equal(r.passed, false);
    assert.match(r.message, /host trap/);
  } finally {
    Interpreter.prototype.evaluateCode = original;
  }
});
test("every assertion runs after failures; expected failures are not passes", () => {
  const r = run(
    'test "Continue"\n assert False\n todo assert False\n legacy assert True\nend',
  );
  assert.equal(r.passed, false);
  assert.deepEqual(
    r.checks.map((c) => c.status),
    ["failed", "expected-failure", "passed"],
  );
});
test("setup is shared only within its case, while individual subjects remain isolated", () => {
  const cases = loadTests({
    "scope.test":
      'test "Setup"\n  def Box type Box(Int)\n  x = 3 :: Int\n  expect Box(x) :: Box result Box(3) :: Box\n  expect\n    x = 9 :: Int\n    x\n  result 9 :: Int\n  expect x result 3 :: Int\nend\ntest "Fresh"\n  expect x error "E_UNBOUND_NAME"\nend',
  });
  for (const t of cases) {
    const r = runTest(t);
    assert.equal(r.passed, true, r.message);
  }
});
test("0f source denotes a Float64-rounded Rational", () => {
  const r = runTest(sample("0f0.1", "result 0x1.999999999999Ap-4 :: Rational"));
  assert.equal(r.passed, true, r.message);
});
test("assertions require a positional Bool result and preserve ordinary operator lexing", () => {
  assert.equal(
    run('test "Labels"\n x = (ok: True)\n assert x\nend').passed,
    false,
  );
  assert.equal(run('test "Truthiness"\n assert 1\nend').passed, false);
  assert.equal(
    run(
      'test "Operators"\n expect 3 >= 2 result True :: Bool\n expect 2 <= 2 result True :: Bool\nend',
    ).passed,
    true,
  );
});

test("assert checks the Bool value space rather than a same-spelled constructor", () => {
  const r = run(
    'test "Not Bool"\n def Flag type :Yes | :No\n flag = :Yes :: Flag\n assert flag\nend',
  );
  assert.equal(r.passed, false);
  assert.match(r.message, /requires Bool/);
});
test("each expectation has its own actual and expected output", () => {
  const r = run(
    'test "Outputs"\n expect 1 result 1 :: Rational\n expect :Widget result Widget :: UpperCamelSymbol\nend',
  );
  assert.equal(r.passed, true, r.message);
  assert.deepEqual(
    r.checks.map((c) => c.actual),
    ["1 :: Rational", "Widget :: UpperCamelSymbol"],
  );
  assert.deepEqual(
    r.checks.map((c) => c.expected),
    ["1 :: Rational", "Widget :: UpperCamelSymbol"],
  );
});
