/**
 * Refinement evidence helpers: Predicate case inventory, predicate ids on
 * refined types, and definition-time evidence obligation checking.
 */
import {
  LanguageError,
  binary,
  operator,
  isName,
  fieldPattern,
  positional,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import type { TypeValue, Scope, Closure, Value, Candidate } from "./values.ts";
import { unwrap, asNumeric, equal, valSymbol } from "./values.ts";
import { isRational } from "./rational.ts";
import type { Pattern } from "./pattern.ts";
import { runtimeDependency, patternExpressions } from "./availability.ts";

/** Initial Predicate enum cases from specs/refinement-predicates.md.
 * `isNegative` is also required by overload-disjointness examples in type-values.
 */
export const PREDICATE_CASES = [
  "isNonZero",
  "isPositive",
  "isNegative",
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

/**
 * Replace evidence for a binding. A new binding starts empty; callers then
 * add annotation predicates or copy evidence from a source binding.
 * Keyed by binding identity: shadowing must not keep the shadowed name's set.
 */
export function setEvidence(
  evidence: EvidenceMap,
  name: string,
  ids: Iterable<PredicateId> = [],
): void {
  evidence.set(name, new Set(ids));
}

/** Evidence known for `name` under the binding-identity rule. */
export function evidenceOf(
  evidence: EvidenceMap,
  name: string,
  scope?: Scope,
): Set<PredicateId> {
  if (evidence.has(name)) return new Set(evidence.get(name));
  if (!scope) return new Set();
  // A local binding without an evidence entry starts with none.
  if (scope.bindings.has(name)) return new Set();
  const parent = scope.parent as
    | (Scope & { evidence?: EvidenceMap })
    | undefined;
  if (parent?.evidence) return evidenceOf(parent.evidence, name, parent);
  return new Set();
}

export function hasEvidence(
  evidence: EvidenceMap,
  name: string,
  required: Set<PredicateId>,
  scope?: Scope,
): boolean {
  if (!required.size) return true;
  // A present entry (including an empty tombstone) is this binding's evidence.
  if (evidence.has(name)) {
    const local = evidence.get(name)!;
    return [...required].every((id) => local.has(id));
  }
  if (!scope) return false;
  // Shadowing: a local binding does not inherit parent evidence by name.
  if (scope.bindings.has(name)) return false;
  const parent = scope.parent as
    | (Scope & { evidence?: EvidenceMap })
    | undefined;
  if (parent?.evidence)
    return hasEvidence(parent.evidence, name, required, parent);
  return false;
}

/** Bare name designator after peeling packs and ascriptions. */
function bareDesignator(
  expression: Syntax,
): Extract<Syntax, { kind: "symbol" }> | undefined {
  let n = expression;
  while (true) {
    const annotation = binary(n, "::");
    if (annotation) {
      n = annotation[0];
      continue;
    }
    if (n.kind === "pack" && n.body.length === 1) {
      n = n.body[0].value;
      continue;
    }
    break;
  }
  return n.kind === "symbol" && !n.quoted ? n : undefined;
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

/** Names that carry runtime provenance even after a local binding. */
type RuntimeNames = Set<string>;

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
    runtimeNames: RuntimeNames,
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
      walk(branch.condition, evidence, bound, runtimeNames);
      walk(branch.consequent, thenEvidence, bound, runtimeNames);
      walk(branch.alternative, evidence, bound, runtimeNames);
      return;
    }
    walk(branch.condition, evidence, bound, runtimeNames);
    walk(branch.consequent, evidence, bound, runtimeNames);
    walk(branch.alternative, evidence, bound, runtimeNames);
  };
  const walk = (
    n: Syntax,
    evidence: EvidenceMap,
    bound: Set<string>,
    runtimeNames: RuntimeNames,
  ) => {
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
        walkIf(branch, evidence, bound, runtimeNames);
        return;
      }
      if (n.name === "Definition" || n.name === "MacroRegistration") return;
      for (const [, capture] of n.captures)
        for (const field of capture.fields)
          walk(field.value, evidence, bound, runtimeNames);
      return;
    }
    if (n.kind === "block") {
      const localBound = new Set(bound);
      const localEvidence = copyEvidence(evidence);
      const localRuntime = new Set(runtimeNames);
      for (let i = 0; i < n.lines.length; ) {
        // An if/else occupying the next two lines grants evidence only in the
        // consequent; keep walking any statements that follow the conditional.
        if (i + 1 < n.lines.length) {
          const pair = surfaceIf({
            kind: "block",
            lines: n.lines.slice(i, i + 2),
            span: n.span,
          });
          if (pair) {
            walkIf(pair, localEvidence, localBound, localRuntime);
            i += 2;
            continue;
          }
        }
        const line = n.lines[i++];
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
            walk(expression, localEvidence, localBound, localRuntime);
          for (const field of binding[1])
            walk(field.value, localEvidence, localBound, localRuntime);
          requirePatternEvidence(
            binding[0],
            binding[1],
            localEvidence,
            localBound,
            localRuntime,
            env,
            binders,
            resolveType,
          );
          const rhsRuntime = binding[1].some((field) =>
            expressionDependsOnRuntime(
              field.value,
              env,
              binders,
              localBound,
              localRuntime,
            ),
          );
          // A sole bare RHS name is a direct copy; its evidence transfers.
          const copiedFrom =
            binding[1].length === 1
              ? bareDesignator(binding[1][0].value)
              : undefined;
          for (const name of binders({ kind: "pack", body: binding[0] })) {
            let annotatedType: TypeValue | undefined;
            let annotationEvidence: Set<PredicateId> | undefined;
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
                  annotatedType = resolveType(annotation[1], env);
                  annotationEvidence = predicatesOfType(annotatedType);
                } catch {
                  /* type errors surface elsewhere */
                }
              }
            }
            // New binding identity: clear any shadowed evidence first.
            if (annotationEvidence) setEvidence(localEvidence, name, annotationEvidence);
            else if (copiedFrom)
              setEvidence(
                localEvidence,
                name,
                evidenceOf(localEvidence, copiedFrom.name, env),
              );
            else setEvidence(localEvidence, name);
            if (rhsRuntime) {
              // Preserve runtime provenance through aliases such as `alias = n`.
              localRuntime.add(name);
              env.runtimeBindings.add(name);
              let type = annotatedType;
              if (!type) {
                const source = binding[1]
                  .map((field) =>
                    runtimeSubject(
                      field.value,
                      env,
                      binders,
                      localBound,
                      localRuntime,
                    ),
                  )
                  .find(Boolean);
                if (source) {
                  const prior = env.get(source.name);
                  if (
                    prior &&
                    "kind" in prior &&
                    prior.kind === "slot" &&
                    prior.type?.kind === "type"
                  )
                    type = prior.type;
                }
              }
              if (!type) {
                try {
                  type = resolveType(
                    { kind: "symbol", name: "Any", quoted: false },
                    env,
                  );
                } catch {
                  /* keep undefined only if Any is unavailable */
                }
              }
              if (type)
                env.bindings.set(name, {
                  kind: "slot",
                  type,
                  value: valSymbol("\0runtime"),
                });
            } else {
              localBound.add(name);
              if (annotatedType)
                env.bindings.set(name, {
                  kind: "slot",
                  type: annotatedType,
                  value: valSymbol("\0bound"),
                });
            }
          }
        } else {
          walk(item, localEvidence, localBound, localRuntime);
        }
      }
      return;
    }
    if (n.kind === "pack") {
      for (const field of n.body)
        walk(field.value, evidence, bound, runtimeNames);
      return;
    }
    if (n.kind === "sequence") {
      for (const item of n.items) walk(item, evidence, bound, runtimeNames);
      return;
    }
    if (n.kind === "postfix") {
      walk(n.operand, evidence, bound, runtimeNames);
      return;
    }
    const arrow = operator(n, "->");
    if (arrow) {
      for (const expression of patternExpressions({
        kind: "pack",
        body: arrow[0],
      }))
        walk(expression, evidence, bound, runtimeNames);
      const localEvidence = copyEvidence(evidence);
      const localBound = new Set(bound);
      const localRuntime = new Set(runtimeNames);
      for (const name of binders({ kind: "pack", body: arrow[0] })) {
        let annotatedType: TypeValue | undefined;
        let annotationEvidence: Set<PredicateId> | undefined;
        for (const field of arrow[0]) {
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
              annotatedType = resolveType(annotation[1], env);
              annotationEvidence = predicatesOfType(annotatedType);
            } catch {
              /* type errors surface elsewhere */
            }
          }
        }
        // Lambda parameters are a new binding identity: no inherited evidence.
        setEvidence(localEvidence, name, annotationEvidence ?? []);
        localRuntime.add(name);
        env.runtimeBindings.add(name);
        const type =
          annotatedType ??
          (() => {
            try {
              return resolveType(
                { kind: "symbol", name: "Any", quoted: false },
                env,
              );
            } catch {
              return undefined;
            }
          })();
        if (type)
          env.bindings.set(name, {
            kind: "slot",
            type,
            value: valSymbol("\0runtime"),
          });
      }
      for (const field of arrow[1])
        walk(field.value, localEvidence, localBound, localRuntime);
      return;
    }
    const annotation = binary(n, "::");
    if (annotation) {
      walk(annotation[0], evidence, bound, runtimeNames);
      requireExpressionEvidence(
        annotation[0],
        annotation[1],
        evidence,
        bound,
        runtimeNames,
        env,
        binders,
        resolveType,
      );
      return;
    }
    walk(n.head, evidence, bound, runtimeNames);
    for (const field of n.body)
      walk(field.value, evidence, bound, runtimeNames);
    requireCallEvidence(n, evidence, bound, runtimeNames, env, binders, resolveType);
  };
  walk(body, options.evidence, new Set(), new Set());
}

