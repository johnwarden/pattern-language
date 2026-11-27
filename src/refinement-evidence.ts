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
          for (const name of binders({ kind: "pack", body: binding[0] })) {
            if (rhsRuntime) {
              // Preserve runtime provenance through aliases such as `alias = n`.
              localRuntime.add(name);
            } else {
              localBound.add(name);
              for (const field of binding[0]) {
                const annotation = binary(field.value, "::");
                const capture =
                  field.value.kind === "symbol"
                    ? field.value
                    : annotation?.[0].kind === "symbol"
                      ? annotation[0]
                      : undefined;
                if (!capture || capture.quoted || capture.name !== name)
                  continue;
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
  return n.kind === "symbol" && !n.quoted && n.name === name;
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
    const argBase = argType.baseType ?? argType;
    const matching = members.filter((member) => {
      const base = member.baseType ?? member;
      return (
        base.key === argBase.key ||
        base.name === argBase.name ||
        member.key === argType!.key ||
        member.name === argType!.name
      );
    });
    if (matching.length)
      return matching.reduce((ids, member) => {
        for (const id of predicatesOfType(member)) ids.add(id);
        return ids;
      }, new Set<PredicateId>());
    // Typed argument that matches no member: no predicate obligation here.
    return new Set();
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
  const candidates = env.visible(head.name);
  const closures = candidates.filter(
    (c): c is Closure => c.kind === "closure" && !c.macro,
  );
  for (const candidate of closures) {
    if (candidate.parameters.length < packs.length) continue;
    let applicable = true;
    for (let p = 0; p < packs.length; p++) {
      const patterns = candidate.parameters[p];
      const args = packs[p];
      if (!patterns || !args || patterns.length !== args.length) {
        applicable = false;
        break;
      }
    }
    if (!applicable) continue;
    for (let p = 0; p < packs.length; p++) {
      const patterns = candidate.parameters[p];
      const args = packs[p];
      for (let i = 0; i < patterns.length; i++) {
        const annotation = binary(patterns[i].value, "::");
        if (!annotation) continue;
        let paramType: TypeValue;
        try {
          paramType = resolveType(annotation[1], candidate.env);
        } catch {
          continue;
        }
        // Skip refined obligations that the argument's static type cannot meet
        // when another overload covers that type (e.g. Float64 vs PositiveInt).
        if (!argumentMayMeet(args[i].value, paramType, env, resolveType))
          continue;
        try {
          requireExpressionEvidence(
            args[i].value,
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
  const argBase = argType.baseType ?? argType;
  const paramBases = (paramType.unionMembers ?? [paramType]).map(
    (member) => member.baseType ?? member,
  );
  return paramBases.some(
    (base) =>
      base.key === argBase.key ||
      base.name === argBase.name ||
      base.name === "Any" ||
      argBase.name === "Any",
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
