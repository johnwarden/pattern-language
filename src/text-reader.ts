import { LanguageError } from "./diagnostics.ts";
import { lineSeparator } from "./string-format.ts";
import type { Syntax, TextPart, Span, Field } from "./syntax.ts";
import {
  hasLinePrefix,
  indentBeyond,
  lineIndent,
  stripLinePrefix,
} from "./indent.ts";

const identifier = /^[\p{L}_][\p{L}\p{M}\p{N}_]*/u;
function sourceLocator(source: string): (start: number, end?: number) => Span {
  const lines = [0];
  for (let i = 0; i < source.length; i++)
    if (source[i] === "\n") lines.push(i + 1);
  const row = (offset: number) => {
    let low = 0,
      high = lines.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (lines[middle] <= offset) low = middle;
      else high = middle;
    }
    return low;
  };
  return (start, end = start + 1) => {
    const first = row(start),
      last = row(end);
    return {
      start,
      end,
      line: first + 1,
      column: start - lines[first] + 1,
      endLine: last + 1,
      endColumn: end - lines[last] + 1,
    };
  };
}
export function textSpan(source: string, start: number, end = start + 1): Span {
  return sourceLocator(source)(start, end);
}
const fail = (
  source: string,
  offset: number,
  message: string,
  code = "E_STRING_SYNTAX",
): never => {
  throw new LanguageError(message, textSpan(source, offset), {
    code,
    phase: "parse",
  });
};
interface Content {
  text: string;
  positions: number[];
  end: number;
  escaped: boolean;
  interpolate: boolean;
  held?: boolean;
}

