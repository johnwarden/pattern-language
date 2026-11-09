import { stringSource, escapedText } from "./string-format.ts";
import { infixPunctuation, labelName } from "./lexical.ts";
import { applicationHead, infixApplication } from "./application-format.ts";
import type { ApplicationNotation } from "./application-format.ts";
import { LanguageError } from "./diagnostics.ts";
import type { Captures } from "./pattern.ts";
import type { SourceDocument } from "./diagnostics.ts";
import type { Rational } from "./rational.ts";
import { isRational, formatRational, float64ToRational } from "./rational.ts";
export { LanguageError } from "./diagnostics.ts";
/** Lossless structural distinctions; packs occur at call/result boundaries. */
export interface Span {
  line: number;
  column: number;
  start?: number;
  end?: number;
  endLine?: number;
  endColumn?: number;
  source?: SourceDocument;
}
export interface Field<T> {
  label: string;
  value: T;
  span?: Span;
}
export type TextPart =
  | { kind: "text"; value: string }
  | {
      kind: "hole";
      value: Syntax;
      protection: number;
      spelling?: string;
      span?: Span;
    };
export type Syntax =
  | { kind: "quote"; value: Syntax; span?: Span }
  | {
      kind: "typedQuote";
      grammar: Syntax;
      value: Syntax;
      interpolate?: boolean;
      span?: Span;
    }
  | { kind: "template"; parts: TextPart[]; reader?: Syntax; span?: Span }
  | { kind: "symbol"; name: string; quoted: boolean; span?: Span }
  | {
      kind: "literal";
      value: string | number | Rational;
      spelling?: string;
      span?: Span;
    }
  | { kind: "apply"; head: Syntax; body: Field<Syntax>[]; span?: Span }
  | {
      kind: "postfix";
      operator: string;
      operand: Syntax;
      span?: Span;
    }
  | { kind: "pack"; body: Field<Syntax>[]; span?: Span }
  | { kind: "sequence"; items: Syntax[]; span?: Span }
  | { kind: "block"; lines: Syntax[]; span?: Span }
  | {
      kind: "form";
      name: string;
      captures: Captures<Syntax>;
      items: Syntax[];
      span?: Span;
    };
export const symbol = (name: string, quoted = false): Syntax => ({
  kind: "symbol",
  name,
  quoted,
});
export const isName = (n: Syntax, name: string): boolean =>
  n.kind === "symbol" && !n.quoted && n.name === name;
/** Quoting a pattern fixes its head while retaining patterns in argument packs. */
export function quotePatternHead(node: Syntax): Syntax {
  return node.kind === "apply"
    ? { ...node, head: quotePatternHead(node.head) }
    : node.kind === "postfix"
      ? { ...node, operand: quotePatternHead(node.operand) }
      : node.kind === "symbol"
        ? { ...node, quoted: true }
        : node;
}
export const isCapture = (name: string): boolean =>
  name.startsWith("\0macro") ||
  /^\p{Ll}[\p{L}\p{M}\p{N}]*$/u.test(name) ||
  /^_\d+$/.test(name);
/** Preserve the type-valued naming rule through hygienic alpha-renaming. */
export const isTypeCapture = (name: string): boolean =>
  /^\p{Lu}/u.test(name) || name.startsWith("\0macroType");
export const positional = (label: string): boolean => /^_\d+$/.test(label);
export const packOf = (n: Syntax): Field<Syntax>[] =>
  n.kind === "pack" ? n.body : [{ label: "_1", value: n }];
