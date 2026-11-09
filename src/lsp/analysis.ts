import { DiagnosticSeverity, SymbolKind } from "vscode-languageserver/node.js";
import type {
  Diagnostic,
  DocumentSymbol,
  Range,
} from "vscode-languageserver/node.js";
import {
  LanguageError,
  type Diagnostic as ReaderDiagnostic,
} from "../diagnostics.ts";
import { Grammar, DEFAULT_GRAMMAR } from "../grammar.ts";
import {
  parseSurface,
  parseTestSource,
  layoutFormsFromBlock,
  mergeLayoutForms,
  tokenize,
} from "../parser.ts";
import { TEST_SCHEMA } from "../test-schema.ts";
import { isName, normal, type Syntax, type Span } from "../syntax.ts";
import { SourcePositions } from "./positions.ts";

export interface Snapshot {
  readonly uri: string;
  readonly version: number;
  readonly text: string;
  readonly languageId?: string;
}
export interface Analysis {
  version: number;
  diagnostics: Diagnostic[];
  symbols: DocumentSymbol[];
  status: "syntax-checked" | "partial" | "unavailable";
  unknown: { reason: string; range?: Range }[];
}
export const MAX_SOURCE_LENGTH = 100000;

export function unavailable(snapshot: Snapshot, reason: string): Analysis {
  return {
    version: snapshot.version,
    diagnostics: [],
    symbols: [],
    status: "unavailable",
    unknown: [{ reason }],
  };
}

function explanation(diagnostic: ReaderDiagnostic, depth = 0): string {
  return [
    diagnostic.message,
    ...diagnostic.notes,
    diagnostic.expected === undefined ? "" : "Expected: " + diagnostic.expected,
    diagnostic.actual === undefined ? "" : "Actual: " + diagnostic.actual,
    ...(depth < 3
      ? (diagnostic.causes ?? []).map(
          (cause) => "Caused by: " + explanation(cause, depth + 1),
        )
      : []),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8192);
}

export function readerDiagnostic(
  diagnostic: ReaderDiagnostic,
  positions: SourcePositions,
): Diagnostic {
  return {
    range: positions.range(diagnostic.primary),
    severity: DiagnosticSeverity.Error,
    source: "pattern-language",
    code: diagnostic.code,
    message: explanation(diagnostic),
    relatedInformation: diagnostic.related.flatMap((related) => {
      if (!related.span) return [];
      const source = related.span.source;
      if (
        source &&
        source.name !== positions.uri &&
        source.text !== positions.normalized
      )
        return [];
      return [
        {
          location: {
            uri: positions.uri,
            range: positions.range(related.span),
          },
          message: related.message,
        },
      ];
    }),
  };
}

