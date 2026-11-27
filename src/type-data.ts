import { primitiveNames as primitiveAtoms } from "./primitive-names.ts";
import { compare, isNumeric, integerValue } from "./values.ts";
import { numericKey } from "./rational.ts";
import { LanguageError, canonicalFields } from "./syntax.ts";
import type { Pattern } from "./pattern.ts";
import type { TypeValue, Value } from "./values.ts";
import { isOpenPattern, orderedParts } from "./pattern-captures.ts";
import { DescriptionScope } from "./description-scope.ts";

export const sym = (name: string): Value => ({ kind: "symbol", name });
export const lit = (value: string | number): Value => ({
  kind: "literal",
  value,
});
export const term = (name: string, ...values: Value[]): Value => ({
  kind: "term",
  head: sym(name),
  body: values.map((value, i) => ({ label: "_" + (i + 1), value })),
});
const bare = (v: Value): Value =>
  v.kind === "view" ? bare(v.base) : v.kind === "slot" ? bare(v.value) : v;
const primitiveNames: Record<string, string> = {
  rational: "NumericValue",
  NumericValue: "NumericValue",
  float64: "Float64",
  Float64: "Float64",
  float32: "Float32",
  Float32: "Float32",
  int64: "Int64",
  Int64: "Int64",
  int32: "Int32",
  Int32: "Int32",
  uint64: "UInt64",
  UInt64: "UInt64",
  String: "String",
  Bool: "Bool",
  LowerCamelSymbol: "LowerCamelSymbol",
  UpperCamelSymbol: "UpperCamelSymbol",
  UpperSnakeSymbol: "UpperSnakeSymbol",
  PunctuationSymbol: "PunctuationSymbol",
  Any: "Any",
  Expression: "Expression",
  Body: "Body",
  Type: "Type",
  ReservedSymbol: "ReservedSymbol",
};
const reserved = new Set([
  "Type",
  "Struct",
  "Facet",
  "**",
  "UnionType",
  "Literal",
  "Apply",
  "Postfix",
  "Fields",
  "OpenFields",
  "Repeat",
  "Row",
  "Sequence",
  "Collect",
  "Recursive",
  "Recur",
  "Union",
  "String",
  "TreeGrammar",
]);
const special = (name: string) => reserved.has(name) || name === "|";
const failure = (message: string): never => {
  throw new LanguageError(message, undefined, {
    code: "E_TYPE_DESCRIPTION",
    phase: "declaration",
  });
};
const unavailable = (message: string): never => {
  throw new LanguageError(message, undefined, { code: "E_TYPE_SERIALIZATION" });
};

