import { isCanonicalAtom } from "./primitive-names.ts";
import { displayString } from "./string-format.ts";
import {
  LanguageError,
  positional,
  canonicalFields,
  normal,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import type { Grammar } from "./grammar.ts";
import type { Pattern, Captures } from "./pattern.ts";
import { typeIdentity } from "./type-descriptor.ts";
import { typeData } from "./type-data.ts";
import { valueText } from "./value-text.ts";
import { encodeSyntax } from "./language-description.ts";
import type { TextDomain } from "./value-text.ts";
import { infixPunctuation } from "./lexical.ts";
import { applicationHead, infixApplication } from "./application-format.ts";
import type { ApplicationNotation } from "./application-format.ts";
export const syntaxOrigins = new WeakMap<object, Syntax>();
export interface TypeValue {
  kind: "type";
  name: string;
  key: string;
  pattern: () => Pattern<Value>;
  element?: TypeValue;
  modifier?: string;
  declaration?: TypeDeclaration;
  /** Refinements retain the concrete space of their base. */
  baseType?: TypeValue;
  transparent?: boolean;
  /** Abstract values retain an explicit concrete type and payload. */
  packaged?: boolean;
  /** Structural facet: preserves the actual concrete space of its input. */
  facet?: boolean;
  numeric?: "int64" | "float32" | "float64";
  arguments?: Field<Value>[];
  /** An explicit Type(Int) is distinct from the primitive Int atom. */
  wrappedPrimitive?: boolean;
  unionMembers?: TypeValue[];
  /** Source-defined schema for a syntax interpretation, not a constructor tag. */
  treeGrammar?: TypeValue;
}
/** Lexical declaration products. They are not fields of an ordinary Type value. */
export interface TypeDefinition {
  type: TypeValue;
  name?: string;
  declaration?: TypeDeclaration;
  capturePattern: Pattern<Value>;
  accessors: Accessor[];
}
export interface TypeDeclaration {
  id: number;
  name: string;
  parameters: Field<Syntax>[];
  parameterized: boolean;
  body: Syntax;
  env: Scope;
  captures: Set<string>;
  scope: Scope;
}
export interface Closure {
  signature?: Syntax;
  macro?: boolean;
  sidefix?: boolean;
  grammar?: Grammar;
  kind: "closure";
  id: number;
  parameters: Field<Syntax>[][];
  body: Syntax;
  env: Scope;
}
export interface Native {
  kind: "native";
  id: number;
  name: string;
  arities: number[];
  test: (args: Field<Value>[]) => boolean;
  invoke: (args: Field<Value>[], scope?: Scope) => Field<Value>[];
}
export interface Accessor {
  kind: "accessor";
  id: number;
  name: string;
  declaration?: TypeDeclaration;
  type?: TypeValue;
  pattern?: Pattern<Value>;
}
export type Candidate = Closure | Native | Accessor;
export type Value =
  | { kind: "code"; type: TypeValue; tree: Syntax; portable: boolean }
  | { kind: "slot"; type: TypeValue; value: Value }
  | { kind: "symbol"; name: string }
  | { kind: "literal"; value: number | string }
  | { kind: "term"; head: Value; body: Field<Value>[] }
  | { kind: "overload"; name: string; candidates: Candidate[] }
  | { kind: "pack"; body: Field<Value>[] }
  | {
      kind: "view";
      /** A surface symbol literal may be interpreted by its immediate context. Binding commits it. */
      provisional?: boolean;
      base: Value;
      space?: TypeValue;
      views: Map<string, { type: TypeValue; captures: Captures<Value> }>;
    }
  | Closure
  | Native
  | Accessor
  | TypeValue;
export type Binding = Value | TypeDeclaration;
export class Scope {
  parent?: Scope;
  bindings = new Map<string, Binding>();
  functions = new Map<string, Candidate[]>();
  typeDefinitions = new Map<string, TypeDefinition>();
  runtimeBindings = new Set<string>();
  isRuntime(name: string): boolean {
    return this.bindings.has(name)
      ? this.runtimeBindings.has(name)
      : (this.parent?.isRuntime(name) ?? false);
  }
  constructor(parent?: Scope) {
    this.parent = parent;
  }
  get(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.get(name);
  }
  visible(name: string): Candidate[] {
    const methods: Candidate[] = [];
    const seen = new Set<number>();
    const add = (candidate: Candidate) => {
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id);
        methods.push(candidate);
      }
    };
    for (let scope: Scope | undefined = this; scope; scope = scope.parent) {
      for (const candidate of scope.functions.get(name) ?? []) add(candidate);
      // A visible declaration owns its lazy specialization products. Lexical
      // snapshots retain that declaration, not the timing of accessor compilation.
      for (const binding of scope.bindings.values()) {
        if ("kind" in binding || this.get(binding.name) !== binding) continue;
        for (const candidate of binding.scope.functions.get(name) ?? [])
          if (
            candidate.kind === "accessor" &&
            candidate.declaration === binding
          )
            add(candidate);
      }
    }
    return methods;
  }
}
export const valSymbol = (name: string): Value => ({ kind: "symbol", name });
export const valLiteral = (value: string | number): Value => ({
  kind: "literal",
  value,
});
export const singleton = (value: Value): Field<Value>[] => [
  { label: "_1", value },
];
export function unwrap(v: Value): Value {
  while (v.kind === "view" || v.kind === "slot")
    v = v.kind === "view" ? v.base : v.value;
  return v;
}
export function single(xs: Field<Value>[], context = "expression"): Value {
  if (xs.length !== 1)
    throw new LanguageError(
      context + " requires 1 result; received " + xs.length,
    );
  return xs[0].value;
}
export function display(v: Value): string {
  v = unwrap(v);
  const syntax = syntaxOrigins.get(v);
  if (syntax && !["literal", "symbol", "apply", "pack"].includes(syntax.kind))
    return normal(syntax);
  switch (v.kind) {
    case "code":
      return normal(v.tree);
    case "literal":
      return typeof v.value === "string"
        ? displayString(v.value)
        : String(v.value);
    case "symbol":
      return isCanonicalAtom(v.name) ? v.name : ":" + v.name;
    case "term": {
      const body = (xs: Field<Value>[]) =>
        canonicalFields(xs)
          .map((e) =>
            e.label === "**"
              ? "**"
              : (positional(e.label) ? "" : e.label + ": ") + display(e.value),
          )
          .join(", ");
      const notation: ApplicationNotation<Value> = {
        application: (node) => {
          const value = unwrap(node);
          return value.kind === "term" ? value : undefined;
        },
        punctuation: (node) => {
          const value = unwrap(node);
          return value.kind === "symbol" && infixPunctuation(value.name)
            ? value.name
            : undefined;
        },
        render: display,
        fields: body,
      };
      return v.head.kind === "symbol" && ["[]", "{}"].includes(v.head.name)
        ? v.head.name[0] + body(v.body) + v.head.name[1]
        : (infixApplication(v, notation) ??
            (v.head.kind === "symbol"
              ? v.head.name
              : applicationHead(v.head, notation)) +
              "(" +
              body(v.body) +
              ")");
    }
    case "type":
      try {
        return valueText(v);
      } catch (error) {
        // Predicate/default descriptions still have only a local presentation.
        if (
          error instanceof LanguageError &&
          ["E_TYPE_SERIALIZATION", "E_VALUE_SERIALIZATION"].includes(
            error.diagnostic.code,
          )
        )
          return v.name;
        throw error;
      }
    case "pack":
      return displayResults(v.body);
    default:
      return "<function>";
  }
}
export function displayResults(xs: Field<Value>[]): string {
  return xs.length === 1
    ? display(xs[0].value)
    : "(" +
        canonicalFields(xs)
          .map((e) =>
            e.label === "**"
              ? "**"
              : (positional(e.label) ? "" : e.label + ": ") + display(e.value),
          )
          .join(", ") +
        ")";
}
/** Text interpolation is content conversion, without interpretation annotations. */
export function textValue(value: Value): string {
  const raw = unwrap(value);
  if (raw.kind === "literal" && typeof raw.value === "string") return raw.value;
  if (raw.kind === "symbol") return raw.name;
  return display(raw);
}
/** Expose the language value behind a compiled cache. Comparison never sees caches. */
export function valueTree(value: Value): Value {
  value = unwrap(value);
  if (value.kind === "code") {
    if (!value.portable)
      throw new LanguageError(
        "captured Code needs a portable environment before structural comparison",
        undefined,
        { code: "E_VALUE_REPRESENTATION" },
      );
    return encodeSyntax(value.tree);
  }
  if (["closure", "native", "accessor", "overload"].includes(value.kind))
    throw new LanguageError(
      "value has no structural representation yet",
      undefined,
      { code: "E_VALUE_REPRESENTATION" },
    );
  if (value.kind !== "type") return value;
  try {
    return typeData(value);
  } catch (error) {
    if (
      !(error instanceof LanguageError) ||
      error.diagnostic.code !== "E_TYPE_SERIALIZATION"
    )
      throw error;
    throw new LanguageError(
      "value has no structural representation yet",
      undefined,
      { code: "E_VALUE_REPRESENTATION", notes: [error.message] },
    );
  }
}

