import test from "node:test";
import assert from "node:assert/strict";
import { SourcePositions } from "../src/lsp/positions.ts";
import { analyze, readerDiagnostic } from "../src/lsp/analysis.ts";
import { Grammar, DEFAULT_GRAMMAR } from "../src/grammar.ts";
import { parseSurface } from "../src/parser.ts";
import { Interpreter } from "../src/runtime.ts";

const uri = "file:///workspace/unsaved.pattern";
const read = (text: string, file = uri) =>
  analyze({ uri: file, text, version: 7 });

test("LSP outlines concrete and abstract declarations through the shared grammar", () => {
  const result = read(
    "type Rectangle concrete\n  Rect(w :: Rational, h :: Rational)\nend\ntype Either abstract Float32 | Float64\nEither",
  );
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.name),
    ["Rectangle", "Either"],
  );
  assert.deepEqual(result.symbols[0].selectionRange.start, {
    line: 0,
    character: 5,
  });
  assert.deepEqual(result.symbols[0].range.end, { line: 2, character: 3 });
  assert.deepEqual(result.symbols[1].selectionRange.start, {
    line: 3,
    character: 5,
  });
});

test("LSP diagnoses ordinary code outside a .test envelope without checking its operands", () => {
  for (const invalid of ["foo 1 2", "foo()", "1", "x = 1"]) {
    const result = read(
      `test "First"\n  expect unknown() result Future<3> :: Missing\nend\n\n${invalid}\n`,
      "file:///changed.test",
    );
    assert.equal(result.diagnostics.length, 1, invalid);
    assert.equal(result.diagnostics[0].code, "E_TEST_FILE", invalid);
    assert.deepEqual(
      result.diagnostics[0].range.start,
      { line: 4, character: 0 },
      invalid,
    );
    assert.match(
      result.diagnostics[0].message,
      /named test or todo test block/u,
    );
    assert.equal(result.symbols[0].name, "First");
  }
  const inside = read(
    'todo test "Still future"\n  expect unknown() result Future<3> :: Missing\nend',
    "file:///changed.test",
  );
  assert.deepEqual(inside.diagnostics, []);
  assert.equal(inside.symbols[0].name, "Still future");
});

test("LSP source ranges map BOM, CRLF, astral scalars, tabs and missing endpoints", () => {
  const positions = new SourcePositions(uri, '\uFEFF"😀"\r\n\tbad');
  assert.equal(positions.normalized, '"😀"\n\tbad');
  assert.deepEqual(positions.range({ line: 1, column: 2, start: 1, end: 3 }), {
    start: { line: 0, character: 2 },
    end: { line: 0, character: 4 },
  });
  assert.deepEqual(positions.range({ line: 1, column: 2 }), {
    start: { line: 0, character: 2 },
    end: { line: 0, character: 4 },
  });
  assert.deepEqual(
    positions.range({ line: 2, column: 2, endLine: 2, endColumn: 5 }),
    { start: { line: 1, character: 1 }, end: { line: 1, character: 4 } },
  );
  assert.deepEqual(positions.range({ line: 99, column: 99 }), {
    start: { line: 1, character: 4 },
    end: { line: 1, character: 4 },
  });
  assert.deepEqual(
    positions.range({ line: -9, column: -2, start: -10, end: 1e9 }),
    { start: { line: 0, character: 1 }, end: { line: 1, character: 4 } },
  );
});

test("LSP maps structured reader diagnostics rather than rendered CLI text", () => {
  const positions = new SourcePositions(uri, "a\r\nb");
  const diagnostic = readerDiagnostic(
    {
      code: "E_EXAMPLE",
      phase: "parse",
      message: "Bad token",
      primary: { line: 2, column: 1 },
      notes: ["A note"],
      expected: "x",
      actual: "b",
      related: [{ message: "Started here", span: { line: 1, column: 1 } }],
      causes: [
        {
          code: "E_CAUSE",
          phase: "parse",
          message: "Underlying reason",
          notes: [],
          related: [],
        },
      ],
    },
    positions,
  );
  assert.equal(diagnostic.code, "E_EXAMPLE");
  assert.equal(
    diagnostic.message,
    "Bad token\nA note\nExpected: x\nActual: b\nCaused by: Underlying reason",
  );
  assert.deepEqual(diagnostic.range, {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 1 },
  });
  assert.deepEqual(diagnostic.relatedInformation?.[0].location.range, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: 1 },
  });
});

test("LSP start-only spans account for the reader treating lone CR as whitespace", () => {
  const positions = new SourcePositions(uri, "a\rb");
  assert.deepEqual(positions.range({ line: 1, column: 3 }), {
    start: { line: 1, character: 0 },
    end: { line: 1, character: 1 },
  });
});

test("LSP uses authored full declaration and nested name ranges", () => {
  const result = read(
    "\uFEFFdef answer()\r\n  def inner(x) x\r\n  missing(1 / 0)\r\nend\r\nanswer()",
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.symbols[0].name, "answer()");
  assert.deepEqual(result.symbols[0].range, {
    start: { line: 0, character: 1 },
    end: { line: 3, character: 3 },
  });
  assert.deepEqual(result.symbols[0].selectionRange, {
    start: { line: 0, character: 5 },
    end: { line: 0, character: 11 },
  });
  assert.deepEqual(result.symbols[0].children?.[0].selectionRange, {
    start: { line: 1, character: 6 },
    end: { line: 1, character: 11 },
  });
  assert.equal(result.symbols[0].children?.[0].name, "inner(x)");
});

