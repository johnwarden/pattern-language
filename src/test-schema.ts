/**
 * One step grammar per assertion predicate and mode. A predicate is the word after
 * the subject (`is`, `fails`, `contains`); later predicates add a clause here and
 * a comparison in the runner.
 */
function expectationSchema(
  mode: string,
  name: string,
  modifier: string,
): string {
  const step = (type: string, rest: string, parts: string) =>
    `def ${name}${type} type ${modifier}${rest}
def stepParts(e :: ${name}${type})
  (${parts})
end`;
  return [
    step(
      "IsExpectation",
      ":expect subject :: Expression :is expected :: Expression",
      `"is", "${mode}", e.subject, e.expected`,
    ),
    step(
      "FailsExpectation",
      ":expect subject :: Expression :fails reason :: String",
      `"fails", "${mode}", e.subject, e.reason`,
    ),
    step(
      "ContainsExpectation",
      ":expect subject :: Expression :contains needle :: Expression",
      `"contains", "${mode}", e.subject, e.needle`,
    ),
    step(
      "Assertion",
      ":assert condition :: Expression",
      `"assert", "${mode}", e.condition`,
    ),
  ].join("\n");
}

/** Expected data is inert grammar data; a trailing :: annotation is read by the harness, never evaluated. */
export const TEST_SCHEMA = `def Test type :test name :: String body :: Expression
def TodoTest type :todo :test name :: String body :: Expression
def TestBlock unionType Test | TodoTest
def TestFileContent type
  first :: TestBlock
  rest :: TestBlock*
  ...
end
def tests(f :: TestFileContent) [f.first,f.rest...]
def testParts(t :: Test)
  ("check", t.name, t.body)
end
def testParts(t :: TodoTest)
  ("todo", t.name, t.body)
end
${expectationSchema("check", "", "")}
${expectationSchema("legacy", "Legacy", ":legacy ")}
${expectationSchema("todo", "Todo", ":todo ")}
def LegacySetup type :legacy statement :: Expression
def stepParts(e :: LegacySetup)
  ("setup", "legacy", e.statement)
end
def TodoSetup type :todo statement :: Expression
def stepParts(e :: TodoSetup)
  ("setup", "todo", e.statement)
end
TestFileContent
`;
export const TEST_STEP_TYPES = ["", "Legacy", "Todo"].flatMap((mode) =>
  ["IsExpectation", "FailsExpectation", "ContainsExpectation", "Assertion"].map(
    (type) => mode + type,
  ),
);
export const TEST_SETUP_TYPES = ["LegacySetup", "TodoSetup"];
