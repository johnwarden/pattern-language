import { Interpreter } from "./runtime.ts";
import {
  layoutFormsFromBlock,
  mergeLayoutForms,
  parseSurface,
  parseTestSource,
} from "./parser.ts";
import { DEFAULT_GRAMMAR, Grammar } from "./grammar.ts";
import { normal, LanguageError } from "./syntax.ts";
import type { Field, Syntax, Span } from "./syntax.ts";
import { dataSyntax, codeSource } from "./syntax-values.ts";
import {
  single,
  singleton,
  unwrap,
  equal,
  observedType,
  parseNumericSpelling,
  formatRational,
} from "./values.ts";
import type { Value, TypeValue } from "./values.ts";
import type { Pattern } from "./pattern.ts";
import { renderDiagnostic } from "./diagnostics.ts";
import {
  TEST_SCHEMA,
  TEST_STEP_TYPES,
  TEST_SETUP_TYPES,
} from "./test-schema.ts";

export type AssertionMode = "check" | "legacy" | "todo";
export interface TestStep {
  kind: "setup" | "output" | "result" | "error" | "parse-error" | "assert";
  mode: AssertionMode;
  subject: Syntax;
  expected?: Syntax;
  expectedType?: Syntax;
  reason?: string;
  source: string;
}
export interface TestCase {
  id: string;
  file: string;
  name: string;
  value: Value;
  fileValue: Value;
  body: Syntax;
  steps: TestStep[];
  /** Executable editor source for supported checks/output, excluding todo operands. */
  source: string;
  program: boolean;
}
export type TestStatus = "passed" | "failed";
export interface CheckReport {
  kind: TestStep["kind"];
  status: TestStatus | "expected-failure";
  mode: AssertionMode;
  message: string;
  actual?: string;
  expected?: string;
  span?: Span;
}
export interface TestReport {
  id: string;
  name: string;
  status: TestStatus;
  passed: boolean;
  phase: "fixture" | "setup" | "expectation" | "body" | "comparison";
  message: string;
  checks: CheckReport[];
  results?: Field<Value>[];
  expectedError?: string;
  interpreter?: Interpreter;
}
const problem = (message: string, tree?: Syntax, code = "E_TEST_EXPECTATION") =>
  new LanguageError(message, tree?.span, { code, phase: "parse" });
const codeLayoutForms = new Grammar(DEFAULT_GRAMMAR).layoutForms();
const testLayoutForms = mergeLayoutForms(
  codeLayoutForms,
  layoutFormsFromBlock(parseSurface(TEST_SCHEMA, "test schema")),
);
const asType = (value: Value): TypeValue => {
  const raw = unwrap(value);
  if (raw.kind !== "type")
    throw problem("an expected type expression must produce a Type value");
  return raw;
};
function one(n: Syntax): Syntax {
  while (
    (n.kind === "block" && n.lines.length === 1) ||
    (n.kind === "sequence" && n.items.length === 1)
  )
    n =
      n.kind === "block"
        ? n.lines[0]
        : (n as Extract<Syntax, { kind: "sequence" }>).items[0];
  return n;
}
/** Original source stays authoritative for later execution and editor drafts. */
export function testSourceText(tree: Syntax): string {
  if (tree.kind === "sequence" && tree.items.length === 1)
    return testSourceText(tree.items[0]);
  const span = tree.span;
  if (
    tree.kind === "block" &&
    span?.source &&
    span.start !== undefined &&
    span.end !== undefined
  ) {
    const text = span.source.text.slice(span.start, span.end);
    if (text.startsWith("(")) return text;
    const newline = text.indexOf("\n");
    const indentation = tree.lines[0]?.span?.column;
    if (newline >= 0)
      return dedent(
        text.slice(newline + 1).replace(/\n$/, ""),
        indentation === undefined ? undefined : indentation - 1,
      );
  }
  if (
    span?.source &&
    span.start !== undefined &&
    span.end !== undefined &&
    tree.kind !== "sequence"
  )
    return span.source.text.slice(span.start, span.end);
  return codeSource(tree);
}
function dedent(text: string, indentation?: number): string {
  const lines = text.split("\n"),
    nonempty = lines.filter((line) => line.trim());
  const indent =
    indentation ??
    (nonempty.length
      ? Math.min(...nonempty.map((line) => line.match(/^ */)![0].length))
      : 0);
  return lines
    .map((line) => line.slice(Math.min(indent, line.match(/^ */)![0].length)))
    .join("\n");
}
function scalarString(value: Value): string {
  const v = unwrap(value);
  if (v.kind !== "literal" || typeof v.value !== "string")
    throw new Error("Test schema string projection failed");
  return v.value;
}
function stem(file: string): string {
  return file.replace(/\.test$/, "");
}
function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || "case"
  );
}

