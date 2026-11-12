# Type values and wrapping

Draft for review. On approval, this supersedes [Type values without a reserved
Type](../approved/type-values.md).

## One pattern language

Type descriptions, parameter patterns, destructuring bindings and match arms
use the same pattern compiler and matching semantics. Each context supplies its
own inputs and consumes the result. A declaration can register accessors from
captures, a binding introduces captures into scope, and a call resolves all
eligible overloads.

A type description accepts a singleton value, a reference to a type, a
constructor pattern, an alternative, a predicate refinement, or a pattern with
a positional rest or open labeled fields. Any of these can appear inside
`Wrap(...)`, including in a nested field type.

| Pattern | Plain type | Wrapped type |
| --- | --- | --- |
| `:None` | Singleton containing the symbol | Distinct singleton designated by the symbol |
| `Int` | Alias of the existing type | Newtype designated by Int values |
| `Rect(Int, Int)` | Closed struct | Distinct type designated by that struct |
| `Int \| :None` | Union preserving the member types | Concrete union |
| `Int .where isPositive` | Refinement preserving the base type | Carveout |
| `Rect(Int, Int, **)` | Open structural facet | Concrete type designated by structs that satisfy the facet |

A closed constructor pattern describes a concrete struct, including when a
field has an abstract type. A rest or open field pack makes a constructor
pattern a facet. For example, `Some(Int) | :None` has a concrete struct member
and a singleton symbol member. Neither requires a raw expression tree as a
runtime value. Constructor-shaped source can designate a struct in an expected
type context. Source represented as `Code` retains its separate identity.

## Constructing and storing type values

`type P` compiles and normalizes a type description. A lone type reference
resolves to the referenced type. In particular, a primitive type value stays
a primitive type value.

```pattern
t = (type Int)
expect t is Int :: PrimitiveType

expect (type :None) is Type(:None)
expect (type Rect(Int, Int)) is Type(Rect(Int, Int))
expect (type Int | :None) is Type(Int | :None)
expect (type Wrap(Int)) is Type(Wrap(Int))
```

`Type(P)` is a type descriptor literal. It reads its argument as a pattern
and preserves the descriptor as written, including the order of alternatives.
The `type` macro returns the normal form of the described type. A literal
descriptor can describe a type whose normal form is a primitive atom.
`Type(Int)` is a descriptor of type `Type`; `type Int` yields the primitive
value `Int :: PrimitiveType`.

```pattern
expect Type(Int) is Type(Int) :: Type
assert Type(Int | Float) != Type(Float | Int)
expect (type Int | Float) is Type(Int | Float) :: Type
expect (type Float | Int) is Type(Int | Float) :: Type
```

Descriptor value equality compares the stored pattern structure. Normalized
types compare by their normal forms. Thus two descriptors can describe the
same type and still differ as literal values. Local aliases and capture names
do not affect normalized type identity. Physical field labels, predicate
identity and wrapper boundaries participate.

Type values can be stored, passed to functions and used in annotations.
`ConcreteType(...)`, `AbstractType(...)` and `RefinementType(...)` are
superseded as descriptor kinds. Type declarations can install accessors from
captures. Plain type expressions and descriptor literals have no declaration
effects. Defaults remain excluded from type descriptions.

### Literal values round-trip

Every literal denotes a specific value. Printing that value as literal text
and reading the result in the appropriate type yields the same exact value.
This holds for non-normal descriptors as well. Printing or reading a
`Type(P)` literal preserves its descriptor value. Normalization is the
operation of the `type` macro.

```pattern
d = Type(Float | Int)
text = toString(Type)(d)
assert parse(Type)(text) == d
assert parse(Type)(text) != Type(Int | Float)

intDescriptor = Type(Int)
assert parse(Type)(toString(Type)(intDescriptor)) == intDescriptor

primitive = Int
assert parse(PrimitiveType)(toString(PrimitiveType)(primitive)) == primitive
```

Descriptor inspection means extracting the pattern from an existing
`Type(P)` value for use in a program, for example extracting the two arms
of a union. The literal round-trip guarantee is independent of the syntax
and value representation used to expose those pieces.

## Wrapping and unwrapping

`Wrap(P)` creates a concrete type disjoint from its base. An input that
designates a value under `P` can designate a value of `Wrap(P)` when that
wrapped type is expected. The resulting value belongs to `Wrap(P)`. A wrapped
value cannot designate a value in its base type. `unwrap` removes one
boundary and yields the concrete base value, including the selected union
member. Nested wrappers each add a distinct concrete type.

```pattern
t = (type Wrap(:None))
(v :: t) = :None :: UpperCamelSymbol
expect v is :None :: t
expect unwrap v is :None :: UpperCamelSymbol

type ErrorCode Wrap(UpperSnakeSymbol)
(e :: ErrorCode) = FILE_NOT_FOUND

type PositiveInt Int .where isPositive
type Id Wrap(PositiveInt)
(id :: Id) = 5 :: Int
expect unwrap id is 5 :: Int

type One Wrap(Int)
type Two Wrap(One)
type Three Wrap(Two)

assert One != Two
assert Two != Three

(n :: One) = 5 :: Int
(m :: Two) = n
(k :: Three) = m
assert (unwrap k) == m
assert (unwrap m) == n
expect (unwrap n) is 5 :: Int
```

A wrapped refinement checks its predicate before wrapping.

## Open facets retain the concrete value