interface TextLayout {
  clauses: Set<string>;
  shareEnd: boolean;
}
function layoutStop(
  remainder: string,
  layout: TextLayout,
): "end" | "clause" | undefined {
  if (/^end[ \t]*(?:#.*)?$/.test(remainder)) return "end";
  const word = remainder.match(identifier);
  if (word && layout.clauses.has(word[0])) return "clause";
}
/** Strip exactly the first content prefix, retaining all non-framing lines. */
function blockText(
  source: string,
  opening: number,
  contentStart: number,
  layout: TextLayout,
): { text: string; positions: number[]; end: number; held?: boolean } {
  const lineStart = source.lastIndexOf("\n", opening - 1) + 1;
  const indentation = lineIndent(source.slice(lineStart, opening));
  const lines: { text: string; start: number }[] = [];
  let cursor = contentStart,
    end = -1,
    held = false;
  while (cursor <= source.length) {
    const newline = source.indexOf("\n", cursor),
      limit = newline < 0 ? source.length : newline;
    const line = source.slice(cursor, limit);
    const remainder = stripLinePrefix(line, indentation);
    const stop = layoutStop(remainder, layout);
    if (stop === "end") {
      end = layout.shareEnd ? cursor : limit;
      held = layout.shareEnd;
      break;
    }
    if (stop === "clause") {
      end = cursor;
      held = true;
      break;
    }
    if (cursor === source.length) break;
    lines.push({ text: line, start: cursor });
    if (newline < 0) break;
    cursor = newline + 1;
  }
  if (end < 0)
    return fail(
      source,
      opening,
      "text block requires an explicit aligned end; EOF does not terminate a quote",
      "E_QUOTE_END",
    );
  if (!lines.length)
    return fail(
      source,
      opening,
      "a text block requires at least one physical content line",
      "E_QUOTE_EMPTY_BLOCK",
    );
  const anchor =
    lines.find((line) => /[^ \t]/.test(line.text)) ??
    lines.find((line) => line.text.length > 0);
  const prefix = anchor ? lineIndent(anchor.text) : indentation + "  ";
  if (anchor && !indentBeyond(prefix, indentation))
    return fail(
      source,
      anchor.start,
      "text content must be indented beyond its opener",
      "E_QUOTE_INDENT",
    );
  let text = "";
  const positions: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (line.text && !hasLinePrefix(line.text, prefix))
      return fail(
        source,
        line.start,
        "text line does not have the required indentation prefix; use aligned end to close the quote",
        "E_QUOTE_INDENT",
      );
    const content = line.text ? stripLinePrefix(line.text, prefix) : "";
    if (index) {
      text += "\n";
      positions.push(line.start - 1);
    }
    text += content;
    for (let i = 0; i < content.length; i++)
      positions.push(line.start + (line.text ? prefix.length : 0) + i);
  }
  positions.push(end);
  return { text, positions, end, held };
}

/** Skip a nested string using the same lexical rules as its containing quote. */
export function holeEnd(source: string, opening: number, nesting = 0): number {
  if (nesting > 128)
    return fail(
      source,
      opening,
      "quotation nesting exceeds 128",
      "E_QUOTE_LIMIT",
    );
  let depth = 1;
  for (let i = opening + 1; i < source.length; i++) {
    if (source[i] === "#") {
      const newline = source.indexOf("\n", i);
      if (newline < 0) break;
      i = newline;
    } else if (source[i] === '"' || source[i] === "'") {
      const interpolate = source[i - 1] === "$";
      const reader =
        source[i] === "'" &&
        /[\p{L}\p{M}\p{N}]/u.test(source[i - (interpolate ? 2 : 1)] ?? "");
      i = readContent(source, i, interpolate, reader, nesting + 1).end - 1;
    } else if (source[i] === "(") depth++;
    else if (source[i] === ")" && --depth === 0) return i;
  }
  return fail(
    source,
    opening,
    "unclosed interpolation: expected )",
    "E_QUOTE_HOLE",
  );
}

function readContent(
  source: string,
  opening: number,
  interpolate: boolean,
  readerRaw: boolean,
  nesting = 0,
  layout: TextLayout = { clauses: new Set(), shareEnd: false },
): Content {
  const delimiter = source[opening],
    escaped = delimiter === '"',
    start = opening + 1;
  if (source[start] === "\n")
    return {
      ...blockText(source, opening, start + 1, layout),
      escaped,
      interpolate,
    };
  if (readerRaw) {
    const newline = source.indexOf("\n", start),
      end = newline < 0 ? source.length : newline;
    const contentStart = source[start] === " " ? start + 1 : start;
    for (let i = contentStart; i < end; i++)
      if (lineSeparator(source[i]))
        return fail(
          source,
          i,
          "inline readers cannot contain a literal line separator; use a block or an escape",
          "E_STRING_LINE",
        );
    return {
      text: source.slice(contentStart, end),
      positions: Array.from(
        { length: end - contentStart + 1 },
        (_, i) => contentStart + i,
      ),
      end,
      escaped: false,
      interpolate,
    };
  }
  let i = start;
  while (i < source.length) {
    const c = source[i];
    if (c === delimiter)
      return {
        text: source.slice(start, i),
        positions: Array.from({ length: i - start + 1 }, (_, n) => start + n),
        end: i + 1,
        escaped,
        interpolate,
      };
    if (lineSeparator(c))
      return fail(
        source,
        i,
        "inline strings cannot contain a literal line separator; use a block or an escape",
        "E_STRING_LINE",
      );
    if (escaped && c === "\\") {
      if (i + 1 >= source.length) break;
      i += 2;
      continue;
    }
    if (interpolate && c === "$") {
      let run = i;
      while (source[run] === "$") run++;
      if (source[run] === "(") {
        i = holeEnd(source, run, nesting + 1) + 1;
        continue;
      }
      i = run;
      continue;
    }
    i++;
  }
  return fail(source, opening, "unterminated string", "E_QUOTE_END");
}

function escape(
  text: string,
  index: number,
  source: string,
  positions: number[],
): [string, number] {
  const code = text[index + 1],
    simple: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      b: "\b",
      f: "\f",
      "0": "\0",
      '"': '"',
      "\\": "\\",
    };
  if (Object.hasOwn(simple, code)) return [simple[code], index + 2];
  const width = ({ x: 2, u: 4, U: 8 } as Record<string, number>)[code];
  const digits = width ? text.slice(index + 2, index + 2 + width) : "";
  if (!width || digits.length !== width || !/^[0-9A-Fa-f]+$/.test(digits))
    return fail(
      source,
      positions[index],
      "invalid escape; use a named escape, \\xHH, \\uHHHH, or \\UHHHHHHHH",
      "E_STRING_ESCAPE",
    );
  const point = parseInt(digits, 16);
  if (
    point > 0x10ffff ||
    (point >= 0xd800 && point <= 0xdfff) ||
    (code === "x" && point > 0x7f)
  )
    return fail(
      source,
      positions[index],
      "escape is not an allowed Unicode scalar (\\x is ASCII only)",
      "E_UNICODE_SCALAR",
    );
  return [String.fromCodePoint(point), index + 2 + width];
}