/** A finite ordinary expression value. Matcher closures and accessor names are absent. */
export function typeDescription(
  type: TypeValue,
  localReferences?: ReadonlyMap<unknown, string>,
): Value {
  interface Binder {
    key: unknown;
    used: boolean;
  }
  type Build = (binders: Binder[]) => Value;
  const active: Binder[] = [];
  let steps = 0;
  const constant =
    (v: Value): Build =>
    () =>
      v;
  function binder(key: unknown, body: () => Pattern<Value>): Build {
    const prior = active.find((b) => b.key === key);
    if (prior) {
      prior.used = true;
      return (bs) => term("Recur", lit(bs.length - 1 - bs.indexOf(prior)));
    }
    const b = { key, used: false };
    active.push(b);
    let content: Build;
    try {
      content = encode(body(), true);
    } finally {
      active.pop();
    }
    return (bs) =>
      b.used ? term("Recursive", content([...bs, b])) : content(bs);
  }
  function literal(v: Value): Value {
    v = bare(v);
    if (v.kind === "literal") return v;
    if (v.kind === "symbol" && v.name !== "_" && !primitiveAtoms.has(v.name))
      return v;
    if (v.kind === "postfix")
      return term("Postfix", literal(v.operator), literal(v.operand));
    return term("Literal", v);
  }
  function encode(p: Pattern<Value>, root = false): Build {
    if (++steps > 10000)
      return unavailable("type description exceeds structural budget");
    switch (p.kind) {
      case "any":
        return constant(sym("Any"));
      case "test": {
        const id = p.identity;
        if (Array.isArray(id) && id[0] === "primitive" && primitiveNames[id[1]])
          return constant(sym(primitiveNames[id[1]]));
        if (Array.isArray(id) && id[0] === "literal")
          return constant(literal(id[1]));
        if (Array.isArray(id) && id[0] === "treeGrammar")
          return constant(term("TreeGrammar", id[1]));
        return unavailable(
          "predicate types need a portable predicate description before serialization",
        );
      }
      case "capture":
        return encode(p.pattern, root);
      case "ref": {
        const alias = !root && localReferences?.get(p.key);
        if (alias) return constant(sym(alias));
        const child = binder(p.key, p.resolve);
        // A root reference is an alias. References inside a pattern retain their
        // type boundary; Recur already refers to a surrounding type binder.
        return (bs) => {
          let value = child(bs);
          if (
            p.wrappedPrimitive &&
            value.kind === "symbol" &&
            primitiveAtoms.has(value.name)
          )
            value = term("Struct", value);
          if (p.facet && !hasHead(value, "Facet") && !hasHead(value, "Recur"))
            value = term("Facet", value);
          return root ? value : wrapType(value);
        };
      }
      case "map":
        if (p.identity !== undefined)
          return unavailable(
            "refinement types need a portable predicate description before serialization",
          );
        return encode(p.pattern, root);
      case "label":
        if (p.fallback)
          return unavailable(
            "types with default expressions need a portable default description before serialization",
          );
        return encode(p.pattern);
      case "repeat": {
        const child = encode(p.pattern);
        return (bs) => term(p.collect ? "Collect" : "Repeat", child(bs));
      }
      case "fields": {
        const parts = orderedParts(p.parts);
        const children = parts.map((x) => encode(x));
        return (bs) => {
          const fields: Value = {
            kind: "term",
            head: sym("Fields"),
            body: children.map((child, i) => ({
              label: parts[i].kind === "label" ? parts[i].label : "_" + (i + 1),
              value: child(bs),
            })),
          };
          return p.openLabels || p.ignorePositions
            ? {
                kind: "term",
                head: sym("OpenFields"),
                body: [
                  { label: "_1", value: fields },
                  {
                    label: "labels",
                    value: sym(p.openLabels ? "True" : "False"),
                  },
                  {
                    label: "positional",
                    value: sym(p.ignorePositions ? "True" : "False"),
                  },
                ],
              }
            : fields;
        };
      }
      case "postfix": {
        const op = encode(p.operator);
        const operand = encode(p.operand);
        return (bs) => term("Postfix", op(bs), operand(bs));
      }
      case "node": {
        const h = encode(p.head),
          b = encode(p.body);
        const identity = p.head.kind === "test" ? p.head.identity : undefined;
        const literalHead: Value | undefined =
          Array.isArray(identity) &&
          identity[0] === "literal" &&
          identity[1]?.kind === "symbol"
            ? identity[1]
            : undefined;
        return (bs) => {
          const headValue = literalHead ?? h(bs),
            body = b(bs);
          const negative =
            headValue.kind === "symbol" &&
            headValue.name === "-" &&
            body.kind === "term" &&
            body.body.length === 1 &&
            body.body[0].value.kind === "literal" &&
            (typeof body.body[0].value.value === "number" ||
              isNumeric(body.body[0].value.value));
          if (
            literalHead &&
            headValue.kind === "symbol" &&
            !special(headValue.name) &&
            !negative &&
            body.kind === "term" &&
            body.head.kind === "symbol" &&
            body.head.name === "Fields"
          )
            return { kind: "term", head: headValue, body: body.body };
          return term("Apply", h(bs), body);
        };
      }
      case "union": {
        const flatten = (branch: Pattern<Value>): Pattern<Value>[] =>
          branch.kind === "union" && !branch.preserveSpace
            ? branch.choices.flatMap(flatten)
            : [branch];
        const choices = (
          p.preserveSpace ? p.choices : p.choices.flatMap(flatten)
        ).map((x) => encode(x));
        return (bs) => {
          const values = choices.map((x) => x(bs));
          if (p.preserveSpace) return unionData(values);
          const ordered = values.sort(compare);
          return ordered.length < 2
            ? term("Union", ...ordered)
            : ordered.slice(0, -1).reduceRight(
                (right, left) => ({
                  kind: "term",
                  head: term("|", left),
                  body: [{ label: "_1", value: right }],
                }),
                ordered.at(-1)!,
              );
        };
      }
      case "sequence": {
        const parts = p.parts.map((part) => encode(part));
        return (bs) => term("Sequence", ...parts.map((part) => part(bs)));
      }
      case "row": {
        const part = encode(p.pattern);
        return (bs) => term("Row", part(bs));
      }
      case "reader":
        return unavailable(
          "this pattern needs a structural description before serialization",
        );
    }
  }
  const result = binder(type.key, type.pattern)([]);
  if (
    type.wrappedPrimitive &&
    result.kind === "symbol" &&
    primitiveAtoms.has(result.name)
  )
    return term("Struct", result);
  return type.facet && !hasHead(result, "Facet")
    ? term("Facet", result)
    : result;
}

