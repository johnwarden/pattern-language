# Raw expression values (superseded)

**Superseded.** The requirement for concrete interpretation in
[Types, descriptors, and type expressions](type-values.md#designation-and-matching)
supersedes bare raw runtime expression construction. A constructor expression
or symbol tag needs a concrete interpretation from its context or an explicit
ascription. See also
[Migration and remaining work](type-values.md#migration-and-remaining-work)
and the model summary in [VALUE-SPACES.md](../VALUE-SPACES.md).

This document previously recorded an interim ruling that allowed unbound
`Expression` values such as `e = Rect(2, 2)` pending typed interpretation.
That interim rule is withdrawn. Preserve typed construction, quotation, and
explicit one-boundary matching coverage under the type-value contracts.
