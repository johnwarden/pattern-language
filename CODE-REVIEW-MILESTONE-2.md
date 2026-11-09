# Independent code review — milestone 2

Reviewer: GPT-6.1 Sol, high reasoning effort, in an independent agent session with
no conversation history. Inputs were the current documentation, implementation and
tests. Review was read-only; fixes were made by the implementation agent.

## Final result

All three original P2 findings and one regression found during fix verification are
closed in the reviewer's focused checks. No remaining confirmed regression was found
in those fixes. Final independent verification passed 39 focused tests, including all
seven review regression tests. The complete implementation suite passes 497 tests;
TypeScript checking and browser build pass.

The review found the milestone's architecture present: schema-gated interpretation,
shared pattern metadata, recursive ordinary Language descriptions, AST transport,
recognition reconstruction and an explicit bootstrap/host inventory. It found no
additional confirmed schema/decoder-ownership or Language/AST-transport issue.

## Findings and fixes

| Priority | Confirmed finding | Resolution |
| --- | --- | --- |
| P2 | A destructuring default could read a runtime parameter and bind its result as compile-time available; match captures also lost scrutinee availability. | Binding and arm captures retain dependencies from their inputs and pattern computations. |
| P2 | Grammar compilation stripped a root quote before the shared compiler could preserve the literal head, turning quoted names into captures and quoted operators into alternation. | Grammar delegates root quotation to the common pattern compiler. |
| P2 | Macro availability analysis followed helper bodies but skipped helper parameter defaults and annotations. | It now checks signature computations in their lexical scope, respecting preceding argument packs. |
| P2 | An initial availability fix interpreted a quoted literal `::` head as an annotation, falsely tainting constant match captures. | The compiler and availability walk share `quotePatternHead`; real computations inside quoted constructor arguments are still checked. |

Ordinary type-factory parameters also retain runtime availability, matching ordinary
function parameters outside explicit expansion. The analysis remains deliberately
conservative; these fixes are not general compile-time specialization or a proof system.

## Representative reproductions

The following must reject with `E_MACRO_RUNTIME_CAPTURE` at registration:

```text
def outer(x)
  (value: y = x) = ()
  macro :bad Args() Code(:($y))
  (bad Args())
end
outer(7)
```

```text
def outer(x)
  def build(value: e = x) Code(:($e))
  macro :bad Args() build()
  0
end
outer(7)
```

This source must return `1`; its quoted operator is a literal constructor, and `x`
in the pattern is a capture rather than a read of the outer parameter:

```text
def outer(x)
  match :(1 :: 2)
    :(a :: x) ->
      macro :good Args() Code(:($a))
      (good Args())
    end
  end
end
outer(7)
```

Grammar and runtime must agree that `(:|(Int)(Int))` matches the application tree
`1 | 2`, not either integer independently. The grammar's literal `:(x)` must reject
an unrelated name. Regression coverage is in `test/milestone-two-review.test.ts`.

## Limits of the review

This is targeted code/design review and executable regression verification, not an
exhaustive audit or a correctness proof. Full elaboration, computed syntax references,
universal stack safety, static type inference and portable closures are documented
future work and were not classified as defects. Source locations and lexical
provenance remain session metadata, not part of transported Language/AST values.
