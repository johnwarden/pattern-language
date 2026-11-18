# Pattern types and structs

The [refined type model](../inbox/2026-11-17-refined-type-model.md) supersedes
the earlier [type-values proposal](../approved/type-values.md) for type
construction. The source contracts cover the agreed core. Todo markers record
the work still needed in the interpreter.

- `pattern P` admits matching values and retains their concrete identities.
  A pattern applied to a type reference resolves to that type, including
  `pattern pattern Int`. A standalone symbol pattern such as `pattern :Red`
  admits the matching values of concrete enums at their immediate boundary.
- `struct P` establishes a distinct concrete type. A constructor pattern
  describes fields that the expected type can interpret. A reference to a
  concrete type inside `struct` adds a boundary around that type. Each nested
  struct boundary contributes to type identity.
- `Pattern(P)` and `Struct(P)` are descriptor values. Both use `T .where p`
  for refinement patterns. The macros normalize descriptions using the
  established structural rules. Literal descriptor values obey typed text
  round trips.
- An abstract facet can admit different concrete types. Assignment to the
  facet requires an unambiguous concrete value. A facet inspects the actual
  concrete members of abstract fields and leaves the enclosing type intact.
- Direct destructuring reads the fields of a struct whose constructor pattern
  declares them. An explicit match can also project one concrete wrapper or
  select a symbolic alternative without producing a raw symbol. Ordinary
  binding and overload dispatch preserve wrapper boundaries.
- Overload domains must be disjoint for direct membership. A direct match
  takes priority over designation. Equality is permitted when the static
  domains overlap and compares exact values including their concrete types.

## Contracts

- [C04–C06 and the type model contracts](../../tests/specification/type-values.test)
  cover concrete construction, structural identity, symbol patterns, facets,
  normalized type syntax, descriptor round trips, and explicit projection.
- [Construction and quotation](../../tests/specification/raw-expressions.test)
  distinguishes bare constructors and symbol alternatives, typed values,
  and quoted syntax. [Binding defaults](../../tests/bindings/defaults.test)
  and [cross-context patterns](../../tests/matching/cross-context.test)
  use explicit concrete fixtures for supported behavior.

The bootstrap fixture spelling remains in ordinary checks for supported
behavior. Legacy assertions retain selected bootstrap observations until
the replacement lands. The inbox draft retains the broader spread, generic,
and predicate-transport questions.
