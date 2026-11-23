# Should `match` arms be disjoint?

**Status:** decisions recorded (PR discussion); runtime still ordered first-match.
Arm-separator change is deferred (`->` kept). Open items below are decided
in outline (Jonathan review); enforcement waits on implementation.
**Related:** [type-values § Match arm domains](../specs/type-values.md#match-arm-domains),
[GRAMMAR](../GRAMMAR.md) (shared patterns),
[VALUE-SPACES](../VALUE-SPACES.md#refinement-evidence-and-functions),
[ambiguous-values](../specs/ambiguous-values.md),
[#88 type-value consolidation](https://github.com/johnwarden/pattern-language/pull/88).

Sketches in the background sections are indented (display-only). Executable
contracts live as `todo` / ordinary fences under
[specs/type-values.md](../specs/type-values.md#match-arm-domains) on this branch
(based on `master` after the #88 squash).

## Decided

Jonathan (seed, with later clarification: *“one trailing error”* was a typo for
*“one trailing else/catch-all”*), plus follow-ups on this PR:

1. **Match arms are pairwise disjoint**, under the same domain rule as
   overloads. Overlap is rejected; there is no ordered first-match priority
   among peer arms.
2. **One scrutinee value:** a single `match` takes one unlabeled value.
   Bind positional or labeled function results to locals before matching
   one of them.
3. **At most one trailing `else`**, and only last. Its body is an ordinary
   expression. Its domain is the values the peer arms leave uncovered.
   See the coverage rule for abstract unions below.
4. **Overlap diagnostic:** `E_OVERLAPPING_MATCH_ARMS` (not `E_AMBIGUOUS_CALL`,
   not `E_AMBIGUOUS_VALUE_DESIGNATOR`).
5. **Compare peers with refinement predicates erased.** Require structurally
   disjoint domains. When disjointness cannot be proved, raise
   `E_OVERLAPPING_MATCH_ARMS` and explain why. The checker still requires
   evidence for any refined binding in the selected arm. An explicit prior
   check can supply it. Use `if` / `.matches` inside one base-type arm for
   ordered predicate tests.
6. **Union binding patterns are disallowed** in match arms and function
   signatures. Use separate arms or definitions. Union type annotations remain.
7. **Compare arms on possible values of the scrutinee's static type.**
   Count one-boundary projection as part of matching the same input.
   An `Outer` arm can bind the wrapper and an `Inner` arm can bind its
   immediate member. The arms overlap because one `Outer` input permits both.
   A raw `Box(3)` given different concrete interpretations by otherwise
   disjoint arms raises `E_AMBIGUOUS_VALUE_DESIGNATOR`.
8. **Peer arms keep `->` for now.** `.then` is rejected; a future `when` /
   `else` newline-bounded layout may be revisited (see Deferred).

Runtime matching is still **ordered first-match**. GRAMMAR and the type-values
section state the decision as not yet enforced. Peer arms keep `->` (deferred
below); do not migrate arm syntax in this PR.

### Reconcile with #88

#88 is squash-merged on `master` (`e8ae940`). This branch is rebased onto that
tip. The disjoint-arm rule lives in
[`specs/type-values.md`](../specs/type-values.md#match-arm-domains), replacing
the former ordered first-match / Peer-match stub under Overload domains.

## Migration inventory (existing overlapping / ordered-priority uses)

Most live multi-arm matches are already pairwise disjoint or use a trailing
`_` / residual. Implementation must revisit:

### A. Peer overlap / new contracts

| Location | Why |
| --- | --- |
| [specs/type-values.md](../specs/type-values.md#match-arm-domains) | Overlapping Int arms; Outer/Inner projection overlap; refinement peers; mid/`else` residual; union binding patterns |
| [tests/matching/open-fields.test](../tests/matching/open-fields.test) | Union parameter / union arm cases to migrate to separate arms |
| [tests/matching/hygiene.test](../tests/matching/hygiene.test) | Generated union lambda |
| [src/type-schema.ts](../src/type-schema.ts) | Inline tag alternatives in binding-pattern shape |

### B. Designation ambiguity (not arm overlap)

| Location | Why |
| --- | --- |
| type-values — bare `Box(3)` across Int/Float field arms | `E_AMBIGUOUS_VALUE_DESIGNATOR` in either order. The explicit `:: NumBox` ambiguity is a separate control. |
| [open-fields.test](../tests/matching/open-fields.test) — within-arm `(Box(Int) \| Box(Float))` | Same designation class |

### C. Trailing `_` after a more specific arm

Migrate to `else` when residual coverage is implemented. Examples:
[types.test](../tests/examples/types.test),
[quotes/evaluation.test](../tests/quotes/evaluation.test),
[quoted-heads.test](../tests/matching/quoted-heads.test),
[call-label-spacing.test](../tests/layout/call-label-spacing.test),
[type-schema.pattern](../examples/type-schema.pattern).

### D. Prose that still teaches ordered first-match

[tutorial/pages/04-choose-a-matching-arm.md](../tutorial/pages/04-choose-a-matching-arm.md),
[tutorial/TEACHING-PLAN.md](../tutorial/TEACHING-PLAN.md),
[README.md](../README.md), [VISION.md](../VISION.md).

---

## Background (options considered)

| | Rule | Outcome |
| --- | --- | --- |
| **A** | Ordered first-match (status quo) | Rejected as the default. |
| **B** | Disjoint arms everywhere, no residual sugar | Too harsh without a residual story. |
| **C** | Two constructs | Rejected (one construct). |
| **D / B′** | Disjoint peers + one trailing `else` catch-all | **Accepted.** |

---

## Deferred: match arm separator (keep `->` for now)

**Decision (Jonathan):** keep `->` for match arms for now.

Motivation considered: `->` reads as a function (a true function catch-all
would look like `(...) -> 'default'`), and `=>` has the same problem.
`.then` is **rejected**. A possible future direction is `when` / `else` as
match-clause keywords with newline-bounded bodies (sketches below); do not
migrate arm syntax until that is revisited.

    match value
      when String
        "string"
      when Int
        "int"
      else
        "neither"
    end

Same-line juxtaposition (`when String "string"`) is not the future shape —
see analysis.

### Analysis (against current grammar; retained)

**Shared baseline.** Match is a multiline layout form closed by aligned `end`
([GRAMMAR](../GRAMMAR.md), [default.pattern](../default.pattern)
`MatchExpression`). Arms are not first-class functions. Infix operators need
spaces; dotted forms are ordinary application (`a .b c` → `b(a)(c)`).
Juxtaposition / call spacing distinguishes tight `f(a)` from spaced `f a`.
[#99](https://github.com/johnwarden/pattern-language/pull/99) requires explicit
grouping for mixed infix chains; dotted word operators keep master’s reading;
`->` leaves a free right-hand side (except `=` inside an arrow body).

**`when` (clause keyword) — possible future.**
- Needs a match-clause keyword (like `else` on `if`), not a reserved word in
  ordinary expression Code — grammar keywords come from the active surface
  grammar, not a global reserved list.
- Trailing `else` already fits as a sibling clause keyword with no pattern.
- **Pattern/body boundary is the hard part.** Same-line
  `when String "string"` looks like spaced juxtaposition / call
  (`String "string"`). Compound cases are worse:
  `when Box(Int) x + 1` — after a complete pattern `Box(Int)`, is `x`
  a capture continuation, a call argument, or the body start?
  `when Left(x, y) x` and `when x x` are similarly ambiguous without a
  mandatory delimiter or newline/indent rule.
- A workable `when` would need **newline (or indent) before the body**, not
  bare juxtaposition.

**`.then` (dotted word operator) — rejected.**
- Parses as ordinary `then(pattern)(body)` under current dotted rules. That
  collides with “arms are not function values” and with using `.then` as a
  real method elsewhere.
- RHS inherits dotted/infix grouping: `Box(Int) .then x + 1` is not obviously
  `then(Box(Int))(x + 1)` vs `(then(Box(Int))(x)) + 1` without #99-style
  parentheses.
- `else` is inconsistent: bare `else "neither"` is not a `.then` form unless
  special-cased, which reintroduces a keyword arm beside dotted peers.

**Disjoint-arm rule / projection.** Separator choice does not change domain
comparison (scrutinee + projection) or `E_OVERLAPPING_MATCH_ARMS`.

**Migration size (survey only; do not pin volatile counts in specs).** On the
order of a hundred-plus `->` occurrences sit inside `match`…`end` blocks
across specs/tests/examples/tutorial/src. Function arrows would stay. Any
separator change is a wide mechanical edit plus printer/grammar/`Arms` work.

---

## Checking, exhaustiveness, and `Remaining` (decided)

1. **Overlap checking.** Resolve the scrutinee's static type and the arm
   patterns when checking the enclosing expression or function. Check their
   domains before evaluating the match. An unused function can still contain
   an overlap error.
2. **Abstract-union coverage.** Require one explicit arm covering each whole
   alternative of the scrutinee's abstract union, including an abstract
   alternative. Check the declared alternatives even if the current value
   selects one of the arms already present.
3. **Residual coverage.** A trailing `else` covers values outside the peer
   arms. Reject `else` when the residual is provably empty. An abstract union
   with all required alternatives handled has empty residual coverage.
4. **Public subtraction.** `Remaining` describes the residual domain in the
   design. User-written `P \ Q` and `Remaining` types are deferred.

No runtime implementation in this PR. Spec todos record the decided
diagnostics; remove them when an implementation PR makes them pass. Keep the
PR in draft until those todos describe runnable destination behavior.
