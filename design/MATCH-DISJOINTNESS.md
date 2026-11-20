# Should `match` arms be disjoint?

**Status:** decisions recorded (PR discussion); runtime still ordered first-match.
Open questions remain below — especially the trailing residual.
**Related:** [type-values § Match arm domains](../specs/type-values.md#match-arm-domains),
[GRAMMAR](../GRAMMAR.md) (shared patterns),
[VALUE-SPACES](../VALUE-SPACES.md#refinement-evidence-and-functions),
[ambiguous-values](../specs/ambiguous-values.md),
[#88 type-value consolidation](https://github.com/johnwarden/pattern-language/pull/88).

Sketches in the background sections are indented (display-only). Executable
contracts live as `todo` / ordinary fences under
[specs/type-values.md](../specs/type-values.md#match-arm-domains) on this branch
(rebased onto #88’s type-value spec).

## Decided

Jonathan (verbatim seed: *“Let's make match arms disjoint with one trailing
error. One construct. I guess an overlap would need a different error since
it's not a call.”*), plus follow-ups on this PR:

1. **Match arms are pairwise disjoint**, under the same domain rule as
   overloads. Overlap is rejected; there is no ordered first-match priority
   among peer arms.
2. **One construct:** a single `match`.
3. **At most one trailing residual arm**, and only as the **last** arm.
   Exact spelling, value-vs-error behavior, and pack coverage are **not**
   decided — see Open questions.
4. **Overlap diagnostic:** `E_OVERLAPPING_MATCH_ARMS` (not `E_AMBIGUOUS_CALL`,
   not `E_AMBIGUOUS_VALUE_DESIGNATOR`).
5. **Refinement predicates cannot distinguish peers.** Erase predicate tests
   and require structurally disjoint domains. When disjointness cannot be
   proved, **reject conservatively** as `E_OVERLAPPING_MATCH_ARMS` and report
   that disjointness could not be proved (same code; distinct message). Put
   ordered predicate checks inside one base-type arm with `if` / `.matches`.
6. **Union binding patterns are disallowed** in match arms and function
   signatures. Use separate arms or definitions. Union type annotations remain.
7. **Domain comparison is relative to the scrutinee.** Check overlap over the
   admitted scrutinee domain **including the permitted one-boundary
   projection**. An `Outer` wrapper arm and a projected `Inner` arm that both
   admit the same `Outer` value overlap. Separately, a raw designator that can
   enter two otherwise-disjoint arms (e.g. `Box(3)` into `Box(Int)` vs
   `Box(Float)`) stays `E_AMBIGUOUS_VALUE_DESIGNATOR`, not arm overlap.

Runtime matching is still **ordered first-match**. GRAMMAR and the type-values
section state the decision as not yet enforced.

### Reconcile with #88

This branch is **rebased onto** `spec/type-expressions-and-kinds` (#88). The
disjoint-arm rule lives in [#88’s `specs/type-values.md`](../specs/type-values.md#match-arm-domains),
replacing the former ordered first-match / arm-subtraction paragraph under
Overload domains. Do not push to #88’s branch from this PR; once #88 merges to
`master`, rebase this branch onto `master`.

## Migration inventory (existing overlapping / ordered-priority uses)

Most live multi-arm matches are already pairwise disjoint or use a trailing
`_`. Implementation must revisit:

### A. Peer overlap / new contracts

| Location | Why |
| --- | --- |
| [specs/type-values.md](../specs/type-values.md#match-arm-domains) | Overlapping Int arms; Outer/Inner projection overlap; refinement peers; mid residual; union binding patterns |
| [tests/matching/open-fields.test](../tests/matching/open-fields.test) | Union parameter / union arm cases to migrate to separate arms |
| [tests/matching/hygiene.test](../tests/matching/hygiene.test) | Generated union lambda |
| [src/type-schema.ts](../src/type-schema.ts) | Inline tag alternatives in binding-pattern shape |

### B. Designation ambiguity (not arm overlap)

| Location | Why |
| --- | --- |
| type-values — raw `Box(3) :: NumBox` across Int/Float field arms | `E_AMBIGUOUS_VALUE_DESIGNATOR`; typed `Box(3 :: Int)` counterpart passes |
| [open-fields.test](../tests/matching/open-fields.test) — within-arm `(Box(Int) \| Box(Float))` | Same designation class |

### C. Trailing `_` after a more specific arm

Keep until residual spelling/coverage is decided. Examples:
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
| **D / B′** | Disjoint peers + one trailing residual | **Accepted** in outline; residual details open. |

---

## Open questions

### Trailing residual (exact question for Jonathan)

**Do not treat as settled.** Please choose:

1. **Fallback kind:** May the trailing arm return an ordinary value (soft
   default), or must it only signal failure / raise (hard exhaustiveness)?
2. **Coverage / spelling:** Today `_` matches one positional value. If the
   residual should cover **any remaining pack** (multiple positionals and
   labels), should that be spelled `else`, with tests for multi-value and
   labeled packs? Or does `_` grow that meaning?
3. **Unreachable residual:** After arms that already cover the scrutinee, is a
   trailing residual allowed (vacuous `Remaining`) or rejected?

Until those are answered, keep residual examples as indented sketches or
`todo` fences; do not land a live contract that pre-decides them.

### Other open items

1. **Public `P \ Q` / `Remaining` in types** for named residual domains.
2. **When is overlap checked?** Elaboration time only, or also after later
   type edits?
3. **Exhaustiveness** as warning vs hard error vs residual-only convention.

No runtime implementation in this PR. Spec todos record the decided
diagnostics; remove them when an implementation PR makes them pass.