/** True when `expression` is the bare runtime name (not a computation over it). */
function isDirectRuntimeDesignator(
  expression: Syntax,
  name: string,
): boolean {
  const designator = bareDesignator(expression);
  return !!designator && designator.name === name;
}

function expressionDependsOnRuntime(
  expression: Syntax,
  env: Scope,
  binders: CaptureNames,
  bound: Set<string>,
  runtimeNames: RuntimeNames,
): boolean {
  if (expression.kind === "symbol" && !expression.quoted) {
    if (runtimeNames.has(expression.name)) return true;
  }
  return !!runtimeSubject(expression, env, binders, bound, runtimeNames);
}

function runtimeSubject(
  expression: Syntax,
  env: Scope,
  binders: CaptureNames,
  bound: Set<string>,
  runtimeNames: RuntimeNames,
): Extract<Syntax, { kind: "symbol" }> | undefined {
  if (expression.kind === "symbol" && !expression.quoted) {
    if (runtimeNames.has(expression.name)) return expression;
  }
  const dependency = runtimeDependency(expression, env, binders, bound);
  if (dependency && runtimeNames.has(dependency.name)) return dependency;
  if (
    dependency &&
    !bound.has(dependency.name) &&
    !runtimeNames.has(dependency.name)
  )
    return dependency;
  // A local alias recorded in runtimeNames is found above; peel nested forms.
  if (expression.kind === "symbol" && runtimeNames.has(expression.name))
    return expression;
  return dependency;
}

