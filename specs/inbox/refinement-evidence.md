# Refinement evidence

Draft for review. This extends D10's evidence rule to literal designation,
bindings, dispatch, and return types.
[Language decisions](../../design/LANGUAGE-DECISIONS.md) · [Ambiguity contract](../approved/ambiguous-values.md)

## A refined type carries evidence

A static type `T .where p` guarantees both membership in `T` and the truth of
`p` for the value. A `pattern T .where p` retains the base value's concrete
type and identity. For example, a `NonZeroNumber` binding can hold a
`Float` with proof that it is nonzero.

A binding or parameter that requires a refinement checks the expression's static
type and the facts available at that point. An existing guarantee satisfies
the requirement directly. A base-typed variable with no such guarantee is
ineligible even when its current value happens to pass the predicate.
An ascription of an already typed expression requires the same evidence.
An explicit match can narrow the base type or project a wrapper according to
the type model.

| Operation | Source of refinement evidence |
| --- | --- |
| Assignment or argument using an already typed expression | Its static type and facts in scope |
| Designation of a literal in a known expected type | Evaluate each required predicate during designation |
| True branch of an explicit `if p(x)` | The result of that check for that binding and predicate |
| Call with a refined return type | The function's declared and checked guarantee |

Missing evidence and a predicate returning `False` are different failures.
For a binding, report which guarantee is missing. For a call with no eligible
definition, report the missing overload and the types supplied. Report a failed
predicate for a literal that reaches the check and is rejected by it.

## Literal designation

A literal, including a parenthesized or explicitly base-ascribed literal such
as `2 :: Float`, can designate a value of a refined type if it fits the base
type and its predicate returns `True`. Literal fields and elements can be
designated under their own expected types. A name used as a field or an
element supplies its existing evidence. For a predicate on a whole compound
literal, the check needs the whole literal value.

Eligibility comes from the expression being designated. Binding a literal
does not carry its source form into later uses of the name. Constant
propagation or inlining cannot make a base-typed variable eligible.
Consequently, substituting an equal expression preserves results when both
expressions are valid in the same typed context. A replacement that requires
missing refinement evidence fails checking.

A compiler performs the literal checks at compile time. The interpreter
can perform them while interpreting the literal in its expected type.
Reuse the outcome for the eventual binding and any diagnostic. An error
raised by a predicate is a failure of the check and retains its diagnostic.

## Nonzero numbers

These examples use the draft fixed-precision prelude. The division example
uses `Float` operands so that the choice of division signature is explicit.

```pattern
def isNonZero(n :: Number) n !#= 0
type NonZeroNumber pattern Number .where isNonZero
type NonZeroFloat pattern Float .where isNonZero

def safeDivide(x :: Float, y :: NonZeroFloat) x / y
```

```pattern
test "A literal can establish a refinement"
  (x :: NonZeroNumber) = 2 :: Float
  expect x is 2 :: Float
  expect safeDivide(1 :: Float, 2 :: Float) is 0.5 :: Float

  expect
    (z :: NonZeroNumber) = 0 :: Float
    z
  fails "isNonZero"
end

test "A Float binding needs evidence before it can be used as nonzero"
  (y :: Float) = 2 :: Float
  expect safeDivide(1 :: Float, y) fails "no method"

  expect
    (z :: NonZeroNumber) = y
    z
  fails "missing isNonZero"

  (value :: Float?) =
    if isNonZero(y) safeDivide(1 :: Float, y) else :None
  end

  expect value is 0.5 :: Float?
  expect safeDivide(1 :: Float, y) fails "no method"
end
```

In the true branch, `y` is still `Float` and carries the additional
`isNonZero` fact. It can bind directly to `NonZeroFloat` or
`NonZeroNumber`. The fact applies to the same binding and predicate in
scope, including the predicate's bound arguments and dependencies. Evidence
is valid while those dependencies stay fixed. The false branch gains no
positive evidence. A fact can be used after a join if it holds on every
path that reaches that point.

## Return types

A declared result type requires every return path to establish the result's
guarantees. A caller receives those facts as part of the result's static
type. A successful branch may return the checked value under its stronger
type. Here the other branch needs only `:None`.

```pattern
def zeroAsNone(x :: Number) :: NonZeroNumber?
  if isNonZero(x) x else :None
end
```

A specified built-in result guarantee supplies evidence in the same way.
For example, the absolute value of a finite nonzero float is nonzero.
Supply guarantees only for operations and formats where all successful
results satisfy them. Float multiplication may underflow to zero, and
integer division may truncate to zero. A result guarantee can depend on a
known input refinement while retaining a single overload.

The rule also affects checked numeric conversions. The proposed addition
definitions currently contain `right = b :: Int` where `b` may be a stored
`ExactRational`. If `Int` is `struct ExactRational .where fitsInt64`,
that arm needs an explicit exact-fit check or a checked conversion with
the required result type. The same applies to a computed exact result.
See [the fixed-precision draft](fixed-precision-numbers.md#prelude-definitions-for-addition).

## One expected union and several overloads

Once a call has a known expected union for an argument, a literal designator
checks its plausible members. If the literal fails a member's refinement, that
member cannot contribute to the ambiguity. With one definition
`def f(n :: U) n` and `type U pattern AboveFive | Float`, where
`AboveFive` is an `Int` refinement, `f(3)` selects Float and `f(7)` is
ambiguous. The same designation applies in a literal binding to `U` and in
nested literal fields. An already typed `Int` passed to the same function
requires evidence for `AboveFive`.

Dispatch on a bound argument never evaluates a predicate to decide if an
overload applies. A predicate needed for literal designation cannot be checked
again when the parameter is bound. The rules for disjoint overload domains and
direct membership still apply.

## Open choices

- When multiple definitions could each supply an expected type for the same
  literal, prefer explicit ascription if the static dispatch rules cannot pick a
  definition. Decide whether to allow literal predicate checks to disambiguate
  *between* definitions as well as between members of one selected type.
- The examples recognize a direct condition `if p(x)`. Specify whether an
  explicit `.matches` test, a guarded match arm, or a checked assertion also
  establishes a fact. Typed text reading has its own validation boundary.
- Choose the intrinsic operations and input refinements that justify stronger
  numeric results. Keep the assumptions about finite values and rounding
  explicit in those contracts.

## Implementation sequence

Evaluating predicates in overload recognition can run them twice, run them
for rejected definitions, and turn predicate errors into overload fallback.
Keep recognition on static types and their available evidence. Evaluate
predicates in literal designation when an expected type is available.
[#80 review](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6953945601)

The independent diagnostic work in #80 can land before the full evidence
checker. The ambiguity message should come from surviving interpretations.
Normalize repeated type alternatives by their compiled structural identity.
That preserves distinct nested wrappers. Use source suggestions only when
they can select the advertised interpretation.
If #80 lands before it can distinguish literal designation from bound
arguments, record the remaining literal-refinement cases as todo and carry
them into the refinement implementation.
