/**
 * Refinement evidence helpers: Predicate case inventory, predicate ids on
 * refined types, and definition-time evidence obligation checking.
 */
import { LanguageError, binary, operator, isName } from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import type { TypeValue, Scope, Closure, Value } from "./values.ts";
import { unwrap, asNumeric, equal } from "./values.ts";
import { isRational } from "./rational.ts";
import type { Pattern } from "./pattern.ts";
import { runtimeDependency, patternExpressions } from "./availability.ts";

/** Initial Predicate enum cases from specs/refinement-predicates.md. */
export const PREDICATE_CASES = [
  "isNonZero",
  "isPositive",
  "isSquare",
] as const;
export type PredicateCase = (typeof PREDICATE_CASES)[number];

export function isPredicateCase(name: string): name is PredicateCase {
  return (PREDICATE_CASES as readonly string[]).includes(name);
}

/** Structural predicate id stored on refinement map patterns. */
export type PredicateId = string;

export function predicateIdFromIdentity(
  identity: unknown,
): PredicateId | undefined {
  if (
    Array.isArray(identity) &&
    identity[0] === "predicate" &&
    identity.length >= 2
  ) {
    const id = identity[1];
    if (typeof id === "string") return id;
    if (typeof id === "number") return "fn:" + id;
    if (Array.isArray(id)) return "fn:" + id.join(",");
  }
}

/** Collect predicate ids required by a type (including nested refinements). */
export function predicatesOfType(type: TypeValue): Set<PredicateId> {
  const found = new Set<PredicateId>();
  // Use the type's own key, not structural typeIdentity: a named alias such as
  // `def Positive … .where …` shares typeIdentity with its refinement body, and
  // collapsing those would skip the map that carries the predicate id.
  const seen = new Set<string>();
  const visitType = (t: TypeValue) => {
    if (seen.has(t.key)) return;
    seen.add(t.key);
    if (t.unionMembers) {
      for (const m of t.unionMembers) visitType(m);
      return;
    }
    visitPattern(t.pattern());
  };
  const visitPattern = (p: Pattern<Value>) => {
    switch (p.kind) {
      case "map": {
        const id = predicateIdFromIdentity(p.identity);
        if (id) found.add(id);
        visitPattern(p.pattern);
        break;
      }
      case "ref":
        if (
          p.referent &&
          typeof p.referent === "object" &&
          "kind" in p.referent &&
          (p.referent as TypeValue).kind === "type"
        )
          visitType(p.referent as TypeValue);
        else visitPattern(p.resolve());
        break;
      case "capture":
      case "label":
      case "row":
        visitPattern(p.pattern);
        break;
      case "union":
        for (const c of p.choices) visitPattern(c);
        break;
      // Structural shapes keep nested field/element refinements on those
      // slots; they are not obligations on the compound value as a whole.
      default:
        break;
    }
  };
  visitType(type);
  return found;
}

export type EvidenceMap = Map<string, Set<PredicateId>>;

export function emptyEvidence(): EvidenceMap {
  return new Map();
}

export function copyEvidence(evidence: EvidenceMap): EvidenceMap {
  const copy: EvidenceMap = new Map();
  for (const [name, ids] of evidence) copy.set(name, new Set(ids));
  return copy;
}

export function addEvidence(
  evidence: EvidenceMap,
  name: string,
  ids: Iterable<PredicateId>,
): void {
  let set = evidence.get(name);
  if (!set) {
    set = new Set();
    evidence.set(name, set);
  }
  for (const id of ids) set.add(id);
}

export function hasEvidence(
  evidence: EvidenceMap,
  name: string,
  required: Set<PredicateId>,
  scope?: Scope,
): boolean {
  if (!required.size) return true;
  const local = evidence.get(name);
  if (local && [...required].every((id) => local.has(id))) return true;
  if (!scope) return false;
  const parent = scope.parent as
    | (Scope & { evidence?: EvidenceMap })
    | undefined;
  if (parent?.evidence)
    return hasEvidence(parent.evidence, name, required, parent);
  return false;
}

