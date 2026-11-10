import { Interpreter } from "./runtime.ts";
import {
  layoutFormsFromBlock,
  mergeLayoutForms,
  parseSurface,
  parseTestSource,
} from "./parser.ts";
import { DEFAULT_GRAMMAR, Grammar } from "./grammar.ts";
import { normal, binary, LanguageError } from "./syntax.ts";
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
import { primitiveNames } from "./primitive-names.ts";
import type { Pattern } from "./pattern.ts";
import { renderDiagnostic } from "./diagnostics.ts";
import { lineIndent } from "./indent.ts";
import {
  TEST_SCHEMA,
  TEST_STEP_TYPES,
  TEST_SETUP_TYPES,
} from "./test-schema.ts";

export type AssertionMode = "check" | "legacy" | "todo";
export interface TestStep {
  kind: "setup" | "output" | "is" | "fails" | "contains" | "assert";
  mode: AssertionMode;
  subject: Syntax;
  expected?: Syntax;
  expectedType?: Syntax;
  reason?: string;
  source: string;
  /** Where the step starts and its original source, keyword included. */
  location: StepLocation;
}
export interface StepLocation {
  line: number;
  column: number;
  source: string;
}
export interface TestCase {
  id: string;
  file: string;
  name: string;
  mode: "check" | "todo";
  value: Value;
  fileValue: Value;
  body: Syntax;
  steps: TestStep[];
  /** Executable editor source for supported checks/output, excluding todo operands. */
  source: string;
  program: boolean;
}
export type TestStatus = "passed" | "failed" | "expected-failure";
export interface CheckReport {
  kind: TestStep["kind"];
  status: TestStatus;
  mode: AssertionMode;
  message: string;
  actual?: string;
  expected?: string;
  span?: Span;
  /** The original assertion; present on every failed check. */
  location?: StepLocation & { file: string };
  /** Operands of a failed direct ==, != or .matches, captured during evaluation. */
  operands?: OperandReport;
}
export interface OperandReport {
  operator: "==" | "!=" | ".matches";
  left: { expression: string; actual: string };
  right: { expression: string; actual: string };
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
const asType = (value: Value, interpreter?: Interpreter): TypeValue => {
  const raw = unwrap(value);
  if (raw.kind === "type") return raw;
  if (raw.kind === "symbol" && primitiveNames.has(raw.name) && interpreter) {
    const typed = unwrap(single(interpreter.run("type " + raw.name)));
    if (typed.kind === "type") return typed;
  }
  throw problem("an expected type expression must produce a Type value");
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
  let prefix = lineIndent(nonempty[0] ?? "");
  if (indentation !== undefined) prefix = prefix.slice(0, indentation);
  else
    for (const line of nonempty.slice(1))
      while (!line.startsWith(prefix)) prefix = prefix.slice(0, -1);
  return lines
    .map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line))
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

