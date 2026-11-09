import {
  primitiveNames,
  isSelfEvaluating,
  isCanonicalAtom,
} from "./primitive-names.ts";
import { parseExpression } from "./parser.ts";
import { syntaxData, codeSource } from "./syntax-values.ts";
import { LanguageError, normal } from "./syntax.ts";
import type { Syntax } from "./syntax.ts";
import type { TypeValue, Value } from "./values.ts";
import {
  unwrap,
  concreteSpace,
  syntaxOrigins,
  equal,
  isRational,
  rationalLiteralParts,
  parseNumericSpelling,
  valRational,
  float64ToRational,
  integerValue,
  isExactFloat32,
  isExactFloat64,
} from "./values.ts";
import { typeIdentity } from "./type-descriptor.ts";
import { typeData, typeDescription, sym, lit } from "./type-data.ts";

const singleton = (value: Syntax) => [{ label: "_1", value }];
const reserved = new Set([
  "Type",
  "UnionType",
  "Facet",
  "**",
  "String",
  "Node",
  "TreeGrammar",
]);
const fail = (message: string, syntax?: Syntax): never => {
  throw new LanguageError(message, syntax?.span, {
    code: "E_DATA_PARSE",
    phase: "parse",
  });
};
export interface TextDomain {
  type: (description: Value) => TypeValue;
  check: (type: TypeValue, value: Value) => Value;
  localName?: (type: TypeValue) => string | undefined;
  localType?: (name: string) => TypeValue | undefined;
  localReferences?: ReadonlyMap<unknown, string>;
}

