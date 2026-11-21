# Ambiguous value designators report `E_AMBIGUOUS_VALUE_DESIGNATOR`

Approved by Jonathan in the project chat on 10 November 2026; renamed from
`E_AMBIGUOUS_VALUE` on 17 November. This renames `E_AMBIGUOUS_PATTERN` and
changes what its message says.

An expression that designates a value, such as the literal `3` or `:None`, is a
value designator. When more than one member of an expected type can accept the
designator, it is ambiguous. The error is the same however the expected type
reaches the designator, and it blames the designator, not the pattern:

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

Each of these fails with `E_AMBIGUOUS_VALUE_DESIGNATOR`. The message lists the
possible interpretations so the author can choose one, for example "ambiguous
value designator 3: please specify `3 :: Int` or `3 :: Float`". Each
interpretation is written as source, `designator :: Type`, for a member that
accepts it. The exact surrounding wording is not pinned; every candidate
interpretation must appear in it. When more than two interpretations match, the
message lists the first two and ends with `...and N others`.

A member accepts a designator only if every condition of the member holds,
including a refinement's predicate. If exactly one member accepts it, the
designator is not ambiguous and selects that member. With
`p = Int .where (n -> n > (5 :: Int))`, `u = abstract p | Float` and
`def f(n :: u) n`, `f(3)` is not ambiguous (only `Float` accepts `3`), while
`f(7)` is (both do). Choosing `3 :: p` explicitly fails with the failed predicate
named in the error.

`E_AMBIGUOUS_PATTERN` is retired: existing assertions that expect it are renamed
to `E_AMBIGUOUS_VALUE_DESIGNATOR`, preserving their subjects. A declaration with
repeated alternatives is not ambiguous: `type :A | :A` normalizes to `type :A`.
This does not change designation or literal typing: `3` stays ambiguous between
`Int` and `Float` here because both designate it.

## Contracts

[PR #80](https://github.com/johnwarden/pattern-language/pull/80) implements the
diagnostic in [ambiguous-values.test](../tests/specification/ambiguous-values.test).
The cases cover numeric and optional designators, surviving alternatives,
nested and recursive suggestions, truncation, and refinement checks after
overload selection. Bound arguments and bound fields have todo cases for
refinement evidence.

[Overlapping union contracts](../tests/specification/overlapping-unions.test)
cover normalization. Type macros remove repeated alternatives under ordinary type
equality, including aliases and factory results. Explicit kind constructors
retain their existing behavior.

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
dispatched concrete type. Restored from the retired
`2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md`
draft (ExactRational → `NumericValue`).

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