/** Only syntactic children; quoted code and text templates are inert data. */
function children(node: Syntax): Syntax[] {
  switch (node.kind) {
    case "apply":
      return [node.head, ...node.body.map((f) => f.value)];
    case "pack":
      return node.body.map((f) => f.value);
    case "postfix":
      return [node.operand];
    case "block":
      return node.lines;
    case "sequence":
      return node.items;
    case "form":
      return node.items;
    default:
      return [];
  }
}
function extent(node: Syntax, positions: SourcePositions): Span | undefined {
  let start = node.span?.start,
    end = node.span?.end;
  const visit = (value: Syntax) => {
    if (value.span?.start !== undefined)
      start = Math.min(start ?? Infinity, value.span.start);
    if (value.span?.end !== undefined) {
      let last = value.span.end;
      if (value.kind === "block") {
        const closing = /^[ \t]*end(?=$|[\s#])/u.exec(
          positions.normalized.slice(last),
        );
        if (closing) last += closing[0].length;
      }
      end = Math.max(end ?? 0, last);
    }
    children(value).forEach(visit);
  };
  visit(node);
  return start === undefined || end === undefined
    ? node.span
    : { line: 1, column: 1, start, end };
}
function nameNode(node: Syntax): Syntax | undefined {
  if (node.kind === "symbol") return node;
  if (node.kind === "apply") return nameNode(node.head);
  if (node.kind === "postfix") return nameNode(node.operand);
  if (node.kind === "sequence")
    return node.items.find((n) => n.kind === "symbol" && n.quoted);
  return undefined;
}
const capture = (
  node: Extract<Syntax, { kind: "form" }>,
  name: string,
): Syntax | undefined => node.captures.get(name)?.fields[0]?.value;

/** Shared Test/TodoTest declarations are read as grammar data, never bootstrapped. */
function testGrammar(): {
  grammar: Grammar;
  layout: ReturnType<Grammar["layoutForms"]>;
} {
  const schema = parseSurface(TEST_SCHEMA, "trusted Test schema");
  if (schema.kind !== "block") throw new Error("Test schema requires a block");
  const declarations = schema.lines.filter(
    (line) =>
      line.kind === "sequence" &&
      isName(line.items[0], "def") &&
      line.items[1]?.kind === "symbol" &&
      ["Test", "TodoTest"].includes(line.items[1].name) &&
      isName(line.items[2], "type"),
  );
  if (declarations.length !== 2)
    throw new Error("Test schema envelope changed; update the syntax adapter");
  const grammar = new Grammar(declarations.map(normal).join("\n"), {
    opaqueExpressions: true,
  });
  return {
    grammar,
    layout: mergeLayoutForms(
      new Grammar().layoutForms(),
      layoutFormsFromBlock(schema),
    ),
  };
}

/** No runtime, runner, evaluator, native functions, or user predicates are called. */
export function analyze(snapshot: Snapshot): Analysis {
  if (snapshot.text.length > MAX_SOURCE_LENGTH)
    return unavailable(
      snapshot,
      "Syntax analysis unavailable: source exceeds the reader's 100000-character limit.",
    );
  const positions = new SourcePositions(snapshot.uri, snapshot.text);
  const result: Analysis = {
    version: snapshot.version,
    diagnostics: [],
    symbols: [],
    status: "syntax-checked",
    unknown: [],
  };
  const markUnknown = (reason: string, node?: Syntax) => {
    result.status = "partial";
    result.unknown.push({
      reason,
      ...(node ? { range: positions.range(extent(node, positions)) } : {}),
    });
  };
  const isTest =
    /\.test(?:[?#]|$)/u.test(snapshot.uri) ||
    snapshot.languageId === "pattern-language-test";
  const base = new Grammar(DEFAULT_GRAMMAR);
  const specification = isTest ? testGrammar() : undefined;
  let surface: Syntax;
  try {
    surface = (isTest ? parseTestSource : parseSurface)(
      snapshot.text,
      snapshot.uri,
      {
        layoutForms: specification?.layout ?? base.layoutForms(),
      },
    );
  } catch (error) {
    if (!(error instanceof LanguageError)) throw error;
    // Clause ownership may be supplied by an unexecuted local macro. Never guess
    // that a missing built-in clause boundary makes such source invalid.
    let customLayout = false;
    if (["E_BLOCK_END", "E_UNEXPECTED_END"].includes(error.diagnostic.code)) {
      try {
        customLayout = tokenize(snapshot.text).some(
          (token) =>
            token.kind === "name" && !token.quoted && token.text === "macro",
        );
      } catch {
        /* Preserve the original certain reader failure. */
      }
    }
    if (customLayout)
      markUnknown(
        "Grammar-dependent layout is unknown; local macro clauses require a staged reader.",
      );
    else {
      result.status = "partial";
      result.diagnostics.push(readerDiagnostic(error.diagnostic, positions));
    }
    return result;
  }
  if (surface.kind !== "block")
    return unavailable(
      snapshot,
      "Syntax analysis unavailable: reader did not return a source block.",
    );

  const definitionSymbol = (node: Syntax): DocumentSymbol[] => {
    if (
      node.kind === "quote" ||
      node.kind === "typedQuote" ||
      node.kind === "template"
    )
      return [];
    if (
      node.kind === "form" &&
      ["Definition", "MacroRegistration"].includes(node.name)
    ) {
      const signature = capture(node, "signature"),
        body = capture(node, "body");
      if (!signature || !nameNode(signature)) return [];
      const selected = nameNode(signature)!;
      const macro = node.name === "MacroRegistration";
      return [
        {
          name: normal(signature),
          detail: macro ? "macro · syntax only" : "definition · syntax only",
          kind:
            macro || signature.kind === "apply"
              ? SymbolKind.Function
              : SymbolKind.Variable,
          range: positions.range(extent(node, positions)),
          selectionRange: positions.range(selected.span),
          ...(body
            ? { children: children(body).flatMap(definitionSymbol) }
            : {}),
        },
      ];
    }
    return children(node).flatMap(definitionSymbol);
  };
  const readCode = (
    block: Extract<Syntax, { kind: "block" }>,
    grammar = base,
  ): DocumentSymbol[] => {
    const symbols: DocumentSymbol[] = [];
    try {
      grammar.elaborate(
        block,
        (form) => {
          grammar.registerDefinition(form);
          symbols.push(...definitionSymbol(form));
        },
        true,
      );
    } catch (error) {
      if (!(error instanceof LanguageError)) throw error;
      if (
        ["E_SYNTAX", "E_MACRO_SIGNATURE", "E_MACRO_REGISTRATION"].includes(
          error.diagnostic.code,
        )
      )
        result.diagnostics.push(readerDiagnostic(error.diagnostic, positions));
      else
        markUnknown(
          "Grammar-dependent region unknown: syntax recognition stopped before an unrecognized or incomplete form.",
        );
    }
    return symbols;
  };
  if (specification) {
    try {
      specification.grammar.elaborate(
        surface,
        (form) => {
          if (
            form.kind !== "form" ||
            !["Test", "TodoTest"].includes(form.name)
          ) {
            markUnknown(
              "Test envelope unknown; expected a named test or todo test block.",
              form,
            );
            return;
          }
          const name = capture(form, "name"),
            body = capture(form, "body");
          if (
            name?.kind !== "literal" ||
            typeof name.value !== "string" ||
            body?.kind !== "block"
          ) {
            markUnknown(
              "Test envelope unknown; only literal names and indented bodies are recognized.",
              form,
            );
            return;
          }
          result.symbols.push({
            name: name.value,
            detail:
              form.name === "TodoTest"
                ? "todo test · not executed"
                : "test · not executed",
            kind: SymbolKind.Module,
            range: positions.range(extent(form, positions)),
            selectionRange: positions.range(name.span),
            children: readCode(body, new Grammar()),
          });
        },
        true,
      );
    } catch (error) {
      if (!(error instanceof LanguageError)) throw error;
      markUnknown(
        "Test envelope unknown: the schema did not recognize the complete source.",
      );
    }
    markUnknown(
      "Test assertions, setup, todo operands and expected types are source data; semantic analysis is unavailable.",
    );
  } else result.symbols = readCode(surface);
  const noteQuotes = (node: Syntax): void => {
    if (node.kind === "typedQuote" || node.kind === "template") {
      markUnknown(
        "Reader- or macro-dependent contents are unknown; quoted source is not interpreted.",
        node,
      );
      return;
    }
    children(node).forEach(noteQuotes);
  };
  noteQuotes(surface);
  return result;
}