/** Global data text is independent of lexical scope and quotation provenance. */
export function valueText(
  value: Value,
  domain?: TextDomain,
  expected?: TypeValue,
  expandRootType = false,
): string {
  let steps = 0;
  const implicit = new WeakSet<object>();
  // Omit only interpretations the supplied structural type reconstructs itself.
  // Extra fields and Any payloads keep explicit :: tags when their type is lost.
  if (expected) {
    if (!domain) throw new Error("typed serialization requires a text domain");
    let structural = true;
    try {
      typeDescription(expected);
    } catch (error) {
      if (
        !(error instanceof LanguageError) ||
        error.diagnostic.code !== "E_TYPE_SERIALIZATION"
      )
        throw error;
      structural = false;
    }
    if (structural) {
      const erase = (v: Value): Value => {
        if (v.kind === "slot") return v.type.unionMembers ? erase(v.value) : v;
        v = unwrap(v);
        if (v.kind === "code") return syntaxData(v.tree);
        return v.kind === "term"
          ? {
              ...v,
              head: erase(v.head),
              body: v.body.map((f) => ({ ...f, value: erase(f.value) })),
            }
          : v;
      };
      const printedNumericDesignates = (value: Value, space: TypeValue) => {
        const raw = unwrap(value);
        if (
          raw.kind !== "literal" ||
          isRational(raw.value) ||
          typeof raw.value !== "number"
        )
          return true;
        const parsed = parseNumericSpelling(String(Math.abs(raw.value)));
        if (!parsed) return false;
        const sign = raw.value < 0 || Object.is(raw.value, -0) ? -1n : 1n;
        const rational = { n: sign * parsed.n, d: parsed.d };
        const numeric = space.numeric ?? space.baseType?.numeric;
        if (numeric === "float32") return isExactFloat32(rational);
        if (numeric === "float64") return isExactFloat64(rational);
        return true;
      };
      const collect = (original: Value, reconstructed: Value) => {
        const a = concreteSpace(original),
          b = concreteSpace(reconstructed);
        if (a && b && typeIdentity(a) === typeIdentity(b)) {
          // Keep `::` when untagged printed text would not reconstruct the
          // same member and value (ambiguous, or a different value such as
          // Float64 0.1 vs Rational 1/10).
          if (
            !(
              original.kind === "slot" &&
              original.type.unionMembers &&
              !printedNumericDesignates(original, a)
            )
          )
            implicit.add(original);
        }
        original = unwrap(original);
        reconstructed = unwrap(reconstructed);
        if (
          (original.kind === "term" && reconstructed.kind === "term") ||
          (original.kind === "pack" && reconstructed.kind === "pack")
        ) {
          if (original.kind === "term" && reconstructed.kind === "term")
            collect(original.head, reconstructed.head);
          for (const field of original.body) {
            const other = reconstructed.body.find(
              (f) => f.label === field.label,
            );
            if (other) collect(field.value, other.value);
          }
        }
      };
      try {
        collect(value, domain.check(expected, erase(value)));
      } catch (error) {
        // Facet/Any slots may need their concrete reconstruction tags.
        // Erasure is only a printing optimization, never a new interpretation.
        if (
          !(error instanceof LanguageError) ||
          ![
            "E_PATTERN_MISMATCH",
            "E_AMBIGUOUS_PATTERN",
            "E_CONCRETE_TYPE_REQUIRED",
          ].includes(error.diagnostic.code)
        )
          throw error;
      }
    }
  }
  function syntax(v: Value, root = false, inert = false): Syntax {
    if (++steps > 10000)
      throw new LanguageError("value exceeds serialization budget", undefined, {
        code: "E_SERIALIZATION_LIMIT",
      });
    if (v.kind === "code") {
      if (!v.portable)
        throw new LanguageError(
          "captured Code needs a portable environment before serialization",
          v.tree.span,
          { code: "E_VALUE_SERIALIZATION" },
        );
      codeSource(v.tree);
      if (inert && implicit.has(v)) return v.tree;
      if (
        root &&
        expected &&
        !expected.packaged &&
        typeIdentity(expected.baseType ?? expected) ===
          typeIdentity(v.type.baseType ?? v.type)
      )
        return v.tree;
      return {
        kind: "apply",
        head: {
          kind: "apply",
          head: { kind: "symbol", name: "::", quoted: false },
          body: singleton(v.tree),
        },
        body: singleton(typeSyntax(v.type)),
      };
    }
    if (v.kind === "slot") {
      const code = unwrap(v.value);
      if (code.kind === "code") return syntax(code);
      // Omit `::` when untagged printed text designates a unique member.
      if (v.type.unionMembers && concreteSpace(v) && implicit.has(v))
        return parseExpression(
          valueText(v.value, domain, concreteSpace(v)),
          true,
        );
      return {
        kind: "apply",
        head: {
          kind: "apply",
          head: { kind: "symbol", name: "::", quoted: false },
          body: singleton(
            parseExpression(valueText(v.value, domain, concreteSpace(v)), true),
          ),
        },
        body: singleton(typeSyntax(concreteSpace(v)!)),
      };
    }
    const origin = syntaxOrigins.get(v);
    if (
      origin &&
      !["symbol", "literal", "apply", "pack", "block", "sequence"].includes(
        origin.kind,
      )
    )
      throw new LanguageError(
        "this code value needs a portable syntax/environment description before serialization",
        origin.span,
        { code: "E_VALUE_SERIALIZATION" },
      );
    if (v.kind === "view") {
      // Expression/Body are legacy raw-tree domains. Exact ordinary type-value
      // trees use the same canonical spelling as their compiled cache, just as
      // the constructed Type/UnionType trees handled below do.
      if (
        domain &&
        expected &&
        ["Expression", "Body"].includes(expected.name)
      ) {
        try {
          const compiled = domain.type(unwrap(v));
          if (equal(compiled, v)) return typeSyntax(compiled);
        } catch (error) {
          if (
            !(error instanceof LanguageError) ||
            ![
              "E_TYPE_DESCRIPTION",
              "E_EXPECTED_TYPE",
              "E_TYPE_UNION_SYNTAX",
              "E_TYPE_SERIALIZATION",
              "E_VALUE_REPRESENTATION",
            ].includes(error.diagnostic.code)
          )
            throw error;
        }
      }
      const code = unwrap(v);
      if (code.kind === "code") return syntax(code, root);
      const space = v.space?.baseType ?? v.space;
      if (
        space &&
        !implicit.has(v) &&
        !(
          root &&
          expected &&
          !expected.packaged &&
          typeIdentity(space) === typeIdentity(expected.baseType ?? expected)
        )
      ) {
        return {
          kind: "apply",
          head: {
            kind: "apply",
            head: { kind: "symbol", name: "::", quoted: false },
            body: singleton(syntax(v.base, false, inert)),
          },
          body: singleton(typeSyntax(space)),
        };
      }
      return syntax(v.base, root, inert);
    }
    if (v.kind === "type") return typeSyntax(v, root && expandRootType);
    if (v.kind === "literal") {
      if (isRational(v.value)) {
        const parts = rationalLiteralParts(v.value);
        return {
          kind: "literal",
          value: parts.value,
          spelling: parts.spelling,
        };
      }
      return { kind: "literal", value: v.value };
    }
    if (v.kind === "symbol")
      return {
        kind: "symbol",
        name: v.name,
        quoted:
          expected &&
          [
            "LowerCamelSymbol",
            "UpperCamelSymbol",
            "UpperSnakeSymbol",
            "PunctuationSymbol",
          ].includes(expected.name)
            ? isSelfEvaluating(v.name)
            : !isCanonicalAtom(v.name),
      };
    if (v.kind === "pack")
      return {
        kind: "pack",
        body: v.body.map((f) => ({
          ...f,
          value: syntax(f.value, false, inert),
        })),
      };
    if (v.kind === "postfix") {
      const operator = unwrap(v.operator);
      if (operator.kind !== "symbol")
        throw new LanguageError(
          "functions and result packs need a portable description before serialization",
          undefined,
          { code: "E_VALUE_SERIALIZATION" },
        );
      return {
        kind: "postfix",
        operator: operator.name,
        operand: syntax(v.operand, false, inert),
      };
    }
    if (v.kind === "term") {
      const h = unwrap(v.head);
      if (
        h.kind === "symbol" &&
        ["syntaxBlock", "syntaxSequence"].includes(h.name)
      ) {
        const children = v.body.map((f) => syntax(f.value, false, true));
        return h.name === "syntaxBlock"
          ? { kind: "block", lines: children }
          : { kind: "sequence", items: children };
      }
      // A compiled type and its ordinary constructor tree are the same value.
      // Use the constructor spelling only when decoding preserves that exact tree.
      if (
        domain &&
        h.kind === "symbol" &&
        ["Type", "UnionType", "Facet"].includes(h.name)
      ) {
        try {
          const decoded = domain.type(v);
          if (equal(decoded, v)) return typeSyntax(decoded);
        } catch (error) {
          if (
            !(error instanceof LanguageError) ||
            ![
              "E_TYPE_DESCRIPTION",
              "E_EXPECTED_TYPE",
              "E_TYPE_UNION_SYNTAX",
              "E_TYPE_SERIALIZATION",
              "E_VALUE_REPRESENTATION",
            ].includes(error.diagnostic.code)
          )
            throw error;
        }
      }
      const reservedHead = h.kind === "symbol" && reserved.has(h.name);
      const annotation =
        h.kind === "term" && h.head.kind === "symbol" && h.head.name === "::";
      const negative =
        h.kind === "symbol" &&
        h.name === "-" &&
        v.body.length === 1 &&
        unwrap(v.body[0].value).kind === "literal";
      if (!inert && (reservedHead || annotation || negative)) {
        return {
          kind: "apply",
          head: { kind: "symbol", name: "Node", quoted: false },
          body: [
            { label: "_1", value: syntax(v.head) },
            {
              label: "_2",
              value: {
                kind: "apply",
                head: { kind: "symbol", name: "{}", quoted: false },
                body: v.body.map((f) => ({
                  ...f,
                  value:
                    f.label === "**"
                      ? { kind: "symbol" as const, name: "**", quoted: false }
                      : syntax(f.value, false, inert),
                })),
              },
            },
          ],
        };
      }
      const head =
        h.kind === "symbol"
          ? { kind: "symbol" as const, name: h.name, quoted: false }
          : syntax(v.head, false, inert);
      return {
        kind: "apply",
        head:
          head.kind === "symbol" && ["[]", "{}"].includes(head.name)
            ? { ...head, quoted: false }
            : head,
        body: v.body.map((f) => ({
          ...f,
          value:
            f.label === "**"
              ? { kind: "symbol" as const, name: "**", quoted: false }
              : syntax(f.value, false, inert),
        })),
      };
    }
    throw new LanguageError(
      "functions and result packs need a portable description before serialization",
      undefined,
      { code: "E_VALUE_SERIALIZATION" },
    );
  }
  function typeSyntax(t: TypeValue, expand = false): Syntax {
    const alias = domain?.localName?.(t);
    if (alias && !expand) return parseExpression(alias);
    // Type's argument is pattern data, so its descriptor constructors are literal.
    const referenceNames = new Set(domain?.localReferences?.values());
    const data: Value = domain?.localReferences
      ? (() => {
          const description =
            t.treeGrammar && domain.localName?.(t.treeGrammar)
              ? {
                  kind: "term" as const,
                  head: sym("TreeGrammar"),
                  body: [
                    {
                      label: "_1",
                      value: sym(domain.localName(t.treeGrammar)!),
                    },
                  ],
                }
              : typeDescription(t, domain.localReferences);
          return (description.kind === "symbol" &&
            primitiveNames.has(description.name)) ||
            (description.kind === "term" &&
              description.head.kind === "symbol" &&
              ["Type", "UnionType", "Facet", "TreeGrammar"].includes(
                description.head.name,
              ))
            ? description
            : {
                kind: "term" as const,
                head: sym("Type"),
                body: [{ label: "_1", value: description }],
              };
        })()
      : typeData(t);
    function patternSyntax(v: Value, head = false): Syntax {
      if (v.kind === "symbol")
        return {
          kind: "symbol",
          name: v.name,
          quoted: head
            ? !/^\p{Lu}/u.test(v.name) && !["|", "[]", "{}"].includes(v.name)
            : !isSelfEvaluating(v.name) && !referenceNames.has(v.name),
        };
      if (v.kind === "literal") return syntax(v);
      if (v.kind === "term") {
        const head = patternSyntax(v.head, true);
        if (v.head.kind === "symbol" && v.head.name === "Literal")
          return {
            kind: "apply",
            head,
            body: v.body.map((f) => ({
              ...f,
              value:
                f.label === "**"
                  ? { kind: "symbol" as const, name: "**", quoted: false }
                  : f.value.kind === "symbol"
                    ? {
                        kind: "symbol" as const,
                        name: f.value.name,
                        quoted: true,
                      }
                    : syntax(f.value),
            })),
          };
        return {
          kind: "apply",
          head:
            head.kind === "symbol" && ["[]", "{}"].includes(head.name)
              ? { ...head, quoted: false }
              : head,
          body: v.body.map((f) => ({ ...f, value: patternSyntax(f.value) })),
        };
      }
      throw new LanguageError("invalid structural type description");
    }
    return patternSyntax(data);
  }
  return normal(syntax(value, true));
}