interface Rule {
  type: TypeValue;
  arity: number;
  keyword: string;
  setup: boolean;
}
class TestReader {
  schema = new Interpreter();
  fileType = asType(single(this.schema.run(TEST_SCHEMA)));
  rules: Rule[];
  starts = new Set<string>();
  constructor() {
    const shape = (pattern: Pattern<Value>): Pattern<Value> => {
      const seen = new Set<unknown>();
      while (pattern.kind === "ref" || pattern.kind === "map") {
        if (pattern.kind === "ref") {
          if (seen.has(pattern.key))
            throw new Error("recursive test step shape");
          seen.add(pattern.key);
          pattern = pattern.resolve();
        } else pattern = pattern.pattern;
      }
      return pattern;
    };
    this.rules = [...TEST_STEP_TYPES, ...TEST_SETUP_TYPES].map((name) => {
      const type = asType(single(this.schema.run(name))),
        pattern = shape(type.pattern());
      if (
        pattern.kind !== "node" ||
        pattern.body.kind !== "fields" ||
        !pattern.body.parts.every((p) => p.kind === "label")
      )
        throw new Error(
          "Test step grammar must use a fixed sidefix sequence: " + name,
        );
      const head = pattern.body.parts[0];
      const keyword = head.kind === "label" ? shape(head.pattern) : undefined;
      const identity = keyword?.kind === "test" ? keyword.identity : undefined;
      if (!Array.isArray(identity) || identity[0] !== "literal")
        throw new Error("Test step needs a literal starting keyword");
      const literal = unwrap(identity[1] as Value);
      if (literal.kind !== "symbol")
        throw new Error("Test step needs a symbol keyword");
      this.starts.add(literal.name);
      return {
        type,
        arity: pattern.body.parts.length,
        keyword: literal.name,
        setup: TEST_SETUP_TYPES.includes(name),
      };
    });
  }
  steps(body: Syntax): TestStep[] {
    if (body.kind !== "block")
      throw problem("a test requires an indented body", body, "E_TEST_SYNTAX");
    const tokens: Syntax[] = [],
      boundaries = new Map<number, number>();
    body.lines.forEach((line, index) => {
      boundaries.set(tokens.length, index);
      tokens.push(...(line.kind === "sequence" ? line.items : [line]));
    });
    boundaries.set(tokens.length, body.lines.length);
    const result: TestStep[] = [];
    for (let pos = 0; pos < tokens.length;) {
      const matches: { end: number; value: Value }[] = [];
      for (const rule of this.rules) {
        if (rule.setup) continue;
        const end = pos + rule.arity;
        if (!boundaries.has(end)) continue;
        const tree: Syntax = {
          kind: "sequence",
          items: tokens.slice(pos, end),
          span: tokens[pos].span,
        };
        try {
          matches.push({
            end,
            value: this.schema.interpretSyntax(rule.type, tree),
          });
        } catch (error) {
          if (
            !(error instanceof LanguageError) ||
            ![
              "E_PATTERN_MISMATCH",
              "E_MISSING_FIELD",
              "E_EXTRA_FIELD",
            ].includes(error.diagnostic.code)
          )
            throw error;
        }
      }
      if (matches.length > 1)
        throw problem("ambiguous test step", tokens[pos], "E_TEST_SYNTAX");
      if (matches.length) {
        const match = matches[0];
        const [kind, mode, ...parts] = this.schema.call(
          "stepParts",
          singleton(match.value),
        );
        const role = scalarString(kind.value) as TestStep["kind"];
        const subject = dataSyntax(parts[0].value);
        result.push({
          kind: role,
          mode: scalarString(mode.value) as AssertionMode,
          subject,
          source:
            role === "parse-error"
              ? scalarString(parts[0].value)
              : testSourceText(subject),
          expected: role === "result" ? dataSyntax(parts[1].value) : undefined,
          expectedType:
            role === "result" ? dataSyntax(parts[2].value) : undefined,
          reason:
            role === "error" || role === "parse-error"
              ? scalarString(parts[1].value)
              : undefined,
        });
        pos = match.end;
      } else {
        const n = tokens[pos];
        const setupRule =
          n.kind === "symbol" && !n.quoted
            ? this.rules.find((rule) => rule.setup && rule.keyword === n.name)
            : undefined;
        const operand = tokens[pos + 1];
        const wrapsSetup =
          setupRule &&
          operand &&
          !(
            operand.kind === "symbol" &&
            !operand.quoted &&
            (this.starts.has(operand.name) ||
              ["test", "value", "result", "results", "error"].includes(
                operand.name,
              ))
          );
        if (
          !wrapsSetup &&
          n.kind === "symbol" &&
          !n.quoted &&
          (this.starts.has(n.name) ||
            ["test", "value", "type", "results", "result"].includes(n.name))
        )
          throw problem(
            "incomplete assert/expect/todo/legacy form; group compound operands or use indented blocks",
            n,
            "E_TEST_SYNTAX",
          );
        const row = boundaries.get(pos)!;
        const next = [...boundaries.keys()].find((i) => i > pos)!;
        const start = n.span;
        const stop = body.lines[row + 1]?.span?.start ?? body.span?.end;
        let source: string;
        if (start?.source && start.start !== undefined && stop !== undefined) {
          let from = start.start - start.column + 1;
          if (row === 0 && body.span?.start !== undefined) {
            const leading = start.source.text.slice(body.span.start, from);
            const newline = leading.indexOf("\n");
            if (newline >= 0) from = body.span.start + newline + 1;
          }
          const following = body.lines[row + 1]?.span;
          const to =
            following?.start !== undefined
              ? following.start - following.column + 1
              : stop;
          source = dedent(start.source.text.slice(from, to).replace(/\n$/, ""));
        } else source = normal(body.lines[row]);
        if (wrapsSetup) {
          const rest = tokens.slice(pos + 1, next);
          const statement: Syntax =
            rest.length === 1
              ? rest[0]
              : { kind: "sequence", items: rest, span: rest[0].span };
          const wrapped = this.schema.interpretSyntax(setupRule.type, {
            kind: "sequence",
            items: [n, statement],
            span: n.span,
          });
          const [kind, mode, value] = this.schema.call(
            "stepParts",
            singleton(wrapped),
          );
          result.push({
            kind: scalarString(kind.value) as "setup",
            mode: scalarString(mode.value) as AssertionMode,
            subject: dataSyntax(value.value),
            source:
              statement.kind === "block"
                ? testSourceText(statement)
                : source.replace(
                    new RegExp("^" + setupRule.keyword + "[ \\t]+", "m"),
                    "",
                  ),
          });
        } else
          result.push({
            kind: "setup",
            mode: "check",
            subject: body.lines[row],
            source,
          });
        pos = next;
      }
    }
    // A final ordinary argument pack exposes already-computed example output.
    // It is not another assertion and introduces no new pack representation.
    const tail = result.at(-1);
    if (
      tail?.kind === "setup" &&
      tail.mode === "check" &&
      one(tail.subject).kind === "pack" &&
      result.some(isAssertion)
    )
      tail.kind = "output";
    return result;
  }
  file(file: string, source: string): TestCase[] {
    const tree = parseTestSource(source, file, {
      layoutForms: testLayoutForms,
    });
    if (tree.kind !== "block" || !tree.lines.length)
      throw problem(
        "a .test file requires one or more test blocks",
        tree,
        "E_TEST_FILE",
      );
    let value: Value;
    try {
      value = this.schema.interpretSyntax(this.fileType, tree);
    } catch (error) {
      if (error instanceof LanguageError)
        error.diagnostic.notes.push(
          "A .test file contains one or more test blocks; todo and legacy modify assertions, not tests.",
        );
      throw error;
    }
    const collection = unwrap(
      single(this.schema.call("tests", singleton(value))),
    );
    if (collection.kind !== "term")
      throw new Error("TestFileContent projection failed");
    const ids = new Set<string>();
    return collection.body.map((entry) => {
      const [name, content] = this.schema.call(
        "testParts",
        singleton(entry.value),
      );
      const title = scalarString(name.value),
        body = dataSyntax(content.value);
      if (body.kind !== "block")
        throw problem(
          "a test requires an indented body",
          body,
          "E_TEST_SYNTAX",
        );
      const id = stem(file) + "#" + slug(title);
      if (ids.has(id))
        throw problem(
          "duplicate case ID in " + file + ": " + title,
          body,
          "E_TEST_ID",
        );
      ids.add(id);
      const steps = this.steps(body);
      // A future assertion accompanies an executable example; it is not part of
      // that example's program. Todo-only cases still have no runnable example.
      const supported = steps.filter((step) => step.mode !== "todo");
      const assertions = supported.filter(isAssertion);
      const exampleAssertions = assertions.filter(
        (step) => step.kind !== "parse-error",
      );
      const output = supported.at(-1)?.kind === "output";
      const singleProgram =
        exampleAssertions.length === 1 &&
        exampleAssertions[0] === supported.at(-1);
      const program =
        !supported.some((step) => step.kind === "parse-error") &&
        (singleProgram || (output && exampleAssertions.length > 0));
      const source = program
        ? supported
            .filter((step) =>
              output ? step.kind === "setup" || step.kind === "output" : true,
            )
            .map((step) => step.source)
            .join("\n")
        : testSourceText(body);
      return {
        id,
        file,
        name: title,
        value: entry.value,
        fileValue: value,
        body,
        steps,
        source,
        program,
      };
    });
  }
}
/** The published file grammar and common matcher recognize every file, without execution. */
export function loadTests(files: Record<string, string>): TestCase[] {
  const reader = new TestReader();
  return Object.entries(files)
    .sort(([a], [b]) => a.localeCompare(b, "en"))
    .flatMap(([name, source]) =>
      reader.file(name.endsWith(".test") ? name : name + ".test", source),
    );
}

