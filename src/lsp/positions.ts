import { TextDocument } from "vscode-languageserver-textdocument";
import type { Range } from "vscode-languageserver/node.js";
import type { Span } from "../syntax.ts";

/** Parser offsets refer to BOM-free, LF-normalized UTF-16 text. */
export class SourcePositions {
  readonly normalized: string;
  private offsets: number[];
  private original: TextDocument;
  private lineStarts: number[] = [0];

  readonly uri: string;
  readonly text: string;

  constructor(uri: string, text: string) {
    this.uri = uri;
    this.text = text;
    let normalized = "",
      offset = text.startsWith("\uFEFF") ? 1 : 0;
    this.offsets = [offset];
    while (offset < text.length) {
      if (text[offset] === "\r" && text[offset + 1] === "\n") {
        normalized += "\n";
        offset += 2;
      } else normalized += text[offset++];
      this.offsets.push(offset);
    }
    this.normalized = normalized;
    this.original = TextDocument.create(uri, "pattern-language", 0, text);
    // Unlike LSP documents, the reader treats a lone CR as horizontal space.
    for (let i = 0; i < normalized.length; i++)
      if (normalized[i] === "\n") this.lineStarts.push(i + 1);
  }

  private clamp(offset: number): number {
    return Math.max(
      0,
      Math.min(this.normalized.length, Math.trunc(offset) || 0),
    );
  }

  private at(line: number, column: number): number {
    const index = Math.max(0, Math.trunc(line - 1) || 0);
    const start = this.lineStarts[index];
    if (start === undefined) return this.normalized.length;
    const end = this.lineStarts[index + 1];
    return Math.min(
      start + Math.max(0, Math.trunc(column - 1) || 0),
      end === undefined ? this.normalized.length : end - 1,
    );
  }

  range(span?: Span): Range {
    let start = span
      ? Number.isFinite(span.start)
        ? this.clamp(span.start!)
        : this.at(span.line, span.column)
      : this.normalized.length;
    // Never bisect an astral character when falling back to a scalar-sized span.
    if (start > 0 && /[\uDC00-\uDFFF]/u.test(this.normalized[start] ?? ""))
      start--;
    let end: number;
    if (Number.isFinite(span?.end)) end = this.clamp(span!.end!);
    else if (Number.isFinite(span?.endLine) && Number.isFinite(span?.endColumn))
      end = this.at(span!.endLine!, span!.endColumn!);
    else
      end =
        start +
        ((this.normalized.codePointAt(start) ?? 0) > 0xffff
          ? 2
          : Number(start < this.normalized.length));
    end = Math.max(start, end);
    return {
      start: this.original.positionAt(this.offsets[start]),
      end: this.original.positionAt(this.offsets[end]),
    };
  }
}
