# Inbox implementation handoff

The original files under `tests/inbox` remain author drafts, optional in the
default suite and runnable by explicit path. Do not change an expected payload
to the current implementation's output or count `assert 1 == 1` as coverage of
the commented design examples.

## Concrete binding and match boundary: actionable now

`tests/bindings/concrete-value-boundary.test` activates the accepted portion of
`tests/inbox/2026-raw-and-typed-expressions.test` using current bootstrap declaration
syntax. A Rectangle is a concrete value, not an exposed Rect expression. A raw
constructor pattern must not open it in an ordinary binding or function parameter.
An explicit match may open the boundary and returns its Int-typed fields. Capturing
the entire Rectangle through an annotation preserves the original value.

The draft currently fails the ordinary binding and dispatch error expectations;
the explicit-match and annotated-value controls pass. These are ordinary target
assertions, not todo failures presented as implementation progress. Keep the PR
draft until the behavior and relevant legacy coverage have been aligned.

Coordinate integration with #31's primitive/value alignment and #32's declaration
products. Likely shared areas are `matchParameters`, the runtime pattern compiler,
and the value matcher adapter. Put this policy at the pattern role boundary;
changing global unwrapping indiscriminately can break accessor extraction,
type construction, serialization and one-boundary matching. Preserve those checks,
predicate/default isolation and descriptor transport. Equivalent declarations
and accessor collisions remain errors.

The raw-expression mode question is separate: whether a bare `Rect(2, 2)` can
be an ordinary runtime Expression value, or how an embedding selects an untyped
mode, is still unknown. This PR does not select that policy or a public decoding
API. It does not introduce target declaration keywords or a source evaluator.

## Nested optional printing: retain the expected-text question

`2026-09-11-printing-values-of-ambiguous-concrete-types.test` uses the removed
`value` assertion clause and lacks current explicit block termination. Its first
golden string ends in `:: String` although the checked value is `String??`.
The intended outer type tag is unknown. Its strings also use lexical aliases in
the global `toString` path, whose current contract is independent of local names.

The settled portion is preserving inner versus outer absence and sufficient
member information for round trips. Existing nested-option/concrete-union tests
exercise those laws. Before choosing new printing goldens, resolve the outer tag
and whether the example means global or local text. #31 owns intrinsic String
identity and symbol-text alignment; this handoff does not rewrite its active work.

## Bare named predicate: retain the function-value question

`2026-11-09-bug-bare-function-name-in-where-clause.test` currently comments out two
identical lambda forms; neither demonstrates a bare named predicate. The lambda
control can use the current bootstrap spelling:

```text
def isSquare(r :: Rectangle) r.width == r.height
def Rectangle type Rect(width :: Int, height :: Int)
def Square Rectangle .where (r -> isSquare(r))
(square :: Square) = Rect(2, 2)
```

If the intended alternative is `.where isSquare`, it reaches the existing
`E_FUNCTION_NOT_VALUE` guard. Whether to permit a named predicate adapter in that
context is unknown; general first-class overload sets are not accepted. Do not
remove that guard or invent overload/closure transport semantics to satisfy this
filename. The independent tab-indented source-extraction bug is addressed in #37.

## Ownership and readiness

The coordinator owns these regression fixtures until an implementing agent posts
a claim on the PR with its session, branch and shared methods. Do not edit #31 or
#32's active branches. Rebase after their approved integration and run the relevant
binding/dispatch/projection/accessor/transport checks plus `just check` on the final
implementation head. Each merge still needs Jonathan's authorization for that PR.