test("LSP recognizes a single whole-test todo under inbox without running its operands", () => {
  const result = read(
    'todo test "Future 😀"\n  def bomb() 1 / 0\n  expect F<3> result None :: Float??\nend',
    "file:///workspace/tests/inbox/future.test",
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.symbols.length, 1);
  assert.equal(result.symbols[0].name, "Future 😀");
  assert.equal(result.symbols[0].detail, "todo test · not executed");
  assert.deepEqual(result.symbols[0].range, {
    start: { line: 0, character: 0 },
    end: { line: 3, character: 3 },
  });
  assert.deepEqual(result.symbols[0].selectionRange, {
    start: { line: 0, character: 10 },
    end: { line: 0, character: 21 },
  });
  assert.equal(result.symbols[0].children?.[0].name, "bomb()");
  assert.match(
    result.unknown.map((item) => item.reason).join(" "),
    /semantic analysis is unavailable/u,
  );
});

test("LSP reports the first certain parse failure with end-exclusive editor coordinates", () => {
  const result = read('\uFEFF"😀"\r\nbroken(');
  assert.equal(result.diagnostics.length, 1);
  assert.match(result.diagnostics[0].message, /unclosed delimiter/u);
  assert.deepEqual(result.diagnostics[0].range, {
    start: { line: 1, character: 6 },
    end: { line: 1, character: 7 },
  });
  assert.deepEqual(result.symbols, []);
});

test("LSP leaves incomplete declarations and source-dependent clauses unknown", () => {
  const incomplete = read("def");
  assert.deepEqual(incomplete.diagnostics, []);
  assert.deepEqual(incomplete.symbols, []);
  assert.equal(incomplete.status, "partial");
  const clauses = read(
    "macro :choose x :: Body :otherwise y :: Body Code` 1\nchoose\n  1\notherwise\n  2\nend",
  );
  assert.deepEqual(clauses.diagnostics, []);
  assert.match(clauses.unknown[0].reason, /Grammar-dependent layout/u);
  const certain = read("macro :choose x :: Expression Code` 1\nbroken(");
  assert.match(certain.diagnostics[0].message, /unclosed delimiter/u);
});

test("LSP preserves raw text and typed-quote contents as unknown without fake symbols", () => {
  const result = read("def value() Custom` :(def fake() 1)\nvalue()");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(
    result.symbols.map((symbol) => symbol.name),
    ["value()"],
  );
  assert.deepEqual(result.symbols[0].children, []);
  assert.match(
    result.unknown.map((item) => item.reason).join(" "),
    /quoted source is not interpreted/u,
  );
  const raw = read("def text() String'\n  def Fake() missing()\nend\ntext()");
  assert.deepEqual(raw.diagnostics, []);
  assert.deepEqual(
    raw.symbols.map((symbol) => symbol.name),
    ["text()"],
  );
});

test("LSP analysis has no runtime/bootstrap/test execution path", (t) => {
  const run = t.mock.method(Interpreter.prototype, "run", () => {
    throw new Error("runtime canary executed");
  });
  const call = t.mock.method(Interpreter.prototype, "call", () => {
    throw new Error("predicate/macro canary executed");
  });
  for (const [file, source] of [
    [uri, "macro :explode x :: Expression\n  missing(1 / 0)\nend\nexplode 1"],
    [uri, "def Positive type Rational\n  missing(1 / 0)\nend\nmissing()"],
    [
      "file:///test.test",
      'test "Execution canary"\n  missing(1 / 0)\n  expect missing() result None :: MissingType\nend',
    ],
  ])
    assert.deepEqual(read(source, file).diagnostics, []);
  assert.equal(run.mock.callCount(), 0);
  assert.equal(call.mock.callCount(), 0);
});

test("opaque schema operands are opt-in and preserve default Grammar behavior", () => {
  const schema = "def Envelope type :envelope body :: Expression";
  const source = "envelope\n  missing()\nend";
  assert.throws(() => new Grammar(schema).parse(source));
  const opaque = new Grammar(schema, { opaqueExpressions: true });
  const surface = parseSurface(source);
  assert.equal(surface.kind, "block");
  if (surface.kind !== "block") throw new Error("Expected source block");
  const parsed = opaque.clone().elaborate(surface, () => {}, true);
  assert.equal(parsed.kind, "block");
  if (parsed.kind !== "block" || parsed.lines[0].kind !== "form")
    throw new Error("Expected schema form");
  assert.equal(
    parsed.lines[0].captures.get("body")?.fields[0].value.kind,
    "block",
  );
  assert.throws(() => new Grammar(schema).parse(source));
  const bodySchema =
    DEFAULT_GRAMMAR + "\ndef Envelope type :envelope body :: Body";
  const malformedBody = "envelope\n  def\nend";
  assert.throws(() => new Grammar(bodySchema).parse(malformedBody));
  assert.doesNotThrow(() =>
    new Grammar(bodySchema, { opaqueExpressions: true }).parse(malformedBody),
  );
});

test("LSP outlines a syntactically registered macro without selecting or expanding it", () => {
  const result = read(
    "macro :explode x :: Expression\n  missing()\nend\nexplode 1",
  );
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.symbols.length, 1);
  assert.match(result.symbols[0].name, /^:explode/u);
  assert.equal(result.symbols[0].detail, "macro · syntax only");
  assert.deepEqual(result.symbols[0].range, {
    start: { line: 0, character: 0 },
    end: { line: 2, character: 3 },
  });
});

test("oversize source is unavailable, never diagnosed as a bad program", () => {
  const result = read(" ".repeat(100001));
  assert.equal(result.status, "unavailable");
  assert.deepEqual(result.diagnostics, []);
});
