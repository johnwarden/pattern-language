# Implementation queue

Updated 10 November 2026. Follow the linked executable contracts and approved
decisions. A declaration/parser failure does not demonstrate the deeper rule
behind a todo.

## Ready implementation slices

| Work | Contract | Handoff |
| --- | --- | --- |
| Concrete boundary in ordinary bindings | [raw-expressions.test](../../tests/specification/raw-expressions.test), "Ordinary constructor bindings do not project a concrete value" | The negative subject currently succeeds. Enforce rejection while retaining raw Expression destructuring, whole-value binding and explicit one-boundary matching. Audit [defaults.test](../../tests/bindings/defaults.test); preserve its capture/default observations through explicit matching. No angle syntax dependency. |
| Refinement declaration recognition | C07–C10 in [refinements.test](../../tests/specification/refinements.test) | The eight todos currently stop at declaration recognition. Add focused declaration, base-identity and no-accessor controls, then elaborate `type NonZero refinement Rational .where predicate` into the existing refinement mechanism. Evidence checking belongs to milestone 7; this slice must not introduce predicate-driven overload selection. |

Write any missing focused contracts before runtime changes. These scopes may
proceed independently with explicit ownership around shared runtime/grammar code.

## Ready for contract conversion; remaining design dependencies

| Work | Current state | Next step |
| --- | --- | --- |
| Ordinary type values | [Approved type-values decision](../../specs/type-values.md); [prelude-pattern draft](https://github.com/johnwarden/pattern-language/blob/spec/prelude-type-kinds/specs/prelude-type-kind-patterns.md) | Convert the approved examples into focused contracts. Settle the ordinary construction rule and required supporting domains before claiming the full prelude implementation is ready. No angle syntax is required. |
| Closed named function values | [Approved decision](../../specs/named-function-values.md), [closed immutable values](../../specs/library-closure-and-local-printing.md), and 17 todos in [named-function-values.test](../../tests/specification/named-function-values.test) | Representation preflight first: complete immutable captured values/dependencies, finite recursion, packs, labels/rest/defaults and structural identity. A name handle or hidden ambient closure is insufficient. Public Function/Library grammar, admissible captures and overloaded-name selection remain design work. |
| Retiring legacy type-definition syntax | [Approved retirement](../../specs/retire-legacy-type-definition-syntax.md) | Coordinate replacement construction/declaration support with prelude/corpus migration before removing compatibility. The newer type-values decision already permits ordinary Type-valued functions. |

## Parked angle-bracket syntax

[#62](https://github.com/johnwarden/pattern-language/pull/62) is parked as a draft
at the author's request. Preserve its implementation and the existing C05/C12/C18
todos. Do not resume or rebase the parked PR until reactivated. Ordinary argument
packs remain available for type-valued factories; angle syntax does not block
milestones 5a.2 or 5b.

## Test maintenance and later work

- C17's missing-field/default subjects and C24's two-result binding already reject.
  Their diagnostic contracts need deliberate alignment; do not substitute observed
  output without an agreed contract change.
- Some C20 spreading and C23 round-trip cases stop at an `assert` inside evaluated
  Code. Isolate their intended observations from that unrelated dependency.
- Callability, overlapping abstract unions, single-template mirrored spreading and
  anonymous repeated patterns already have ordinary source coverage. Do not assign
  those completed slices again.
- C11's short extraction-statement spelling is not implemented; existing arrow-match
  controls cover supported one-boundary projection.
- C14's unambiguous qualifier/certification, C15's bounded facet-intersection
  compatibility rules and C22's typed keyword remainder need design work first.
- Numeric-width, lifting and public QuotedSymbol cases have their own vocabulary
  dependencies. C26 contains deliberate harness fixtures, not language backlog.
- [Arithmetic precedence](https://github.com/johnwarden/pattern-language/blob/spec/arithmetic-precedence/specs/arithmetic-precedence.md) is under
  review. The [Rational literals draft](../../specs/rational-literals-and-text.md)
  covers exact source round trips and fraction spelling.
- Foundation drafts #43, #44 and #45 remain parked.
