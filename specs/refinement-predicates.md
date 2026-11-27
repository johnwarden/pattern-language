# Refinement predicates

The prelude defines `Predicate` as a concrete enum. Each case identifies
one Boolean test with a declared input domain. A descriptor can store
the enum value structurally and print it by name, so a reader can recover
the same predicate without the caller's lexical environment.

```pattern
test "Predicate is a concrete enum of named cases"
  type Predicate struct :isNonZero | :isPositive | :isSquare

  def checkPredicate(p :: Predicate)(value)
    match p
      :isNonZero -> isNonZero(value)
      :isPositive -> isPositive(value)
      :isSquare -> isSquare(value)
    end
  end

  assert (:isNonZero :: Predicate) .matches Predicate
  assert (:isSquare :: Predicate) .matches Predicate
end
```

The example uses ordinary matching to associate each enum value with a
Boolean test. Each case has an input domain. A refinement's base pattern
must admit only values that the selected case can test. Checking that
compatibility does not execute the test. For `isSquare`, the domain is a
rectangular facet (width and height fields); for `isNonZero` /
`isPositive`, numeric formats supply the fit.

## Designation and identity

In `T .where p`, the expected type of `p` is `Predicate`. Here the
pattern grammar interprets a bare lower-camel name such as
`isNonZero` or `isSquare` as an enum tag. The name designates the
corresponding member of `Predicate`. This is a grammatical role for a
lower-camel symbol, like a capture name in a binding pattern. A bare name
here does not look up a function or a local variable.

An explicit tag uses ordinary enum designation. A supplied value must
have type `Predicate`. An unknown tag, a lambda, a function value, or a
value of a different concrete type does not supply a predicate. Report
`E_EXPECTED_PREDICATE` when the operand is not a `Predicate`. These rules
apply to `pattern`, `struct`, direct descriptors and typed reading.

The descriptor stores the enum member by ordinary structural identity.
The prelude supplies its Boolean test.

## Printing

Print the case name without the colon in a refinement, for example
`NumericValue .where isNonZero` or `Rectangular .where isSquare`. The
reader expects a `Predicate` after `.where`, so it recovers the enum
member under the same prelude. When an expression needs to identify the
enum value on its own, use `:isNonZero :: Predicate` or
`:isSquare :: Predicate`.

```pattern
todo test "Refinement descriptors print bare predicate case names"
  p = Pattern(NumericValue .where isNonZero)
  t = Struct(NumericValue .where isNonZero)
  nested = Struct(Box(Pattern(NumericValue .where isNonZero)))

  expect toString(Type)(p) is "Pattern(NumericValue .where isNonZero)"
  expect toString(Type)(t) is "Struct(NumericValue .where isNonZero)"
  assert parse(Type)(toString(Type)(p)) === p
  assert parse(Type)(toString(Type)(t)) === t
  assert parse(Type)(toString(Type)(nested)) === nested
end
```

Numeric formats supply any additional fit cases and their tests with
the corresponding types. Facet predicates such as `isSquare` ship with
the structural facet contracts. This spec leaves the full enum inventory
open to those contracts while requiring `isNonZero`, `isPositive`, and
`isSquare` in the initial set shown above.

## Evidence and first tests

An expected refined type can establish evidence by checking its predicate
on a constant expression. Bindings, arguments, and expression ascriptions
use the same rule. A successful explicit `.matches` check can establish
evidence for a runtime value. See the
[refinement evidence proposal](https://github.com/johnwarden/pattern-language/pull/89).

```pattern
test "Refinements require Predicate operands"
  todo expect
    Int .where unknownPredicate
  fails "E_EXPECTED_PREDICATE"

  expect
    Int .where "isNonZero"
  fails "E_EXPECTED_PREDICATE"

  todo expect
    Int .where (n -> True)
  fails "E_EXPECTED_PREDICATE"
end
```

```pattern
todo test "isSquare designates a Predicate case, not a local function"
  type Rectangular pattern Rect(w :: Float, h :: Float)
  type Rectangle struct Rect(w :: Float, h :: Float)
  def isSquare(r :: Rectangular) False
  type Square pattern Rectangular .where isSquare

  r = Rect(10, 10) :: Rectangle
  assert not(isSquare(r))
  assert r .matches Square
end
```

[Portable refinement predicates](https://github.com/johnwarden/pattern-language/compare/master...spec/portable-refinement-predicates)
describe the extension to user-defined functions and captures.