const hasHead = (v: Value, name: string): boolean =>
  v.kind === "term" && v.head.kind === "symbol" && v.head.name === name;
/**
 * Destination concrete descriptors print as Struct(...).
 * Bootstrap Type(...) rewrites in place, preserving the whole body.
 */
export const wrapType = (description: Value): Value => {
  if (hasHead(description, "Type") && description.kind === "term")
    return { kind: "term", head: sym("Struct"), body: description.body };
  if (
    hasHead(description, "Facet") ||
    hasHead(description, "Struct") ||
    (description.kind === "symbol" && primitiveAtoms.has(description.name)) ||
    hasHead(description, "Recur") ||
    hasHead(description, "UnionType") ||
    hasHead(description, "TreeGrammar")
  )
    return description;
  return term("Struct", description);
};

export const typeData = (type: TypeValue): Value =>
  wrapType(typeDescription(type));

/** Type unions are sets of member descriptions, unlike ordered pattern alternatives. */
export function unionData(members: Value[]): Value {
  const flat = members.flatMap((v) =>
    hasHead(v, "UnionType") && v.kind === "term"
      ? v.body.map((f) => f.value)
      : [v],
  );
  const unique = new Map(flat.map((v) => [descriptionKey(v), v]));
  return term(
    "UnionType",
    ...[...unique].sort((a, b) => compare(a[1], b[1])).map(([, v]) => v),
  );
}

/** Stable keys for the public, capture-free description; no host object IDs. */
export function descriptionKey(v: Value): string {
  const key = (v: Value): unknown => {
    v = bare(v);
    if (v.kind === "symbol") return ["symbol", v.name];
    if (v.kind === "literal")
      return isNumeric(v.value)
        ? ["literal", "rational", ...numericKey(v.value)]
        : ["literal", v.value];
    if (v.kind === "type") return key(typeData(v));
    if (v.kind === "postfix")
      return ["postfix", key(v.operator), key(v.operand)];
    if (v.kind === "term" || v.kind === "pack")
      return [
        v.kind,
        v.kind === "term" ? key(v.head) : null,
        canonicalFields(v.body).map((f) => [f.label, key(f.value)]),
      ];
    return unavailable(
      "functions need a portable environment description before serialization",
    );
  };
  return JSON.stringify(key(v));
}

