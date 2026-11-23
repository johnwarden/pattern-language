# Declaration products and type syntax

[declarations.test](declarations.test) is the executable contract. Its ordinary
C05/C16/C18 controls retain supported bootstrap syntax for type-value identity,
declaration-only accessors and independent-scope interoperability. The explicit
`type Name concrete ...` and plain `concrete ...` C16 forms are now ordinary
checks too. Parameterized surface forms and the remaining obligations stay todo.

Plain construction cannot introduce accessor captures or install methods. A named
declaration registers its local products; physical field labels still belong to
the structural value and do not automatically install accessors. The C16 controls
exercise both explicit captures and labeled plain construction.

The C05 extraction control uses explicit match, so it does not endorse opening a
concrete value through an ordinary constructor binding. The latter rejection is
tracked in [raw-expressions.test](raw-expressions.test). The C18 control exchanges
equal values across independent lexical declarations without importing accessor
bundles. Existing equivalent-declaration/accessor collisions remain errors
near term; the [proposed D21 collision policy](../../design/LANGUAGE-DECISIONS.md#d21-name-collision-and-equivalent-redeclaration-policy--proposed)
and its executable fences in [type-values](../../specs/type-values.md#name-collisions-and-aliases)
and [named-function-values](../../specs/named-function-values.md#name-collisions-and-overloads)
are the destination contracts.

The source grammar now recognizes concrete/abstract declarations and their
ordinary type-producing expressions. The non-generic C05 and C06 checks in
[type-values.test](type-values.test), C13 in
[interpretations.test](interpretations.test), and the C16 checks here exercise
the specified spellings and their existing type/declaration semantics. The
[declaration-syntax regressions](declaration-syntax.test) also cover recursive
groups and retained duplicate/collision errors.

Angle parameters, refinement/evidence and other still-unfulfilled contracts are
separate work. A parsed declaration does not fulfill every assertion in its case
family. Keep this note synchronized with the tests rather than treating it as an
independent specification.
