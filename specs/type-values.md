# Type values without a reserved `Type`

Approved by Jonathan in the project chat on 10 November 2026. Origin:
`specs/inbox/type-values.md`, moved here with the agreed migration correction.

The examples below are approved source contracts. Capture them in
`tests/specification/` before implementation. They approve the constructor forms
and behavior shown here. Descriptor values are ordinary data: inspecting one is
ordinary pattern matching on its kind constructor, and its text is its ordinary
value text. This does not approve decoding from arbitrary Expressions (see
below) or a wire format. `Type` is a prelude abstract union of
`AbstractType | ConcreteType | RefinementType | PrimitiveType`; the first three
kinds are defined with ordinary patterns. Primitive atoms retain their existing
special status. `Type(...)` is retired as a native type-value wrapper.

## Prelude and ordinary values

```pattern
todo test "Type is a prelude union, not a reserved symbol"
  assert :Type .matches UpperCamelSymbol
  assert not(Type .matches ReservedSymbol)
  assert Int .matches Type
  assert Bool .matches PrimitiveType
  assert PrimitiveType .matches PrimitiveType
  assert not(:Type .matches Type)

  concreteValue = ConcreteType(Rect(Rational))
  abstractValue = AbstractType(Rational | String)
  predicate = n -> n != 0
  refined = RefinementType(Rational, predicate)
  assert concreteValue .matches ConcreteType
  assert abstractValue .matches AbstractType
  assert refined .matches RefinementType
  assert concreteValue .matches Type
  assert abstractValue .matches Type
  assert refined .matches Type
  assert not(concreteValue .matches AbstractType)
  assert not(refined .matches ConcreteType)
end

todo test "A primitive is already a type value"
  expect Int is Int :: PrimitiveType
  assert Int .matches Type
  expect :Int fails "E_QUOTED_PRIMITIVE"
end

todo test "Type value constructors differ from applying a type to data"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  t = ConcreteType(Rect(Rational, Rational))
  assert t == Rectangle
  assert Rect(2, 3) .matches t
  expect Rect(2, 3) :: t is Rect(2, 3) :: Rectangle
  expect t(2, 3) fails "E_NOT_CALLABLE"
  expect Type(Rect(Rational, Rational)) is Type(Rect(Rational, Rational)) :: Expression
end
```

## Construction and identity

Normalization happens when a `concrete` or `abstract` pattern is evaluated, not
in the kind constructors. `ConcreteType(...)` and `AbstractType(...)` have no
automatic normalizing behavior for now: a descriptor value may hold its
alternatives in any order, and direct constructor calls never reorder, merge or
deduplicate them. The declaration examples produce canonical descriptor data;
equality compares the resulting values, rather than normalizing them.

```pattern
todo test "Concrete descriptors are capture-free and structural"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  x = ConcreteType(Rect(Rational, Rational))
  y = ConcreteType(Rect(Rational, Rational))
  assert Rectangle == x
  assert x == y
  assert not(x == ConcreteType(Rect(Rational, String)))
  assert not(x == ConcreteType(Rect(width: Rational, height: Rational)))
  def keep(t :: Type) t
  assert keep(x) == Rectangle
end

todo test "An independently declared descriptor interops"
  first = (
    type Rectangle concrete Rect(w :: Rational, h :: Rational)
    Rectangle
  )
  second = (
    type Shape concrete Rect(width :: Rational, height :: Rational)
    Shape
  )
  assert first == second
  assert first == ConcreteType(Rect(Rational, Rational))
  value = (Rect(2, 3) :: first)
  assert value .matches second
end

todo test "AbstractType values don't automatically normalize"
  type Either abstract String | Rational
  a = AbstractType(Rational | String)
  b = AbstractType(String | Rational)
  assert Either == a
  assert Either != b
end

todo test "Abstract members remain their concrete types"
  type Either abstract Rational | String
  a = AbstractType(Rational | String)
  assert Either == a
  assert a .matches Type
  assert not(a == ConcreteType(Rational | String))
  assert 3 .matches a
  assert "hello" .matches a
end

test "Independent abstract scopes retain the same member domain"
  left = (
    type Choice abstract Rational | String
    Choice
  )
  right = (
    type Other abstract String | Rational
    Other
  )
  assert left == right
  def pass(t :: Type) t
  assert pass(left) == right
end

todo test "A refinement has a base and predicate, and keeps its base space"
  def nonZero(n :: Rational) n != 0
  type NonZero refinement Rational .where nonZero
  t = RefinementType(Rational, nonZero)
  assert t == NonZero
  assert t .matches Type
  assert not(t == Rational)
  assert not(0 .matches t)
  assert 2 .matches t
  def identity(u :: Type) u
  assert identity(t) == NonZero
end

todo test "Different refinements are not equated merely by their base"
  def positive(n :: Rational) n > 0
  def nonZero(n :: Rational) n != 0
  a = RefinementType(Rational, positive)
  b = RefinementType(Rational, nonZero)
  assert a != b
  assert a != Rational
end
```

