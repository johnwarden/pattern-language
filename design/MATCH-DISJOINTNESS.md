# Match disjointness rationale

The language rules and executable contracts are in
[pattern domains and disjointness](../specs/type-values.md#pattern-domains-and-disjointness),
[overload domains](../specs/type-values.md#overload-domains-and-projection-dispatch),
and [match arm domains](../specs/type-values.md#match-arm-domains).
This note records the alternatives considered, migration context, and the
deferred arm-separator design.

Sketches below are indented display examples. Executable tests live with the
rules in `specs/type-values.md`.

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

### D. Multi-valued call results in the bootstrap

The call-result restriction and its diagnostic are specified in
[match arm domains](../specs/type-values.md#match-arm-domains). Relevant
bootstrap examples include `examples/code-categories.pattern`, the executable
type-schema examples and their embedded source, and the comparison cases in
`tests/specification/primitives.test`.

### E. Prose that still teaches ordered first-match

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