/** `x .matches T` desugars to matches(x)(T). */
export function matchesCheck(
  condition: Syntax,
):
  | { subject: Extract<Syntax, { kind: "symbol" }>; type: Syntax }
  | undefined {
  if (condition.kind !== "apply") return;
  const inner = condition.head;
  if (inner.kind !== "apply") return;
  if (!isName(inner.head, "matches")) return;
  if (inner.body.length !== 1 || condition.body.length !== 1) return;
  const subject = inner.body[0].value;
  if (subject.kind !== "symbol" || subject.quoted) return;
  return { subject, type: condition.body[0].value };
}

/**
 * Definition bodies may still hold surface `if cond … else …` sequences
 * before IfExpression elaboration. Recognize both shapes.
 */
export function surfaceIf(
  n: Syntax,
):
  | { condition: Syntax; consequent: Syntax; alternative: Syntax }
  | undefined {
  if (n.kind === "form" && n.name === "IfExpression") {
    const condition = n.captures.get("condition")?.fields[0]?.value;
    const consequent = n.captures.get("consequent")?.fields[0]?.value;
    const alternative = n.captures.get("alternative")?.fields[0]?.value;
    if (condition && consequent && alternative)
      return { condition, consequent, alternative };
    return;
  }
  if (n.kind !== "block" || n.lines.length < 2) return;
  const first =
    n.lines[0].kind === "sequence" && n.lines[0].items.length >= 3
      ? n.lines[0]
      : undefined;
  const second =
    n.lines[1].kind === "sequence" && n.lines[1].items.length >= 2
      ? n.lines[1]
      : undefined;
  if (
    !first ||
    !second ||
    first.items[0].kind !== "symbol" ||
    first.items[0].quoted ||
    first.items[0].name !== "if" ||
    second.items[0].kind !== "symbol" ||
    second.items[0].quoted ||
    second.items[0].name !== "else"
  )
    return;
  return {
    condition: first.items[1],
    consequent: first.items[2],
    alternative: second.items[1],
  };
}

export type TypeResolver = (syntax: Syntax, env: Scope) => TypeValue;
export type CaptureNames = (pattern: Syntax) => Set<string>;

/**
 * Walk a function body and reject refined uses of runtime names that lack
 * evidence. Constants are left to ordinary evaluation.
 */
