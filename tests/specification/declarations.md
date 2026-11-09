# Declaration products and the pending declaration syntax

[declarations.test](declarations.test) is the executable contract. Its ordinary
C05/C16/C18 cases use supported bootstrap syntax to check type-value identity,
declaration-only accessors and independent-scope interoperability. Its todo cases
retain the specified concrete/abstract and parameterized surface forms.

Plain construction cannot introduce accessor captures or install methods. A named
declaration registers its local products; physical field labels still belong to
the structural value and do not automatically install accessors. The C16 controls
exercise both explicit captures and labeled plain construction.

The C05 extraction control uses explicit match, so it does not endorse opening a
concrete value through an ordinary constructor binding. The latter rejection is
tracked by the separate concrete-boundary work in #39. The C18 control exchanges
equal values across independent lexical declarations without importing accessor
bundles. Existing equivalent-declaration/accessor collisions remain errors.

Passing these controls does not mean the new `type Name concrete ...`, ordinary
`concrete ...`, or angle-parameter syntax is implemented. Those todo contracts
must be promoted only when their specified spellings and behavior pass. #48 is
the next syntax implementation handoff. Keep this note synchronized with the
tests rather than treating it as an independent specification.