function locate(
  tree: Syntax,
  positions: number[],
  offset: number,
  location: (start: number, end?: number) => Span,
): Syntax {
  const span = (s?: Span) =>
    s
      ? location(
          positions[offset + (s.start ?? 0)] ?? positions[0],
          positions[offset + (s.end ?? s.start ?? 0)] ?? positions.at(-1)!,
        )
      : undefined;
  const fields = (xs: Field<Syntax>[]) =>
    xs.map((field) => ({
      ...field,
      span: span(field.span),
      value: visit(field.value),
    }));
  function visit(n: Syntax): Syntax {
    switch (n.kind) {
      case "apply":
        return {
          ...n,
          span: span(n.span),
          head: visit(n.head),
          body: fields(n.body),
        };
      case "postfix":
        return {
          ...n,
          span: span(n.span),
          operand: visit(n.operand),
        };
      case "pack":
        return { ...n, span: span(n.span), body: fields(n.body) };
      case "quote":
        return { ...n, span: span(n.span), value: visit(n.value) };
      case "typedQuote":
        return {
          ...n,
          span: span(n.span),
          grammar: visit(n.grammar),
          value: visit(n.value),
        };
      case "template":
        return {
          ...n,
          span: span(n.span),
          reader: n.reader && visit(n.reader),
          parts: n.parts.map((p) =>
            p.kind === "text"
              ? p
              : { ...p, span: span(p.span), value: visit(p.value) },
          ),
        };
      case "block":
        return { ...n, span: span(n.span), lines: n.lines.map(visit) };
      case "sequence":
        return { ...n, span: span(n.span), items: n.items.map(visit) };
      default:
        return { ...n, span: span(n.span) };
    }
  }
  return visit(tree);
}

export function readText(
  source: string,
  opening: number,
  interpolate: boolean,
  readerRaw: boolean,
  parse: (source: string) => Syntax,
  layout: TextLayout = { clauses: new Set(), shareEnd: false },
): { end: number; parts: TextPart[]; held?: boolean } {
  const content = readContent(
    source,
    opening,
    interpolate,
    readerRaw,
    0,
    layout,
  ),
    { text, positions } = content;
  const location = sourceLocator(source);
  const parts: TextPart[] = [];
  let current = "";
  const flush = () => {
    if (current) {
      parts.push({ kind: "text", value: current });
      current = "";
    }
  };
  for (let i = 0; i < text.length;) {
    if (content.escaped && text[i] === "\\") {
      const [value, end] = escape(text, i, source, positions);
      current += value;
      i = end;
      continue;
    }
    if (!interpolate || text[i] !== "$") {
      current += text[i++];
      continue;
    }
    const start = i;
    while (text[i] === "$") i++;
    const dollars = i - start,
      parenthesized = text[i] === "(";
    const name = !parenthesized && text.slice(i).match(identifier);
    if (!parenthesized && !name) {
      if (dollars % 2)
        return fail(
          source,
          positions[start],
          "interpolation requires $name, $(expression), or $$",
          "E_QUOTE_HOLE",
        );
      current += "$".repeat(dollars / 2);
      continue;
    }
    const expressionStart = parenthesized ? i + 1 : i,
      end = parenthesized
        ? holeEnd(text, i)
        : i + (name as RegExpMatchArray)[0].length;
    let value: Syntax;
    try {
      value = locate(
        parse(text.slice(expressionStart, end)),
        positions,
        expressionStart,
        location,
      );
    } catch (error) {
      if (error instanceof LanguageError) {
        const local = error.diagnostic.primary;
        error.diagnostic.primary = location(
          positions[expressionStart + (local?.start ?? 0)] ?? positions[start],
        );
        error.refresh();
      }
      throw error;
    }
    if (dollars > 33)
      return fail(
        source,
        positions[start],
        "quote protection depth exceeds 32",
        "E_QUOTE_STAGE_LIMIT",
      );
    flush();
    parts.push({
      kind: "hole",
      value,
      protection: dollars - 1,
      spelling:
        dollars > 1
          ? "$".repeat(dollars - 1) + text.slice(i, end + Number(parenthesized))
          : undefined,
      span: location(
        positions[start],
        positions[Math.min(end + Number(parenthesized), positions.length - 1)],
      ),
    });
    i = end + Number(parenthesized);
  }
  flush();
  if (!parts.length) parts.push({ kind: "text", value: "" });
  return { end: content.end, parts, held: content.held };
}