export function checkBodyEvidence(options: {
  body: Syntax;
  env: Scope;
  evidence: EvidenceMap;
  binders: CaptureNames;
  resolveType: TypeResolver;
}): void {
  const { body, env, binders, resolveType } = options;
  const walkIf = (
    branch: { condition: Syntax; consequent: Syntax; alternative: Syntax },
    evidence: EvidenceMap,
    bound: Set<string>,
  ) => {
    const check = matchesCheck(branch.condition);
    if (check) {
      let type: TypeValue | undefined;
      try {
        type = resolveType(check.type, env);
      } catch {
        type = undefined;
      }
      const thenEvidence = copyEvidence(evidence);
      if (type)
        addEvidence(thenEvidence, check.subject.name, predicatesOfType(type));
      walk(branch.condition, evidence, bound);
      walk(branch.consequent, thenEvidence, bound);
      walk(branch.alternative, evidence, bound);
      return;
    }
    walk(branch.condition, evidence, bound);
    walk(branch.consequent, evidence, bound);
    walk(branch.alternative, evidence, bound);
  };
  const walk = (n: Syntax, evidence: EvidenceMap, bound: Set<string>) => {
    if (
      n.kind === "literal" ||
      n.kind === "symbol" ||
      n.kind === "quote" ||
      n.kind === "typedQuote" ||
      n.kind === "template"
    )
      return;
    if (n.kind === "form") {
      const branch = surfaceIf(n);
      if (branch) {
        walkIf(branch, evidence, bound);
        return;
      }
      if (n.name === "Definition" || n.name === "MacroRegistration") return;
      for (const [, capture] of n.captures)
        for (const field of capture.fields) walk(field.value, evidence, bound);
      return;
    }
    if (n.kind === "block") {
      const branch = surfaceIf(n);
      if (branch) {
        walkIf(branch, evidence, bound);
        return;
      }
      const localBound = new Set(bound);
      const localEvidence = copyEvidence(evidence);
      for (const line of n.lines) {
        const item =
          line.kind === "sequence" && line.items.length === 1
            ? line.items[0]
            : line;
        const binding = operator(item, "=");
        if (binding) {
          for (const expression of patternExpressions({
            kind: "pack",
            body: binding[0],
          }))
            walk(expression, localEvidence, localBound);
          for (const field of binding[1])
            walk(field.value, localEvidence, localBound);
          requirePatternEvidence(
            binding[0],
            binding[1],
            localEvidence,
            localBound,
            env,
            binders,
            resolveType,
          );
          for (const name of binders({ kind: "pack", body: binding[0] })) {
            localBound.add(name);
            for (const field of binding[0]) {
              const annotation = binary(field.value, "::");
              const capture =
                field.value.kind === "symbol"
                  ? field.value
                  : annotation?.[0].kind === "symbol"
                    ? annotation[0]
                    : undefined;
              if (!capture || capture.quoted || capture.name !== name) continue;
              if (annotation) {
                try {
                  addEvidence(
                    localEvidence,
                    name,
                    predicatesOfType(resolveType(annotation[1], env)),
                  );
                } catch {
                  /* type errors surface elsewhere */
                }
              }
            }
          }
        } else {
          walk(item, localEvidence, localBound);
        }
      }
      return;
    }
    if (n.kind === "pack") {
      for (const field of n.body) walk(field.value, evidence, bound);
      return;
    }
    if (n.kind === "sequence") {
      for (const item of n.items) walk(item, evidence, bound);
      return;
    }
    if (n.kind === "postfix") {
      walk(n.operand, evidence, bound);
      return;
    }
    const annotation = binary(n, "::");
    if (annotation) {
      walk(annotation[0], evidence, bound);
      requireExpressionEvidence(
        annotation[0],
        annotation[1],
        evidence,
        bound,
        env,
        binders,
        resolveType,
      );
      return;
    }
    walk(n.head, evidence, bound);
    for (const field of n.body) walk(field.value, evidence, bound);
    requireCallEvidence(n, evidence, bound, env, binders, resolveType);
  };
  walk(body, options.evidence, new Set());
}

function requireExpressionEvidence(
  expression: Syntax,
  typeSyntax: Syntax,
  evidence: EvidenceMap,
  bound: Set<string>,
  env: Scope,
  binders: CaptureNames,
  resolveType: TypeResolver,
  typeEnv: Scope = env,
): void {
  let type: TypeValue;
  try {
    type = resolveType(typeSyntax, typeEnv);
  } catch {
    return;
  }
  requireTypeEvidence(expression, type, evidence, bound, env, binders);
}

/** Positional field types from a struct/constructor type pattern. */
function fieldTypesOf(type: TypeValue): TypeValue[] | undefined {
  const fields: TypeValue[] = [];
  const visit = (p: Pattern<Value>): boolean => {
    switch (p.kind) {
      case "ref":
        if (
          p.referent &&
          typeof p.referent === "object" &&
          "kind" in p.referent &&
          (p.referent as TypeValue).kind === "type"
        )
          return visit((p.referent as TypeValue).pattern());
        return visit(p.resolve());
      case "capture":
      case "label":
      case "row":
      case "map":
        return visit(p.pattern);
      case "union":
        // Ambiguous field shape — not a single constructor alignment.
        return false;
      case "fields":
        for (const part of p.parts) {
          if (!visitFieldPart(part)) return false;
        }
        return true;
      case "sequence":
        for (const part of p.parts) {
          if (!visitFieldPart(part)) return false;
        }
        return true;
      case "node":
        return visit(p.body);
      default:
        return false;
    }
  };
  const visitFieldPart = (p: Pattern<Value>): boolean => {
    if (p.kind === "label" || p.kind === "row") return visitFieldPart(p.pattern);
    if (p.kind === "capture") return visitFieldPart(p.pattern);
    if (
      p.kind === "ref" &&
      p.referent &&
      typeof p.referent === "object" &&
      "kind" in p.referent &&
      (p.referent as TypeValue).kind === "type"
    ) {
      fields.push(p.referent as TypeValue);
      return true;
    }
    // Typed field stored as map/ref chain.
    if (p.kind === "map") return visitFieldPart(p.pattern);
    return false;
  };
  if (!visit(type.pattern())) return;
  return fields.length ? fields : undefined;
}