function requireExpressionEvidence(
  expression: Syntax,
  typeSyntax: Syntax,
  evidence: EvidenceMap,
  bound: Set<string>,
  runtimeNames: RuntimeNames,
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
  requireTypeEvidence(
    expression,
    type,
    evidence,
    bound,
    runtimeNames,
    env,
    binders,
  );
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
  runtimeNames: RuntimeNames,
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
          runtimeNames,
          env,
          binders,
        );
    }
    if (aligned) return;
  }
  const required = predicatesOfSelected(type, expression, env, binders, bound);
  if (!required.size) return;
  const dependency = runtimeSubject(
    expression,
    env,
    binders,
    bound,
    runtimeNames,
  );
  if (!dependency) return;
  // Evidence for `n` does not establish predicates for a computation over `n`.
  if (!isDirectRuntimeDesignator(expression, dependency.name)) {
    throw new LanguageError(
      "missing refinement evidence for computed value from " + dependency.name,
      expression.span,
      {
        code: "E_NO_METHOD",
        phase: "declaration",
        notes: [
          "A runtime computation needs its own evidence before a refined use; input evidence does not transfer.",
        ],
      },
    );
  }
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

/**
 * Predicates required by `type` for this expression. Multi-member unions only
 * contribute predicates from members whose erased base matches the argument's
 * static type (so Float64 does not owe PositiveInt's isPositive).
 */
