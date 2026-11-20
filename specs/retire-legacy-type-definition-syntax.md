# Retire alternate type-definition spellings

Approved by Jonathan in the project chat on 9 November 2026: retire
`x = type pattern` and `def Name type ...`; `def` must not provide an alternate
way to declare a type. The motivation is one clear spelling for each role.
Aligned with the [type values](type-values.md) decision: named declarations
install accessors; plain construction is capture-free; Type-valued ordinary
computation remains legal.

## Current spellings

Use a dedicated declaration, or an ordinary type-producing expression:

```pattern
test "Dedicated declarations and plain construction"
  type Rectangle concrete Rect(width :: Int, height :: Int)
  t = concrete Rect(Int, Int)
  type EitherFloat abstract Float32 | Float64
  u = abstract Float32 | Float64
  alias = Rectangle
  assert alias == Rectangle
  assert t == (concrete Rect(Int, Int))
  assert u == (abstract Float32 | Float64)
end
```

`alias = Rectangle` stores an existing type value; it is not another declaration.
Kind constructors such as `ConcreteType(...)` and `AbstractType(...)` are the
ordinary data forms of those descriptors; see [type values](type-values.md).

Retired alternate spellings (`t = type …`, `def Name type …`, and
`def Name concrete/abstract …` as a second declaration path) are rejected rather
than normalized. Coverage for those rejections belongs with the coordinated
runtime removal; this record does not keep a suite of negative deprecated-form
cases.

## Type-valued ordinary functions

Retiring `def` as a type-declaration spelling does not ban Type as a parameter
or result. [Type values](type-values.md) already contracts ordinary functions
that take and return Type, including building descriptors with
`ConcreteType(...)`. The old sketch `def makeBox(t :: Type) concrete Box(t)` was
a confused hybrid of declaration syntax and computation; the approved form is an
ordinary function body:

```pattern
test "Ordinary functions may take and return Type values"
  def keep(t :: Type) t
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  assert keep(Rectangle) == Rectangle
end

todo test "A Type parameter builds a concrete Box descriptor"
  def makeBox(T :: Type) ConcreteType(Box(T))
  saved = makeBox(String)
  assert saved == ConcreteType(Box(String))
end
```

A `def` constant that merely names an existing type value remains an ordinary
binding (`alias = Rectangle` above), not a declaration mechanism.

## Open patterns migrate to `abstract`

Approved by Jonathan in the project chat on 2026-11-10. The retired
`def Name type pattern` and `type pattern` forms constructed an abstract type
when the pattern was open (`...` or `**`). Migrate those to `abstract`, never
`concrete`. A concrete type cannot be open (`ConcreteType({**})` and the
`concrete` pattern form fail with `E_TYPE_DESCRIPTION`).

```pattern
test "Open facets use abstract declarations"
  type Rectangular abstract Rect(w :: Float, h :: Float, **)
  assert Rectangular .matches Type
end

todo test "An abstract open facet registers named field accessors"
  type Rectangular abstract Rect(w :: Float, h :: Float, **)
  r = Rect(2, 3, color: "black") :: (concrete Rect(Float, Float, color: String))
  (p :: Rectangular) = r
  expect p.w is 2 :: Float
  expect p.h is 3 :: Float
end
```

The facet fixes the `Float` fields, so their annotations may be omitted in typed
text; an open `color` field keeps its `String` annotation when the facet does
not determine it. Annotated typed repetition such as `... :: Float32*` follows
[anonymous repeated patterns](anonymous-repeated-patterns.md) (`type Numbers
concrete [... :: Float32*]`); do not treat those as open-facet migrations.

## Implementation

Positive controls remain C04/C05 in
[type-values.test](../tests/specification/type-values.test), C13 in
[interpretations.test](../tests/specification/interpretations.test) and C16 in
[declarations.test](../tests/specification/declarations.test). Runtime removal of
the retired spellings is a coordinated breaking change with the prelude,
schemas, corpus, docs and editors, and follows the type-values migration table
for `Type(...)` / `UnionType(...)` replacements. Preserve the source-defined
optional convention and complete runtime argument packs. This surface change
does not choose a new descriptor-decoding or public inspection API.