/** One structural comparison for all representable language values. */
export function compare(a: Value, b: Value): number {
  // Slot representation is not an extra language value. A common abstract
  // comparison domain orders concrete descriptions first; equal payloads retain
  // their identity when moved between concrete and abstract storage.
  if (
    a.kind === "slot" &&
    b.kind === "slot" &&
    typeIdentity(a.type) === typeIdentity(b.type)
  ) {
    const sa = concreteSpace(a),
      sb = concreteSpace(b);
    if (sa && sb) {
      const c = compare(sa, sb);
      if (c) return c;
    }
  }
  const sa = concreteSpace(a),
    sb = concreteSpace(b);
  if (sa && sb && typeIdentity(sa) !== typeIdentity(sb))
    throw new LanguageError(
      "values from different concrete types cannot be compared: " +
        sa.name +
        " and " +
        sb.name,
      undefined,
      { code: "E_INCOMPARABLE_TYPES", phase: "match" },
    );
  a = valueTree(a);
  b = valueTree(b);
  const ranks: Record<string, number> = {
    symbol: 0,
    literal: 1,
    term: 3,
    pack: 4,
  };
  const rank = (v: Value) =>
    v.kind === "literal"
      ? typeof v.value === "number"
        ? 1
        : 2
      : ranks[v.kind];
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? -1 : 1;
  if (a.kind === "literal" && b.kind === "literal")
    return a.value === b.value ? 0 : a.value < b.value ? -1 : 1;
  if (a.kind === "symbol" && b.kind === "symbol")
    return a.name === b.name ? 0 : a.name < b.name ? -1 : 1;
  if (
    (a.kind === "term" || a.kind === "pack") &&
    (b.kind === "term" || b.kind === "pack")
  ) {
    if (a.kind === "term" && b.kind === "term") {
      const h = compare(a.head, b.head);
      if (h) return h;
    }
    const aa = canonicalFields(a.body),
      bb = canonicalFields(b.body);
    for (let i = 0; i < Math.min(aa.length, bb.length); i++) {
      const x = aa[i],
        y = bb[i];
      if (x.label !== y.label) return x.label < y.label ? -1 : 1;
      const c = compare(x.value, y.value);
      if (c) return c;
    }
    return Math.sign(a.body.length - b.body.length);
  }
  throw new LanguageError(
    "value has no structural representation yet",
    undefined,
    { code: "E_VALUE_REPRESENTATION" },
  );
}
export function equal(a: Value, b: Value): boolean {
  return compare(a, b) === 0;
}

