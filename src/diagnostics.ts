import type { Span } from "./syntax.ts";
export interface SourceDocument {
  name: string;
  text: string;
}
export interface RelatedLocation {
  message: string;
  span?: Span;
}
export interface Diagnostic {
  code: string;
  phase: "parse" | "declaration" | "match" | "evaluate" | "expand";
  message: string;
  primary?: Span;
  notes: string[];
  related: RelatedLocation[];
  path?: string[];
  expected?: string;
  actual?: string;
  causes?: Diagnostic[];
}
export class LanguageError extends Error {
  diagnostic: Diagnostic;
  constructor(message: string, span?: Span, details: Partial<Diagnostic> = {}) {
    super(message);
    this.name = "LanguageError";
    this.diagnostic = {
      code: "E_LANGUAGE",
      phase: "evaluate",
      message,
      notes: [],
      related: [],
      ...details,
      primary: span ?? details.primary,
    };
    this.refresh();
  }
  refresh(): void {
    const span = this.diagnostic.primary;
    this.message =
      (span ? `${span.line}:${span.column}: ` : "") + this.diagnostic.message;
  }
  at(span?: Span): this {
    if (!this.diagnostic.primary && span) this.diagnostic.primary = span;
    this.refresh();
    return this;
  }
}
/** Source text is diagnostic metadata, never part of structural syntax identity. */
export function attachSource(span: Span, source: SourceDocument): void {
  Object.defineProperty(span, "source", {
    value: source,
    configurable: true,
    enumerable: false,
  });
}
export function renderDiagnostic(error: unknown): string {
  if (!(error instanceof LanguageError))
    return error instanceof Error ? error.message : String(error);
  const d = error.diagnostic;
  const location = (span?: Span) =>
    span ? `${span.source?.name ?? "program"}:${span.line}:${span.column}` : "";
  const out = [
    `${d.code}${d.primary ? " · " + location(d.primary) : ""}: ${d.message}`,
  ];
  const span = d.primary;
  if (span?.source) {
    const line = span.source.text.split(/\r?\n/)[span.line - 1] ?? "";
    const width =
      span.endLine === span.line && span.endColumn
        ? Math.max(1, span.endColumn - span.column)
        : 1;
    out.push(
      `${span.line} | ${line}`,
      `${" ".repeat(String(span.line).length)} | ${" ".repeat(span.column - 1)}${"^".repeat(Math.min(width, Math.max(1, line.length - span.column + 2)))}`,
    );
  }
  for (const note of d.notes) out.push(note);
  for (const related of d.related)
    out.push(
      `${related.message}${related.span ? " — " + location(related.span) : ""}`,
    );
  return out.join("\n");
}