Predicate value identity follows the portable function decision; no extensional
equality, environment replay, or public predicate-field extraction is implied.

## A lone primitive is not wrapped

A primitive atom is already a type value, and `type Int` is no longer in the
grammar. A pattern that is just one primitive adds nothing, so neither the
constructors nor the declaration and pattern forms wrap one. All of these are
rejected with `E_TYPE_DESCRIPTION`:

```text
concrete Int
abstract Int
concrete concrete Int
ConcreteType(Int)
AbstractType(Int)
type X concrete Int
type Y abstract Int
```

`concrete concrete Int` is rejected because its operand, `concrete Int`, is
itself rejected. These forms are rejected rather than normalized to the bare
primitive.

The rule concerns a lone primitive, not reuse of an existing type. A union of
two or more primitives is valid (`ConcreteType(Rational | String)`,
`concrete Int | Float`), and an existing type value can be made concrete: given
`a = abstract Int | Float`, `b = concrete a` is valid, and so is `concrete` of a
refinement such as `Int .where ...`. A primitive also remains usable inside a
larger pattern (`concrete Rect(Int, Int)`, `abstract Float32 | Float64`) and as
the base of a refinement (`RefinementType(Rational, nonZero)`). Use the
primitive itself where a type value is wanted: `Int`, `Int :: PrimitiveType`.

## Declaration products, defaults, and application

```pattern
todo test "A declaration registers its accessors"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  value = Rect(2, 3) :: Rectangle
  expect value.w is 2 :: Rational
  assert Rectangle == ConcreteType(Rect(Rational, Rational))
end

todo test "A plain descriptor does not install an accessor"
  t = ConcreteType(Rect(width: Rational, height: Rational))
  value = Rect(width: 2, height: 3) :: t
  expect value.width fails "unbound name"
end

todo test "A type constructor cannot declare captures"
  expect
    ConcreteType(Rect(w :: Rational, h :: Rational))
  fails "ordinary type construction cannot declare captures/accessors"
end

todo test "A type description cannot carry a default"
  expect
    ConcreteType(Rect(Rational, color: String = "black"))
  fails "defaults are forbidden in type descriptions"
end

test "Equivalent declarations and accessor collisions still fail"
  type First concrete Rect(w :: Rational)

  expect
    type First concrete Rect(w :: Rational)
    type Second concrete Rect(w :: Rational)
    Second
  fails "E_DUPLICATE_TYPE"

  expect
    def w(x) 99
    value = Rect(2) :: First
    value.w
  fails "E_AMBIGUOUS_CALL"

end

test "Typed overloaded function still works"
  type First concrete Rect(w :: Rational)
  def w(x :: Int) 99
  value = Rect(2) :: First
  expect value.w is 2
end

todo test "A stored type flows through ordinary calls and returns"
  def make(T :: Type) ConcreteType(Box(T))
  def use(T :: Type)(x :: T) x
  saved = make(String)
  assert saved == ConcreteType(Box(String))
  expect use(saved)(Box("hi") :: saved) is Box("hi") :: saved
  expect use(saved, Box("hi")) fails "E_NO_METHOD"
end

todo test "A type value is not a function that constructs its members"
  t = ConcreteType(Box(String))
  expect t("hi") fails "E_NOT_CALLABLE"
  expect Box("hi") :: t is Box("hi") :: t
end
```