/** An optional trailing :: names the expected type; everything else is inert data. */
function splitExpected(expected: Syntax): [Syntax, Syntax | undefined] {
  const annotation = binary(one(expected), "::");
  return annotation ? [annotation[0], annotation[1]] : [expected, undefined];
}
/** The step's original text from its first token's line start through its last token. */
function stepLocation(first: Syntax, last: Syntax): StepLocation {
  const start = first.span;
  const end = last.span;
  if (
    !start?.source ||
    start.start === undefined ||
    end?.end === undefined ||
    end.source !== start.source
  )
    return {
      line: start?.line ?? 0,
      column: start?.column ?? 0,
      source: normal(first),
    };
  const text = start.source.text;
  let stop = end.end;
  // A block's span excludes its aligned end, which belongs to the original step.
  if (last.kind === "block")
    stop +=
      /^(?:[ \t]*(?:#[^\n]*)?\n)*[ \t]*end\b/.exec(text.slice(stop))?.[0]
        .length ?? 0;
  return {
    line: start.line,
    column: start.column,
    source: dedent(
      text.slice(start.start - (start.column - 1), stop).trimEnd(),
      start.column - 1,
    ),
  };
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
        const [expected, expectedType] =
          role === "is"
            ? splitExpected(dataSyntax(parts[1].value))
            : role === "contains"
              ? [dataSyntax(parts[1].value), undefined]
              : [undefined, undefined];
        result.push({
          kind: role,
          mode: scalarString(mode.value) as AssertionMode,
          subject,
          source: testSourceText(subject),
          expected,
          expectedType,
          reason: role === "fails" ? scalarString(parts[1].value) : undefined,
          location: stepLocation(tokens[pos], tokens[match.end - 1]),
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
              ["test", "value", "is", "results", "fails", "contains"].includes(
                operand.name,
              ))
          );
        if (
          !wrapsSetup &&
          n.kind === "symbol" &&
          !n.quoted &&
          (this.starts.has(n.name) ||
            ["test", "value", "results", "is", "fails", "contains"].includes(
              n.name,
            ))
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
            location: stepLocation(n, tokens[next - 1]),
          });
        } else
          result.push({
            kind: "setup",
            mode: "check",
            subject: body.lines[row],
            source,
            location: stepLocation(n, tokens[next - 1]),
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
          "A .test file contains one or more test or todo test blocks; legacy modifies assertions and setup, not whole tests.",
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
      const [modifier, name, content] = this.schema.call(
        "testParts",
        singleton(entry.value),
      );
      const mode = scalarString(modifier.value) as TestCase["mode"],
        title = scalarString(name.value),
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
      const output = supported.at(-1)?.kind === "output";
      const singleProgram =
        assertions.length === 1 && assertions[0] === supported.at(-1);
      const program =
        mode !== "todo" && (singleProgram || (output && assertions.length > 0));
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
        mode,
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
  const codeType = asType(single(interpreter.run("Code")), interpreter);
  const block =
    tree.kind === "block"
      ? tree
      : { kind: "block" as const, lines: [tree], span: tree.span };
  return interpreter.evaluateCode(interpreter.interpretSyntax(codeType, block));
}
function typeOf(tree: Syntax, interpreter: Interpreter): TypeValue {
  return asType(single(execute(interpreter, tree)), interpreter);
}
export function isAssertion(step: TestStep): boolean {
  return (
    step.kind !== "output" && (step.kind !== "setup" || step.mode === "todo")
  );
}
interface ExpectedResult {
  value: Syntax;
  /** Absent when the data takes the actual subject value's type. */
  type?: TypeValue;
}
function expectedData(
  tree: Syntax,
  type: TypeValue,
  interpreter: Interpreter,
): Value {
  // An explicit :: operand computes a type; the value payload stays inert data.
  const annotations = (n: Syntax): Syntax => {
    const tagged = binary(n, "::");
    if (tagged && n.kind === "apply" && n.head.kind === "apply") {
      const typeText = scalarString(
        single(
          interpreter.call(
            "toString",
            singleton(asType(single(interpreter.run("Type")), interpreter)),
            singleton(typeOf(tagged[1], interpreter)),
          ),
        ),
      );
      return {
        ...n,
        head: {
          ...n.head,
          body: [{ label: "_1", value: annotations(tagged[0]) }],
        },
        body: [{ label: "_1", value: one(parseSurface(typeText)) }],
      };
    }
    if (n.kind === "apply")
      return {
        ...n,
        head: annotations(n.head),
        body: n.body.map((f) => ({ ...f, value: annotations(f.value) })),
      };
    if (n.kind === "pack")
      return {
        ...n,
        body: n.body.map((f) => ({ ...f, value: annotations(f.value) })),
      };
    if (n.kind === "postfix") return { ...n, operand: annotations(n.operand) };
    return n;
  };
  const sourceText = testSourceText(tree).trim();
  const text = parseNumericSpelling(sourceText)
    ? sourceText
    : normal(annotations(one(tree)));
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
    type: step.expectedType && typeOf(step.expectedType, interpreter),
  };
}
function resultType(value: Value, interpreter: Interpreter): TypeValue {
  const observed = observedType(value);
  return typeof observed === "string"
    ? asType(single(interpreter.run(observed)), interpreter)
    : observed;
}
function matchesExpectedError(error: LanguageError, reason: string): boolean {
  return reason.startsWith("E_")
    ? error.diagnostic.code === reason
    : error.message.includes(reason);
}

function expectedNeedle(step: TestStep): string {
  const needle = one(step.expected!);
  if (needle.kind !== "literal" || typeof needle.value !== "string")
    throw problem(
      "contains needle is not a String; write an authored String literal",
      step.expected,
      "E_TEST_OPERAND_TYPE",
    );
  return needle.value;
}

function compareResult(
  actual: Field<Value>[],
  expected: ExpectedResult,
  interpreter: Interpreter,
): string | undefined {
  if (actual.length !== 1 || actual[0].label !== "_1")
    return "is requires exactly one positional value; destructure multiple returns before checking them";
  if (!expected.type) return;
  const type = resultType(actual[0].value, interpreter);
  if (!equal(type, expected.type))
    return (
      "is type mismatch: expected " +
      expected.type.name +
      "; received " +
      type.name
    );
}

const DIRECT_OPERATORS: Record<string, OperandReport["operator"]> = {
  "==": "==",
  "!=": "!=",
  matches: ".matches",
};
/** Watch the operands of a direct ==, != or .matches while the assertion runs normally. */
function watchOperands(interpreter: Interpreter, subject: Syntax) {
  const tree = one(subject);
  if (
    tree.kind !== "apply" ||
    tree.head.kind !== "apply" ||
    tree.head.head.kind !== "symbol" ||
    tree.head.head.quoted ||
    !Object.hasOwn(DIRECT_OPERATORS, tree.head.head.name) ||
    tree.head.body.length !== 1 ||
    tree.body.length !== 1 ||
    !tree.span
  )
    return;
  const name = tree.head.head.name,
    seen: { left?: Field<Value>[]; right?: Field<Value>[] } = {},
    stop = interpreter.observeOperands(tree.span, name, (side, operands) => {
      seen[side] = operands;
    }),
    text = (operand: Syntax) => normal(operand).replace(/\s*\n\s*/g, " "),
    left = tree.head.body[0].value,
    right = tree.body[0].value;
  return {
    stop,
    report(): OperandReport | undefined {
      if (!seen.left || !seen.right) return;
      return {
        operator: DIRECT_OPERATORS[name],
        left: {
          expression: text(left),
          actual: interpreter.inspect(seen.left),
        },
        right: {
          expression: text(right),
          actual: interpreter.inspect(seen.right),
        },
      };
    },
  };
}
/** Reason, file:line:column, the original assertion and any captured operands. */
function describeFailure(reason: string, check: CheckReport): string {
  const at = check.location!;
  return [
    reason,
    "  at " + at.file + ":" + at.line + ":" + at.column,
    ...at.source.split("\n").map((line) => "    " + line),
    ...(check.operands
      ? [check.operands.left, check.operands.right].map(
          (side) => "  " + side.expression + ": " + side.actual,
        )
      : []),
  ].join("\n");
}

/** Execute checks; whole-test todo expects a case failure, never a host/fixture failure. */
export function runTest(test: TestCase, fixture = ""): TestReport {
  const checks: CheckReport[] = [];
  let phase: TestReport["phase"] = "fixture",
    results: Field<Value>[] | undefined,
    expectedError: string | undefined;
  const interpreter = new Interpreter();
  let unexpectedTodo = false;
  const report = (
    outcome: "passed" | "failed",
    message: string,
    todoEligible = false,
  ): TestReport => {
    const expectedFailure =
      test.mode === "todo" &&
      outcome === "failed" &&
      todoEligible &&
      !unexpectedTodo;
    const fulfilled = test.mode === "todo" && outcome === "passed";
    const status: TestStatus = expectedFailure
      ? "expected-failure"
      : fulfilled
        ? "failed"
        : outcome;
    return {
      id: test.id,
      name: test.name,
      status,
      passed: status !== "failed",
      phase,
      message: fulfilled ? "This test now passes; remove todo." : message,
      checks,
      results,
      expectedError,
      interpreter,
    };
  };
  let firstFailure: { phase: TestReport["phase"]; message: string } | undefined;
  const failures: string[] = [];
  const fail = (message: string, todoEligible = true) => {
    if (!todoEligible) unexpectedTodo = true;
    failures.push(message);
    if (!firstFailure || (test.mode === "todo" && !todoEligible))
      firstFailure = { phase, message };
  };
  const located = (step: TestStep, check: CheckReport): CheckReport => ({
    ...check,
    location: { file: test.file, ...step.location },
  });
  /** One failed check: its entry in the report and its full description. */
  const failCheck = (
    step: TestStep,
    check: CheckReport,
    todoEligible: boolean,
  ) => {
    const entry = located(step, check);
    checks.push(entry);
    fail(describeFailure(entry.message, entry), todoEligible);
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
          const check: CheckReport = {
            kind: "setup",
            mode: "todo",
            status: failed ? "expected-failure" : "failed",
            message: failed ? "" : "This setup now succeeds; remove todo.",
            span: step.subject.span,
          };
          if (failed) checks.push(check);
          else failCheck(step, check, false);
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
        expectedOutput: string | undefined,
        watch: ReturnType<typeof watchOperands>,
        operands: OperandReport | undefined;
      try {
        let expected: ExpectedResult | undefined;
        let needle: string | undefined;
        if (step.kind === "is") {
          phase = "expectation";
          expected = expectedResult(step, interpreter);
        } else if (step.kind === "contains") {
          phase = "expectation";
          needle = expectedNeedle(step);
        }
        phase = "body";
        let subjectFailed = false;
        try {
          watch =
            step.kind === "assert"
              ? watchOperands(interpreter, step.subject)
              : undefined;
          results = execute(interpreter, step.subject);
          actualOutput = interpreter.inspect(results);
        } catch (error) {
          if (
            step.kind === "fails" &&
            error instanceof LanguageError &&
            matchesExpectedError(error, step.reason!)
          ) {
            subjectFailed = true;
            expectedError = step.reason;
          } else throw error;
        }
        phase = "comparison";
        if (step.kind === "fails") {
          if (!subjectFailed)
            mismatch = "expected " + step.reason + "; the subject succeeded";
        } else if (step.kind === "contains") {
          const subject = results!;
          if (
            subject.length !== 1 ||
            subject[0].label !== "_1" ||
            !equal(
              resultType(subject[0].value, interpreter),
              asType(single(interpreter.run("String")), interpreter),
            )
          )
            throw problem(
              "contains subject is not a String",
              step.subject,
              "E_TEST_OPERAND_TYPE",
            );
          const text = scalarString(subject[0].value);
          expectedOutput = JSON.stringify(needle!);
          actualOutput = JSON.stringify(text);
          if (!text.includes(needle!))
            mismatch =
              "expected " + actualOutput + " to contain " + expectedOutput;
        } else if (step.kind === "assert") {
          const value = unwrap(single(results!, "assertion"));
          const bool = asType(single(interpreter.run("Bool")), interpreter);
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
              expected!.type ?? resultType(results![0].value, interpreter),
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
      } finally {
        operands = watch?.report();
        watch?.stop();
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
        operands = undefined;
      }
      if (mismatch)
        failCheck(
          step,
          {
            kind: step.kind,
            mode: step.mode,
            status: "failed",
            message: mismatch,
            actual: actualOutput,
            expected: expectedOutput,
            span: step.subject.span,
            operands,
          },
          step.mode !== "todo",
        );
      else
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
      const reported = firstFailure.message;
      return report(
        "failed",
        [reported, ...failures.filter((message) => message !== reported)].join(
          "\n\n",
        ),
        true,
      );
    }
    return report(
      "passed",
      checks.filter((c) => c.status === "passed").length + " assertions passed",
    );
  } catch (error) {
    return report(
      "failed",
      renderDiagnostic(error),
      error instanceof LanguageError &&
        phase !== "fixture" &&
        error.diagnostic.code !== "E_TEST_NO_CHECK" &&
        test.steps.some((step) => isAssertion(step) || step.mode === "todo"),
    );
  }
}
