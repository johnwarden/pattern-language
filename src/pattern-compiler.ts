import {
  LanguageError,
  binary,
  spread,
  isCapture,
  isTypeCapture,
  implicitFieldCapture,
  isTypeSpecification,
  fieldPattern,
  positional,
  normal,
  quotePatternHead,
  symbol,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import { any } from "./pattern.ts";
import type { Pattern } from "./pattern.ts";
import { uniqueCaptures, patternCaptures } from "./pattern-captures.ts";
import { isSelfEvaluating } from "./primitive-names.ts";
const anonymousSpread = (node: Syntax) =>
  node.kind === "symbol" && !node.quoted && node.name === "…";
/** Domain adapters supply leaves; all structural pattern syntax is compiled here. */
export interface PatternDomain<T> {
  atom: (node: Syntax) => Pattern<T>;
  head: (node: Syntax, dimensions?: number) => Pattern<T>;
  annotation: (node: Syntax, dimensions?: number) => Pattern<T>;
  repeatedElement: (node: Syntax, dimensions?: number) => Pattern<T>;
  expand: (node: Syntax) => Pattern<T>[] | undefined;
  bareCaptures: boolean;
  captureWrapper?: (annotation: Syntax) => (value: T) => T;
  expression?: (node: Syntax, dimensions?: number) => Pattern<T> | undefined;
  allowIgnoredCaptures?: boolean;
  requireCaptureTypes?: boolean;
  allowDefaults?: boolean;
  /** Keep alternatives in written order (ConcreteType(...)) rather than normalizing them. */
  orderedAlternatives?: boolean;
  defaultValue?: (node: Syntax) => T;
  defaultIdentity?: (node: Syntax) => string;
  validateTypedCapture?: (name: string, annotation: Syntax) => void;
}
export class PatternCompiler<T> {
  domain: PatternDomain<T>;
  private dimensions = 0;
  constructor(domain: PatternDomain<T>, dimensions = 0) {
    this.domain = domain;
    this.dimensions = dimensions;
  }
  compile(n: Syntax): Pattern<T> {
    try {
      return uniqueCaptures(this.compileNode(n));
    } catch (error) {
      if (error instanceof LanguageError) error.at(n.span);
      throw error;
    }
  }
  private compileNode(n: Syntax): Pattern<T> {
    if (n.kind === "quote") {
      return this.compile(quotePatternHead(n.value));
    }
    const union = binary(n, "|");
    if (union)
      return {
        kind: "union",
        ordered: this.domain.orderedAlternatives || undefined,
        choices: union.map((x) => this.compile(x)),
      };
    const annotation = binary(n, "::");
    if (annotation) {
      const anonymous = anonymousSpread(annotation[0]);
      const rest = spread(annotation[0]),
        left = rest ?? annotation[0];
      const typed =
        rest || anonymous
          ? {
              kind: "repeat" as const,
              pattern: this.domain.repeatedElement(
                annotation[1],
                this.dimensions,
              ),
            }
          : this.domain.annotation(annotation[1], this.dimensions);
      if (anonymous) return typed;
      if (
        left.kind === "symbol" &&
        !left.quoted &&
        (isCapture(left.name) || isTypeCapture(left.name) || left.name === "_")
      ) {
        if (isSelfEvaluating(left.name))
          throw new LanguageError(
            "reserved self-evaluating name cannot be captured: " + left.name,
            left.span,
            { code: "E_RESERVED_CAPTURE", phase: "declaration" },
          );
        this.domain.validateTypedCapture?.(left.name, annotation[1]);
        if (this.domain.allowIgnoredCaptures === false && left.name === "_")
          throw new LanguageError(
            "_ is for ignoring a capture; write the field type directly in a type definition",
            left.span,
            { code: "E_TYPE_FIELD", phase: "declaration" },
          );
        return left.name === "_"
          ? typed
          : {
              kind: "capture",
              name: left.name,
              pattern: typed,
              rest: !!rest,
              wrap:
                rest || this.dimensions
                  ? this.domain.captureWrapper?.(annotation[1])
                  : undefined,
              origin: { syntax: left, implicit: false },
            };
      }
      if (rest) throw new LanguageError("rest capture must be lowercase");
      // Intersection: interpret first, then destructure the interpreted value.
      const destructuring = this.compile(left);
      return {
        kind: "reader",
        name: "annotated pattern",
        capturePattern: destructuring,
        inputPattern: typed,
        read: (items, pos, m) =>
          m.scan(typed, items, pos).flatMap((result) =>
            m
              .scan(destructuring, result.fields, 0)
              .filter((r) => r.end === result.fields.length)
              .flatMap((r) => {
                const captures = m.merge(result.captures, r.captures);
                return captures ? [{ ...r, end: result.end, captures }] : [];
              }),
          ),
      };
    }
    const evaluated = this.domain.expression?.(n, this.dimensions);
    if (evaluated) return evaluated;
    if (this.domain.bareCaptures && n.kind === "symbol" && !n.quoted) {
      if (this.domain.allowIgnoredCaptures === false && n.name === "_")
        throw new LanguageError(
          "_ ignores a capture and is not allowed in a type definition",
          n.span,
          { code: "E_TYPE_FIELD", phase: "declaration" },
        );
      if (n.name === "_") return any<T>();
      if (isCapture(n.name)) {
        if (this.domain.requireCaptureTypes)
          throw new LanguageError(
            "capture " +
              n.name +
              " needs a type annotation; type inference is not implemented (write " +
              n.name +
              " :: T)",
            n.span,
            { code: "E_TYPE_INFERENCE_REQUIRED", phase: "declaration" },
          );
        return {
          kind: "capture",
          name: n.name,
          pattern: any<T>(),
          origin: { syntax: n, implicit: false },
        };
      }
    }
    if (n.kind === "block") {
      const parts: Pattern<T>[] = [];
      const marker = (x: Syntax | undefined) => {
        if (x?.kind === "sequence" && x.items.length === 1) x = x.items[0];
        return x?.kind === "symbol" && !x.quoted && x.name === "…";
      };
      for (let i = 0; i < n.lines.length; i++) {
        if (marker(n.lines[i]))
          throw new LanguageError(
            "vertical ... requires a preceding row",
            n.lines[i].span,
            { code: "E_VERTICAL_SPREAD", phase: "declaration" },
          );
        const repeated = marker(n.lines[i + 1]);
        let row = n.lines[i];
        if (row.kind === "sequence" && row.items.length === 1)
          row = row.items[0];
        if (repeated) this.dimensions++;
        let pattern: Pattern<T>;
        try {
          pattern = {
            kind: "row",
            pattern: this.fields(
              row.kind === "pack" ? row.body : [{ label: "_1", value: row }],
              false,
            ),
          };
        } finally {
          if (repeated) this.dimensions--;
        }
        parts.push(
          repeated ? { kind: "repeat", collect: true, pattern } : pattern,
        );
        if (repeated) i++;
      }
      return {
        kind: "node",
        head: this.domain.head({
          kind: "symbol",
          name: "syntaxBlock",
          quoted: true,
        }),
        body: { kind: "sequence", parts },
      };
    }
    if (n.kind === "apply")
      return {
        kind: "node",
        head: this.domain.head(n.head, this.dimensions),
        body: this.fields(n.body, false, n.head),
      };
    if (n.kind === "postfix") {
      return {
        kind: "postfix",
        operator: this.domain.head(symbol(n.operator), this.dimensions),
        operand: this.compile(n.operand),
      };
    }
    return this.domain.atom(n);
  }
  fields(xs: Field<Syntax>[], openLabels = true, head?: Syntax): Pattern<T> {
    const parts: Pattern<T>[] = [];
    let hasRest = false,
      ignorePositions = false;
    for (let i = 0; i < xs.length; i++) {
      const original = xs[i];
      if (
        original.value.kind === "apply" &&
        original.value.head.kind === "symbol" &&
        !original.value.head.quoted &&
        original.value.head.name === "**"
      )
        throw new LanguageError(
          "labeled rest capture is not implemented; use bare ** to ignore extra labels",
          original.value.span,
          { code: "E_KEYWORD_REST_UNSUPPORTED", phase: "declaration" },
        );
      if (original.label === "**") {
        if (i !== xs.length - 1)
          throw new LanguageError("** must be last", original.span);
        openLabels = true;
        continue;
      }
      if (
        original.value.kind === "symbol" &&
        !original.value.quoted &&
        original.value.name === "…"
      ) {
        if (hasRest || ignorePositions)
          throw new LanguageError(
            "only one positional rest or ignore marker is allowed",
            original.span,
          );
        if (xs.slice(i + 1).some((e) => positional(e.label)))
          throw new LanguageError(
            "... must follow positional patterns and precede labels",
            original.span,
          );
        ignorePositions = true;
        continue;
      }
      const { pattern: base, fallback } = fieldPattern(original.value);
      if (fallback && this.domain.allowDefaults === false)
        throw new LanguageError(
          "defaults are forbidden in type descriptions: defaults are only allowed in binding patterns, not type definitions; use an ordinary factory function",
          original.value.span,
          { code: "E_TYPE_DEFAULT", phase: "declaration" },
        );
      if (fallback && positional(original.label))
        throw new LanguageError("defaults require a labeled parameter");
      if (fallback && !this.domain.defaultValue)
        throw new LanguageError(
          "defaults are not supported by this pattern domain",
        );
      const e = {
          ...original,
          value: base,
        },
        annotation = binary(e.value, "::"),
        anonymous = !!annotation && anonymousSpread(annotation[0]),
        rest = anonymous
          ? annotation![0]
          : spread(annotation ? annotation[0] : e.value);
      if (rest) {
        if (fallback)
          throw new LanguageError("rest captures cannot have defaults");
        if (!annotation) {
          const expanded = this.domain.expand(rest);
          if (expanded) {
            parts.push(...expanded);
            continue;
          }
        }
        if (
          this.domain.allowIgnoredCaptures === false &&
          rest.kind === "symbol" &&
          rest.name === "_"
        ) {
          const listType =
            head?.kind === "symbol" && !head.quoted && head.name === "[]";
          if (!listType)
            throw new LanguageError(
              "_ ignores a capture and is not allowed in a type definition",
              e.value.span,
              { code: "E_TYPE_FIELD", phase: "declaration" },
            );
        }
        if (hasRest || ignorePositions)
          throw new LanguageError(
            "only one positional rest or ignore marker is allowed",
            e.value.span,
          );
        if (xs.slice(i + 1).some((e) => positional(e.label)))
          throw new LanguageError(
            "rest capture must be the last positional pattern",
            e.value.span,
          );
        if (
          rest.kind !== "symbol" ||
          rest.quoted ||
          !(anonymous || isCapture(rest.name) || rest.name === "_")
        )
          throw new LanguageError("rest capture must be lowercase");
        hasRest = true;
        if (!annotation && this.domain.requireCaptureTypes)
          throw new LanguageError(
            "rest capture " +
              rest.name +
              " needs an element type; type inference is not implemented (write " +
              rest.name +
              "... :: T*)",
            e.value.span,
            { code: "E_TYPE_INFERENCE_REQUIRED", phase: "declaration" },
          );
        const element = annotation
          ? this.domain.repeatedElement(annotation[1], this.dimensions)
          : any<T>();
        const repeated: Pattern<T> = { kind: "repeat", pattern: element };
        parts.push(
          anonymous || rest.name === "_"
            ? repeated
            : {
                kind: "capture",
                name: rest.name,
                pattern: repeated,
                rest: true,
                wrap: annotation
                  ? this.domain.captureWrapper?.(annotation[1])
                  : undefined,
                origin: { syntax: rest, implicit: false },
              },
        );
        continue;
      }
      const compiled = this.compile(e.value);
      const name =
        !positional(e.label) && !annotation && compiled.kind === "ref"
          ? e.label
          : implicitFieldCapture(e);
      const pattern = compiled;
      parts.push({
        kind: "label",
        label: e.label,
        span: e.span ?? e.value.span,
        pattern: name
          ? {
              kind: "capture",
              name,
              pattern,
              origin: { syntax: e.value, implicit: true },
            }
          : pattern,
        fallback: fallback
          ? () => this.domain.defaultValue!(fallback)
          : undefined,
        defaultIdentity: fallback
          ? (this.domain.defaultIdentity?.(fallback) ?? normal(fallback))
          : undefined,
      });
    }
    return uniqueCaptures({
      kind: "fields",
      parts,
      openLabels,
      ignorePositions,
    });
  }
}

/** Compile binding structure without evaluating annotation/default expressions.
 * Opaque leaves let declaration validation and hygiene use the common compiler
 * before type resolution; inserted syntax can retain its caller's binding scope.
 */
export function bindingPattern(
  nodes: Syntax[],
  typeDefinition = false,
  references = new Set<string>(),
  opaque?: (node: Syntax) => boolean,
): Pattern<never> {
  const compiler: PatternCompiler<never> = new PatternCompiler({
    bareCaptures: true,
    allowIgnoredCaptures: !typeDefinition,
    requireCaptureTypes: typeDefinition,
    allowDefaults: !typeDefinition,
    expression: (n) => {
      if (opaque?.(n)) return any();
      // Inline type expressions own their accessors; they do not bind variables
      // in an enclosing destructuring pattern. Full type validation runs later.
      if (isTypeSpecification(n)) return any();
      if (n.kind === "sequence")
        return {
          kind: "sequence",
          parts: n.items.map((x) => compiler.compile(x)),
        };
      if (
        typeDefinition &&
        n.kind === "symbol" &&
        !n.quoted &&
        references.has(n.name)
      )
        return any();
      return undefined;
    },
    atom: (n) => (n.kind === "pack" ? compiler.fields(n.body) : any()),
    head: (n) => (n.kind === "symbol" ? any() : compiler.compile(n)),
    annotation: () => any(),
    repeatedElement: () => any(),
    expand: (n) =>
      opaque?.(n) ||
      (typeDefinition &&
        n.kind === "symbol" &&
        (/^\p{Lu}/u.test(n.name) || references.has(n.name)))
        ? []
        : undefined,
    defaultValue: () => {
      throw new Error("capture validation does not evaluate defaults");
    },
  });
  try {
    return uniqueCaptures({
      kind: "sequence",
      parts: nodes.map((n) => compiler.compile(n)),
    });
  } catch (error) {
    if (error instanceof LanguageError) error.at(nodes[0]?.span);
    throw error;
  }
}

export function validatePatternCaptures(
  nodes: Syntax[],
  typeDefinition = false,
  references = new Set<string>(),
): Set<string> {
  return patternCaptures(bindingPattern(nodes, typeDefinition, references));
}