/** Decodes the small data-constructor algebra; it has no evaluator or environment. */
export function parseValueText(
  text: string,
  domain: TextDomain,
  typeExpected = false,
  allowLayout = false,
): Value {
  const source = { name: "serialized value", text };
  const numeric = parseNumericSpelling(text);
  if (numeric && !typeExpected) return valRational(numeric.n, numeric.d);
  let tree: Syntax;
  try {
    tree = parseExpression(text, allowLayout);
  } catch (error) {
    if (error instanceof LanguageError && error.diagnostic.primary)
      error.diagnostic.primary.source = source;
    throw error;
  }
  let work = 0;
  const positional = (
    n: Extract<Syntax, { kind: "apply" }>,
    count?: number,
  ) => {
    if (
      (count !== undefined && n.body.length !== count) ||
      n.body.some((f, i) => f.label !== "_" + (i + 1))
    )
      return fail("invalid data constructor arguments", n);
    return n.body.map((f) => f.value);
  };
  function decode(n: Syntax, pattern = false): Value {
    if (++work > 10000) return fail("value exceeds parsing budget", n);
    if (
      pattern &&
      n.kind !== "quote" &&
      !(n.kind === "symbol" && n.quoted) &&
      !(n.kind === "apply" && n.head.kind === "symbol" && n.head.quoted)
    ) {
      const alias = domain.localType?.(normal(n));
      if (alias) return alias;
    }
    if (n.kind === "literal") {
      if (typeof n.value === "number") {
        const spelling =
          n.spelling ??
          (n.span?.source &&
          n.span.start !== undefined &&
          n.span.end !== undefined
            ? n.span.source.text.slice(n.span.start, n.span.end)
            : undefined);
        const parsed = spelling ? parseNumericSpelling(spelling) : undefined;
        if (parsed) return valRational(parsed.n, parsed.d);
        const rounded = float64ToRational(n.value);
        return valRational(rounded.n, rounded.d);
      }
      return lit(n.value);
    }
    if (n.kind === "quote") return decode(n.value, pattern);
    if (n.kind === "symbol")
      return !n.quoted && primitiveNames.has(n.name)
        ? domain.type(sym(primitiveNames.get(n.name)!))
        : sym(n.name);
    if (n.kind === "block" && !pattern && allowLayout) return syntaxData(n);
    if (n.kind === "block" && n.lines.length === 1)
      return decode(n.lines[0], pattern);
    if (n.kind === "sequence" && n.items.length === 1)
      return decode(n.items[0], pattern);
    if (n.kind === "sequence" && !pattern && allowLayout) return syntaxData(n);
    if (n.kind === "postfix")
      return {
        kind: "postfix",
        operator: { kind: "symbol", name: n.operator },
        operand: decode(n.operand, pattern),
      };
    if (n.kind !== "apply")
      return fail(
        "expected data; blocks, definitions, quotations, and generic calls are not evaluated by parse",
        n,
      );
    if (n.head.kind === "symbol" && n.head.name.startsWith("\0"))
      return fail(
        "interpolation is not allowed in serialized data; encode a literal dollar as $$",
        n,
      );
    if (pattern && n.head.kind === "symbol" && n.head.name === "Literal")
      return {
        kind: "term",
        head: sym("Literal"),
        body: singleton(positional(n, 1)[0]).map((f) => ({
          ...f,
          value: decode(f.value),
        })),
      };
    if (pattern && n.head.kind === "symbol" && n.head.name === "String")
      return decode(n, false);
    if (
      pattern &&
      n.head.kind === "symbol" &&
      n.head.name === "-" &&
      n.body.length === 1 &&
      n.body[0].value.kind === "literal" &&
      typeof n.body[0].value.value === "number"
    )
      return lit(-n.body[0].value.value);
    if (!pattern) {
      if (
        n.head.kind === "apply" &&
        n.head.head.kind === "symbol" &&
        n.head.head.name === "::"
      ) {
        const [value] = positional(n.head, 1),
          [type] = positional(n, 1);
        const tag = decodeType(type);
        if (tag.packaged)
          return fail(
            "a :: tag must identify a concrete type, not an abstract type",
            type,
          );
        return domain.check(
          tag,
          tag.treeGrammar ? syntaxData(value) : decode(value),
        );
      }
      if (n.head.kind === "symbol") {
        if (n.head.name === "NumericSource") {
          const [spelling] = positional(n, 1);
          const text =
            spelling.kind === "literal" && typeof spelling.value === "string"
              ? spelling.value
              : undefined;
          const parsed = text ? parseNumericSpelling(text) : undefined;
          if (!parsed) return fail("malformed numeric source literal", n);
          return valRational(parsed.n, parsed.d);
        }
        if (n.head.name === "TreeGrammar") {
          const [schema] = positional(n, 1);
          return domain.type({
            kind: "term",
            head: sym("TreeGrammar"),
            body: singleton(schema).map((f) => ({
              ...f,
              value: decode(f.value, true),
            })),
          });
        }
        if (n.head.name === "Type" || n.head.name === "Facet")
          return n.head.name === "Type"
            ? domain.type({
                kind: "term",
                head: sym("Type"),
                body: [
                  { label: "_1", value: decode(positional(n, 1)[0], true) },
                ],
              })
            : domain.type({
                kind: "term",
                head: sym("Facet"),
                body: [
                  { label: "_1", value: decode(positional(n, 1)[0], true) },
                ],
              });
        if (n.head.name === "UnionType") {
          positional(n);
          return domain.type(decode(n, true));
        }
        if (n.head.name === "String") {
          const [codes] = positional(n, 1);
          if (
            codes.kind !== "apply" ||
            codes.head.kind !== "symbol" ||
            codes.head.name !== "[]"
          )
            return fail("String requires a list of Unicode code points", n);
          const values = positional(codes).map((x) => integerValue(decode(x)));
          if (
            values.some(
              (n) =>
                n === undefined ||
                !Number.isInteger(n) ||
                n < 0 ||
                n > 0x10ffff ||
                (n >= 0xd800 && n <= 0xdfff),
            )
          )
            return fail("String requires Unicode code points", n);
          return lit(
            values.map((n) => String.fromCodePoint(n as number)).join(""),
          );
        }
        if (n.head.name === "Node") {
          const [head, body] = positional(n, 2);
          if (
            body.kind !== "apply" ||
            body.head.kind !== "symbol" ||
            body.head.name !== "{}"
          )
            return fail("Node requires a head and a braced argument body", n);
          return {
            kind: "term",
            head: decode(head),
            body: body.body.map((f) => ({ ...f, value: decode(f.value) })),
          };
        }
        if (
          n.head.name === "-" &&
          n.body.length === 1 &&
          n.body[0].value.kind === "literal" &&
          typeof n.body[0].value.value === "number"
        )
          return lit(-n.body[0].value.value);
      }
    }
    return {
      kind: "term",
      head:
        n.head.kind === "symbol" ? sym(n.head.name) : decode(n.head, pattern),
      body: n.body.map((f) => ({ ...f, value: decode(f.value, pattern) })),
    };
  }
  function decodeType(n: Syntax): TypeValue {
    const local = domain.localType?.(normal(n));
    if (local) return local;
    const value = decode(n);
    if (value.kind !== "type")
      return fail("a serialized interpretation requires a type value", n);
    return value;
  }
  try {
    const local = typeExpected ? domain.localType?.(normal(tree)) : undefined;
    return local ?? decode(tree);
  } catch (error) {
    if (error instanceof LanguageError) {
      error.diagnostic.primary ??= tree.span;
      if (error.diagnostic.primary)
        error.diagnostic.primary = { ...error.diagnostic.primary, source };
    }
    throw error;
  }
}