export const apply = (head: Syntax, body: Field<Syntax>[]): Syntax => ({
  kind: "apply",
  head,
  body,
});
/** Tight one-character suffixes. Transported as SyntaxNode Postfix(String, SyntaxNode). */
export const POSTFIX_SUFFIX = /^[~!@#$%^&*?]+$/;
/** Prefix and postfix callables occupy distinct structural namespaces. */
export const postfixMethodName = (operator: string): string =>
  "\0postfix:" + operator;
export const postfix = (
  operator: string,
  operand: Syntax,
  span?: Span,
): Extract<Syntax, { kind: "postfix" }> => ({
  kind: "postfix",
  operator,
  operand,
  span: span ?? operand.span,
});
/** Rest/vertical list annotations have one postfix star per collection layer. */
export function listLayer(n: Syntax): { operand: Syntax } | undefined {
  if (n.kind === "postfix" && n.operator === "*") return { operand: n.operand };
  return undefined;
}
export function operator(
  n: Syntax,
  name: string,
): [Field<Syntax>[], Field<Syntax>[]] | undefined {
  return n.kind === "apply" &&
    n.head.kind === "apply" &&
    isName(n.head.head, name)
    ? [n.head.body, n.body]
    : undefined;
}
export function binary(n: Syntax, name: string): [Syntax, Syntax] | undefined {
  const p = operator(n, name);
  return p && p[0].length === 1 && p[1].length === 1
    ? [p[0][0].value, p[1][0].value]
    : undefined;
}
export function spread(n: Syntax): Syntax | undefined {
  return n.kind === "apply" && isName(n.head, "…") && n.body.length === 1
    ? n.body[0].value
    : undefined;
}
/** Dollar prefixes remain ordinary syntax until an explicit quote pass consumes them. */
export function quoteHole(
  n: Syntax,
): { value: Syntax; protection: number } | undefined {
  return n.kind === "apply" &&
    n.head.kind === "symbol" &&
    !n.head.quoted &&
    /^\$+$/.test(n.head.name) &&
    n.body.length === 1
    ? { value: n.body[0].value, protection: n.head.name.length - 1 }
    : undefined;
}
/** Equal-precedence infix keeps `c :: T = d` as `::(c)(=(T)(d))`.
 * Interpret the default at the field-pattern boundary, without changing precedence. */
export function fieldPattern(n: Syntax): {
  pattern: Syntax;
  fallback?: Syntax;
} {
  const assignment = operator(n, "=");
  if (assignment) {
    if (assignment[0].length !== 1)
      throw new LanguageError("default requires one field pattern");
    return {
      pattern: assignment[0][0].value,
      fallback:
        assignment[1].length === 1
          ? assignment[1][0].value
          : { kind: "pack", body: assignment[1] },
    };
  }
  const annotation = binary(n, "::");
  const typedDefault = annotation && fieldPattern(annotation[1]);
  if (annotation && typedDefault?.fallback)
    return {
      pattern: apply(
        apply(symbol("::"), packOf(annotation[0])),
        packOf(typedDefault.pattern),
      ),
      fallback: typedDefault.fallback,
    };
  return { pattern: n };
}
/** Only a type specification supplies an implicit capture. A structural pattern
 * introduces its own captures, never an additional capture of the whole field. */
export function implicitFieldCapture(field: Field<Syntax>): string | undefined {
  if (positional(field.label)) return undefined;
  const pattern = fieldPattern(field.value).pattern;
  const annotation = binary(pattern, "::");
  const target = annotation?.[0] ?? pattern;
  const capture = spread(target) ?? target;
  if (
    capture.kind === "symbol" &&
    !capture.quoted &&
    (isCapture(capture.name) || capture.name === "_")
  )
    return undefined;
  return !annotation && isTypeSpecification(pattern) ? field.label : undefined;
}
export function isTypeSpecification(n: Syntax): boolean {
  return (
    (n.kind === "symbol" && !n.quoted && /^\p{Lu}/u.test(n.name)) ||
    (n.kind === "postfix" && isTypeSpecification(n.operand)) ||
    (n.kind === "form" && n.name === "TypeExpression") ||
    (n.kind === "sequence" &&
      n.items[0]?.kind === "symbol" &&
      !n.items[0].quoted &&
      n.items[0].name === "type")
  );
}
export function fields(items: Field<Syntax>[]): Field<Syntax>[] {
  let count = 0,
    named = false;
  const seen = new Set<string>();
  return items
    .flatMap((e) =>
      positional(e.label) && e.value.kind === "pack" ? e.value.body : [e],
    )
    .map((e, index, all) => {
      if (e.label === "**" && index !== all.length - 1)
        throw new LanguageError(
          "** must follow all positional and named fields",
          e.span ?? e.value.span,
          { code: "E_FIELD_ORDER", phase: "parse" },
        );
      const pos = positional(e.label);
      if (!pos && e.label !== "**" && !labelName(e.label))
        throw new LanguageError(
          "labels must be lowercase camelCase names",
          e.span ?? e.value.span,
          { code: "E_LABEL", phase: "parse" },
        );
      if (pos && named)
        throw new LanguageError(
          "positional arguments must precede named arguments",
        );
      named ||= !pos;
      const label = pos ? "_" + ++count : e.label;
      if (seen.has(label))
        throw new LanguageError(
          "duplicate argument label: " + label,
          e.span ?? e.value.span,
          { code: "E_DUPLICATE_LABEL", phase: "parse" },
        );
      seen.add(label);
      return { ...e, label };
    });
}
/** Positional order is significant; named fields have UTF-16 code-unit label order. */
export function canonicalFields<T>(xs: Field<T>[]): Field<T>[] {
  return [
    ...xs.filter((e) => positional(e.label)),
    ...xs
      .filter((e) => !positional(e.label) && e.label !== "**")
      .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0)),
    ...xs.filter((e) => e.label === "**"),
  ];
}
/**
 * Join form/sequence operands without printing a term followed by a spaced '('.
 * Tight applications stay unwrapped after a keyword (`def f()` not `def (f())`).
 * A pack or block after a term is indented; a later clause keyword continues
 * the form without an `end` before that clause.
 */
