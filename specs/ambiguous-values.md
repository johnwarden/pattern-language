# Ambiguous value designators report `E_AMBIGUOUS_VALUE_DESIGNATOR`

Approved by Jonathan in the project chat on 10 November 2026; renamed from
`E_AMBIGUOUS_VALUE` on 17 November. This renames `E_AMBIGUOUS_PATTERN` and
changes what its message says.

A value designator, such as `3` or `:None`, is ambiguous when designation
has multiple surviving interpretations. An abstract union counts alternatives
that yield the same exact typed value as one interpretation. A concrete
descriptor preserves explicit alternative occurrences. See
[type designation](type-values.md#designation-and-matching).

```pattern
test "An ambiguous numeric literal fails with E_AMBIGUOUS_VALUE_DESIGNATOR"
  b = abstract Int | Float
  expect 3 .matches b fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
  expect
    (x :: b) = 3
    x
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end

test "An ambiguous absence between peer options fails with E_AMBIGUOUS_VALUE_DESIGNATOR"
  type Foo concrete String? | Float?
  expect
    (x :: Foo) = :None
    x
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end
```

Each designator above raises `E_AMBIGUOUS_VALUE_DESIGNATOR`. The message
blames the designator and prints source that selects each surviving
interpretation, such as `3 :: Int` and `3 :: Float`. When more than two
interpretations survive, it lists the first two and ends with
`...and N others`. When source cannot select an interpretation, report
the count.

Literal designation can test a refinement once an expected type is known.
Given `PositiveInt = pattern Int .where isPositive`, in
`pattern PositiveInt | Float` the literal `-3` selects `Float` because
the integer refinement rejects it. A positive
literal such as `3` is ambiguous. Explicitly designating `-3` as the
refined integer reports the failed predicate. A bound argument supplies
its existing evidence. See [refinement predicates](refinement-predicates.md).

Type macros remove repeated alternatives. `struct :A | :A` normalizes to
`struct :A`. Direct descriptors preserve repeats.

## Contracts

[PR #80](https://github.com/johnwarden/pattern-language/pull/80) implements the
diagnostic in [ambiguous-values.test](../tests/specification/ambiguous-values.test).
The cases cover numeric and optional designators, surviving alternatives,
nested and recursive suggestions, truncation, and refinement checks after
overload selection. Bound arguments and bound fields have todo cases for
refinement evidence.

[Overlapping union contracts](../tests/specification/overlapping-unions.test)
cover normalization. Type macros remove repeated alternatives under ordinary type
equality, including aliases and factory results. The [type-value spec](type-values.md#declarations-normalization-and-identity)
covers direct constructors.

## Nested and peer option overloads

With a known expected type `String??`, bare `:None` selects the outer absence.
Explicit inner absence, `:None :: String?`, produces a different value inside
`String??`. The
[existing nested option test](../tests/bindings/nested-option-designation.test)
covers this distinction for unions.

With both the `String?` and `String??` overloads in scope, bare `:None` first
selects the inner overload. With peer `String?` and `Int?` overloads, bare
`:None` is ambiguous. An ascription selects either peer.

Numeric `==` can hold across formats while overloads still distinguish the
dispatched concrete type.

```pattern
todo test "Numeric equality can hold for values dispatched to different overloads"
  def kind(n :: Int) "Int"
  def kind(n :: NumericValue) "NumericValue"

  x = 0 :: Int
  assert x == 0
  expect kind(x) is "Int"
  expect kind(0) is "NumericValue"
  expect kind(0 :: NumericValue) is "NumericValue"
end

todo test "A lone outer overload preserves the chosen absence"
  def outer(v :: String??) v
  outerNone = :None :: String??
  innerNone = (:None :: String?) :: String??

  assert outer(:None) === outerNone
  assert outer(:None :: String?) === innerNone
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