function predicatesOfSelected(
  type: TypeValue,
  expression: Syntax,
  env: Scope,
  binders: CaptureNames,
  bound: Set<string>,
): Set<PredicateId> {
  const members = type.unionMembers;
  if (!members || members.length <= 1) return predicatesOfType(type);
  void binders;
  void bound;
  let argType: TypeValue | undefined;
  const annotation = binary(expression, "::");
  if (annotation) {
    try {
      // Compare by resolved type when the checker can resolve the ascription.
      // Fall back to the symbol name for simple `:: Int` forms.
      const ascribed = annotation[1];
      if (ascribed.kind === "symbol" && !ascribed.quoted) {
        const binding = env.get(ascribed.name);
        argType =
          binding && "kind" in binding && binding.kind === "type"
            ? binding
            : undefined;
        if (!argType) {
          const matching = members.filter((member) => {
            const base = member.baseType ?? member;
            return base.name === ascribed.name || member.name === ascribed.name;
          });
          if (matching.length)
            return matching.reduce((ids, member) => {
              for (const id of predicatesOfType(member)) ids.add(id);
              return ids;
            }, new Set<PredicateId>());
        }
      }
    } catch {
      /* fall through */
    }
  } else if (expression.kind === "symbol" && !expression.quoted) {
    const binding = env.get(expression.name);
    if (
      binding &&
      "kind" in binding &&
      binding.kind === "slot" &&
      binding.type?.kind === "type"
    )
      argType = binding.type;
  }
  if (argType) {
    const argMembers = argType.unionMembers?.length
      ? argType.unionMembers
      : [argType];
    const required = new Set<PredicateId>();
    let matched = false;
    for (const argMember of argMembers) {
      const argBase = argMember.baseType ?? argMember;
      const matching = members.filter((member) => {
        const base = member.baseType ?? member;
        return (
          base.key === argBase.key ||
          base.name === argBase.name ||
          member.key === argMember.key ||
          member.name === argMember.name ||
          member.key === argType!.key ||
          member.name === argType!.name
        );
      });
      if (!matching.length) continue;
      matched = true;
      for (const member of matching)
        for (const id of predicatesOfType(member)) required.add(id);
    }
    // Typed argument that matches no member: no predicate obligation here.
    return matched ? required : new Set();
  }
  // Untyped designator: do not demand every member's predicates at once.
  return new Set();
}

function requirePatternEvidence(
  pattern: Field<Syntax>[],
  values: Field<Syntax>[],
  evidence: EvidenceMap,
  bound: Set<string>,
  runtimeNames: RuntimeNames,
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
        runtimeNames,
        env,
        binders,
        resolveType,
      );
  }
}

/** Native operators whose trailing operand requires isNonZero evidence. */
const NONZERO_DIVISOR_OPS = new Set(["/", "%", "div", "flDiv"]);

