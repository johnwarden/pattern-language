# Exactness, numeric comparison and designation

## Strong functional equality

If two expressions have the same static type and compare exactly equal
with `===`, substituting one for the other in an evaluated value
position preserves the result whenever both expressions are valid there.
Quotation and unevaluated macro operands can inspect the source
expression. Literal designation can make one expression valid in a
typed context in which a binding with the same value lacks evidence.
See [refinement evidence](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md).

Exact comparison requires the operands' static types to admit at least
one concrete type in common. It compares both the concrete type and the
value. For example, `Number` and `Float64` overlap. A `Number` holding
an `Int` zero is exactly unequal to a `Float64` zero. Comparing a
concrete `Int` directly with a concrete `Float64` is a type error.
The bootstrap's [abstract comparison tests](../test/abstract-values.test.ts#L25-L43)
cover a subset of this proposed rule.

Numeric `==` and ordering compare exact magnitudes across formats.
An overload can distinguish values that are numerically equal.

```pattern
todo test "Numeric equality can hold for values dispatched to different overloads"
  def kind(n :: Int) "Int"
  def kind(n :: ExactRational) "ExactRational"

  x = 0 :: Int
  assert x == 0
  expect kind(x) is "Int"
  expect kind(0) is "ExactRational"
  expect kind(0 :: ExactRational) is "ExactRational"
end
```

## Fixed precision number types are wrapped ExactRationals

A numeric literal by itself has type `ExactRational`. It can designate
a fixed value when it exactly fits the requested type. The fixed value
occupies a separate concrete value space. For example, `0.1` does not
fit `Float64`, whereas `0f0.1` denotes exactly the rational stored
in the Float64 approximation to one tenth.

The [fixed-precision prelude](fixed-precision-numbers.md) specifies
the numeric types, operator signatures and conversions. Operations
that can produce irrational numbers, such as `sqrt`, are
[deferred](fixed-precision-numbers.md#future-operations-that-can-produce-irrational-results).

## Designation and ambiguity

Check overload domains when adding a definition. Reject the definition
if it shares any directly admitted arguments with an existing overload.
For example, `f(x :: Int)` and `f(x :: Number)` overlap because
`Number` includes every `Int`.

Also reject a definition if a bare literal could designate arguments for
two otherwise equally ranked overloads and choosing between them would
require a predicate on an abstract refinement such as `PositiveInt`.
Compare the parameter bases for possible literal designation without
running those predicates. Representation checks such as `fitsFloat64`
for concrete numeric types remain part of designation. For example, an
`Int .where isPositive` overload conflicts with a `Float64` overload at
definition time. See [refinement evidence](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md#one-expected-union-and-several-overloads).

Different concrete formats such as `Float32` and `Float64` admit disjoint
values. Both overloads are valid, and an exact rational that designates
both can make a call ambiguous.

An overload that directly admits the argument wins. Between nested
designation targets, prefer the inner target for overload selection.
Adding an overload can change which definition an existing call selects.

For a known expected union, prefer a direct member to members reachable
only by designation. This applies to concrete unions and is proposed for
abstract unions too. For example, an `ExactRational` literal supplied to
`pattern Int | ExactRational` selects the `ExactRational` member. An
explicit `Int` selects the `Int` member. This lets arithmetic pass an
exact operand unchanged to the selected definition for its own fit
check. The union and overload rules differ when the already selected
outer wrapper has a direct symbol alternative, as in the example below.

The comparison across several argument positions still needs a rule
when each overload has a better match in a different position.
A peer overload tie and competing designations within one selected
expected type need distinct diagnostics. The public code for a tie
between otherwise applicable definitions remains to be confirmed.

## Nested and peer options

With a known expected type `String??`, bare `:None` selects the
outer absence. Explicit inner absence, `:None :: String?`, produces
a different value inside `String??`. The
[existing nested option test](../tests/bindings/nested-option-designation.test#L126-L136)
covers this distinction.

With both the `String?` and `String??` overloads in scope, bare
`:None` first selects the inner overload. With peer `String?` and
`Int?` overloads, bare `:None` is ambiguous. An ascription selects
either peer.

```pattern
todo test "A lone outer overload preserves the chosen absence"
  def outer(v :: String??) v
  outerNone = :None :: String??
  innerNone = (:None :: String?) :: String??

  expect outer(:None) is outerNone
  expect outer(:None :: String?) is innerNone
  assert outerNone !== innerNone
end

todo test "Inner overload takes priority for nested option designation"
  def foo(v :: String??) "Outer"
  def foo(v :: String?) "Inner"

  expect foo(:None) is "Inner"
  expect foo(:None :: String?) is "Inner"
  expect foo(:None :: String??) is "Outer"
  expect foo((:None :: String?) :: String??) is "Outer"
end

test "Peer overloads require a type for bare absence"
  def foo(v :: String?) "String?"
  def foo(v :: Int?) "Int?"

  expect foo(:None) fails "ambiguous"
  expect foo(:None :: String?) is "String?"
  expect foo(:None :: Int?) is "Int?"
end
```
