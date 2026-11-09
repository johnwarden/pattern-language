# Closed immutable values and exact local printing

Approved in the project chat on 9 November 2026: Jonathan agreed the immutable,
closed-value and exact-local-printing principles discussed as points 3 and 4 of
the libraries draft review. This does not approve the draft's full Library
grammar, overloaded constants or expected-type selection policy.

## Closed immutable values

A stored function/library value is an immutable snapshot of the definitions and
values it contains. Later additions to a named definition group cannot mutate
an earlier stored value. Include transitive referenced definitions and captured
values so there are no free user variables or hidden lexical lookup dependencies.
Recursive and mutually recursive definitions must have a finite representation.

"Helper" is only informal shorthand for a definition referenced by another
definition. It is not a different definition kind and does not introduce private
versus exported categories. Any such distinction would need its own decision.

Only the fixed primitive vocabulary remains external in the initial closed
representation. Treat ordinary prelude/standard-library definitions like other
referenced definitions, rather than resolving an unversioned name to whatever
implementation happens to be present in the receiving environment. A later
external library-reference scheme must identify exact definitions without
changing structural value identity.

## Exact local printing

Local printing can abbreviate a value or an embedded referenced definition with
an in-scope name only when that binding denotes the exact same complete value.
Matching spelling, one matching overload, or equivalent observed behavior is
insufficient. If a name is shadowed, or its group now contains different
definitions, do not abbreviate the older value with that name. Another valid
alias may still be used; otherwise print the closed representation.

Global text remains independent of lexical aliases and must reconstruct the
same value in a fresh environment. Local text requires its naming scope and must
reconstruct the same value there. Printing changes presentation, not the selected
definition group, dispatch behavior or identity. Preferred choice among several
valid aliases is not settled here.

## Contracts and remaining conversion

[named-function-values.test](../../tests/specification/named-function-values.test)
contains todo checks for captured values, transitive referenced definitions,
finite recursive calls, successive packs, lazy defaults, returned captures and
structural identity, alongside the original callable-use cases. Those behavioral
tests alone do not prove a portable representation without a hidden environment.

The [test proposal](../inbox/named-function-value-tests.md) names the remaining
snapshot, fresh-context and printing checks and the decisions needed to express
them. Keep this record approved until those representation-level obligations
are captured as actual tests. No public Function/Library schema, export policy,
constant selection syntax or implicit Library projection is chosen here.