## No implicit public decoding

```pattern
todo test "A constructor spelling in Code does not grant it type identity"
  source = parse(Code)("ConcreteType(Rect(Rational))")
  assert source .matches Code
  t = ConcreteType(Rect(Rational))
  assert t .matches Type
  assert not(source .matches Type)
end

todo test "Supported type values round trip under the prelude Type"
  c = ConcreteType(Rect(Rational))
  a = AbstractType(Rational | String)
  assert parse(Type)(toString(Type)(c)) == c
  assert parse(Type)(toString(Type)(a)) == a
  assert parse(Type)(toString(Type)(Int)) == Int
end
```

The round trips assert identity, not one printed spelling or a parser from an
arbitrary expression tree. Refinement round trips await portable predicate values.

## Migration targets

The legacy `Type(...)` constructor always constructed a concrete type;
`UnionType(...)` constructed abstract unions. Replace those constructors with
`ConcreteType(...)` and `AbstractType(...)`, respectively. There is no per-member
kind classification or additional normalization step. Primitive wrapper cases
instead use the direct primitive atoms, as specified below.

| Existing authored subject | Approved replacement contract |
| --- | --- |
| `Type(Rect(Float, Float))` for a declared concrete rectangle | `ConcreteType(Rect(Float, Float))` equal to the declaration's type value |
| `Type(:None | Some(Int))` / `Type(:Black | :Red)` | `ConcreteType(:None | Some(Int))` / `ConcreteType(:Black | :Red)` |
| `Type(Int)` / `type type Int` | Retire the wrapper; assert `Int :: PrimitiveType` and ordinary `Type` membership; `type Int` is no longer in the grammar |
| `Type(pattern) = t` | Retire the wrapper-specific destructuring; match the ordinary kind constructor instead (`ConcreteType(pattern) = t`) |
| `Type(t) == Type(Int)` with `t` stored as `Any` | Assert the directly stored primitive is still `Int` and accepted by `Type` |
| `toString(Type)` / `parse(Type)` | Keep the prelude union as expected type; the text of a descriptor is its ordinary value text (e.g. `ConcreteType(Rect(Rational))`). Legacy `Type(...)` text keeps its current spelling until the legacy form is deprecated, including `Recursive(...)` with `Recur(0)` back-references |
| `:(Type(...))` equal to a compiled type | Preserve Code/Expression as source data; Code is not implicitly decoded to a type value (see No implicit public decoding) |
| `UnionType(Type(X(...)), ...)` | `AbstractType(ConcreteType(X(...)) | ...)`; union construction does not install declarations or accessors |

## Implementation handoff and deferred decisions

1. Write or revise focused executable contracts for these examples before runtime
   changes. This record remains approved until those tests capture the decision;
   runtime completion is tracked by the tests, including their todo markers.
2. Define the prelude kinds with ordinary patterns using the approved one-argument
   concrete/abstract and two-argument refinement forms. Exact recursive and nested
   descriptor cases need focused contracts before support is extended. Keep direct
   `:Symbol(...)` construction distinct from calling a bound concrete value.
3. Migrate legacy concrete and abstract constructors according to the table,
   preserving primitive atoms. This approval does not add an explicit primitive
   descriptor quote.
4. Descriptor inspection is ordinary pattern matching on the kind constructors,
   and descriptor text is their ordinary value text; neither needs a separate
   mechanism. Two things stay open: the recursive descriptor spelling, which keeps
   its current `Recursive(...)` / `Recur(0)` form for now and is changed only by a
   separate decision, and refinement predicate values and their text, which follow
   the portable function decision; specify them before adding a refinement
   round-trip test.