function requireCallEvidence(
  call: Syntax,
  evidence: EvidenceMap,
  bound: Set<string>,
  runtimeNames: RuntimeNames,
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
  if (NONZERO_DIVISOR_OPS.has(head.name)) {
    // Infix `/` is curried as /(dividend)(divisor); a flat two-arg pack is
    // accepted the same way.
    const divisor =
      packs.length >= 2 && packs[1].length === 1
        ? packs[1][0].value
        : packs[0]?.length >= 2
          ? packs[0][1].value
          : undefined;
    if (divisor) {
      const dependency = runtimeSubject(
        divisor,
        env,
        binders,
        bound,
        runtimeNames,
      );
      if (dependency) {
        const required = new Set<PredicateId>(["isNonZero"]);
        if (
          !isDirectRuntimeDesignator(divisor, dependency.name) ||
          !hasEvidence(evidence, dependency.name, required, env)
        )
          throw new LanguageError(
            "missing refinement evidence for " +
              (isDirectRuntimeDesignator(divisor, dependency.name)
                ? dependency.name
                : "computed value from " + dependency.name),
            divisor.span,
            {
              code: "E_NO_METHOD",
              phase: "declaration",
              notes: [
                "A runtime divisor needs isNonZero evidence before /, %, div, or flDiv.",
              ],
            },
          );
      }
    }
  }
  const closures = callableClosures(head.name, env);
  for (const candidate of closures) {
    if (candidate.parameters.length < packs.length) continue;
    const alignments: { param: Field<Syntax>; arg: Syntax }[][] = [];
    let applicable = true;
    for (let p = 0; p < packs.length; p++) {
      const patterns = candidate.parameters[p];
      const args = packs[p];
      if (!patterns || !args) {
        applicable = false;
        break;
      }
      const aligned = alignSuppliedPack(patterns, args);
      if (!aligned) {
        applicable = false;
        break;
      }
      alignments.push(aligned);
    }
    if (!applicable) continue;
    // The complete pack (including tags) decides which overload applies.
    if (
      alignments.some((aligned) =>
        aligned.some(({ param, arg }) => !staticParamCompatible(param, arg)),
      )
    )
      continue;
    for (const aligned of alignments) {
      for (const { param, arg } of aligned) {
        const { pattern } = fieldPattern(param.value);
        const annotation = binary(pattern, "::");
        if (!annotation) continue;
        let paramType: TypeValue;
        try {
          paramType = resolveType(annotation[1], candidate.env);
        } catch {
          continue;
        }
        // Skip refined obligations that the argument's static type cannot meet
        // when another overload covers that type (e.g. Float64 vs PositiveInt).
        if (!argumentMayMeet(arg, paramType, env, resolveType)) continue;
        try {
          requireExpressionEvidence(
            arg,
            annotation[1],
            evidence,
            bound,
            runtimeNames,
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
}

/** Closures reachable as `name` methods or as a callable binding value. */
function callableClosures(name: string, env: Scope): Closure[] {
  const found: Closure[] = [];
  const seen = new Set<number>();
  const add = (candidate: Candidate) => {
    if (candidate.kind === "closure" && !candidate.macro && !seen.has(candidate.id)) {
      seen.add(candidate.id);
      found.push(candidate);
    }
  };
  for (const candidate of env.visible(name)) add(candidate);
  const binding = env.get(name);
  if (binding && "kind" in binding) {
    if (binding.kind === "closure") add(binding);
    else if (binding.kind === "overload")
      for (const candidate of binding.candidates) add(candidate);
    else if (binding.kind === "slot") {
      const value = binding.value;
      if (value && "kind" in value) {
        if (value.kind === "closure") add(value as Closure);
        else if (value.kind === "overload")
          for (const candidate of (value as { candidates: Candidate[] }).candidates)
            add(candidate);
      }
    }
  }
  return found;
}

/**
 * Align supplied arguments with a parameter pack, allowing omitted defaults.
 * Returns the supplied pairs, or undefined when a required parameter is missing.
 */
function alignSuppliedPack(
  patterns: Field<Syntax>[],
  args: Field<Syntax>[],
): { param: Field<Syntax>; arg: Syntax }[] | undefined {
  const used = new Set<number>();
  const aligned: { param: Field<Syntax>; arg: Syntax }[] = [];
  for (const arg of args) {
    const index = !positional(arg.label)
      ? patterns.findIndex((field) => field.label === arg.label)
      : patterns.findIndex(
          (field, i) => !used.has(i) && positional(field.label),
        );
    if (index < 0) return;
    used.add(index);
    aligned.push({ param: patterns[index], arg: arg.value });
  }
  for (let i = 0; i < patterns.length; i++) {
    if (used.has(i)) continue;
    const { fallback } = fieldPattern(patterns[i].value);
    if (!fallback) return;
  }
  return aligned;
}

/**
 * Constant tag/literal parameters must agree with a statically known argument.
 * Type-only parameters do not exclude a candidate here.
 */
function staticParamCompatible(param: Field<Syntax>, arg: Syntax): boolean {
  const { pattern } = fieldPattern(param.value);
  const annotation = binary(pattern, "::");
  const core = annotation?.[0] ?? pattern;
  if (core.kind !== "symbol" || !core.quoted) return true;
  let subject = arg;
  while (true) {
    const ascribed = binary(subject, "::");
    if (ascribed) {
      subject = ascribed[0];
      continue;
    }
    if (subject.kind === "pack" && subject.body.length === 1) {
      subject = subject.body[0].value;
      continue;
    }
    break;
  }
  if (subject.kind !== "symbol") return true;
  return subject.name === core.name;
}

/**
 * Whether this argument's static type can inhabit `paramType` after predicate
 * erasure. Used to avoid demanding PositiveInt evidence when the argument is
 * already typed as Float64 and a Float64 overload exists.
 */
function argumentMayMeet(
  argument: Syntax,
  paramType: TypeValue,
  env: Scope,
  resolveType: TypeResolver,
): boolean {
  let argType: TypeValue | undefined;
  const annotation = binary(argument, "::");
  if (annotation) {
    try {
      argType = resolveType(annotation[1], env);
    } catch {
      return true;
    }
  } else if (argument.kind === "symbol" && !argument.quoted) {
    const binding = env.get(argument.name);
    if (
      binding &&
      "kind" in binding &&
      binding.kind === "slot" &&
      binding.type?.kind === "type"
    )
      argType = binding.type;
  }
  if (!argType) return true;
  const argBases = (argType.unionMembers?.length
    ? argType.unionMembers
    : [argType]
  ).map((member) => member.baseType ?? member);
  const paramBases = (paramType.unionMembers ?? [paramType]).map(
    (member) => member.baseType ?? member,
  );
  return argBases.some((argBase) =>
    paramBases.some(
      (base) =>
        base.key === argBase.key ||
        base.name === argBase.name ||
        base.name === "Any" ||
        argBase.name === "Any",
    ),
  );
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
  if (name === "isNegative") return n.n < 0n;
  return n.n > 0n;
}
