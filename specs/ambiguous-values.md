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
