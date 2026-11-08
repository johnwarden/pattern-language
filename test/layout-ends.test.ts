import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  LanguageError,
  parseSurface,
  Grammar,
  TEST_SCHEMA,
  loadTests,
  runTest,
} from "../src/index.ts";
import {
  layoutFormsFromBlock,
  mergeLayoutForms,
  parseTestSource,
} from "../src/parser.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const parse = (source: string) => new Interpreter().parse(source);
const isBlockEnd = (error: unknown) =>
  error instanceof LanguageError && error.diagnostic.code === "E_BLOCK_END";

test("an indented function cannot terminate at EOF", () => {
  assert.throws(() => parse("def f(x)\n  x"), isBlockEnd);
});

test("a nested block needs its own aligned end", () => {
  assert.throws(
    () =>
      parse(`main = x ->
  f = y ->
    y
  x
end
main`),
    isBlockEnd,
  );
  assert.throws(
    () =>
      parse(`main = x ->
  f = y ->
    y
    x
end
main`),
    isBlockEnd,
  );
});

test("if/else remains one form closed by a single aligned end", () => {
  assert.equal(
    run(`if 1 < 2
  x = 1
  x + 1
else
  3
end`),
    "2",
  );
});

test("a final end can close a string and its surrounding if", () => {
  assert.equal(
    run(`s = if True '
  Hello, World!
else '
  What is cooking?
end
s`),
    displayResults(new Interpreter().run('"Hello, World!"')),
  );
});

const testLayoutForms = mergeLayoutForms(
  new Grammar().layoutForms(),
  layoutFormsFromBlock(parseSurface(TEST_SCHEMA, "test schema")),
);
const probeHoldForms = mergeLayoutForms(
  new Grammar().layoutForms(),
  new Grammar(
    "def Probe type :probe (body :: Body) :then (result :: Expression)\ndef Hold type :hold (body :: Body)",
  ).layoutForms(),
);

test("an error clause from the test grammar completes without a preceding end", () => {
  parseTestSource(
    `test "error clause"
  expect
    missing()
  error "E_UNBOUND_NAME"
end`,
    "error-clause.test",
    { layoutForms: testLayoutForms },
  );
  const [closed] = loadTests({
    "error-clause.test": `test "error clause"
  expect
    missing()
  error "E_UNBOUND_NAME"
end`,
  });
  const report = runTest(closed);
  assert.equal(report.passed, true, report.message);
  const [flat] = loadTests({
    "flat-error.test": `test "flat error"
  expect missing() error "E_UNBOUND_NAME"
end`,
  });
  assert.equal(runTest(flat).passed, true);
});

test("an indented assert still needs an aligned end", () => {
  parseTestSource(
    `test "closed assert"
  assert
    True
  end
end`,
    "closed-assert.test",
    { layoutForms: testLayoutForms },
  );
  assert.throws(
    () =>
      parseTestSource(
        `test "open assert"
  assert
    True
end`,
        "open-assert.test",
        { layoutForms: testLayoutForms },
      ),
    isBlockEnd,
  );
});

test("user-defined probe/then completes without end; hold still needs end", () => {
  parseSurface(
    `probe
  1
then 2`,
    "program",
    { layoutForms: probeHoldForms },
  );
  parseSurface(
    `probe 1
then 2`,
    "program",
    { layoutForms: probeHoldForms },
  );
  parseSurface(
    `hold
  1
end`,
    "program",
    { layoutForms: probeHoldForms },
  );
  assert.throws(
    () =>
      parseSurface(
        `hold
  1`,
        "program",
        { layoutForms: probeHoldForms },
      ),
    isBlockEnd,
  );
  const i = new Interpreter();
  i.run(
    "macro (:probe (body :: Body) :then (result :: Expression)) Code$` $(result)",
    "repl",
  );
  i.run("macro (:hold (body :: Body)) Code$` $(body)", "repl");
  assert.equal(
    displayResults(
      i.run(
        `probe
  1
then 2`,
        "repl",
      ),
    ),
    displayResults(i.run("probe 1 then 2", "repl")),
  );
  assert.equal(
    displayResults(
      i.run(
        `hold
  1 + 1
end`,
        "repl",
      ),
    ),
    "2",
  );
  assert.throws(
    () =>
      i.parse(
        `hold
  1`,
        "repl",
      ),
    isBlockEnd,
  );
});

test("clause keywords come from the active grammar, not a hardcoded else list", () => {
  const otherwise = new Grammar(
    "def IfExpression type :if (condition :: Expression) (consequent :: Body) :otherwise (alternative :: Body)",
  ).layoutForms();
  parseSurface(
    `if True
  1
otherwise
  2
end`,
    "program",
    { layoutForms: otherwise },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
else
  2
end`,
        "program",
        { layoutForms: otherwise },
      ),
    isBlockEnd,
  );
  parseSurface(
    `if True
  1
else
  2
end`,
    "program",
    { layoutForms: new Grammar().layoutForms() },
  );
  assert.throws(
    () =>
      parseSurface(
        `if True
  1
otherwise
  2
end`,
        "program",
        { layoutForms: new Grammar().layoutForms() },
      ),
    isBlockEnd,
  );
});

test("an extra end after a complete inline clause is still accepted", () => {
  assert.equal(
    run(`if True
  1
else 2
end`),
    "1",
  );
  const [compat] = loadTests({
    "compat-extra-end.test": `test "compat extra end"
  expect
    missing()
  error "E_UNBOUND_NAME"
  end
end`,
  });
  assert.equal(runTest(compat).passed, true);
});

test("quoted if/else branches continue the same form without end before else", () => {
  assert.equal(
    run(`if 1 == 1 '
    Hello
else '
    there
end`),
    displayResults(new Interpreter().run('"Hello"')),
  );
  assert.equal(
    run(`if 1 == 0 '
    Hello
else '
    there
end`),
    displayResults(new Interpreter().run('"there"')),
  );
  parseTestSource(
    `test "quoted nested"
  expect
    if 1 == 1 '
      Hello
    else '
      there
    end
  result "Hello" :: Expression
end`,
    "quoted-nested.test",
    { layoutForms: testLayoutForms },
  );
  const otherwise = new Grammar(
    "def IfExpression type :if (condition :: Expression) (consequent :: Body) :otherwise (alternative :: Body)",
  ).layoutForms();
  parseSurface(
    `if 1 == 1 '
    Hello
otherwise '
    there
end`,
    "program",
    { layoutForms: otherwise },
  );
});
