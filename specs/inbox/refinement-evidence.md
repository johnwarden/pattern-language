# Refinement evidence

A type such as `NonZeroFloat` promises that a value is a `Float` and that
`isNonZero` is true for it. Both bindings below hold the same concrete `Float` value.
[Language decisions](../../design/LANGUAGE-DECISIONS.md) · [Ambiguity contract](../approved/ambiguous-values.md)

```pattern
def isNonZero(n :: Number) n != 0
type NonZeroFloat pattern Float .where isNonZero

(x :: NonZeroFloat) = 2 :: Float
(y :: Float) = 2 :: Float
expect y :: NonZeroFloat fails "missing isNonZero"
```

The binding of `x` checks the predicate on the literal. From then on, `x`
carries the guarantee in its type. The declared type of `y` guarantees
only `Float`. Writing `y :: NonZeroFloat` asks to use the value of `y` at
the stronger type, so the checker needs the nonzero guarantee already
in scope. Assigning `y` to a refined binding or passing it to a refined
parameter needs the same guarantee.

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
Reuse the outcome for binding and diagnostics. A predicate that returns `False`
produces a diagnostic naming the failed predicate. An error raised by the
predicate retains its diagnostic.

## Explicit tests establish evidence

The true branch of `if isNonZero(y)` can use `y` as a `NonZeroFloat`. The
condition has already checked that value. In the branch, both
`y :: NonZeroFloat` and passing `y` directly to `safeDivide` work.

```pattern
type NonZeroNumber pattern Number .where isNonZero
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

Other explicit checks establish the same evidence.

| Check | Where the evidence is available |
| --- | --- |
| `if y .matches NonZeroFloat` | The true branch can pass `y` as `NonZeroFloat`. |
| A match arm binds `n :: Float` and its guard checks `isNonZero(n)` | The selected arm can use `n` as `NonZeroFloat`. The guard tests the bound value. |
| `assert isNonZero(y)` | Following statements can use `y` as `NonZeroFloat`. A failed checked assertion stops that path. |
| `parse(NonZeroFloat)("2")` | The returned value carries the `NonZeroFloat` guarantee. |

Typed parsing checks predicates as part of matching the grammar, including in
nested fields. Both invalid rectangles below fail to match the `Rectangle`
grammar.

```pattern
def isPositive(n :: Int) n > 0
type PositiveInt pattern Int .where isPositive
type Rectangle concrete Rect(PositiveInt, PositiveInt)

parse(Rectangle)("Rect(2, 3)")
parse(Rectangle)("Rect(-2, 0)")
parse(Rectangle)("Rect('a','b')")
```

The successful parse establishes evidence for both fields. In the second
example a field fails `isPositive`. In the third example the strings fail
the base type of the field pattern.

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
results satisfy them. Fixed-precision float division returns a nonzero
value when its numerator is known to be nonzero. Division by zero and
rounding a nonzero result to zero both panic. The integer quotient
operations can return zero for a nonzero numerator. A result guarantee
can depend on a known input refinement while retaining a single overload.
[Fixed-precision arithmetic](fixed-precision-numbers.md#arithmetic-policy)

A checked conversion establishes fit evidence for a stored exact value
or a computed result. For example, `checkedConvert(Int)(n)` checks
`fitsInt64` and returns an `Int` if it succeeds.
See [checked conversion](fixed-precision-numbers.md#proposed-checked-conversion).

## One expected union and several overloads

Once a call has a known expected union for an argument, a literal designator
checks its plausible members. If the literal fails a member's refinement, that
member cannot contribute to the ambiguity. With one definition
`def f(n :: U) n` and `type U pattern AboveFive | Float`, where
`AboveFive` is an `Int` refinement, `f(3)` selects Float and `f(7)` is
ambiguous. The same designation applies in a literal binding to `U` and in
nested literal fields. An already typed `Int` passed to the same function
requires evidence for `AboveFive`.

Reject a definition that overlaps another overload's directly admitted
domain. Also reject competing literal designations at definition time when
choosing a definition would require evaluating an abstract refinement
predicate.
For example, adding the second `pick` definition below is an error.
A bare exact integer could designate either parameter type, and
`aboveFive` would determine whether the first definition competes.

```pattern
def aboveFive(n :: Int) n > 5
type AboveFive pattern Int .where aboveFive

def pick(n :: AboveFive) "integer"
def pick(n :: Float64) "float"
```

Dispatch on a bound argument uses its existing evidence. Once an overload
has supplied an expected type, check any predicates needed for literal
designation and reuse the result when binding the parameter.
[Designation and ambiguity](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#designation-and-ambiguity)

## Implementation sequence

Evaluating predicates in overload recognition can run them twice, run them
for rejected definitions, and turn predicate errors into overload fallback.
Keep recognition on static types and their available evidence. Evaluate
predicates in literal designation when an expected type is available.
[#80 review](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6953945601)

The independent diagnostic work in #80 can land before the full evidence
checker. The ambiguity message should come from surviving interpretations.
Write each suggestion with the member's
[type expression](2026-11-18-type-expressions.md). Every type has one, so
each surviving interpretation can be listed. Pasting a suggestion must
select the interpretation it names.
If #80 lands before it can distinguish literal designation from bound
arguments, record the remaining literal-refinement cases as todo and carry
them into the refinement implementation.

Normalize repeated type alternatives by value. Two alternatives are the
same when they evaluate to equal types under the usual value equality,
however they are spelled. `pattern :Box(Int) | Box(Int)` is one
alternative: the quote is redundant, and normalization drops it.
Normalization happens only in the `pattern` and `struct` macros.

```pattern
i = Int
assert (pattern Int | String | i) === (pattern Int | String)
assert (pattern :Box(Int) | Box(Int)) === (pattern Box(Int))
```

Whether the redundant quote should be an error instead is still open.
[Open choices](2026-11-18-type-expressions.md#open-choices)
