import { parseSurface } from "./parser.ts";
import { TYPE_SCHEMA } from "./type-schema.ts";
import {
  canonicalFields,
  fields as syntaxFields,
  isTypeModifierOperator,
  LanguageError,
  packOf,
  symbol,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import { valLiteral, valSymbol, unwrap } from "./values.ts";
import type { Value } from "./values.ts";

/** These are semantic readers, not hidden additions to surface syntax. */
export const HOST_READERS = [
  [
    "PatternBody",
    "One opaque pattern operand (micro, grouped sidefix or block), or a nested type form.",
  ],
  [
    "Expression",
    "One micro expression or a recognized sidefix form; no ungrouped block.",
  ],
  ["Form", "One recognized sidefix form or micro expression."],
  ["Body", "An expression or a block with a final result pack."],
  ["Arms", "A nonempty block of ordered pattern -> expression arms."],
  [
    "Program",
    "A block of forms ending in a result pack; REPL submissions may end in a declaration.",
  ],
  [
    "Signature",
    "A micro application signature, or a sidefix sequence starting with a quoted keyword.",
  ],
  [
    "Pattern",
    "An unevaluated surface tree interpreted by the common pattern compiler.",
  ],
  ["Int", "A numeric literal whose value is an integer."],
  ["Number", "A numeric literal (Num is an alias)."],
  ["String", "A string literal."],
] as const;

/** One executable tree schema serves grammar transport and expression inspection. */
export const SYNTAX_SCHEMA = `def SyntaxNode type Name(String,Bool) | NumberLiteral(Float) | StringLiteral(String) | Apply(SyntaxNode,(type Field(String,SyntaxNode))*) | Pack((type Field(String,SyntaxNode))*) | Quote(SyntaxNode) | TypedQuote(SyntaxNode,SyntaxNode,Bool) | TextTemplate((type Text(String) | Hole(SyntaxNode,Int,String))*) | ReaderQuote(SyntaxNode,(type Text(String) | Hole(SyntaxNode,Int,String))*) | Sequence(SyntaxNode*) | Block(SyntaxNode*) | Form(String,SyntaxNode*,(type Capture(String,Bool,(type Field(String,SyntaxNode))*))*)
`;

/** Recursive source-language schema for the actual grammar transport format. */
export const LANGUAGE_SCHEMA = `${SYNTAX_SCHEMA}def Rule type Rule(name: String,kind: Symbol,pattern: SyntaxNode*)
def Reader type Reader(name: String,contract: String)
def BlockPolicy type BlockPolicy(programTail: Symbol,replTail: Symbol,arms: Symbol)
def Language Facet(type Language(start: Symbol,rules: Rule*,readers: Reader*,blocks: BlockPolicy,typeGrammar: SyntaxNode))
type Language
`;

export const node = (name: string, ...values: Value[]): Value => ({
  kind: "term",
  head: valSymbol(name),
  body: values.map((value, i) => ({ label: "_" + (i + 1), value })),
});
export const record = (name: string, values: Record<string, Value>): Value => ({
  kind: "term",
  head: valSymbol(name),
  body: canonicalFields(
    Object.entries(values).map(([label, value]) => ({ label, value })),
  ),
});
export const list = (values: Value[]): Value => node("[]", ...values);
const boolean = (v: boolean) => valSymbol(v ? "True" : "False");
/** Explicit AST variants avoid collisions between quote syntax and a Quote(...) application. */
export function encodeSyntax(input: Syntax): Value {
  let work = 0;
  const fields = (xs: Field<Syntax>[], depth: number): Value =>
    list(
      canonicalFields(xs).map((f) =>
        node("Field", valLiteral(f.label), visit(f.value, depth + 1)),
      ),
    );
  function visit(s: Syntax, depth: number): Value {
    if (++work > 10000 || depth > 256)
      return invalid("language AST exceeds codec budget");
    const child = (s: Syntax) => visit(s, depth + 1);
    switch (s.kind) {
      case "symbol":
        return node("Name", valLiteral(s.name), boolean(s.quoted));
      case "literal":
        return node(
          typeof s.value === "number" ? "NumberLiteral" : "StringLiteral",
          valLiteral(s.value),
        );
      case "apply":
        return node("Apply", child(s.head), fields(s.body, depth));
      case "postfix":
        // Public SyntaxNode has Apply, not Postfix. Type-modifier suffixes
        // already existed as Apply; only distinct postfix such as @ stays
        // host-only adapter debt.
        if (isTypeModifierOperator(s.operator))
          return node(
            "Apply",
            child(symbol(s.operator)),
            fields(packOf(s.operand), depth),
          );
        throw new LanguageError(
          "postfix syntax is not a public SyntaxNode variant",
          s.span,
          { code: "E_VALUE_SERIALIZATION" },
        );
      case "pack":
        return node("Pack", fields(s.body, depth));
      case "quote":
        return node("Quote", child(s.value));
      case "typedQuote":
        return node(
          "TypedQuote",
          child(s.grammar),
          child(s.value),
          boolean(!!s.interpolate),
        );
      case "template": {
        const parts = list(
          s.parts.map((part) =>
            part.kind === "text"
              ? node("Text", valLiteral(part.value))
              : node(
                  "Hole",
                  child(part.value),
                  valLiteral(part.protection),
                  valLiteral(part.spelling ?? ""),
                ),
          ),
        );
        return s.reader
          ? node("ReaderQuote", child(s.reader), parts)
          : node("TextTemplate", parts);
      }
      case "sequence":
        return node("Sequence", list(s.items.map(child)));
      case "block":
        return node("Block", list(s.lines.map(child)));
      case "form":
        return node(
          "Form",
          valLiteral(s.name),
          list(s.items.map(child)),
          list(
            [...s.captures].map(([name, c]) =>
              node(
                "Capture",
                valLiteral(name),
                boolean(c.rest),
                fields(c.fields, depth),
              ),
            ),
          ),
        );
    }
  }
  return visit(input, 0);
}

const invalid = (message: string): never => {
  throw new LanguageError(message, undefined, {
    code: "E_LANGUAGE_DESCRIPTION",
    phase: "declaration",
  });
};
export const termValue = (v: Value): Extract<Value, { kind: "term" }> => {
  v = unwrap(v);
  if (v.kind !== "term")
    return invalid("expected language-description constructor");
  return v;
};
export const items = (v: Value): Value[] =>
  termValue(v).body.map((f) => f.value);
export const text = (v: Value): string => {
  v = unwrap(v);
  if (v.kind !== "literal" || typeof v.value !== "string")
    return invalid("expected language-description string");
  return v.value;
};
export const field = (v: Value, label: string): Value =>
  termValue(v).body.find((f) => f.label === label)?.value ??
  invalid("missing language-description field: " + label);
/** Called only after LANGUAGE_SCHEMA recognition. Locations are session metadata. */
export function decodeSyntax(input: Value): Syntax {
  let work = 0;
  const fields = (v: Value, depth: number): Field<Syntax>[] =>
    syntaxFields(
      items(v).map((f) => ({
        label: text(items(f)[0]),
        value: visit(items(f)[1], depth + 1),
      })),
    );
  function visit(v: Value, depth: number): Syntax {
    if (++work > 10000 || depth > 256)
      return invalid("language AST exceeds codec budget");
    const t = termValue(v),
      xs = items(t),
      head = unwrap(t.head);
    const child = (v: Value) => visit(v, depth + 1);
    if (head.kind !== "symbol") return invalid("invalid AST variant");
    switch (head.name) {
      case "Name":
        return {
          kind: "symbol",
          name: text(xs[0]),
          quoted: (unwrap(xs[1]) as { name: string }).name === "True",
        };
      case "NumberLiteral":
      case "StringLiteral":
        return {
          kind: "literal",
          value: (unwrap(xs[0]) as { value: string | number }).value,
        };
      case "Apply":
        return {
          kind: "apply",
          head: child(xs[0]),
          body: fields(xs[1], depth),
        };
      case "Pack":
        return { kind: "pack", body: fields(xs[0], depth) };
      case "Quote":
        return { kind: "quote", value: child(xs[0]) };
      case "TypedQuote":
        return {
          kind: "typedQuote",
          grammar: child(xs[0]),
          value: child(xs[1]),
          interpolate: (unwrap(xs[2]) as { name: string }).name === "True",
        };
      case "TextTemplate":
      case "ReaderQuote": {
        const reader = head.name === "ReaderQuote";
        const parts = items(xs[reader ? 1 : 0]).map((part) => {
          const value = termValue(part),
            tag = unwrap(value.head),
            fields = items(value);
          if (tag.kind === "symbol" && tag.name === "Text")
            return { kind: "text" as const, value: text(fields[0]) };
          if (tag.kind !== "symbol" || tag.name !== "Hole")
            return invalid("invalid template part");
          const protection = unwrap(fields[1]);
          if (
            protection.kind !== "literal" ||
            typeof protection.value !== "number" ||
            protection.value < 0 ||
            protection.value > 32 ||
            !Number.isInteger(protection.value)
          )
            return invalid("invalid hole protection depth");
          const spelling = text(fields[2]);
          if (protection.value === 0 && spelling)
            return invalid("active holes cannot have residual literal text");
          if (
            protection.value > 0 &&
            !spelling.startsWith("$".repeat(protection.value))
          )
            return invalid(
              "protected holes require their residual literal spelling",
            );
          return {
            kind: "hole" as const,
            value: child(fields[0]),
            protection: protection.value,
            spelling: spelling || undefined,
          };
        });
        if (!reader && !parts.some((p) => p.kind === "hole"))
          return invalid(
            "a text template requires at least one hole; use StringLiteral otherwise",
          );
        if (
          parts.some(
            (part, index) =>
              part.kind === "text" &&
              ((index > 0 && parts[index - 1].kind === "text") ||
                (!part.value && parts.length > 1)),
          )
        )
          return invalid("template text parts must be merged and nonempty");
        return {
          kind: "template",
          parts,
          reader: reader ? child(xs[0]) : undefined,
        };
      }
      case "Sequence":
        return { kind: "sequence", items: items(xs[0]).map(child) };
      case "Block":
        return { kind: "block", lines: items(xs[0]).map(child) };
      case "Form":
        return {
          kind: "form",
          name: text(xs[0]),
          items: items(xs[1]).map(child),
          captures: new Map(
            items(xs[2]).map((c) => [
              text(items(c)[0]),
              {
                rest: (unwrap(items(c)[1]) as { name: string }).name === "True",
                fields: fields(items(c)[2], depth),
              },
            ]),
          ),
        };
      default:
        return invalid("unknown AST variant: " + head.name);
    }
  }
  return visit(input, 0);
}

export const blockPolicy = () =>
  record("BlockPolicy", {
    programTail: valSymbol("ResultPack"),
    replTail: valSymbol("AnyForm"),
    arms: valSymbol("OrderedPatterns"),
  });
export const readerDescriptions = () =>
  list(
    HOST_READERS.map(([name, contract]) =>
      record("Reader", {
        name: valLiteral(name),
        contract: valLiteral(contract),
      }),
    ),
  );
export const typeGrammarDescription = () =>
  encodeSyntax(parseSurface(TYPE_SCHEMA, "type grammar"));
