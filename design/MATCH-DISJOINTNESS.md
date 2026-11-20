# Should `match` arms be disjoint?

**Status:** decisions recorded (PR discussion); runtime still ordered first-match.
Open: arm separator spelling (`->` vs `when` vs `.then`), plus a few lesser items below.
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

Jonathan (seed, with later clarification: *“one trailing error”* was a typo for
*“one trailing else/catch-all”*), plus follow-ups on this PR:

1. **Match arms are pairwise disjoint**, under the same domain rule as
   overloads. Overlap is rejected; there is no ordered first-match priority
   among peer arms.
2. **One construct:** a single `match`.
3. **At most one trailing `else`**, and only as the **last** arm. `else` is an
   ordinary catch-all arm whose body is an ordinary expression. It covers
   **any remaining pack** (multiple positionals and labels), not merely one
   positional `_`. There is no special error-arm concept.
4. **Overlap diagnostic:** `E_OVERLAPPING_MATCH_ARMS` (not `E_AMBIGUOUS_CALL`,
   not `E_AMBIGUOUS_VALUE_DESIGNATOR`).
5. **Refinement predicates cannot distinguish peers.** Erase predicate tests
   and require structurally disjoint domains. When disjointness cannot be
   proved, **reject conservatively** as `E_OVERLAPPING_MATCH_ARMS` and report
   that disjointness could not be proved (same code; distinct message). Put
   ordered predicate checks inside one base-type arm with `if` / `.matches`.
   Spec fixtures use prelude `Predicate` tags (`isPositive`, `isNonZero`), not
   lambda `.where` operands (`E_EXPECTED_PREDICATE`).
6. **Union binding patterns are disallowed** in match arms and function
   signatures. Use separate arms or definitions. Union type annotations remain.
7. **Domain comparison is relative to the scrutinee.** Check overlap over the
   admitted scrutinee domain **including the permitted one-boundary
   projection**. An `Outer` wrapper arm and a projected `Inner` arm that both
   admit the same `Outer` value overlap. Separately, a raw designator that can
   enter two otherwise-disjoint arms (e.g. `Box(3)` into `Box(Int)` vs
   `Box(Float)`) stays `E_AMBIGUOUS_VALUE_DESIGNATOR`, not arm overlap.

Runtime matching is still **ordered first-match**. GRAMMAR and the type-values
section state the decision as not yet enforced. Peer arms in live examples may
still use `->` until the arm-separator question below is settled; do not migrate
syntax in this PR.

### Reconcile with #88

This branch is **rebased onto** `spec/type-expressions-and-kinds` (#88). The
disjoint-arm rule lives in [#88’s `specs/type-values.md`](../specs/type-values.md#match-arm-domains),
replacing the former ordered first-match / arm-subtraction paragraph under
Overload domains. Do not push to #88’s branch from this PR; once #88 merges to
`master`, rebase this branch onto `master`.

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
| type-values — raw `Box(3) :: NumBox` across Int/Float field arms | `E_AMBIGUOUS_VALUE_DESIGNATOR`; typed `Box(3 :: Int)` counterpart passes |
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

## Open decision: match arm separator (drop `->`?)

Jonathan wants to consider dropping `->` for match arms because it reads as a
function (a true function catch-all would look like `(...) -> 'default'`), and
`=>` has the same problem. Candidates (indented sketches only; **do not** change
existing arm syntax or tests yet):

    match value
      when String "string"
      when Int "int"
      else "neither"
    end

    match value
      String .then "String"
      Int .then "int"
      else "neither"
    end

### Analysis (against current grammar)

**Shared baseline.** Match is a multiline layout form closed by aligned `end`
([GRAMMAR](../GRAMMAR.md), [default.pattern](../default.pattern)
`MatchExpression`). Arms are not first-class functions. Infix operators need
spaces; dotted forms are ordinary application (`a .b c` → `b(a)(c)`).
Juxtaposition / call spacing distinguishes tight `f(a)` from spaced `f a`.
[#99](https://github.com/johnwarden/pattern-language/pull/99) requires explicit
grouping for mixed infix chains; dotted word operators keep master’s reading;
`->` today leaves a free right-hand side (except `=` inside an arrow body).

**`when` (clause keyword).**
- Needs a match-clause keyword (like `else` on `if`), not a reserved word in
  ordinary expression Code — grammar keywords come from the active surface
  grammar, not a global reserved list.
- `else` fits as a sibling clause keyword with no pattern.
- **Pattern/body boundary is the hard part.** Same-line
  `when String "string"` looks like spaced juxtaposition / call
  (`String "string"`). Compound cases are worse:
  `when Box(Int) x + 1` — after a complete pattern `Box(Int)`, is `x`
  a capture continuation, a call argument, or the body start?
  `when Left(x, y) x` and `when x x` are similarly ambiguous without a
  mandatory delimiter or newline/indent rule.
- A workable `when` would almost certainly need **newline (or indent) before
  the body**, or some non-arrow separator — not bare juxtaposition.

**`.then` (dotted word operator).**
- Parses as ordinary `then(pattern)(body)` under current dotted rules. That
  collides with “arms are not function values” and with using `.then` as a
  real method elsewhere.
- RHS inherits dotted/infix grouping: `Box(Int) .then x + 1` is not obviously
  `then(Box(Int))(x + 1)` vs `(then(Box(Int))(x)) + 1` without #99-style
  parentheses.
- `else` is inconsistent: bare `else "neither"` is not a `.then` form unless
  special-cased, which reintroduces a keyword arm beside dotted peers.

**Disjoint-arm rule / projection.** Separator choice does not change domain
comparison (scrutinee + projection) or `E_OVERLAPPING_MATCH_ARMS`. It does
affect how large patterns and projected shapes are read before the body.

**Readability.** `when` / `else` read as control-flow clauses; `.then` reads as
a method chain. Keeping `->` keeps parity with function arrows (the motivation
to drop it).

**Migration size (survey only; do not pin volatile counts in specs).** On this
branch tip, on the order of a hundred-plus `->` occurrences sit inside
`match`…`end` blocks across specs/tests/examples/tutorial/src (dozens of
files). Function arrows stay. Any separator change is a wide mechanical edit
plus printer/grammar/`Arms` shape work — still docs-only here.

### Recommendation

Prefer **not** adopting same-line `when Pattern Body` juxtaposition, and
**reject `.then`** as arm syntax (collides with general dotted application and
#99 RHS grouping). If dropping `->`, prefer **`when` / `else` as match-clause
keywords with a newline- or indent-bounded body** (pattern on the `when` line,
body on the following indented line), so the pattern/body cut is layout-driven
rather than juxtaposition. Until that layout rule is specified, **keep `->`**
for peer arms in executable fences; use `else` only for the decided catch-all
in todos/sketches.

**Decision question for Jonathan:** Drop match-arm `->` in favor of
`when`/`else` clause layout with newline-bounded bodies, keep `->`, or pursue a
different separator (not `.then`)?

---

## Other open items

1. **Unreachable `else`:** after arms that already cover the scrutinee, is a
   trailing `else` allowed (vacuous Remaining) or rejected?
2. **Public `P \ Q` / `Remaining` in types** for named residual domains.
3. **When is overlap checked?** Elaboration time only, or also after later
   type edits?
4. **Exhaustiveness** as warning vs hard error vs `else`-only convention.

No runtime implementation in this PR. Spec todos record the decided
diagnostics; remove them when an implementation PR makes them pass.