An open facet is an abstract type that can match multiple concrete struct
types. Assigning to a facet requires the right-hand side to resolve to one
unambiguous concrete value. The binding has the facet as its static type.
At runtime, where the concrete type is not statically known, the binding
carries the value and a reference to its concrete type, as with a Go
interface.

Wrapping a facet makes one new concrete type with an abstract payload. Each
payload retains its own concrete type. `unwrap` recovers that concrete
value, with the facet as the static type of the result.

```pattern
type Color :Red | :Green | :Blue
type Rectangle Rect(Int, Int)
type ColoredRectangle Rect(Int, Int, color: Color)
type RedRectangle Rect(Int, Int, color: :Red)
type Rectangular Rect(Int, Int, **)
type WrappedRectangular Wrap(Rectangular)

plain = Rect(3, 5) :: Rectangle
painted = Rect(3, 5, color: :Red) :: ColoredRectangle

(a :: Rectangular) = plain
(b :: Rectangular) = painted
expect a is Rect(3, 5) :: Rectangle
expect b is Rect(3, 5, color: :Red) :: ColoredRectangle
assert a != b

(wa :: WrappedRectangular) = a
(wb :: WrappedRectangular) = b
expect (unwrap wa) is Rect(3, 5) :: Rectangle
expect (unwrap wb) is Rect(3, 5, color: :Red) :: ColoredRectangle
```

The bare designator `Rect(3, 5, color: :Red)` can designate either a
`ColoredRectangle` or a `RedRectangle`. The facet supplies no unique closed
type for that designator. Supply the concrete type on the right-hand side
before binding to either `Rectangular` or `WrappedRectangular`. For
example, `Rect(3, 5, color: :Red) :: RedRectangle` would carry the concrete
type `RedRectangle` through both the facet binding and the wrapper.

## Destructuring, match and overloads

The same compiler recognizes a closed struct in a destructuring binding, a
parameter or a match arm. The outer wrapper boundary is visible to all these
uses. A plain struct pattern can destructure the base after an explicit
`unwrap`. A whole-value typed pattern can bind the wrapped value itself.

```pattern
type Rectangle Rect(Int, Int)
type WrappedRectangle Wrap(Rect(Int, Int))

a = Rect(2, 3) :: Rectangle
b = a :: WrappedRectangle

Rect(w, h) = a
expect (w, h) is (2, 3)

def f(v :: Rectangle) "Rectangle"
def f(v :: WrappedRectangle) "Wrapped Rectangle"

expect f(a) fails "ambiguous"
expect f(b) is "Wrapped Rectangle"
```

Overload resolution considers every applicable definition using the shared
matcher, including candidates accepted by designation. Direct membership
has no priority over designation across overloads. If both definitions above
are in scope, the call with `a` is ambiguous. The call with `b` has one
candidate because designation cannot unwrap `b`. Adding an applicable
overload can expose an ambiguity and leave the author in control of how to resolve it. This rule concerns overload candidates. Ambiguous member
interpretations within an expected type keep their own diagnostic.

```pattern
type Some(T :: Type) Some(T)
type Option(T :: Type) Wrap(Some(T) | :None)

(x :: Option(Int)) = Some(5)
expect unwrap x is Some(5) :: Some(Int)

result = match unwrap x
  when Some(i) i
  else 0 :: Int
end
expect result is 5 :: Int
```

Here `Some(T)` in the body of the `Some` declaration is the struct pattern.
`Some(T)` in the `Option` declaration references the instantiated struct
type. The name resolution rule that distinguishes these two uses of `Some(T)`
remains open. A plain match on `x` cannot inspect which member is inside it.

## Equality uses the operands' static type

Two variables can be compared under the same static type, including an
abstract type. Their values are equal when the exact values are equal under
that shared static type. An abstract annotation preserves the concrete member
value. It supplies the comparison type even when the two members have different
concrete types. The concrete member type is part of the exact value being
compared, so values from distinct concrete members compare unequal.

```pattern
type MaybeInt Int | :None
(a :: MaybeInt) = :None
(b :: MaybeInt) = 5 :: Int
(c :: MaybeInt) = :None
assert a != b
assert a == c
```

The `a != b` assertion in the open-facet example above uses the same rule.
Both bindings have static type `Rectangular`, and their exact values have
different concrete types.

Two operands of different concrete static types cannot be compared. Both
`==` and `!=` reject a direct comparison between a wrapped value and its
base. An explicit annotation can designate a wrapped operand before
comparison. An explicit `unwrap` can expose the base operand instead.

```pattern
t = (type Wrap(:None))
(v :: t) = :None
z = :None :: UpperCamelSymbol

expect (v == z) fails "disjoint types"
assert v == (z :: t)
assert ((unwrap v) :: UpperCamelSymbol) == z
```

An assertion of the form `expect v is :None :: t` describes the expected
value in `t`; it does not compare the wrapped value to an already typed
symbol. How comparison handles a contextual literal or operands with
different but overlapping abstract static types is a separate rule.

## Migration

Translate existing contracts by behavior. A legacy concrete struct becomes a
plain constructor pattern. An abstract union, refinement, or facet becomes a
plain pattern of the corresponding form. A concrete union becomes
`Wrap(P | Q)`. A former concrete carveout becomes `Wrap(P .where predicate)`.
A bare primitive and an explicitly wrapped primitive are both valid and have
distinct type identities. Apply the literal round-trip rule to typed text.
Review recursive descriptor syntax and accessor installation on wrapped
declarations before migrating those contracts.
