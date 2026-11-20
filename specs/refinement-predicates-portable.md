# Portable refinement predicates

Draft for milestone 10. Extend the initial [predicate enum contract](refinement-predicates.md)
to user-defined predicates after the language has a portable
[closed function representation](../design/FUNCTION-VALUES.md).
A bare name after `.where` always designates a `Predicate` enum case.
An unknown case gives `E_EXPECTED_PREDICATE`, even if a local function has
that name. This extension adds an explicit callable operand, `(name :: (T => Bool))`.

## Closed predicate values

A predicate may eventually be a named user function or a lambda,
including one that captures values or calls other definitions.
Its portable representation must include the dependencies needed
to reconstruct the callable in a fresh environment. Reuse the
closed function representation, including its handling of finite
recursive groups. A predicate does not require a first-class
overload group.

A user-defined predicate's identity comes from its closed
representation. Equality does not compare which inputs two
predicates accept. The enclosing refined descriptor compares its
base pattern and predicate through their ordinary structural rules.

A local predicate can check whether a rectangle is at least twice as wide as
it is tall. The ascription selects the function and its captured ratio.

    type Rectangle struct Rect(width :: Int, height :: Int)
    ratio = 2 :: Int
    def isWide(r :: Rectangle) r.width >= (r.height * ratio)
    type WideRectangle pattern Rectangle .where (isWide :: (Rectangle => Bool))

    wide = Rect(6, 3) :: Rectangle
    tall = Rect(3, 6) :: Rectangle
    assert wide .matches WideRectangle
    assert not(tall .matches WideRectangle)

Even when a function and an enum case share a name, the two spellings select
their respective values.

```pattern
todo test "An explicitly ascribed predicate selects a local function with an enum case's name"
  def isNonZero(n :: ExactRational) False
  type NonZero pattern ExactRational .where isNonZero
  type Never pattern ExactRational .where (isNonZero :: (ExactRational => Bool))

  assert (1 :: ExactRational) .matches NonZero
  assert not((1 :: ExactRational) .matches Never)
  assert not((0 :: ExactRational) .matches Never)
end
```

To reconstruct the refined type, global text must carry the closed predicate and any
definitions it depends on. Local text may abbreviate the callable with
an ascribed name when that name resolves to the same closed value.
An enum predicate prints its bare case name in both contexts.

## Decisions and contract coverage

- Choose the public closed callable expression and its placement in
  canonical type text. A parenthesized lambda is a candidate for a
  noncapturing predicate once it has a portable identity.
- Specify admissible captures and dependency identity, including
  recursive helpers and predicate references to type values.
- Round-trip a predicate with a captured value in a fresh scope.
  Cover local shadowing, recursive dependencies and a refined member
  nested in another type. Check that predicates with different
  captures produce different descriptors even when names agree.
- Generalizing predicate representation leaves the
  [evidence rules](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md)
  in place. Dispatch uses established evidence, and explicit checks
  supply evidence for the exact predicate that was checked.