function joinOperands(
  items: Syntax[],
  indent: number,
  wrapOuter: boolean,
): string {
  const pad = " ".repeat(indent);
  const inner = indent + 2;
  const parts: string[] = [];
  let openBlock = false;
  const closeBlock = () => {
    if (!openBlock) return;
    parts.push("\n" + pad + "end");
    openBlock = false;
  };
  const emitBlock = (text: string) => {
    const last = parts.pop() ?? "";
    parts.push(last + "\n" + text);
    openBlock = true;
  };
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const afterTerm = i > 0;
    if (item.kind === "block") {
      emitBlock(
        item.lines
          .map((line) => " ".repeat(inner) + normal(line, inner))
          .join("\n"),
      );
      continue;
    }
    const raw = normal(item, inner);
    const grouped = item.kind === "apply" || item.kind === "sequence";
    let text = grouped && !afterTerm ? "(" + raw + ")" : raw;
    if (afterTerm && grouped) text = raw;
    const clause =
      afterTerm && item.kind === "symbol" && !item.quoted && openBlock;
    if (clause) {
      openBlock = false;
      parts.push("\n" + pad + text);
      continue;
    }
    if (afterTerm && text.startsWith("(")) {
      emitBlock(" ".repeat(inner) + text);
      continue;
    }
    closeBlock();
    const last = parts.at(-1) ?? "";
    if (afterTerm && last.endsWith("end") && !text.startsWith("\n"))
      parts.push("\n" + pad + text);
    else parts.push(text);
  }
  closeBlock();
  const joined = parts.reduce(
    (acc, part, i) =>
      i === 0 ? part : part.startsWith("\n") ? acc + part : acc + " " + part,
    "",
  );
  return wrapOuter ? "(" + joined + ")" : joined;
}
export function normal(n: Syntax, indent = 0): string {
  const body = (xs: Field<Syntax>[]) =>
    canonicalFields(xs)
      .map(
        (e) =>
          (positional(e.label) || e.label === "**" ? "" : e.label + ": ") +
          normal(e.value, indent),
      )
      .join(", ");
  const notation: ApplicationNotation<Syntax> = {
    application: (node) => (node.kind === "apply" ? node : undefined),
    punctuation: (node) =>
      node.kind === "symbol" && infixPunctuation(node.name)
        ? (node.quoted ? ":" : "") + node.name
        : undefined,
    render: (node) => normal(node, indent),
    fields: body,
    needsGrouping: (node) => node.kind === "sequence" || node.kind === "form",
  };
  switch (n.kind) {
    case "quote":
      return ":(" + normal(n.value, indent) + ")";
    case "typedQuote":
      return (
        normal(n.grammar, indent) +
        (n.interpolate ? "$` " : "` ") +
        normal(n.value, indent)
      );
    case "template": {
      const interpolating = n.parts.some((part) => part.kind === "hole");
      const content = n.parts
        .map((part) =>
          part.kind === "text"
            ? escapedText(part.value, interpolating)
            : part.protection && part.spelling
              ? "$" + part.spelling
              : "$".repeat(part.protection + 1) +
                "(" +
                normal(part.value, indent) +
                ")",
        )
        .join("");
      return (
        (n.reader ? normal(n.reader, indent) : "") +
        (interpolating ? "$" : "") +
        '"' +
        content +
        '"'
      );
    }
    case "symbol":
      return (n.quoted ? ":" : "") + n.name;
    case "literal": {
      if (typeof n.value === "string") return stringSource(n.value, indent);
      if (typeof n.value === "number" || isRational(n.value))
        return formatRational(
          isRational(n.value) ? n.value : float64ToRational(n.value),
        );
      return stringSource(String(n.value), indent);
    }
    case "pack":
      return "(" + body(n.body) + ")";
    case "sequence":
      return joinOperands(n.items, indent, false);
    case "form":
      return joinOperands(n.items, indent, false);
    case "block":
      return (
        "(\n" +
        n.lines
          .map((x) => " ".repeat(indent + 2) + normal(x, indent + 2))
          .join("\n") +
        "\n" +
        " ".repeat(indent) +
        ")"
      );
    case "postfix": {
      const inner = normal(n.operand, indent);
      return n.operand.kind === "apply" ||
        n.operand.kind === "sequence" ||
        n.operand.kind === "form" ||
        n.operand.kind === "pack"
        ? "(" + inner + ")" + n.operator
        : inner + n.operator;
    }
    case "apply": {
      if (
        n.head.kind === "symbol" &&
        !n.head.quoted &&
        ["[]", "{}"].includes(n.head.name)
      ) {
        const rows =
          n.body.length === 1 && n.body[0].value.kind === "block"
            ? n.body[0].value
            : undefined;
        if (rows)
          return (
            n.head.name[0] +
            "\n" +
            rows.lines
              .map((row) => " ".repeat(indent + 2) + normal(row, indent + 2))
              .join("\n") +
            "\n" +
            " ".repeat(indent) +
            n.head.name[1]
          );
        return n.head.name[0] + body(n.body) + n.head.name[1];
      }
      return (
        infixApplication(n, notation) ??
        applicationHead(n.head, notation) + "(" + body(n.body) + ")"
      );
    }
  }
}

