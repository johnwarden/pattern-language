import { attachSource } from "./diagnostics.ts";
import { readText } from "./text-reader.ts";
import { scalarText } from "./string-format.ts";
import { LanguageError, symbol, apply, fields, packOf } from "./syntax.ts";
import type { Syntax, Field, Span } from "./syntax.ts";
import {
  punctuation,
  punctuationEnd,
  identifierName,
  labelName,
} from "./lexical.ts";
interface SurfaceOptions {
  /** Inert specification reading only; execution always uses the ordinary reader. */
  specification?: boolean;
}
interface Token extends Span {
  kind: string;
  text: string;
  start: number;
  end: number;
  quoted?: boolean;
  block?: Syntax;
  textNode?: Syntax;
  interpolate?: boolean;
}
const identifier = /^[\p{L}_][\p{L}\p{M}\p{N}_]*/u;
/** Source conventions are applied once, before any tokens or literal values exist. */
function normalizeSource(source: string): string {
  if (source.length > 100000)
    throw new LanguageError("source exceeds 100000 characters");
  return scalarText(source)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
}
export function tokenize(source: string): Token[] {
  return scan(normalizeSource(source));
}
function scan(source: string, options: SurfaceOptions = {}): Token[] {
  const out: Token[] = [];
  let i = 0,
    line = 1,
    column = 1;
  while (i < source.length) {
    const c = source[i];
    if (c === " " || c === "\r") {
      i++;
      column++;
      continue;
    }
    if (c === "\t")
      throw new LanguageError("use spaces for indentation", { line, column });
    if (c === "\n") {
      out.push({ kind: "newline", text: c, start: i, end: ++i, line, column });
      line++;
      column = 1;
      continue;
    }
    if (c === "#") {
      while (i < source.length && source[i] !== "\n") {
        i++;
        column++;
      }
      continue;
    }
    const start = i,
      span = { line, column };
    let kind = "",
      text = "",
      quoted = false;
    let m: RegExpMatchArray | null;
    if (source.startsWith("...", i)) {
      i += 3;
      kind = "spread";
      text = "…";
    } else if (c === "…") {
      i++;
      kind = "spread";
      text = "…";
    } else if (c === "`" || (c === "$" && source[i + 1] === "`")) {
      if (out.at(-1)?.kind !== "name" || out.at(-1)?.end !== i)
        throw new LanguageError(
          "typed quotation requires a tight type name, such as Code` expression",
          span,
        );
      i += c === "$" ? 2 : 1;
      kind = "typedQuote";
      text = c === "$" ? "$`" : "`";
    } else if (
      ["'", '\"'].includes(c) ||
      (c === "$" && ["'", '\"'].includes(source[i + 1]))
    ) {
      const interpolate = c === "$",
        opening = i + Number(interpolate);
      const reader = out.at(-1)?.kind === "name" && out.at(-1)?.end === i;
      const read = readText(
        source,
        opening,
        interpolate,
        !!reader && source[opening] === "'",
        (text) => expressionFromNormalized(text, true),
      );
      i = read.end;
      kind = reader ? "readerText" : "string";
      text = source.slice(start, i);
      const node: Syntax =
        reader || read.parts.some((part) => part.kind === "hole")
          ? { kind: "template", parts: read.parts }
          : {
              kind: "literal",
              value: read.parts
                .map((part) => (part.kind === "text" ? part.value : ""))
                .join(""),
            };
      const consumed = source.slice(start, i).split("\n");
      if (consumed.length > 1) {
        line += consumed.length - 1;
        column = consumed.at(-1)!.length + 1;
      } else column += i - start;
      out.push({
        kind,
        text,
        start,
        end: i,
        ...span,
        endLine: line,
        endColumn: column,
        textNode: node,
      });
      continue;
    } else if (options.specification && /[<>]/.test(c)) {
      i++;
      kind = "op";
      text = c;
    } else if (
      options.specification &&
      /^(?:0[fFxXbB]|[0-9][0-9_]*_)/.test(source.slice(i))
    ) {
      const digits = "[0-9](?:_?[0-9])*";
      const hex = "[0-9a-fA-F](?:_?[0-9a-fA-F])*";
      const bits = "[01](?:_?[01])*";
      const decimal =
        digits + "(?:\\." + digits + ")?(?:[eE][+-]?" + digits + ")?";
      const spelling = source
        .slice(i)
        .match(
          new RegExp(
            "^(?:0[fF]" +
              decimal +
              "|0[xX]" +
              hex +
              "(?:\\." +
              hex +
              ")?(?:[pP][+-]?" +
              digits +
              ")?|0[bB]" +
              bits +
              "(?:\\." +
              bits +
              ")?(?:[pP][+-]?" +
              digits +
              ")?|" +
              decimal +
              ")",
          ),
        );
      if (
        !spelling ||
        /[\p{L}\p{N}_]/u.test(source[i + spelling[0].length] ?? "")
      )
        throw new LanguageError("malformed numeric source literal", span);
      text = spelling[0];
      i += text.length;
      kind = "numberSource";
    } else if ("()[]{},.".includes(c)) {
      i++;
      kind = c;
      text = c;
    } else if (source.startsWith("::", i)) {
      quoted = source.startsWith(":::", i);
      i += quoted ? 3 : 2;
      kind = "op";
      text = "::";
    } else if (c === ":") {
      const prev = out.at(-1),
        after = prev?.kind === "name" && prev.end === i;
      m = source.slice(i + 1).match(identifier);
      if (!after && ["[]", "{}"].includes(source.slice(i + 1, i + 3))) {
        text = source.slice(i + 1, i + 3);
        i += 3;
        kind = "name";
        quoted = true;
      } else if (!after && m) {
        text = m[0];
        i += text.length + 1;
        kind = "name";
        quoted = true;
      } else if (!after && punctuation.has(source[i + 1])) {
        i++;
        i = punctuationEnd(source, i, true);
        text = source.slice(start + 1, i);
        kind = "op";
        quoted = true;
      } else {
        i++;
        kind = ":";
        text = ":";
      }
    } else if ((m = source.slice(i).match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/))) {
      text = m[0];
      i += text.length;
      kind = "number";
    } else if ((m = source.slice(i).match(identifier))) {
      text = m[0];
      i += text.length;
      kind = "name";
    } else if (punctuation.has(c)) {
      i = punctuationEnd(source, i);
      text = source.slice(start, i);
      kind = "op";
    } else
      throw new LanguageError(
        "unexpected character " + JSON.stringify(c),
        span,
      );
    if (kind === "name") text = text.normalize("NFC");
    if (kind === "name" && !identifierName(text))
      throw new LanguageError(
        "identifiers require strict camelCase or TitleCase; acronyms and underscores are not allowed",
        span,
      );
    const consumed = source.slice(start, i).split("\n");
    if (consumed.length > 1) {
      line += consumed.length - 1;
      column = consumed.at(-1)!.length + 1;
    } else column += i - start;
    out.push({
      kind,
      text,
      start,
      end: i,
      ...span,
      endLine: line,
      endColumn: column,
      quoted,
    });
  }
  // Reserve balanced tight angle suffixes before coalescing prefix punctuation.
  const reserved = new Set<number>();
  out.forEach((t, k) => {
    if (t.text !== "<" || t.quoted || !k || out[k - 1].end !== t.start) return;
    let depth = 0;
    const angles: number[] = [];
    for (let j = k; j < out.length; j++) {
      const x = out[j];
      if (x.kind === "newline") break;
      if (x.quoted) continue;
      if (x.text === "<") {
        depth++;
        angles.push(j);
      } else if (x.text === ">") {
        angles.push(j);
        if (--depth === 0) {
          angles.forEach((v) => reserved.add(v));
          break;
        }
      }
    }
  });
  const result: Token[] = [];
  out.forEach((t, k) => {
    const p = result.at(-1);
    if (
      p &&
      p.kind === "op" &&
      t.kind === "op" &&
      !p.quoted &&
      !t.quoted &&
      p.end === t.start &&
      !reserved.has(k) &&
      !reserved.has(k - 1)
    ) {
      p.text += t.text;
      p.end = t.end;
    } else result.push({ ...t });
  });
  return result;
}
class Reader {
  tokens: Token[];
  pos = 0;
  private options: SurfaceOptions;
  constructor(tokens: Token[], options: SurfaceOptions = {}) {
    this.tokens = tokens;
    this.options = options;
  }
  peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }
  take(): Token {
    const t = this.peek();
    if (!t)
      throw new LanguageError("unexpected end of input", this.tokens.at(-1));
    this.pos++;
    return t;
  }
  stop(stops: Set<string>): boolean {
    const t = this.peek();
    return !t || (!t.quoted && stops.has(t.text));
  }
  sequence(stops = new Set<string>()): Syntax {
    const items: Syntax[] = [];
    while (!this.stop(stops)) items.push(this.expression(stops));
    return { kind: "sequence", items, span: items[0]?.span };
  }
  expression(stops: Set<string>): Syntax {
    const start = this.peek();
    const n = this.expressionBody(stops);
    const end = this.tokens[this.pos - 1];
    if (start && end)
      n.span = {
        line: start.line,
        column: start.column,
        start: start.start,
        end: end.end,
        endLine: end.endLine ?? end.line,
        endColumn: end.endColumn ?? end.column + end.text.length,
      };
    return n;
  }
  expressionBody(stops: Set<string>): Syntax {
    const left = this.postfix(stops),
      t = this.peek();
    if (this.stop(stops) || !t) return left;
    if (t.kind === "op" && t.text === "$" && this.peek(1)?.start === t.end)
      return left;
    if (t.kind === "op" || t.kind === ".") {
      const prev = this.tokens[this.pos - 1];
      if (prev.end === t.start)
        throw new LanguageError(
          "infix operators require spaces on both sides",
          t,
        );
      this.take();
      let name = t;
      if (t.kind === ".") {
        name = this.take();
        if (name.kind !== "name" || name.start !== t.end)
          throw new LanguageError("expected .name", name);
      }
      const rhs = this.peek();
      if (!rhs || name.end === rhs.start)
        throw new LanguageError(
          "infix operators require spaces on both sides",
          name,
        );
      return {
        ...apply(
          apply(symbol(name.text, !!name.quoted), packOf(left)),
          packOf(this.expression(stops)),
        ),
        span: left.span,
      };
    }
    return left;
  }
  postfix(stops: Set<string>): Syntax {
    const first = this.peek()!;
    let n = this.atom(stops);
    while (!this.stop(stops)) {
      const t = this.peek()!,
        tight = this.tokens[this.pos - 1].end === t.start;
      if (!tight) break;
      if (this.options.specification && t.kind === "op" && t.text === "<") {
        this.take();
        n = { ...apply(n, this.arguments(">")), span: n.span };
      } else if (t.kind === "(") {
        this.take();
        n = { ...apply(n, this.arguments(")")), span: n.span };
      } else if (t.kind === ".") {
        this.take();
        const name = this.take();
        if (name.kind !== "name" || name.start !== t.end)
          throw new LanguageError("expected .name", name);
        n = {
          ...apply(symbol(name.text, !!name.quoted), packOf(n)),
          span: n.span,
        };
      } else if (t.kind === "spread") {
        this.take();
        n = { ...apply(symbol("…"), packOf(n)), span: n.span };
      } else if (
        t.kind === "op" &&
        !t.quoted &&
        /^[?*!^]+$/.test(t.text) &&
        this.suffixBoundary()
      ) {
        this.take();
        for (const c of t.text)
          n = {
            kind: "apply",
            head: symbol(c),
            body: packOf(n),
            span: n.span,
          };
      } else break;
    }
    const end = this.tokens[this.pos - 1];
    if (n.span && end)
      n.span = {
        ...n.span,
        line: first.line,
        column: first.column,
        start: first.start,
        end: end.end,
        endLine: end.endLine ?? end.line,
        endColumn: end.endColumn ?? end.column + end.text.length,
      };
    return n;
  }
  suffixBoundary(): boolean {
    const t = this.peek()!,
      n = this.peek(1);
    return (
      !n || t.end < n.start || [",", ")", "]", "}", ".", "("].includes(n.kind)
    );
  }
  atom(stops: Set<string>): Syntax {
    const t = this.take(),
      span = {
        line: t.line,
        column: t.column,
        start: t.start,
        end: t.end,
        endLine: t.endLine,
        endColumn: t.endColumn,
      };
    if (t.kind === "name" && !t.quoted && this.peek()?.kind === "readerText") {
      const raw = this.take(),
        node = raw.textNode!;
      if (node.kind !== "template") throw new Error("reader template expected");
      return { ...node, reader: { ...symbol(t.text), span }, span };
    }
    if (t.kind === "name" && !t.quoted && this.peek()?.kind === "typedQuote") {
      const opener = this.take();
      const content = this.sequence(stops);
      if (content.kind !== "sequence" || !content.items.length)
        throw new LanguageError(
          "typed quotation requires an expression or block",
          span,
        );
      const value = content.items.length === 1 ? content.items[0] : content;
      return {
        kind: "typedQuote",
        grammar: symbol(t.text),
        interpolate: opener.text === "$`",
        value,
        span,
      };
    }
    if (t.kind === ":") {
      if (
        this.options.specification &&
        ["number", "numberSource"].includes(this.peek()?.kind ?? "")
      )
        return { kind: "quote", value: this.atom(stops), span };
      if (this.peek()?.kind !== "(")
        throw new LanguageError("quotation requires :(expression)", span);
      return { kind: "quote", value: this.atom(stops), span };
    }
    if (t.kind === "name") return { ...symbol(t.text, !!t.quoted), span };
    if (t.kind === "numberSource")
      return {
        ...apply(symbol("NumericSource", true), [
          { label: "_1", value: { kind: "literal", value: t.text } },
        ]),
        span,
      };
    if (t.kind === "number") {
      const value = Number(t.text);
      if (
        !Number.isFinite(value) ||
        (Number.isInteger(value) && !Number.isSafeInteger(value))
      )
        throw new LanguageError("number exceeds safe numeric range", t);
      return { kind: "literal", value, span };
    }
    if (t.kind === "string") return { ...t.textNode!, span };
    if (t.kind === "(") {
      const body = this.arguments(")");
      return body.length === 1 && body[0].label === "_1"
        ? body[0].value
        : { kind: "pack", body, span };
    }
    if (t.kind === "[" || t.kind === "{") {
      const close = t.kind === "[" ? "]" : "}";
      return { ...apply(symbol(t.kind + close), this.arguments(close)), span };
    }
    if (t.kind === "block") return t.block!;
    if (t.kind === "op" || t.kind === "spread") {
      const next = this.peek();
      if (t.quoted || (next && next.start === t.end && next.kind === "("))
        return { ...symbol(t.text, !!t.quoted), span };
      if (this.stop(stops)) return { ...symbol(t.text, !!t.quoted), span };
      return { ...apply(symbol(t.text), packOf(this.postfix(stops))), span };
    }
    throw new LanguageError("unexpected token " + t.text, t);
  }
  arguments(close: string): Field<Syntax>[] {
    const result: Field<Syntax>[] = [];
    if (this.peek()?.text === close && !this.peek()?.quoted) {
      this.take();
      return result;
    }
    while (true) {
      const fieldStart = this.peek();
      let label = "_" + (result.length + 1);
      let keywordRest = false;
      if (
        this.options.specification &&
        this.peek()?.kind === "name" &&
        this.peek(1)?.text === "**" &&
        this.peek(2)?.kind === ":" &&
        this.peek()!.end === this.peek(1)!.start &&
        this.peek(1)!.end === this.peek(2)!.start
      ) {
        label = this.take().text;
        this.take();
        this.take();
        keywordRest = true;
      }
      if (
        this.peek()?.kind === "name" &&
        !this.peek()?.quoted &&
        this.peek(1)?.kind === ":" &&
        this.peek()!.end === this.peek(1)!.start
      ) {
        const token = this.take();
        label = token.text;
        if (!labelName(label))
          throw new LanguageError(
            "labels must be lowercase camelCase names",
            token,
          );
        this.take();
      }
      const seq = this.sequence(new Set([",", close]));
      if (seq.kind !== "sequence" || !seq.items.length)
        throw new LanguageError("expected an argument", this.peek());
      const rawValue = seq.items.length === 1 ? seq.items[0] : seq;
      const value = keywordRest
        ? apply(symbol("KeywordRest", true), [{ label: "_1", value: rawValue }])
        : rawValue;
      if (value.kind === "symbol" && !value.quoted && value.name === "**") {
        if (!/^_\d+$/.test(label))
          throw new LanguageError(
            "** must be a standalone labeled-rest marker",
            fieldStart,
          );
        label = "**";
      }
      result.push({
        label,
        span: fieldStart
          ? {
              line: fieldStart.line,
              column: fieldStart.column,
              start: fieldStart.start,
              end: fieldStart.end,
              endLine: fieldStart.endLine,
              endColumn: fieldStart.endColumn,
            }
          : undefined,
        value,
      });
      const t = this.take();
      if (t.text === close && !t.quoted) break;
      if (t.text !== "," || t.quoted)
        throw new LanguageError("expected comma or " + close, t);
      if (this.peek()?.text === close && !this.peek()?.quoted) {
        this.take();
        break;
      }
    }
    return fields(result);
  }
}
function layout(
  tokens: Token[],
  topLevel = true,
  options: SurfaceOptions = {},
): Syntax {
  const lines: { indent: number; tokens: Token[] }[] = [];
  let current: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.kind === "newline") {
      if (!stack.length && current.length) {
        lines.push({ indent: current[0].column - 1, tokens: current });
        current = [];
      }
      continue;
    }
    if (["(", "[", "{"].includes(t.kind)) stack.push(t);
    else if ([")", "]", "}"].includes(t.kind)) {
      const open = stack.pop();
      if (
        !open ||
        ({ "(": ")", "[": "]", "{": "}" } as Record<string, string>)[
          open.kind
        ] !== t.kind
      )
        throw new LanguageError("unmatched closing delimiter", t);
    }
    current.push(t);
  }
  if (stack.length) throw new LanguageError("unclosed delimiter", stack.at(-1));
  if (current.length)
    lines.push({ indent: current[0].column - 1, tokens: current });
  if (topLevel && lines.length && lines[0].indent !== 0)
    throw new LanguageError(
      "top-level code must start at column 1",
      lines[0].tokens[0],
    );
  function region(start: number, indent: number): [Syntax[], number] {
    const result: Syntax[] = [];
    let i = start,
      hadBlock = false;
    while (i < lines.length) {
      let { indent: level, tokens: ts } = lines[i];
      if (level < indent) break;
      if (level > indent)
        throw new LanguageError("inconsistent indentation", ts[0]);
      if (
        ts.length === 1 &&
        ts[0].kind === "name" &&
        ts[0].text === "end" &&
        !ts[0].quoted
      ) {
        if (!hadBlock)
          throw new LanguageError("end has no preceding block", ts[0]);
        i++;
        hadBlock = false;
        continue;
      }
      i++;
      let block: Syntax | undefined;
      if (i < lines.length && lines[i].indent > indent) {
        const [body, next] = region(i, lines[i].indent);
        if (
          topLevel &&
          ts.at(-1)?.kind === "typedQuote" &&
          !(
            lines[next]?.indent === indent &&
            lines[next].tokens.length === 1 &&
            lines[next].tokens[0].text === "end" &&
            !lines[next].tokens[0].quoted
          )
        )
          throw new LanguageError(
            "an indented typed quote requires an explicit aligned end",
            ts.at(-1),
            { code: "E_QUOTE_END", phase: "parse" },
          );
        const opening = ts.at(-1)!,
          closing = lines[next]?.tokens[0],
          last = tokens.at(-1)!;
        const span = {
          start: opening.end,
          end: closing ? closing.start - closing.column + 1 : last.end,
          line: opening.endLine ?? opening.line,
          column: opening.endColumn ?? opening.column,
          endLine: closing?.line ?? last.endLine ?? last.line,
          endColumn: closing ? 1 : (last.endColumn ?? last.column),
        };
        i = next;
        block = { kind: "block", lines: body, span };
        hadBlock = true;
      }
      if (
        block &&
        ["op", "typedQuote"].includes(ts.at(-1)!.kind) &&
        !ts.at(-1)!.quoted
      ) {
        const last = ts.at(-1)!;
        ts = ts.concat([
          {
            kind: "block",
            text: "",
            start: last.end + 1,
            end: last.end + 2,
            line: last.line + 1,
            column: indent + 3,
            block,
          },
        ]);
        block = undefined;
      }
      let depth = 0;
      const commaRow = ts.some((token) => {
        if (["(", "[", "{"].includes(token.kind)) depth++;
        if ([")", "]", "}"].includes(token.kind)) depth--;
        return token.kind === "," && depth === 0;
      });
      const seq: Syntax = commaRow
        ? {
            kind: "sequence",
            items: [
              {
                kind: "pack",
                body: new Reader(
                  [
                    ...ts,
                    {
                      ...ts.at(-1)!,
                      kind: "rowEnd",
                      text: "rowEnd",
                      quoted: false,
                    },
                  ],
                  options,
                ).arguments("rowEnd"),
              },
            ],
            span: ts[0]?.block?.span ?? ts[0],
          }
        : new Reader(ts, options).sequence();
      if (seq.kind === "sequence" && block) seq.items.push(block);
      result.push(seq);
    }
    return [result, i];
  }
  const [body, consumed] = region(0, topLevel ? 0 : (lines[0]?.indent ?? 0));
  if (consumed !== lines.length)
    throw new LanguageError(
      "inconsistent indentation: unconsumed lines in grouped block",
      lines[consumed].tokens[0],
    );
  return { kind: "block", lines: body };
}
/** Parenthesized layout blocks are handled at the surface stage, including inside calls. */
function groups(tokens: Token[], options: SurfaceOptions = {}): Token[] {
  const result: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const open = tokens[i];
    if (!["(", "[", "{"].includes(open.kind)) {
      result.push(open);
      continue;
    }
    let depth = 1,
      j = i + 1;
    for (; j < tokens.length; j++) {
      if (["(", "[", "{"].includes(tokens[j].kind)) depth++;
      else if ([")", "]", "}"].includes(tokens[j].kind) && --depth === 0) break;
    }
    if (depth) throw new LanguageError("unclosed delimiter", open);
    const content = groups(tokens.slice(i + 1, j), options),
      close = tokens[j];
    let level = 0,
      rowBreak = false,
      commaContinuation = false;
    for (let k = 0; k < content.length; k++) {
      const token = content[k];
      if (["(", "[", "{"].includes(token.kind)) level++;
      else if ([")", "]", "}"].includes(token.kind)) level--;
      else if (!level && token.kind === "newline") {
        const before = content
          .slice(0, k)
          .findLast((t) => t.kind !== "newline");
        const after = content.slice(k + 1).find((t) => t.kind !== "newline");
        if (before && after) {
          if (before.kind === ",") commaContinuation = true;
          else rowBreak = true;
        }
      }
    }
    const vertical =
      content[0]?.kind === "newline" && (rowBreak || !commaContinuation);
    if (vertical) {
      const block = layout(content, false, options);
      block.span = {
        line: open.line,
        column: open.column,
        start: open.start,
        end: close.end,
        endLine: close.endLine,
        endColumn: close.endColumn,
      };
      result.push(
        open,
        {
          kind: "block",
          text: "",
          start: open.end,
          end: close.start,
          line: open.line + 1,
          column: open.column + 2,
          block,
        },
        close,
      );
    } else result.push(open, ...content, close);
    i = j;
  }
  return result;
}
export function parseSurface(source: string, sourceName = "program"): Syntax {
  return readSurface(source, sourceName);
}
/** Source-only reader for future specifications, not executable Code.
 * Numeric spellings remain inert NumericSource data; angles are structural packs.
 * The test runner reparses active operands with the ordinary language reader.
 */