function execute(interpreter: Interpreter, tree: Syntax): Field<Value>[] {
  // The source-only reader must not make unsupported syntax executable.
  parseSurface(
    testSourceText(tree),
    tree.span?.source?.name ?? "test subject",
    { layoutForms: codeLayoutForms },
  );
  const codeType = asType(single(interpreter.run("Code")));
  const block =
    tree.kind === "block"
      ? tree
      : { kind: "block" as const, lines: [tree], span: tree.span };
  return interpreter.evaluateCode(interpreter.interpretSyntax(codeType, block));
}
function typeOf(tree: Syntax, interpreter: Interpreter): TypeValue {
  return asType(single(execute(interpreter, tree)));
}
export function isAssertion(step: TestStep): boolean {
  return (
    step.kind !== "output" && (step.kind !== "setup" || step.mode === "todo")
  );
}
interface ExpectedResult {
  value: Syntax;
  type: TypeValue;
}
function expectedData(
  tree: Syntax,
  type: TypeValue,
  interpreter: Interpreter,
): Value {
  const sourceText = testSourceText(tree).trim();
  const text = parseNumericSpelling(sourceText)
    ? sourceText
    : normal(one(tree));
  const value = interpreter.readValue(type, text, true);
  const canonical = scalarString(
    single(interpreter.call("toString", singleton(type), singleton(value))),
  );
  const numeric = parseNumericSpelling(canonical);
  const printed = numeric
    ? formatRational(numeric)
    : normal(
        one(
          parseSurface(canonical, "program", {
            layoutForms: codeLayoutForms,
          }),
        ),
      );
  if (text !== printed)
    throw problem(
      "expected values use data syntax; write " +
        printed +
        " instead of " +
        text,
      tree,
      "E_TEST_VALUE_SYNTAX",
    );
  return value;
}
function expectedResult(
  step: TestStep,
  interpreter: Interpreter,
): ExpectedResult {
  parseSurface(
    testSourceText(step.expected!),
    step.expected!.span?.source?.name ?? "expected result",
    { layoutForms: codeLayoutForms },
  );
  return {
    value: step.expected!,
    type: typeOf(step.expectedType!, interpreter),
  };
}
function resultType(value: Value, interpreter: Interpreter): TypeValue {
  const observed = observedType(value);
  return typeof observed === "string"
    ? asType(single(interpreter.run(observed)))
    : observed;
}
function matchesExpectedError(error: LanguageError, reason: string): boolean {
  return reason.startsWith("E_")
    ? error.diagnostic.code === reason
    : error.message.includes(reason);
}

