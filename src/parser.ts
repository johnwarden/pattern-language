import { attachSource } from "./diagnostics.ts";
import { readText } from "./text-reader.ts";
import { scalarText } from "./string-format.ts";
import {
  LanguageError,
  symbol,
  apply,
  fields,
  packOf,
  isName,
  postfix,
  POSTFIX_SUFFIX,
} from "./syntax.ts";
import {
  matchNumericSource,
  parseNumericSpelling,
  syntaxNumber,
} from "./rational.ts";
import type { Syntax, Field, Span } from "./syntax.ts";
import {
  punctuation,
  punctuationEnd,
  identifierName,
  labelName,
  isCommentStart,
} from "./lexical.ts";
import {
  INFIX_GROUPING_CODE,
  parenthesesRequiredMessage,
  requiresParentheses,
} from "./infix-grouping.ts";
import { indentRelation, lineIndent } from "./indent.ts";
/** Start keyword -> extra clause keywords. `chains` are quoted keyword sequences from the same grammar. */
export type LayoutForms = Map<string, Set<string>> & {
  chains?: Map<string, string[][]>;
  /** True when the expected type is a syntax-shaped block/sequence grammar. */
  structural?: boolean;
};
export interface ParseSurfaceOptions {
  /** Inert specification reading only; execution always uses the ordinary reader. */
  specification?: boolean;
  /** Sidefix start keyword -> additional clause keywords from the active grammar. */
  layoutForms?: LayoutForms;
}
export function emptyLayoutForms(): LayoutForms {
  const forms = new Map() as LayoutForms;
  forms.chains = new Map();
  return forms;
}
function addLayoutChain(
  forms: LayoutForms,
  start: string,
  chain: string[],
): void {
  const chains = (forms.chains ??= new Map<string, string[][]>());
  const found = chains.get(start) ?? [];
  if (!found.some((existing) => existing.join("\0") === chain.join("\0")))
    found.push(chain);
  chains.set(start, found);
}
function formKeywords(
  names: string[],
  start: string,
  clauses: Set<string>,
): string[] {
  return names.filter((name) => name === start || clauses.has(name));
}
function formComplete(seen: string[], chains: string[][] | undefined): boolean {
  return !!chains?.some(
    (chain) =>
      chain.length === seen.length &&
      chain.every((keyword, index) => keyword === seen[index]),
  );
}
type SurfaceOptions = ParseSurfaceOptions;
type SurfaceParseContext = SurfaceOptions & { source?: string };
function quotedLayoutNames(n: Syntax): string[] {
  switch (n.kind) {
    case "symbol":
      return n.quoted ? [n.name] : [];
    case "sequence":
      return n.items.flatMap(quotedLayoutNames);
    case "pack":
      return n.body.flatMap((field) => quotedLayoutNames(field.value));
    case "apply":
      return [
        ...quotedLayoutNames(n.head),
        ...n.body.flatMap((field) => quotedLayoutNames(field.value)),
      ];
    case "postfix":
      return quotedLayoutNames(n.operand);
    case "quote":
      return quotedLayoutNames(n.value);
    case "block":
      return n.lines.flatMap(quotedLayoutNames);
    default:
      return [];
  }
}
export function addLayoutKeywords(
  forms: LayoutForms,
  keywords: string[],
): void {
  if (!keywords.length) return;
  const [start, ...clauses] = keywords;
  let set = forms.get(start);
  if (!set) {
    set = new Set();
    forms.set(start, set);
  }
  for (const clause of clauses) set.add(clause);
  addLayoutChain(forms, start, keywords);
}
export function addLayoutForm(forms: LayoutForms, items: Syntax[]): void {
  addLayoutKeywords(forms, items.flatMap(quotedLayoutNames));
}
export function layoutFormsFromBlock(root: Syntax): LayoutForms {
  const forms = emptyLayoutForms();
  if (root.kind !== "block") return forms;
  for (const line of root.lines) {
    const items = line.kind === "sequence" ? line.items : [line];
    if (
      items.length < 4 ||
      !isName(items[0], "def") ||
      !isName(items[2], "type")
    )
      continue;
    addLayoutForm(forms, items.slice(3));
  }
  return forms;
}
export function mergeLayoutForms(
  left: LayoutForms,
  right: LayoutForms,
): LayoutForms {
  const forms = emptyLayoutForms();
  for (const source of [left, right]) {
    for (const [start, clauses] of source) {
      let set = forms.get(start);
      if (!set) {
        set = new Set();
        forms.set(start, set);
      }
      for (const clause of clauses) set.add(clause);
    }
    for (const [start, chains] of source.chains ?? [])
      for (const chain of chains) addLayoutChain(forms, start, chain);
    if (source.structural) forms.structural = true;
  }
  return forms;
}
function owningForm(
  names: string[],
  forms: LayoutForms | undefined,
): { start: string; clauses: Set<string> } | undefined {
  if (!forms?.size) return;
  for (const name of names) {
    const clauses = forms.get(name);
    if (clauses) return { start: name, clauses };
  }
  for (const [start, clauses] of forms)
    if (names.some((name) => clauses.has(name))) return { start, clauses };
}
function owningClauses(
  names: string[],
  forms: LayoutForms | undefined,
): Set<string> | undefined {
  const form = owningForm(names, forms);
  return form ? new Set(form.clauses) : undefined;
}
/** Start or clause keyword from the active surface grammar, not a hardcoded list. */
function isLayoutKeyword(
  name: string,
  forms: LayoutForms | undefined,
): boolean {
  if (!forms?.size) return false;
  if (forms.has(name)) return true;
  for (const clauses of forms.values()) if (clauses.has(name)) return true;
  return false;
}
function unquotedNames(tokens: Token[]): string[] {
  return tokens
    .filter((token) => token.kind === "name" && !token.quoted)
    .map((token) => token.text);
}
function unquotedNamesSinceNewline(out: Token[]): string[] {
  const names: string[] = [];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].kind === "newline") break;
    if (out[i].kind === "name" && !out[i].quoted) names.unshift(out[i].text);
  }
  return names;
}
function isEndLine(ts: Token[]): boolean {
  return (
    ts.length === 1 &&
    ts[0].kind === "name" &&
    ts[0].text === "end" &&
    !ts[0].quoted
  );
}
function blockEndError(span?: Span, here?: Span): never {
  throw new LanguageError(
    "an indented block requires an explicit aligned end",
    span,
    {
      code: "E_BLOCK_END",
      phase: "parse",
      related: here
        ? [{ message: "expected an aligned end before this line", span: here }]
        : [],
    },
  );
}
function extraEndError(span: Span): never {
  throw new LanguageError("end does not close a completed form", span, {
    code: "E_UNEXPECTED_END",
    phase: "parse",
  });
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
  layoutHold?: boolean;
  indentPrefix?: string;
}
function tokenIndent(source: string, start: number): string {
  return lineIndent(
    source.slice(source.lastIndexOf("\n", start - 1) + 1, start),
  );
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
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      column++;
      continue;
    }
    if (c === "\n") {
      out.push({ kind: "newline", text: c, start: i, end: ++i, line, column });
      line++;
      column = 1;
      continue;
    }
    if (isCommentStart(source, i)) {
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
    const numeric =
      c === "(" || /[0-9]/.test(c) ? matchNumericSource(source, i) : undefined;
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
      const owner = owningClauses(
        unquotedNamesSinceNewline(out),
        options.layoutForms,
      );
      const read = readText(
        source,
        opening,
        interpolate,
        !!reader && source[opening] === "'",
        (text) => expressionFromNormalized(text, true),
        {
          clauses: owner ?? new Set(),
          shareEnd: owner !== undefined,
        },
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
        layoutHold: read.held,
        indentPrefix: tokenIndent(source, start),
      });
      if (read.held && i > 0 && source[i - 1] === "\n")
        out.push({
          kind: "newline",
          text: "\n",
          start: i - 1,
          end: i,
          line: line - 1,
          column: 1,
        });
      continue;
    } else if (options.specification && /[<>]/.test(c)) {
      i++;
      kind = "op";
      text = c;
    } else if (numeric) {
      text = numeric;
      i += text.length;
      if (/[\p{L}\p{N}_]/u.test(source[i] ?? ""))
        throw new LanguageError("malformed numeric source literal", span);
      kind =
        c === "("
          ? "fraction"
          : /^(?:0[fFxXbB])|_/.test(text)
            ? "numberSource"
            : "number";
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
        "word symbols require ASCII lowerCamel, UpperCamel, or UPPER_SNAKE (one- and two-letter upper-snake words need a trailing underscore)",
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
      indentPrefix: tokenIndent(source, start),
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
  private options: SurfaceParseContext;
  private source: string;
  constructor(tokens: Token[], options: SurfaceParseContext = {}) {
    this.tokens = tokens;
    this.options = options;
    this.source = options.source ?? "";
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
    while (!this.stop(stops)) {
      const startPos = this.pos;
      const start = this.peek();
      const prev = items.at(-1);
      const n = this.expression(stops);
      if (
        prev &&
        this.isKeywordTerm(prev) &&
        start?.kind === "(" &&
        startPos > 0 &&
        this.tokens[startPos - 1]!.end !== start.start &&
        this.whollyParenthesized(startPos, this.pos - 1)
      )
        throw new LanguageError(
          "a keyword operand cannot be a single parenthesized group; write the operand without wrapping parentheses, or continue after the group",
          start,
        );
      items.push(n);
    }
    return { kind: "sequence", items, span: items[0]?.span };
  }
  private isKeywordTerm(n: Syntax): boolean {
    return (
      n.kind === "symbol" &&
      !n.quoted &&
      isLayoutKeyword(n.name, this.options.layoutForms)
    );
  }
  /** True when tokens [from, to] are exactly one outer `(...)` group. */
  private whollyParenthesized(from: number, to: number): boolean {
    if (from > to) return false;
    if (this.tokens[from]?.kind !== "(" || this.tokens[to]?.kind !== ")")
      return false;
    let depth = 0;
    for (let i = from; i <= to; i++) {
      const kind = this.tokens[i]!.kind;
      if (kind === "(") depth++;
      else if (kind === ")") {
        depth--;
        if (depth < 0) return false;
        if (depth === 0) return i === to;
      }
    }
    return false;
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
    const operands: Syntax[] = [this.postfix(stops)];
    const operators: {
      text: string;
      display: string;
      quoted: boolean;
      span: Span;
    }[] = [];
    while (!this.stop(stops)) {
      const t = this.peek();
      if (!t) break;
      if (t.kind === "op" && t.text === "$" && this.peek(1)?.start === t.end)
        break;
      if (t.kind !== "op" && t.kind !== ".") break;
      const prev = this.tokens[this.pos - 1];
      if (prev.end === t.start)
        throw new LanguageError(
          "infix operators require spaces on both sides",
          t,
        );
      this.take();
      let name = t;
      let display = t.text;
      if (t.kind === ".") {
        name = this.take();
        if (name.kind !== "name" || name.start !== t.end)
          throw new LanguageError("expected .name", name);
        display = "." + name.text;
      }
      const rhs = this.peek();
      if (!rhs)
        throw new LanguageError(
          "Missing second argument to infix operation",
          name,
        );
      if (name.end === rhs.start)
        throw new LanguageError(
          "infix operators require spaces on both sides",
          name,
        );
      operators.push({
        text: name.text,
        display,
        quoted: !!name.quoted,
        span: {
          line: name.line,
          column: name.column,
          start: name.start,
          end: name.end,
          endLine: name.endLine ?? name.line,
          endColumn: name.endColumn ?? name.column + name.text.length,
        },
      });
      const right = this.postfix(stops);
      if (
        right.kind === "symbol" &&
        !right.quoted &&
        POSTFIX_SUFFIX.test(right.name)
      )
        throw new LanguageError(
          "prefix and postfix operators must touch their operand",
          right.span ?? name,
        );
      operands.push(right);
    }
    for (let i = 0; i < operators.length - 1; i++) {
      const first = operators[i]!;
      const second = operators[i + 1]!;
      if (!requiresParentheses(first.text, second.text)) continue;
      const ranges = operands.map((operand) => ({
        start: operand.span?.start ?? 0,
        end: operand.span?.end ?? 0,
      }));
      throw new LanguageError(
        parenthesesRequiredMessage(this.source, ranges, operators, i),
        second.span,
        { code: INFIX_GROUPING_CODE, phase: "parse" },
      );
    }
    let result = operands[operands.length - 1]!;
    for (let i = operators.length - 1; i >= 0; i--) {
      const op = operators[i]!;
      const left = operands[i]!;
      result = {
        ...apply(
          apply(symbol(op.text, op.quoted), packOf(left)),
          packOf(result),
        ),
        span: left.span,
      };
    }
    return result;
  }
  postfix(stops: Set<string>): Syntax {
    const first = this.peek()!;
    let n = this.atom(stops);
    while (!this.stop(stops)) {
      const t = this.peek()!,
        tight = this.tokens[this.pos - 1].end === t.start;
      if (!tight) {
        if (t.kind === "(" && !this.isKeywordTerm(n))
          throw new LanguageError(
            "a term cannot be followed by a spaced '('; write f(x) for a call or f x for a sidefix operand",
            t,
          );
        break;
      }
      if (this.options.specification && t.kind === "op" && t.text === "<") {
        this.take();
        n = { ...apply(n, this.arguments(">")), span: n.span };
      } else if (t.kind === "(") {
        this.take();
        n = { ...apply(n, this.arguments(")")), span: n.span };
      } else if (t.kind === "fraction") {
        throw new LanguageError(
          "infix operators require spaces on both sides",
          t,
        );
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
        POSTFIX_SUFFIX.test(t.text) &&
        this.suffixBoundary()
      ) {
        this.take();
        for (const c of t.text) n = postfix(c, n, n.span);
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
    if (["number", "numberSource", "fraction"].includes(t.kind))
      return this.numberAtom(t, span);
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
      const touching = !!next && next.start === t.end;
      if (
        t.text === "-" &&
        !t.quoted &&
        touching &&
        next &&
        ["number", "numberSource"].includes(next.kind)
      ) {
        this.take();
        return this.numberAtom(
          { ...next, text: "-" + next.text },
          {
            ...span,
            end: next.end,
            endColumn: next.endColumn,
          },
        );
      }
      if (t.quoted || (touching && next.kind === "("))
        return { ...symbol(t.text, !!t.quoted), span };
      if (t.kind === "spread" && next?.kind === "op" && next.text === "::")
        return { ...symbol(t.text), span };
      if (this.stop(stops)) return { ...symbol(t.text, !!t.quoted), span };
      if (t.kind === "op" && next && !touching)
        throw new LanguageError(
          "prefix and postfix operators must touch their operand",
          t,
        );
      return { ...apply(symbol(t.text), packOf(this.postfix(stops))), span };
    }
    throw new LanguageError("unexpected token " + t.text, t);
  }
  private numberAtom(t: Token, span: Span): Syntax {
    if (t.kind !== "number" && this.options.specification)
      return {
        ...apply(symbol("NumericSource", true), [
          { label: "_1", value: { kind: "literal", value: t.text } },
        ]),
        span,
      };
    const value = parseNumericSpelling(t.text);
    if (!value)
      throw new LanguageError("malformed numeric source literal", span);
    return { ...syntaxNumber(value, t.text), span };
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
        this.peek()?.text === "**" &&
        !this.peek()?.quoted &&
        this.peek(1)?.kind === "name" &&
        this.peek(2)?.kind === ":"
      ) {
        this.take();
        const name = this.take();
        if (!labelName(name.text))
          throw new LanguageError(
            "labels must be lowercase camelCase names",
            name,
          );
        label = name.text;
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
        ? apply(symbol("**"), [{ label: "_1", value: rawValue }])
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
  options: SurfaceParseContext = {},
): Syntax {
  const lines: { indent: string; tokens: Token[] }[] = [];
  let current: Token[] = [];
  const stack: Token[] = [];
  for (const t of tokens) {
    if (t.kind === "newline") {
      if (!stack.length && current.length) {
        lines.push({ indent: current[0].indentPrefix ?? "", tokens: current });
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
    lines.push({ indent: current[0].indentPrefix ?? "", tokens: current });
  if (topLevel && lines.length && lines[0].indent !== "")
    throw new LanguageError(
      "top-level code must start at column 1",
      lines[0].tokens[0],
    );
  function region(start: number, indent: string): [Syntax[], number] {
    const result: Syntax[] = [];
    let i = start;
    let open:
      | {
          start: string;
          seen: string[];
          clauses: Set<string>;
          span: Span;
          closed: boolean;
        }
      | undefined;
    while (i < lines.length) {
      let { indent: level, tokens: ts } = lines[i];
      const relation = indentRelation(level, indent);
      if (relation === "dedented") {
        if (open && !open.closed) blockEndError(open.span, ts[0]);
        break;
      }
      if (relation !== "same")
        throw new LanguageError("inconsistent indentation", ts[0]);
      if (isEndLine(ts)) {
        if (!open) throw new LanguageError("end has no preceding block", ts[0]);
        if (open.closed) extraEndError(ts[0]);
        i++;
        open = undefined;
        continue;
      }
      const names = unquotedNames(ts);
      if (open && !(names.length && open.clauses.has(names[0]))) {
        if (open.closed) open = undefined;
        else blockEndError(open.span, ts[0]);
      }
      const continuing = !!open;
      if (continuing && open && names[0])
        open = { ...open, seen: [...open.seen, names[0]] };
      i++;
      let block: Syntax | undefined;
      if (
        i < lines.length &&
        indentRelation(lines[i].indent, indent) === "nested"
      ) {
        const [body, next] = region(i, lines[i].indent);
        if (
          topLevel &&
          ts.at(-1)?.kind === "typedQuote" &&
          !(lines[next]?.indent === indent && isEndLine(lines[next].tokens))
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
        if (!continuing) {
          const form = owningForm(unquotedNames(ts), options.layoutForms);
          open = {
            start: form?.start ?? "",
            seen: form
              ? formKeywords(unquotedNames(ts), form.start, form.clauses)
              : [],
            clauses: form?.clauses ?? new Set(),
            span: ts[0],
            closed: false,
          };
        }
      } else if (!continuing) {
        const form = owningForm(names, options.layoutForms);
        const next = lines[i];
        const nextName = next ? unquotedNames(next.tokens)[0] : undefined;
        if (
          form &&
          ts.some((token) => token.layoutHold) &&
          next &&
          next.indent === indent &&
          (isEndLine(next.tokens) ||
            (nextName !== undefined && form.clauses.has(nextName)))
        )
          open = {
            start: form.start,
            seen: formKeywords(names, form.start, form.clauses),
            clauses: form.clauses,
            span: ts[0],
            closed: false,
          };
      }
      if (
        continuing &&
        open &&
        !block &&
        !ts.some((token) => token.layoutHold) &&
        formComplete(open.seen, options.layoutForms?.chains?.get(open.start))
      )
        open = { ...open, closed: true };
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
            column: indent.length + 3,
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
    if (open && !open.closed) blockEndError(open.span);
    return [result, i];
  }
  const [body, consumed] = region(0, topLevel ? "" : (lines[0]?.indent ?? ""));
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
export function parseSurface(
  source: string,
  sourceName = "program",
  options: ParseSurfaceOptions = {},
): Syntax {
  return readSurface(source, sourceName, options);
}
/** Source-only reader for future specifications, not executable Code.
 * This specification reader still materializes numeric spellings as NumericSource
 * data and angles as structural packs. Ordinary parseSurface / execution interprets
 * those spellings as exact Rational values; the test runner reparses active operands
 * with the ordinary language reader.
 */
export function parseTestSource(
  source: string,
  sourceName = "test file",
  options: ParseSurfaceOptions = {},
): Syntax {
  return readSurface(source, sourceName, { ...options, specification: true });
}
function readSurface(
  source: string,
  sourceName: string,
  options: SurfaceOptions = {},
): Syntax {
  source = normalizeSource(source);
  const document = { name: sourceName, text: source };
  const context: SurfaceParseContext = { ...options, source };
  try {
    const root = layout(groups(scan(source, options), options), true, context);
    const visit = (n: Syntax) => {
      if (n.span) attachSource(n.span, document);
      if (n.kind === "apply") visit(n.head);
      if (n.kind === "postfix") visit(n.operand);
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
  const context: SurfaceParseContext = { source };
  if (sidefix) {
    const root = layout(groups(scan(source)), true, context);
    if (root.kind !== "block" || !root.lines.length)
      throw new LanguageError("expected one expression");
    const items = root.lines.flatMap((n) =>
      n.kind === "sequence" ? n.items : [n],
    );
    if (!items.length) throw new LanguageError("expected one expression");
    return items.length === 1
      ? items[0]
      : { kind: "sequence", items, span: root.span };
  }
  const seq = new Reader(
    groups(scan(source)).filter((t) => t.kind !== "newline"),
    context,
  ).sequence();
  if (seq.kind !== "sequence" || !seq.items.length || seq.items.length !== 1)
    throw new LanguageError("expected one expression");
  return seq.items[0];
}
