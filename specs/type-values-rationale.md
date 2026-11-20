# Type values: rationale and worked examples

The [type-value spec](type-values.md) defines the rules. These examples
explain how one pattern can describe a concrete value space, an abstract
view, or a projection across a boundary.

## Type constructors and normalization

A type is defined by a pattern. The `struct` and `pattern` macros construct
`Struct(...)` and `Pattern(...)` descriptors. The macros produce normalized descriptors. The constructors preserve
the supplied structure so that canonical text can reproduce a descriptor
exactly, even if it contains repeated or reordered alternatives. A
concrete boundary is part of the type's identity.

```pattern
todo test "struct and pattern macros build Struct and Pattern descriptors"
  type Foo pattern Int | String
  type Bar struct Int | String
  type Baz pattern ExactRational .where isNonZero
  type Boo struct ExactRational .where isNonZero

  assert Foo === (pattern String | Int)
  assert Bar === (struct String | Int)
  expect Baz is Pattern(ExactRational .where isNonZero)
  expect Boo is Struct(ExactRational .where isNonZero)
end
```

Refinement descriptions use `T .where predicate` inside the descriptor.
Wrapping a pattern in `struct` / `Struct` creates a new value space, with
values that are disjoint from but designated by values matching the wrapped
pattern.

Nested `pattern` forms collapse. A lone type reference resolves to the
referenced type, so applying `pattern` to it again returns that same type.

```pattern
todo test "Nested pattern collapses; nested struct does not"
  type Scalar pattern Int | String
  assert (struct Scalar) === (struct Int | String)
  alias = pattern Int
  assert (pattern alias) === Int

  (base :: Type) = UInt64
  (wrapped :: Type) = struct UInt64
  (twice :: Type) = struct wrapped
  assert wrapped === Struct(UInt64)
  assert twice === Struct(Struct(UInt64))
  assert base !== wrapped
  assert wrapped !== twice
end
```

Use `==` and `!=` for numeric equality and inequality. Use `===` and `!==`
for exact equality and inequality. Exact comparison requires overlapping
static domains and compares the value, including its concrete type.

## Grammar for Patterns

Patterns can be:

- single symbol: `:Singleton`
- single-type: `Int`
- expression trees: `Rect(Int, Int)`
- alternatives: `Int | Float`
- refinements: `ExactRational .where isNonZero`

Any of these patterns can be wrapped in `struct`. Packs and repetitions
belong to the fields of a constructed shape.

```pattern
todo test "Each pattern form constructs a descriptor"
  assert (pattern :Singleton) === Pattern(:Singleton)
  assert (pattern Int) === Int
  assert (pattern Rect(Int, Int)) === Pattern(Rect(Int, Int))
  assert (pattern Int | Float) === (pattern Float | Int)
  assert (pattern ExactRational .where isNonZero) === Pattern(ExactRational .where isNonZero)
  assert (struct :Singleton) === Struct(:Singleton)
  assert (struct Rect(Int, Int)) === Struct(Rect(Int, Int))
end
```

## Concrete context for symbols and constructor expressions

A symbol tag or constructor expression describes a value that takes its
concrete type from an expected grammar or an explicit ascription.

```pattern
test "A bare symbol needs a concrete type"
  todo expect
    x = :None
    x
  fails "E_PATTERN_MISMATCH"
end
```

```pattern
todo test "A struct singleton interprets a symbol"
  t = struct :None
  x = :None :: t
  expect x is :None :: t
end
```

## Facets and concrete field types

So what if a pattern is an expression tree:

```pattern
todo test "An expression-tree pattern is a facet descriptor"
  assert (pattern Rect(Float, Float)) === Pattern(Rect(Float, Float))
end
```

This is a *facet*. It is an abstract type that can match many different
concrete types: namely `struct Rect(Float, Float)` but also any concrete
refinements such as `struct Rect(Float, Float) .where isSquare`.

```pattern
todo test "A facet admits a concrete refinement of the same shape"
  type Rectangular pattern Rect(Float, Float)
  type Square struct Rect(Float, Float) .where isSquare
  (r :: Rectangular) = Rect(2, 2) :: Square
  expect r is Rect(2, 2) :: Square
end
```