function requireTypeEvidence(
  expression: Syntax,
  type: TypeValue,
  evidence: EvidenceMap,
  bound: Set<string>,
  env: Scope,
  binders: CaptureNames,
): void {
  // Align constructor arguments with struct field refinements (including
  // each member of an abstract union of shapes).
  if (expression.kind === "apply" && expression.body.length) {
    const members = type.unionMembers ?? [type];
    let aligned = false;
    for (const member of members) {
      const fieldTypes = fieldTypesOf(member);
      if (!fieldTypes || fieldTypes.length !== expression.body.length) continue;
      aligned = true;
      for (let i = 0; i < fieldTypes.length; i++)
        requireTypeEvidence(
          expression.body[i].value,
          fieldTypes[i],
          evidence,
          bound,
          env,
          binders,
        );
    }
    if (aligned) return;
  }
  const required = predicatesOfType(type);
  if (!required.size) return;
  const dependency = runtimeDependency(expression, env, binders, bound);
  if (!dependency) return;
  if (hasEvidence(evidence, dependency.name, required, env)) return;
  throw new LanguageError(
    "missing refinement evidence for " + dependency.name,
    dependency.span ?? expression.span,
    {
      code: "E_NO_METHOD",
      phase: "declaration",
      notes: [
        "A runtime value needs evidence from its type or an explicit check before a refined use.",
      ],
    },
  );
}

function requirePatternEvidence(
  pattern: Field<Syntax>[],
  values: Field<Syntax>[],
  evidence: EvidenceMap,
  bound: Set<string>,
  env: Scope,
  binders: CaptureNames,
  resolveType: TypeResolver,
): void {
  if (pattern.length === 1 && values.length === 1) {
    const annotation = binary(pattern[0].value, "::");
    if (annotation)
      requireExpressionEvidence(
        values[0].value,
        annotation[1],
        evidence,
        bound,
        env,
        binders,
        resolveType,
      );
  }
}

function requireCallEvidence(
  call: Syntax,
  evidence: EvidenceMap,
  bound: Set<string>,
  env: Scope,
  binders: CaptureNames,
  resolveType: TypeResolver,
): void {
  if (call.kind !== "apply") return;
  let head: Syntax = call.head;
  const packs: Field<Syntax>[][] = [call.body];
  while (head.kind === "apply") {
    packs.unshift(head.body);
    head = head.head;
  }
  if (head.kind !== "symbol" || head.quoted) return;
  const candidates = env
    .visible(head.name)
    .filter((c): c is Closure => c.kind === "closure" && !c.macro);
  if (!candidates.length) return;
  for (const candidate of candidates) {
    const patterns = candidate.parameters[0];
    const args = packs[packs.length - 1];
    if (!patterns || !args) continue;
    if (patterns.length !== args.length) continue;
    for (let i = 0; i < patterns.length; i++) {
      const annotation = binary(patterns[i].value, "::");
      if (!annotation) continue;
      try {
        requireExpressionEvidence(
          args[i].value,
          annotation[1],
          evidence,
          bound,
          env,
          binders,
          resolveType,
          candidate.env,
        );
      } catch (error) {
        if (
          error instanceof LanguageError &&
          error.diagnostic.code === "E_NO_METHOD"
        )
          throw error;
      }
    }
  }
}

/** Boolean tests for the initial Predicate cases. */
export function predicateTest(name: PredicateCase, value: Value): boolean {
  const v = unwrap(value);
  if (name === "isSquare") {
    if (v.kind !== "term" || v.body.length < 2) return false;
    const w = v.body[0]?.value;
    const h = v.body[1]?.value;
    if (!w || !h) return false;
    return equal(w, h);
  }
  const n = asNumeric(value);
  if (!n) return false;
  if (name === "isNonZero") {
    if (isRational(n)) return n.n !== 0n;
    return n.real.n !== 0n || n.imaginary.n !== 0n;
  }
  if (!isRational(n)) return false;
  return n.n > 0n;
}