export function concreteSpace(v: Value): TypeValue | undefined {
  while (v.kind === "slot") v = v.value;
  if (v.kind === "code") return v.type.baseType ?? v.type;
  if (v.kind !== "view") return undefined;
  return v.space?.baseType ?? v.space;
}

/** Remove storage boxing while retaining concrete interpretation/accessor caches. */
export function slotValue(v: Value): Value {
  while (v.kind === "slot") v = v.value;
  return v;
}

/** The annotation visible to users; this observes existing metadata, not inference. */
export function observedType(value: Value): TypeValue | "Type" | "Expression" {
  return (
    concreteSpace(value) ??
    (unwrap(value).kind === "type" ? "Type" : "Expression")
  );
}

/** REPL inspection always names the actual concrete space. Uninterpreted syntax
 * is reported as Expression rather than inventing numeric/container inference.
 */
export function inspectResults(
  xs: Field<Value>[],
  domain?: TextDomain,
  typeName: (type: TypeValue) => string = display,
  typeValueText?: (type: TypeValue) => string,
): string {
  const show = (v: Value) => {
    const payload = slotValue(v),
      raw = unwrap(payload);
    if (["closure", "native", "accessor", "overload"].includes(raw.kind))
      return display(raw);
    const type = concreteSpace(v);
    let text: string;
    try {
      text =
        raw.kind === "type" && typeValueText
          ? typeValueText(raw)
          : valueText(
              domain ? payload : raw,
              domain,
              domain ? type : undefined,
            );
    } catch (error) {
      if (
        !(error instanceof LanguageError) ||
        !["E_VALUE_SERIALIZATION", "E_TYPE_SERIALIZATION"].includes(
          error.diagnostic.code,
        )
      )
        throw error;
      text = display(payload);
    }
    return (
      text + " :: " + (type ? typeName(type) : (observedType(v) as string))
    );
  };
  return xs.length === 1
    ? show(xs[0].value)
    : "(" +
        canonicalFields(xs)
          .map(
            (e) => (positional(e.label) ? "" : e.label + ": ") + show(e.value),
          )
          .join(", ") +
        ")";
}
