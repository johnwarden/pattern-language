# Type values and wrapping

Draft for review. On approval, this supersedes [Type values without a reserved
Type](../approved/type-values.md).

## Plain patterns and `Wrap(P)`

[VALUE-SPACES.md’s interpretation roles](../../VALUE-SPACES.md#three-interpretation-roles)
and [D06](../../design/LANGUAGE-DECISIONS.md#d06-concrete-refinement-and-abstract-interpretations-have-different-effects--confirmed-direction)
use `concrete`, `refinement` and `abstract` as type-producing qualifiers.
This proposal replaces those qualifiers with plain patterns and an explicit
`Wrap(P)` boundary. A closed constructor pattern establishes a struct space
by itself. A union or facet describes the concrete types it admits, and a
predicate restricts the values admitted by its base. `Wrap(P)` can wrap any
of these patterns, including a singleton, a type reference or a field type.

| Pattern | Plain type | Wrapped type |
| --- | --- | --- |
| `:None` | Singleton containing the symbol | Distinct singleton designated by the symbol |
| `Int` | Alias of the existing type | Newtype designated by Int values |
| `Rect(Int, Int)` | Closed struct | Distinct type designated by that struct |
| `Int \| :None` | Union preserving the member types | Concrete union |
| `Int .where isPositive` | Refinement preserving the base type | Carveout |
| `Rect(Int, Int, **)` | Open structural facet | Concrete type designated by structs that satisfy the facet |

For example, the plain union `Some(Int) | :None` contains the struct type
`Some(Int)` and the singleton symbol `:None`.

The proposed runtime model also supersedes [the raw-expression
contract](../implemented/raw-expression-values.md), D03 and C04. A bare
constructor shape can serve as source for designation into a concrete struct,
but it cannot evaluate to a raw expression tree when no concrete type is
resolved. A closed type description such as `Rect(Int, Int)` describes the
struct directly. The parser’s `Expression` migration in D03 is a separate
source representation decision.

The [approved open-pattern migration](../approved/retire-legacy-type-definition-syntax.md#open-patterns-migrate-to-abstract)
sent open declarations to `abstract` and rejected open `concrete` descriptions.
Under this draft, `type Rectangular Rect(Int, Int, **)` declares the facet,
and `type WrappedRectangular Wrap(Rectangular)` declares a concrete wrapper
over it. This rule is about open shape constraints. The interpretation of
[typed repetitions](../approved/anonymous-repeated-patterns.md) is a separate
decision from choosing whether to wrap a pattern.

## Constructing and storing type values

[The approved type-values record](../approved/type-values.md) retires
`Type(P)` in favor of `ConcreteType(P)`, `AbstractType(P)` and
`RefinementType(T, predicate)`. This draft replaces the three kinds with
the literal `Type(P)`. `Type` in a type-valued parameter such as
`T :: Type` accepts both primitive atoms and descriptor literals. The
[prelude kind schemas](prelude-type-kind-patterns.md) describe the earlier
model.

The `type P` macro returns the normal form of the described type. This
reverses the [retirement of `type P` in expression
position](../approved/retire-legacy-type-definition-syntax.md). Named
declarations use `type Name P`; the old `def Name type P` spelling remains
retired. A bare primitive normalizes to the primitive itself. A direct
`Type(P)` literal preserves the descriptor's structure, including alternative
order, and can describe a primitive.

```pattern
expect (type Int) is Int :: PrimitiveType
expect Type(Int) is Type(Int) :: Type
expect (type :None) is Type(:None) :: Type
expect (type Rect(Int, Int)) is Type(Rect(Int, Int)) :: Type
expect (type Wrap(Int)) is Type(Wrap(Int)) :: Type

assert Type(Int | Float) != Type(Float | Int)
expect (type Int | Float) is Type(Int | Float) :: Type
expect (type Float | Int) is Type(Int | Float) :: Type
```

[D05](../../design/LANGUAGE-DECISIONS.md#d05-structural-descriptor-identity-remains-the-rule--confirmedretained)
and [TYPE-VALUES.md](../../TYPE-VALUES.md#identity-is-structural) describe
identity in terms of normalized structural descriptors. That identifies
the **type described**. Equality of **literal descriptor values** compares
the stored structure, even when their descriptions have the same normal form.
The D20 example of `type Int` already returns the primitive value. This draft
specifies `PrimitiveType` as its type, as in the approved type-values record;
D20 uses `ReservedSymbol`.

### Literal values round-trip

[The existing typed-text rule](../../VALUE-SPACES.md#text-and-portability)
expresses round trips for supported types. The guarantee applies to every
literal by definition. Printing its value as literal text and reading it
back under the appropriate type yields the same exact value. For a
`Type(P)` literal, that includes the original alternative order.

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
of a union. The extraction syntax and representation remain open.

## Wrapping and unwrapping

The [approved type-values record’s primitive rule](../approved/type-values.md#a-lone-primitive-is-not-wrapped)
rejects wrapping a lone primitive. Here `Wrap(Int)` and repeated wrappers
are valid. Each added boundary changes the concrete type.

`Wrap(P)` creates a concrete type disjoint from its base. An input that
designates a value under `P` can designate a value of `Wrap(P)` when that
wrapped type is expected. The resulting value belongs to `Wrap(P)`. A wrapped
value cannot designate a value in its base type. `unwrap` removes one
boundary and yields the concrete base value, including the selected union
member.

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

Designation into a wrapped refinement requires evidence for its predicate.

## Open facets retain the concrete value

[Abstract storage](../../VALUE-SPACES.md#binding-views-and-abstract-storage)
already retains the actual concrete type of an abstract slot where it is
needed at runtime. The new case is `Wrap(Facet)`: the wrapper is one
concrete type, and its payload can be any of the concrete structs admitted
by the facet. Binding to either type requires the right-hand side to resolve
to one unambiguous concrete value. The facet supplies the static type of the
unwrapped result; the result retains the concrete type of the stored payload.

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

[C04](../../design/LANGUAGE-DECISIONS.md#c04--raw-expressions-and-explicit-concrete-interpretation)
requires explicit projection to destructure a typed struct. In this draft a
plain constructor pattern destructures a closed struct directly in a binding,
parameter or match arm. With `Wrap(P)`, a whole-value typed pattern binds the
wrapper. To match or destructure its payload, apply `unwrap` first. This
replaces the match-based extraction shown for wrapper-like types in
[C11](../../design/LANGUAGE-DECISIONS.md#c11--explicit-projection-crosses-one-boundary-only);
each `unwrap` still crosses exactly one boundary.

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

The [existing direct-arm precedence](../../VALUE-SPACES.md#constructiondesignation-and-projection--settled)
selects a designation path within a single expected type. Across overloads,
both direct membership and designation make a candidate applicable. Thus
`f(a)` is ambiguous and `f(b)` selects the wrapped overload. An annotation
can make the chosen value explicit. [D10’s evidence
rule](../../design/LANGUAGE-DECISIONS.md#d10-where-constraints-need-evidence-refinement-qualified-functions-are-allowed--retainedclarified)
continues to govern predicate requirements: overload resolution cannot
speculatively evaluate predicates to manufacture evidence. The overload
ambiguity here is distinct from [ambiguous designation within an expected
type](../approved/ambiguous-values.md).

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

[Binding views and abstract storage](../../VALUE-SPACES.md#binding-views-and-abstract-storage)
already identify a shared abstract comparison domain. The draft pins down
the equality rule for that domain. Two variables of the same static type can be compared,
including when that type is abstract. Equality requires the same exact value. An abstract annotation preserves the concrete member
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

## Contract migration

| Existing contract | Replacement case |
| --- | --- |
| [C04 and raw-expression tests](../../tests/specification/raw-expressions.test) | Construct a struct in concrete context, destructure it directly, and reject a shape that would otherwise evaluate to a raw tree. |
| [C05–C06 and descriptor contracts](../../tests/specification/type-values.test) | Use plain struct patterns, literal descriptors and explicit normalization with `type P`. Test distinct descriptor orders before normalization and equal results after it. Keep the concrete-union comparison cases using explicit wrappers. |
| [C11–C12](../../tests/specification/interpretations.test) | Use `Wrap(P \| Q)` for concrete unions and `Wrap(P .where predicate)` for carveouts. Exercise one boundary per `unwrap` and preserve the immediate-member designation cases. |
| [C13 and C15](../../tests/specification/interpretations.test) | Use plain unions and facets. Add the wrapped-facet case that recovers the original concrete payload. |
| [Optional convention](../../design/POSTFIX.md#nested-concrete-unions) | Express the concrete optional recipe as `type T? Wrap(T \| :None)` and preserve nested absence semantics. |
| [C23 and typed text](../../VALUE-SPACES.md#text-and-portability) | Round-trip non-normal `Type(P)` values without reordering alternatives. |

The changes above replace the affected type forms and projection examples in
[GRAMMAR.md](../../GRAMMAR.md#type-producing-forms-and-declarations) and
[the roadmap’s immediate conformance targets](../../ROADMAP.md#immediate-priority-implement-the-executable-specification)
when the replacement contracts are adopted. Recursive descriptor spelling
and accessor installation on wrapped declarations need decisions before
migrating those specific contracts.