function compareResult(
  actual: Field<Value>[],
  expected: ExpectedResult,
  interpreter: Interpreter,
): string | undefined {
  if (actual.length !== 1 || actual[0].label !== "_1")
    return "result requires exactly one positional value; destructure multiple returns before checking them";
  const type = resultType(actual[0].value, interpreter);
  if (!equal(type, expected.type))
    return (
      "result type mismatch: expected " +
      expected.type.name +
      "; received " +
      type.name
    );
}

/** Execute every assertion. Todo expects failure; legacy retains current behavior. */
export function runTest(test: TestCase, fixture = ""): TestReport {
  const checks: CheckReport[] = [];
  let phase: TestReport["phase"] = "fixture",
    results: Field<Value>[] | undefined,
    expectedError: string | undefined;
  const interpreter = new Interpreter();
  const report = (status: TestStatus, message: string): TestReport => ({
    id: test.id,
    name: test.name,
    status,
    passed: status === "passed",
    phase,
    message,
    checks,
    results,
    expectedError,
    interpreter,
  });
  let firstFailure: { phase: TestReport["phase"]; message: string } | undefined;
  const fail = (message: string) => {
    firstFailure ??= { phase, message };
  };
  try {
    if (fixture) interpreter.run(fixture, "repl", test.file + ":fixture");
    const setup: TestStep[] = [];
    const history: string[] = [];
    let alternativeBase: string[] | undefined;
    const flush = () => {
      if (!setup.length) return;
      phase = "setup";
      const first = setup[0];
      alternativeBase = first.mode === "legacy" ? [...history] : undefined;
      const source = setup.map((s) => s.source).join("\n");
      try {
        interpreter.run(source, "repl", test.file + ":setup");
      } catch (error) {
        if (error instanceof LanguageError && first.subject.span)
          error.diagnostic.related.push({
            message: "Setup begins here",
            span: first.subject.span,
          });
        throw error;
      }
      history.push(source);
      setup.length = 0;
    };
    for (let index = 0; index < test.steps.length; index++) {
      const step = test.steps[index];
      if (step.kind === "setup") {
        if (step.mode === "todo") {
          flush();
          const group = [step];
          while (
            test.steps[index + 1]?.kind === "setup" &&
            test.steps[index + 1]?.mode === "todo"
          )
            group.push(test.steps[++index]);
          phase = "setup";
          const trial = new Interpreter();
          if (fixture) trial.run(fixture, "repl", test.file + ":fixture");
          for (const source of alternativeBase ?? history)
            trial.run(source, "repl", test.file + ":setup replay");
          let failed = false;
          try {
            trial.run(
              group.map((s) => s.source).join("\n"),
              "repl",
              test.file + ":todo setup",
            );
          } catch (error) {
            if (!(error instanceof LanguageError)) throw error;
            failed = true;
          }
          const message = failed ? "" : "This setup now succeeds; remove todo.";
          checks.push({
            kind: "setup",
            mode: "todo",
            status: failed ? "expected-failure" : "failed",
            message,
            span: step.subject.span,
          });
          if (!failed) fail(message);
          continue;
        }
        if (setup.length && setup[0].mode !== step.mode) flush();
        setup.push(step);
        continue;
      }
      flush();
      alternativeBase = undefined;
      if (step.kind === "output") {
        phase = "body";
        results = execute(interpreter, step.subject);
        continue;
      }
      let mismatch: string | undefined,
        actualOutput: string | undefined,
        expectedOutput: string | undefined;
      try {
        let expected: ExpectedResult | undefined;
        if (step.kind === "result") {
          phase = "expectation";
          expected = expectedResult(step, interpreter);
        }
        phase = "body";
        let subjectFailed = false;
        try {
          if (step.kind === "parse-error") {
            interpreter.parse(step.source, "program", test.file + ":parse");
          } else {
            results = execute(interpreter, step.subject);
            actualOutput = interpreter.inspect(results);
          }
        } catch (error) {
          if (
            (step.kind === "error" || step.kind === "parse-error") &&
            error instanceof LanguageError &&
            matchesExpectedError(error, step.reason!)
          ) {
            subjectFailed = true;
            expectedError = step.reason;
          } else throw error;
        }
        phase = "comparison";
        if (step.kind === "error" || step.kind === "parse-error") {
          if (!subjectFailed)
            mismatch = "expected " + step.reason + "; the subject succeeded";
        } else if (step.kind === "assert") {
          const value = unwrap(single(results!, "assertion"));
          const bool = asType(single(interpreter.run("Bool")));
          if (
            results![0].label !== "_1" ||
            !equal(resultType(results![0].value, interpreter), bool) ||
            value.kind !== "symbol" ||
            !["True", "False"].includes(value.name)
          )
            mismatch = "assert requires Bool, not truthiness";
          else if (value.name !== "True") mismatch = "assertion is False";
        } else {
          mismatch = compareResult(results!, expected!, interpreter);
          if (!mismatch) {
            phase = "expectation";
            const data = expectedData(
              expected!.value,
              expected!.type,
              interpreter,
            );
            expectedOutput = interpreter.inspect(singleton(data));
            phase = "comparison";
            if (!equal(results![0].value, data))
              mismatch =
                "expected " +
                interpreter.inspect(singleton(data)) +
                "; received " +
                interpreter.inspect(results!);
          }
        }
      } catch (error) {
        // Interpreter/validation errors are assertion failures. Host exceptions
        // indicate a broken harness and must never be swallowed by todo.
        if (!(error instanceof LanguageError)) throw error;
        mismatch = renderDiagnostic(error);
      }
      if (step.mode === "todo") {
        if (mismatch) {
          checks.push({
            kind: step.kind,
            mode: step.mode,
            status: "expected-failure",
            message: "",
            span: step.subject.span,
          });
          continue;
        }
        mismatch = "This assertion now passes; remove todo.";
      }
      if (mismatch) {
        checks.push({
          kind: step.kind,
          mode: step.mode,
          status: "failed",
          message: mismatch,
          actual: actualOutput,
          expected: expectedOutput,
          span: step.subject.span,
        });
        fail(mismatch);
      } else
        checks.push({
          kind: step.kind,
          mode: step.mode,
          status: "passed",
          message: "matched",
          actual: actualOutput,
          expected: expectedOutput,
          span: step.subject.span,
        });
    }
    flush();
    if (!checks.length)
      throw problem(
        "a test requires at least one assert or expect",
        test.body,
        "E_TEST_NO_CHECK",
      );
    if (firstFailure) {
      phase = firstFailure.phase;
      return report("failed", firstFailure.message);
    }
    return report(
      "passed",
      checks.filter((c) => c.status === "passed").length + " assertions passed",
    );
  } catch (error) {
    return report("failed", renderDiagnostic(error));
  }
}