export interface DescriptionDomain {
  validate: (value: Value) => void;
  primitive: (name: string) => TypeValue | undefined;
  reference: (type: TypeValue) => Pattern<Value>;
  define: (
    body: () => Pattern<Value>,
    facet?: boolean,
    wrappedPrimitive?: boolean,
  ) => TypeValue;
  union: (members: Value[]) => TypeValue;
  treeGrammar: (schema: Value) => TypeValue;
  literal: (value: Value) => Pattern<Value>;
}
/** Interpret only the documented pattern algebra. Never evaluate expression code. */
export function descriptionPattern(
  value: Value,
  domain: DescriptionDomain,
): Pattern<Value> {
  domain.validate(value);
  let work = 0;
  let facetBoundary = false;
  const scope = new DescriptionScope<TypeValue>();
  // Constructor arity, positional packs, flags and reference-index shape have
  // already been checked by the executable schema. This pass interprets them.
  const number = (v: Value): number => {
    const n = integerValue(bare(v) as Value);
    if (n === undefined)
      throw new LanguageError("invalid structural type description");
    return n;
  };
  const args = (v: Extract<Value, { kind: "term" }>): Value[] =>
    v.body.map((f) => f.value);
  function fields(
    v: Extract<Value, { kind: "term" }>,
    path: string[] = [],
  ): Pattern<Value> {
    return {
      kind: "fields",
      parts: canonicalFields(v.body).map((f) => {
        // The surface ** marker is intentionally untyped. Recognize each extra
        // labeled field against the same scalar schema, in its proper role.
        if (!/^_\d+$/.test(f.label)) domain.validate(f.value);
        const p = decode(f.value, [...path, f.label]);
        return p.kind === "repeat"
          ? p
          : { kind: "label", label: f.label, pattern: p };
      }),
    };
  }
  function alternatives(choices: Pattern<Value>[]): Pattern<Value> {
    return { kind: "union", choices };
  }
  function decode(input: Value, path: string[] = []): Pattern<Value> {
    if (++work > 10000)
      return failure("type description exceeds structural budget");
    const v = bare(input);
    const child = (value: Value, part: string) =>
      decode(value, [...path, part]);
    if (v.kind === "type") return domain.reference(v);
    if (v.kind === "literal") return domain.literal(v);
    if (v.kind === "symbol") {
      const primitive = primitiveAtoms.has(v.name)
        ? domain.primitive(v.name)
        : undefined;
      if (primitive) return domain.reference(primitive);
      if (v.name === "_")
        return failure("_ is pattern syntax; use Any in type values");
      return domain.literal(v);
    }
    if (v.kind !== "term")
      return failure("expected expression data in a type description");
    if (
      v.head.kind === "term" &&
      v.head.head.kind === "symbol" &&
      v.head.head.name === "|"
    ) {
      const choices = [
        child(args(v.head)[0], "left"),
        child(args(v)[0], "right"),
      ];
      return alternatives(choices);
    }
    if (v.head.kind === "symbol") {
      switch (v.head.name) {
        case "TreeGrammar":
          return domain.reference(domain.treeGrammar(args(v)[0]));
        case "UnionType":
          // Decode members in this recursive scope. Re-entering the public type
          // constructor here would detach Recur references from their binder.
          return {
            kind: "union",
            preserveSpace: true,
            choices: args(v).map((member, i) =>
              child(member, "member " + (i + 1)),
            ),
          };
        case "Type":
        case "Struct":
        case "Facet": {
          const kind = v.head.name === "Type" ? "Struct" : v.head.name;
          const facet = kind === "Facet";
          const enclosingBoundary = facetBoundary;
          facetBoundary = facet;
          let pattern: Pattern<Value>;
          let input = args(v)[0];
          if (facet) {
            if (input.kind === "type") input = typeDescription(input);
            while (
              input.kind === "term" &&
              input.head.kind === "symbol" &&
              ["Type", "Struct", "Facet"].includes(input.head.name)
            )
              input = args(input)[0];
          }
          try {
            pattern = scope.enter(() => child(input, kind));
          } finally {
            facetBoundary = enclosingBoundary;
          }
          if (!facet && isOpenPattern(pattern))
            return failure(
              "open patterns describe a Facet, not a concrete Type",
            );
          const atom = bare(input);
          const primitive =
            atom.kind === "symbol"
              ? primitiveAtoms.has(atom.name)
              : atom.kind === "type" &&
                [...primitiveAtoms.values()].some(
                  (name) => domain.primitive(name) === atom,
                );
          if (pattern.kind === "ref" && !facet && !primitive) return pattern;
          return domain.reference(
            domain.define(() => pattern, facet, !facet && primitive),
          );
        }
        case "Literal":
          return domain.literal(args(v)[0]);
        case "Apply": {
          const [head, body] = args(v);
          const fields = child(body, "body");
          return {
            kind: "node",
            head: child(head, "head"),
            body: fields,
          };
        }
        case "Postfix": {
          const [operator, operand] = args(v);
          return {
            kind: "postfix",
            operator: child(operator, "operator"),
            operand: child(operand, "operand"),
          };
        }
        case "Fields":
          return fields(v, path);
        case "OpenFields": {
          const flag = (name: string) => {
            const value = v.body.find((f) => f.label === name)!.value;
            return (
              (bare(value) as Extract<Value, { kind: "symbol" }>).name ===
              "True"
            );
          };
          const pattern = child(v.body[0].value, "fields");
          return {
            ...(pattern as Extract<Pattern<Value>, { kind: "fields" }>),
            openLabels: flag("labels"),
            ignorePositions: flag("positional"),
          };
        }
        case "Row":
          return { kind: "row", pattern: child(args(v)[0], "Row") };
        case "Sequence":
          return {
            kind: "sequence",
            parts: args(v).map((x, i) => child(x, "row " + i)),
          };
        case "Collect":
        case "Repeat":
          return {
            kind: "repeat",
            collect: v.head.name === "Collect" || undefined,
            pattern: child(args(v)[0], "Repeat"),
          };
        case "Union":
          return alternatives(
            args(v).map((value, i) => child(value, "alternative " + (i + 1))),
          );
        case "Recursive": {
          const [body] = args(v);
          let pattern: Pattern<Value>;
          const binding = domain.define(() => pattern, facetBoundary);
          pattern = scope.enter(() => child(body, "Recursive"), binding);
          return domain.reference(binding);
        }
        case "Recur": {
          const index = number(args(v)[0]);
          return domain.reference(scope.recursive(index, path));
        }
      }
    }
    return {
      kind: "node",
      head: domain.literal(v.head),
      body: fields(v, path),
    };
  }
  return scope.enter(() => decode(value));
}
