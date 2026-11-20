# Ambiguous value designators report `E_AMBIGUOUS_VALUE_DESIGNATOR`

Approved by Jonathan in the project chat on 10 November 2026; renamed from
`E_AMBIGUOUS_VALUE` on 17 November. This renames `E_AMBIGUOUS_PATTERN` and
changes what its message says.

An expression that designates a value, such as the literal `3` or `:None`, is a
value designator. When more than one member of an expected type can accept the
designator, it is ambiguous. The error is the same however the expected type
reaches the designator, and it blames the designator, not the pattern:

    b = abstract Int | Float

    3 .matches b
    (x :: b) = 3

    type Foo concrete String? | Float?
    (x :: Foo) = :None

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
