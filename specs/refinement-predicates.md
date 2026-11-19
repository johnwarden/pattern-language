# Refinement predicates

The initial refinement model uses an ordinary concrete enum, `Predicate`.
The prelude declares it and supplies the test for each case. This excerpt
shows two cases:

```pattern
type Predicate struct :isNonZero | :isPositive

def checkPredicate(p :: Predicate)(value)
  match p
    :isNonZero -> isNonZero(value)
    :isPositive -> isPositive(value)
  end
end
```

The example uses ordinary matching to associate each enum value with a
Boolean test. Each case has an input domain. A refinement's base pattern
must admit only values that the selected case can test. Checking that
compatibility does not execute the test.

## Designation and identity

In `T .where p`, the expected type of `p` is `Predicate`. A bare tag
such as `:isNonZero` designates the corresponding enum member. A
reference to an existing `Predicate` value uses the usual value
reference rules for type descriptions. A tag absent from `Predicate`,
a function value, or a value of a different concrete type does not
supply a predicate. This applies to `pattern`, `struct`, direct
descriptors and typed reading.

The descriptor stores the enum value using its ordinary structural
identity. It has no need to classify functions by their definition
scope. Ordinary name lookup applies to the definitions that implement
the tests.

## Printing

Print the tag in a refinement, for example `ExactRational .where :isNonZero`.
The reader already expects a `Predicate` after `.where`, so it recovers
the enum member under the same prelude. When an expression needs to
identify the enum value on its own, use `:isNonZero :: Predicate`.

```pattern
type NonZeroRational pattern ExactRational .where :isNonZero
type NonZeroId struct ExactRational .where :isNonZero

Pattern(ExactRational .where :isNonZero)
Struct(ExactRational .where :isNonZero)
```

Numeric formats supply any additional fit cases and their tests with
the corresponding types. This spec leaves the full enum inventory to
those contracts.

## Evidence and first tests

Use the enum value to identify the test in the
[refinement evidence](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md)
rules. An explicit `.matches` check of a refined pattern can establish
evidence for its predicate. Dispatch uses existing evidence.

Cover designation and reading of a valid enum member and rejection of
an unknown tag or wrong operand type. Round-trip a pattern and a struct,
including a descriptor with a nested refined member. Check that a
caller-local function with the same name as a tag has no effect on the
refinement. The tag identifies the predicate, while ordinary calls use
their own bindings.

[Portable refinement predicates](https://github.com/johnwarden/pattern-language/blob/spec/portable-refinement-predicates/specs/refinement-predicates-portable.md) describe the later extension to
user-defined functions and captures.
