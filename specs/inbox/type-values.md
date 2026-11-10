# Type values without a reserved `Type`

Proposed source contracts. The constructor payloads below are candidate public
shapes, not approved descriptor inspection or a wire format. Put accepted cases in
`tests/specification/` before implementation. `Type` should be a prelude abstract
union of `AbstractType | ConcreteType | RefinementType | PrimitiveType`; the first
three kinds are defined with ordinary patterns. Primitive atoms retain their
existing special status. `Type(...)` is retired as a native type-value wrapper.

## Prelude and ordinary values

```pattern
test "Type is a prelude union, not a reserved symbol"
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

test "A primitive is already a type value"
  expect Int result Int :: PrimitiveType
  assert Int .matches Type
  assert (type Int) == Int
  expect :Int error "E_QUOTED_PRIMITIVE"
end

test "Type value constructors differ from applying a type to data"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  t = ConcreteType(Rect(Rational, Rational))
  assert t == Rectangle
  assert Rect(2, 3) .matches t
  expect Rect(2, 3) :: t result Rect(2, 3) :: Rectangle
  expect t(2, 3) error "E_NOT_CALLABLE"
  expect Type(Rect(Rational, Rational)) error "E_NOT_CALLABLE"
end
```

## Construction and identity

```pattern
test "Concrete descriptors are capture-free and structural"
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

test "An independently declared descriptor interops"
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

test "Abstract members remain their concrete types"
  type Either abstract Rational | String
  a = AbstractType(Rational | String)
  b = AbstractType(String | Rational)
  assert Either == a
  assert a == b
  assert a .matches Type
  assert not(a == ConcreteType(Rect(Rational)))
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

test "A refinement has a base and predicate, and keeps its base space"
  def nonZero(n :: Rational) n != 0
  type NonZero refinement Rational .where nonZero
  t = RefinementType(Rational, nonZero)
  assert t == NonZero
  assert t .matches Type
  assert not(t == Rational)
  assert not(t == ConcreteType(Rational))
  assert not(0 .matches t)
  assert 2 .matches t
  def identity(u :: Type) u
  assert identity(t) == NonZero
end

test "Different refinements are not equated merely by their base"
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

## Declaration products, defaults, and application

```pattern
test "A declaration registers its accessors"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  value = Rect(2, 3) :: Rectangle
  expect value.w result 2 :: Rational
  assert Rectangle == ConcreteType(Rect(Rational, Rational))
end

test "A plain descriptor does not install an accessor"
  t = ConcreteType(Rect(width: Rational, height: Rational))
  value = Rect(width: 2, height: 3) :: t
  expect value.width error "unbound name"
end

test "A type constructor cannot declare captures"
  expect
    ConcreteType(Rect(w :: Rational, h :: Rational))
  error "ordinary type construction cannot declare captures/accessors"
end

test "A bound default supplies a capture but cannot change a type"
  type Rectangle concrete Rect(w :: Rational, h :: Rational)
  def rectangle(w :: Rational, h :: Rational = 3)
    Rect(w, h) :: Rectangle
  end
  expect rectangle(2).h result 3 :: Rational
  expect
    ConcreteType(Rect(Rational, color: String = "black"))
  error "defaults are forbidden in type descriptions"
end

test "Equivalent declarations and accessor collisions still fail"
  expect
    type First concrete Rect(w :: Rational)
    type Second concrete Rect(w :: Rational)
    Second
  error "E_DUPLICATE_TYPE"
  expect
    type First concrete Rect(w :: Rational)
    def w(x) 99
    value = Rect(2) :: First
    value.w
  error "E_AMBIGUOUS_CALL"
end

test "A stored type flows through ordinary calls and returns"
  def make(T :: Type) ConcreteType(Box(T))
  def use(T :: Type)(x :: T) x
  saved = make(String)
  assert saved == ConcreteType(Box(String))
  expect use(saved)(Box("hi") :: saved) result Box("hi") :: saved
  expect use(saved, Box("hi")) error "E_NO_METHOD"
end

test "A type value is not a function that constructs its members"
  t = ConcreteType(Box(String))
  expect t("hi") error "E_NOT_CALLABLE"
  expect Box("hi") :: t result Box("hi") :: t
end
```

## No implicit public decoding

```pattern
test "A constructor spelling in Code does not grant it type identity"
  source = parse(Code)("ConcreteType(Rect(Rational))")
  assert source .matches Code
  t = ConcreteType(Rect(Rational))
  assert t .matches Type
  assert not(source .matches Type)
end

test "Supported type values round trip under the prelude Type"
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

| Existing authored subject | Proposed replacement contract |
| --- | --- |
| `Type(Rect(Float, Float))` for a declared concrete rectangle | `ConcreteType(Rect(Float, Float))` equal to the declaration's type value |
| `Type(:None | Some(Int))` / `Type(:Black | :Red)` | Use `AbstractType(...)` or `ConcreteType(...)` according to the declared member-space role; classify each legacy case before changing its golden |
| `Type(Int)` / `type type Int` | Retire the wrapper; assert `Int :: PrimitiveType`, `(type Int) == Int`, and ordinary `Type` membership |
| `Type(pattern) = t` | Use the agreed ordinary kind pattern (candidate `ConcreteType(pattern) = t`); do not assume public descriptor-field extraction is approved |
| `Type(t) == Type(Int)` with `t` stored as `Any` | Assert the directly stored primitive is still `Int` and accepted by `Type` |
| `toString(Type)` / `parse(Type)` | Keep the prelude union as expected type; migrate exact old `Type(...)` text only after canonical format is chosen |
| `:(Type(...))` equal to a compiled type | Preserve Code/Expression as source data; public type-value decoding remains a separate decision |
| `UnionType(Type(X(...)), ...)` | Preserve member-space identity and normalize each member to its chosen kind; union construction does not install declarations |

## Decisions to settle

1. Specify the exact ordinary patterns and constructor payloads for each kind,
   including nested abstract members, recursive descriptors and refinement
   predicate values. The fences above use candidate one-argument concrete/abstract
   and two-argument refinement shapes.
2. Specify how `ConcreteType(...)` constructs a value while `ConcreteType` also
   denotes its ordinary pattern/type in the prelude. Keep direct `:Symbol(...)`
   construction distinct from calling a bound concrete value.
3. Classify existing `Type(...)` cases by value-space role before replacing their
   expected data. Preserve primitive atoms; settle whether an explicit primitive
   descriptor quote exists at all.
4. Keep public descriptor inspection/decoding and exact canonical text pending;
   decide portable refinement predicate text before adding its round-trip test.
