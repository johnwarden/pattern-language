# Refinement predicates in the prelude

The initial refinement model accepts named functions defined in the
standard prelude. A predicate in `T .where p` is a bare prelude
identifier. It refers to an unambiguous prelude function applicable to
values of the base pattern and returning `Bool`. This applies to
`pattern`, `struct`, direct descriptors and typed reading.

## Names and identity

Resolve the predicate identifier against the same prelude used by
the type reader. A local definition or alias cannot change which
predicate a descriptor means. A name outside the prelude, a lambda
or an arbitrary expression in the predicate position is an error.
Ordinary calls still use lexical lookup. A call to a shadowing
function supplies no evidence for the prelude predicate of the same
name.

The prelude predicate is identified by its name in that prelude.
Printing the predicate emits just that name. Reading it back with
the same prelude reconstructs the same predicate reference. Global
type text keeps the same spelling under caller-local shadowing.
The base pattern and other descriptor data retain the usual
[structural identity](type-values.md#declarations-normalization-and-identity).

```pattern
type NonZeroNumber pattern ExactRational .where isNonZero
type NonZeroId struct ExactRational .where isNonZero

Pattern(ExactRational .where isNonZero)
Struct(ExactRational .where isNonZero)
```

These examples assume the prelude supplies `isNonZero` for
`ExactRational`. Fixed-format fit predicates such as `fitsInt64`
are supplied with their numeric types. This spec does not fix a
complete list of prelude predicates.

## Evidence and first tests

The name determines the predicate to check. [Refinement evidence](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md)
specifies when checks establish evidence and when a caller must
already have it. In particular, dispatch does not run a predicate to
choose among overloads.

Cover an accepted prelude predicate and rejected non-prelude names
and lambdas. Round-trip a pattern and a struct containing the
predicate in a fresh scope and under caller shadowing. Include a
descriptor containing a refined member, so the round trip exercises
the recursive printer as well as the leaf name. Verify that an
ordinary call to a shadowing function supplies no refinement fact
when evidence checking lands.

[Portable refinement predicates](https://github.com/johnwarden/pattern-language/blob/spec/portable-refinement-predicates/specs/refinement-predicates-portable.md) describe the later extension
to user-defined functions and captures.