/** Matching identity must not depend on source encoding or diagnostic metadata. */
export function syntaxKey(n: Syntax): string {
  const key = (n: Syntax): unknown => {
    switch (n.kind) {
      case "literal":
        return isRational(n.value)
          ? ["literal", n.value.n.toString(), n.value.d.toString()]
          : ["literal", n.value];
      case "symbol":
        return ["symbol", n.name, n.quoted];
      case "quote":
        return ["quote", key(n.value)];
      case "typedQuote":
        return ["typedQuote", key(n.grammar), key(n.value), !!n.interpolate];
      case "template":
        return [
          "template",
          n.reader ? key(n.reader) : null,
          n.parts.map((part) =>
            part.kind === "text"
              ? ["text", part.value]
              : ["hole", part.protection, key(part.value), part.spelling ?? ""],
          ),
        ];
      case "apply":
        return [
          n.kind,
          key(n.head),
          canonicalFields(n.body).map((e) => [e.label, key(e.value)]),
        ];
      case "postfix":
        return ["postfix", n.operator, key(n.operand)];
      case "pack":
        return [
          "pack",
          canonicalFields(n.body).map((e) => [e.label, key(e.value)]),
        ];
      case "sequence":
      case "form":
        return [n.kind, n.items.map(key)];
      case "block":
        return ["block", n.lines.map(key)];
    }
  };
  return JSON.stringify(key(n));
}