An open facet can admit extra labels. The
[spread proposal](https://github.com/johnwarden/pattern-language/pull/85)
shows how a residual capture collects those fields.

Example: nested union pattern

```pattern
todo test "A nested union facet admits a concrete field combination"
  type Num pattern Int | Float
  type Rectangular pattern Rect(Num, Num)
  type IntRectangle struct Rect(Int, Int)
  (x :: Rectangular) = Rect(2, 2) :: IntRectangle
  expect x is Rect(2, 2) :: IntRectangle
end
```

The four combinations of concrete field types can also be written as an
explicit union of `Rect(Int, Int)`, `Rect(Int, Float)`, `Rect(Float, Int)`
and `Rect(Float, Float)`. Use matching to show that equivalence. Descriptor
identity uses structural normalization and identity rules. There is no new
normalization rule that distributes a union across fields.

A constructor pattern and a reference to a concrete type have different
roles in a concrete description:

```pattern
todo test "Constructor patterns build structs; wrapping preserves identity"
  type Num pattern Int | Float
  type Rectangle struct Rect(Num, Num)
  type IntRectangle struct Rect(Int, Int)
  type WrappedIntRectangle struct IntRectangle

  (r :: Rectangle) = Rect(2 :: Int, 2 :: Int)
  (i :: IntRectangle) = Rect(2 :: Int, 2 :: Int)
  (w :: WrappedIntRectangle) = i
  assert w === (i :: WrappedIntRectangle)
end
```

The first two declarations define structs from field patterns. The source
`Rect(2 :: Int, 2 :: Int)` can construct either struct in the corresponding
expected type. Once constructed, `i` already has a concrete identity.
A structural facet such as `pattern Rect(Num, Num)` can admit it as is.
Assigning `i` to `Rectangle` would have to reinterpret the struct as a
different concrete type. Assigning it to `WrappedIntRectangle` preserves
`i` inside the new wrapper because that descriptor explicitly names
`struct Rect(Int, Int)` as its inner type.

A concrete union whose alternatives explicitly reference closed concrete
types can likewise preserve the chosen member inside the wrapper. This is
different from a struct with abstract fields. The concrete identities are
different and direct comparison between instances is an error.

Note the difference here:

```pattern
todo test "Wrapped Num fields retain their boundary during facet matching"
  type Num pattern Int | Float
  type NumRectangle struct Rect(struct Num, struct Num)
  type IntRectangle struct Rect(Int, Int)
  type Rectangular pattern Rect(Num, Num)

  (x :: NumRectangle) = Rect(1 :: Int, 1 :: Int)
  (y :: IntRectangle) = Rect(1 :: Int, 1 :: Int)

  expect x === y fails "E_INCOMPARABLE_TYPES"

  expect
    (z :: Rectangular) = x
    z
  fails "E_PATTERN_MISMATCH"

  (z :: Rectangular) = y
  expect z is Rect(1, 1) :: IntRectangle
end
```

`Rectangular` requires the fields themselves to be `Int` or `Float`.
Each field of `x` is a `struct Num` wrapper, with its number one
boundary deeper.

A tag facet can recognize the absence case of a typed option:

```pattern
todo test "An abstract tag facet admits typed absence only"
  type None pattern :None

  (v :: None) = :None :: Int?
  expect v is :None :: Int?

  expect
    (v :: None) = 5 :: Int
    v
  fails "E_PATTERN_MISMATCH"
end
```

The ordinary symbol classes are abstract primitive types. The prelude
combines them in `Symbol`. Wrapping one class in a struct supplies a
concrete space for designation.

```pattern
test "Ordinary symbol classes need a concrete host type for designation"
  todo expect
    y = :Foo :: UpperCamelSymbol
    y
  fails "E_PATTERN_MISMATCH"
end
```

```pattern
todo test "A struct over UpperCamelSymbol supplies the concrete host"
  type TypeName struct UpperCamelSymbol
  x = :MyType :: TypeName
  expect x is :MyType :: TypeName
  (z :: UpperCamelSymbol) = x
  expect z is :MyType :: TypeName
end
```

Values cannot have `Symbol` types (because they are abstract), but
*variables* can.

A union can combine a concrete type and a tag facet. In the example,
`AbstractOption(Int)` accepts an `Int` directly or the absence case of
any concrete option type:

```pattern
todo test "An abstract option admits Int or a typed :None"
  MaybeInt = pattern :None | Int
  assert MaybeInt === (pattern Int | :None)

  type AbstractOption(T) pattern :None | T

  expect
    (w :: AbstractOption(Int)) = :None
    w
  fails "E_PATTERN_MISMATCH"

  (w :: AbstractOption(Int)) = :None :: Int?
  assert w === (:None :: Int?)

  (x :: AbstractOption(Int)) = 5 :: Int
  assert x === (5 :: Int)

  expect
    (y :: AbstractOption(Int)) = 5 :: Int?
    y
  fails "E_PATTERN_MISMATCH"

  assert x !== (5 :: Int?)
end
```

`AbstractOption(Int)` accepts `5 :: Int` as a direct member and
`:None :: Int?` through the tag facet. The present option
`5 :: Int?` stores its `Int` inside the option, so neither branch of
`AbstractOption(Int)` accepts the whole value.

## Examples: single-symbol patterns

`pattern :Red` matches values whose outer alternative is `:Red`.
A match preserves the value's concrete type. `struct :Red` defines a
concrete type with a single value.

### Abstract symbol patterns

```pattern
todo test "An abstract symbol pattern admits a typed tag and preserves identity"
  t = pattern :None
  expect
    (v :: t) = :None
    v
  fails "E_PATTERN_MISMATCH"
  (v :: t) = :None :: Int?
  assert v === (:None :: Int?)
end
```

### Concrete singleton

```pattern
todo test "A struct singleton is a distinct concrete space"
  t = struct :None
  (v :: t) = :None
  expect v !== (:None :: Int?) fails "E_INCOMPARABLE_TYPES"
end
```

### Enums: unions of single-symbol patterns

```pattern
todo test "An abstract Color union preserves concrete enum members"
  type PrimaryColor struct :Red | :Green | :Blue
  type Transparent struct :Transparent
  type Color pattern PrimaryColor | Transparent

  (c :: PrimaryColor) = :Red
  (x :: Color) = c
  expect x is :Red :: PrimaryColor

  (y :: Color) = :Transparent :: Transparent
  expect y is :Transparent :: Transparent

  def describe(c :: PrimaryColor) $"The color $c"
  def describe(t :: Transparent) "Transparent"
  expect describe(c) is "The color Red"
  expect describe(:Transparent :: Transparent) is "Transparent"
end
```

The two `describe` overloads are pairwise disjoint (`PrimaryColor` vs
`Transparent`), so both may coexist. Overlap would be
`E_AMBIGUOUS_CALL`.

### Wrapped enum

```pattern
todo test "Wrapping an enum adds a concrete boundary"
  type PrimaryColor struct :Red | :Green | :Blue
  type Status struct PrimaryColor
  assert Status === Struct(PrimaryColor)

  (s :: Status) = :Red
  assert s === ((:Red :: PrimaryColor) :: Status)

  (c :: PrimaryColor) = :Red
  expect
    (underlying :: PrimaryColor) = s
    underlying
  fails "E_PATTERN_MISMATCH"

  expect s === c fails "E_INCOMPARABLE_TYPES"
  assert s === (c :: Status)
end
```

An abstract symbol pattern can admit a value from a different concrete enum:

```pattern
todo test "Abstract :Red admits TrafficLight red but not Status"
  type PrimaryColor struct :Red | :Green | :Blue
  type Status struct PrimaryColor
  type TrafficLight struct :Red | :Amber | :Green
  type RedPattern pattern :Red
  redPattern = pattern :Red
  assert RedPattern === redPattern

  def takesRed(x :: RedPattern) "red pattern"
  def takesPrimary(x :: PrimaryColor) "primary color"

  light = :Red :: TrafficLight
  (s :: Status) = :Red
  expect takesRed(light) is "red pattern"
  expect takesPrimary(light) fails "E_NO_METHOD"
  expect takesPrimary(s) fails "E_NO_METHOD"
  expect takesRed(s) fails "E_NO_METHOD"

  result = match s
    (c :: PrimaryColor) -> takesRed(c)
  end
  expect result is "red pattern"

  type Transparent struct :Transparent
  type Color pattern PrimaryColor | Transparent
  expect
    (u :: Color) = s
    u
  fails "E_PATTERN_MISMATCH"
end
```

`takesPrimary(s)` requires a `PrimaryColor` value. The abstract symbol
pattern also respects the concrete wrapper boundary. Use `match` to get at
the symbol inside `Status`.

## Single-type patterns

### Abstract single-type pattern: alias

```pattern
todo test "pattern String aliases the primitive"
  t = pattern String
  expect t is String :: PrimitiveType
  x = "hi" :: t
  expect x is "hi" :: String
end
```

### Concrete single-type pattern: "newtypes"

```pattern
todo test "struct Int is a newtype wrapper"
  id = struct Int
  expect id is Struct(Int)

  (x :: id) = 5
  expect x is 5 :: id

  expect
    (y :: Int) = 5 :: id
    y
  fails "E_PATTERN_MISMATCH"
end
```

## Unions

### Unwrapped: abstract unions

```pattern
todo test "Abstract unions preserve member concrete identities"
  t = pattern String | :None
  assert t === (pattern :None | String)

  u = pattern String | :None
  assert t === u

  (a :: t) = :None :: String?
  (b :: t) = "hello"

  expect a is :None :: String?
  expect b is "hello" :: String
  assert a !== b
end
```

For an abstract union, several accepting alternatives that yield the same
exact typed value count as one interpretation. For example,
`pattern Any | String` admits `"hi" :: String` once. Ambiguity remains when
alternatives yield different typed results. Macro normalization sorts
alternatives canonically and removes repetitions of exactly equal
alternatives (dedupe by type-value equality). Direct constructors preserve
supplied order and duplicates.

### Wrapped: concrete unions

```pattern
todo test "Concrete option unions are distinct value spaces"
  type Option(T) struct T | :None

  assert Option(Int) === (struct :None | Int)
  assert Option(Int) !== Option(String)

  (a :: Option(Int)) = :None
  expect a is :None :: Option(Int)

  (b :: Option(String)) = :None
  expect b is :None :: Option(String)

  expect a === b fails "E_INCOMPARABLE_TYPES"
end
```

Inside a concrete descriptor, explicit alternative occurrences remain
separate choices. Designating `3 :: Int` into the direct-constructor
`Struct(Int | Int)` yields two interpretations, even though the two
alternatives have the same pattern. Its normalized macro counterpart
`struct Int | Int` has one.

## Predicate

The [Predicate enum](refinement-predicates.md) gives refinements stable
identities that can be written in type expressions and typed text.

### Pattern: refinements

```pattern
todo test "An abstract refinement preserves Int operations"
  t = pattern Int .where isNonZero
  assert t === Pattern(Int .where isNonZero)

  (x :: t) = 5
  expect x * 2 is 10 :: Int

  expect
    (y :: t) = 0
    y
  fails "E_PATTERN_MISMATCH"
end
```

A refinement restricts the admitted values while preserving their concrete
identity. Literal designation and explicit checks establish predicate
evidence. Bindings and dispatch on bound arguments use the evidence already
available; dispatch does not run predicates.

### Concrete: carveouts

```pattern
todo test "A concrete carveout has its own operations"
  t = struct ExactRational .where isPositive
  expect t is Struct(ExactRational .where isPositive)

  (x :: t) = 5
  expect x * 2 fails "E_NO_METHOD"

  expect
    (y :: t) = 0
    y
  fails "E_PATTERN_MISMATCH"
end
```

A concrete carveout adds its own boundary. Use `T .where p` in either
pattern form.

## Expression trees

### Concrete expression trees

```pattern
todo test "A concrete Rect supports an area match"
  t = struct Rect(Int, Int)
  expect t is Struct(Rect(Int, Int))

  (r :: t) = Rect(2, 3)

  def area(rect :: t)
    match rect
      Rect(w, h) -> w * h
    end
  end
  expect area(r) is 6 :: Int
end
```

Opening a concrete struct boundary is explicit. For an ordinary binding
or function parameter, bind the entire value and access its fields or
open it with `match` inside the body.

### Abstract expression trees: facets

An open pattern can match values of several concrete struct types. An
assignment to a facet requires an unambiguous concrete value. The facet
binding preserves its value and concrete type. If the concrete type cannot
be determined statically, the runtime binding carries a reference to it.

The [spread proposal](https://github.com/johnwarden/pattern-language/pull/85)
includes facets that admit rectangles with different sets of labels.

### Wrapped abstract expression trees: variadic structs

```pattern
todo test "A Picture holds mixed concrete shapes"
  type Circle struct Circle(radius :: UInt64)
  type Rectangle struct Rect(w :: UInt64, h :: UInt64)
  type Figure struct {x :: UInt64, y :: UInt64, shape: Circle | Rectangle}
  type Picture struct Picture((figures :: Figure*)...)

  p = Picture(
      {5, 10, shape: Rect(3, 5) :: Rectangle},
      {5, 5, shape: Circle(2) :: Circle}
  ) :: Picture
  assert p .matches Picture
end
```

### Wrapped partial matches: ad-hoc structs

Wrapping a pattern with a catch-all field spread defines a concrete type
whose values may have different sets of additional labels. Its values are
disjoint from values of other concrete types that match the same facet.
A residual `ArgPack(T)` contains only positional and labeled arguments
that the preceding patterns left unmatched.

### Refinements over structs and facets

A facet can guarantee the fields a predicate needs. The prelude's
`isSquare` case can test a value that provides the rectangular fields.

```pattern
todo test "isSquare is a named Predicate on a Rectangular facet"
  type Rectangular pattern Rect(w :: Float, h :: Float)
  type Rectangle struct Rect(w :: Float, h :: Float)
  type Square pattern Rectangular .where isSquare

  r = Rect(10, 10) :: Rectangle
  assert not((Rect(10, 11) :: Rectangle) .matches Square)
  same = if r .matches Square
    (s :: Square) = r
    s === r
  else
    False
  end
  assert same
end
```

A true explicit `.matches` check supplies evidence. The refined binding
retains the same concrete `Rectangle` value.

A refinement over a numeric type behaves the same way. `NonZeroNumber`
is the static type of `x`. The bound value still has concrete type `Int`.

```pattern
todo test "A Number refinement keeps the Int concrete member"
  type NonZeroNumber pattern Number .where isNonZero
  (x :: NonZeroNumber) = 2 :: Int
  expect x is 2 :: Int
end
```

A concrete carveout has its own concrete identity.

```pattern
todo test "A concrete Square carveout wraps the facet refinement"
  type Rectangular pattern Rect(w :: Float, h :: Float)
  type ConcreteSquare struct Rectangular .where isSquare
  expect ConcreteSquare is Struct(Rectangular .where isSquare)
end
```

Predicate-only types, head-agnostic expressions and intersections of
facets are separate design questions.

A facet name in a `struct` declaration supplies its pattern. A constructor
pattern gives the new concrete type its outer constructor and fields.
A reference to a concrete type supplies a typed member.

```pattern
todo test "struct Rectangular wraps the facet; Bar does not unwrap to Foo"
  type Rectangular pattern Rect(Int, Int)
  type Rectangle struct Rectangular
  (x :: Rectangular) = Rect(2, 3) :: Rectangle
  expect x is Rect(2, 3) :: Rectangle

  type Foo pattern Int
  type Bar struct Foo

  expect
    (i :: Foo) = 5 :: Bar
    i
  fails "E_PATTERN_MISMATCH"
end
```

`Foo` refers to `Int`, and the binding requires an `Int` as the whole
value. The whole value has type `Bar`.

## Pattern matching rules

The `match` macro handles abstract and concrete unions. An abstract union
carries an already typed member. A match against a concrete union can
select its active alternative and bind its typed payload. A symbolic
alternative can select an arm without producing a raw symbol value.
An explicit match projects one concrete boundary at a time. Ordinary
bindings and function arguments respect that boundary.

```pattern
todo test "Match projects one concrete union boundary"
  t = struct Int | String
  (y :: t) = 5 :: Int
  expect y === (5 :: Int) fails "E_INCOMPARABLE_TYPES"

  result = match y
    (i :: Int) -> i
    _ -> 0 :: Int
  end
  expect result is 5 :: Int
end
```

An abstract binding stores its member with the original concrete type.

```pattern
todo test "An abstract union binding keeps the stored Int"
  t = pattern Int | String
  (y :: t) = 5 :: Int
  assert y === (5 :: Int)
end
```

A constructor pattern tests the concrete types held in abstract fields.
A `Rectangle` whose two `Num` fields hold Int values matches
`pattern Rect(Int, Int)`. The `Rectangle` keeps its concrete type. A
rectangle with a Float in the second field reaches the other arm.

```pattern
todo test "A rectangle matches the concrete members held in its fields"
  type Num pattern Int | Float
  type Rectangle struct Rect(Num, Num)

  ints = Rect(5 :: Int, 5 :: Int) :: Rectangle
  mixed = Rect(5 :: Int, 5 :: Float) :: Rectangle

  def classify(r :: Rectangle)
    match r
      Rect(Int, Int) -> "Int, Int"
      _ -> "Something else"
    end
  end

  expect classify(ints) is "Int, Int"
  expect classify(mixed) is "Something else"
end
```

```pattern
test "A match selects absence without binding a raw symbol"
  absent = :None :: Int?
  result = match absent
    :None -> "absent"
    (value :: Int) -> "present"
  end
  expect result is "absent"
end
```

An enum arm selects a tag. A whole-value binding can retain the typed
enum, while selecting a tag alone discards the tag payload.

```pattern
todo test "An enum match selects a tag without a raw symbol value"
  type TrafficLight struct :Red | :Amber | :Green
  x = :Green :: TrafficLight

  result = match x
    :Red -> "Red"
    :Amber -> "Amber"
    :Green -> "Green"
  end
  expect result is "Green"
end
```

## Projection patterns and overloaded matching

`.as` is lower implementation priority than the core type model. It
makes the match-to-overload rewrite expressible with the same patterns.

`P .as T` requires concrete type `T` and tests `P` at the boundary of
its active alternative. Symbol and constructor patterns see the tag and
fields declared at that boundary. A typed member pattern can bind the
immediate stored value. Another `.as` can open that member’s boundary.
On `Int??`, `:None .as Int??` selects outer absence, and
`(:None .as Int?) .as Int??` selects stored inner absence.

    type SomeInt pattern (inner :: Int) .as Int?

    (i :: SomeInt) = 5 :: Int?
    i.inner

The binding retains the `Int?` value. Its `inner` accessor yields the
stored `5 :: Int`.

For `x` of concrete wrapper type `T`, the following match has the same
behavior as a call to one local overloaded function when `P1` and `P2`
are pairwise disjoint at that boundary:

    match x
      P1 -> V1
      P2 -> V2
      _ -> V3
    end

    def f(P1 .as T) V1
    def f(P2 .as T) V2
    def f(_ :: Remaining) V3
    f(x)

`Remaining` represents the values of `T` outside `P1` and `P2`. A
match gets this domain from arm order. An overloaded function would need
a disjoint parameter pattern for that domain. Public notation for
`Remaining` is open. The [Reading example](type-values.md#overload-domains-and-projection-dispatch)
uses two disjoint patterns and needs no subtraction.

A concrete carveout can be used as a field type.

```pattern
todo test "A carveout can be a struct field type"
  type PositiveInt pattern ExactRational .where isPositive
  type Id struct PositiveInt
  type User struct {name: String, id: Id}
  u = {name: "John", id: 5} :: User
  expect u.id is 5 :: Id
end
```

Typed text preserves the `Id` boundary when the expected grammar
cannot infer it. Within the defining scope, local text can use `Id`
if that name still resolves to the exact descriptor.

## Type expressions inside typed fields

A type-producing form reads its pattern in a context that supplies the
interpretation. In `pattern Rect(Float, Float)`, the pattern describes
a facet. In a concrete value expression, `Rect(2, 3)` designates a
rectangle when the expected type supplies its shape. The same structural
notation can serve either role because the surrounding expression
supplies the context.

```pattern
todo test "Nested union patterns are allowed inside struct fields"
  type Foo struct Foo(String | Float, String | Float)
  expect Foo is Struct(Foo(String | Float, String | Float))
end
```

The only issue for a future shorthand is expression-tree patterns. If I
just say:

    t = Rect(Float, Float)

this looks like a value, not a type. A single symbol is similarly
ambiguous:

    :Foo

So those remain a future goal. For now the required spellings are
current syntax and are tested:

```pattern
todo test "Current spellings require pattern or Pattern for facets and tags"
  assert (pattern Rect(Float, Float)) === Pattern(Rect(Float, Float))
  expect Pattern(Rect(Float, Float)) is Pattern(Rect(Float, Float))
  assert (pattern :Foo) === Pattern(:Foo)
end
```
