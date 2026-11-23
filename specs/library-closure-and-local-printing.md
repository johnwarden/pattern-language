# Closed immutable values and exact local printing

## Closed immutable values

A stored function/library value is immutable. Binding `saved = f` captures all
declarations in the current lexical group as a `PolymorphicValue`, including
ones spelled after the binding; no ascription is required, though
`f :: PolymorphicValue` remains an allowed explicit form. A nested scope can
resolve that name differently. The stored value carries its original group and
the transitive definitions and values it uses. Recursive and mutually recursive
definitions have a finite representation.

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
insufficient. A shadowing name that resolves to a different value is ineligible.
A stored group can use an alias that already denotes its `PolymorphicValue`.
Choose the first eligible spelling in lexical order. If none is visible, print
the closed representation.

Global text remains independent of lexical aliases and must reconstruct the
same value in a fresh environment. Local text requires its naming scope and must
reconstruct the same value there. Printing preserves the selected definition
group, dispatch behavior and identity.

A second local **type** name for an equal descriptor is not introduced by
printing or by repeating `type Second …`; it is an ordinary value alias
(`Second = First`) per the
[proposed collision policy](../design/LANGUAGE-DECISIONS.md#d21-name-collision-and-equivalent-redeclaration-policy--proposed).
Aliases have no preferred display name. Import/local name clashes are always
`E_NAME_BOUND` and are resolved by renaming with `as`, never by silent
shadowing that would make an exact-alias print ambiguous.

## Contracts

Executable contracts for named function values, including closure and identity
todos, live in [named-function-values.md](named-function-values.md). Its
fresh-interpreter round trip checks that portable text carries the captured
values.