export function parseTestSource(
  source: string,
  sourceName = "test file",
): Syntax {
  return readSurface(source, sourceName, { specification: true });
}
function readSurface(
  source: string,
  sourceName: string,
  options: SurfaceOptions = {},
): Syntax {
  source = normalizeSource(source);
  const document = { name: sourceName, text: source };
  try {
    const root = layout(groups(scan(source, options), options), true, options);
    const visit = (n: Syntax) => {
      if (n.span) attachSource(n.span, document);
      if (n.kind === "apply") visit(n.head);
      if (n.kind === "apply" || n.kind === "pack")
        for (const e of n.body) {
          if (e.span) attachSource(e.span, document);
          visit(e.value);
        }
      if (n.kind === "template") {
        if (n.reader) visit(n.reader);
        for (const part of n.parts)
          if (part.kind === "hole") {
            if (part.span) attachSource(part.span, document);
            visit(part.value);
          }
      }
      if (n.kind === "quote") visit(n.value);
      if (n.kind === "typedQuote") {
        visit(n.grammar);
        visit(n.value);
      }
      if (n.kind === "block") n.lines.forEach(visit);
      if (n.kind === "sequence") n.items.forEach(visit);
    };
    visit(root);
    return root;
  } catch (error) {
    if (error instanceof LanguageError) {
      error.diagnostic.phase = "parse";
      if (error.diagnostic.code === "E_LANGUAGE")
        error.diagnostic.code = "E_SYNTAX";
      if (error.diagnostic.primary)
        attachSource(error.diagnostic.primary, document);
    }
    throw error;
  }
}
export function parseExpression(source: string, sidefix = false): Syntax {
  return expressionFromNormalized(normalizeSource(source), sidefix);
}
function expressionFromNormalized(source: string, sidefix = false): Syntax {
  const seq = new Reader(
    groups(scan(source)).filter((t) => t.kind !== "newline"),
  ).sequence();
  if (
    seq.kind !== "sequence" ||
    !seq.items.length ||
    (!sidefix && seq.items.length !== 1)
  )
    throw new LanguageError("expected one expression");
  return seq.items.length === 1 ? seq.items[0] : seq;
}
