# Refined type model

A type is described by a pattern. The `pattern` macro produces a normalized
type that admits matching values and preserves their concrete identities.
The `struct` macro constructs a concrete type from a pattern. The resulting
values occupy a separate value space and can be designated by values or
expressions that match the pattern.

```pattern
type Foo pattern Int | String
type Bar struct Int | String
def isPositive(n :: Int) n > (0 :: Int)
type Baz pattern Int .where isPositive
type Boo struct Int .where isPositive

expect Foo is Pattern(Int | String)
expect Bar is Struct(Int | String)
expect Baz is Pattern(Int .where isPositive)
expect Boo is Struct(Int .where isPositive)
```

`Pattern(...)` and `Struct(...)` spell descriptor values. A refinement uses
`T .where p` inside either descriptor. The macros use the implemented Type
[normalization and identity rules](../../TYPE-VALUES-BOOTSTRAP.md#normalization-and-identity).
Literal descriptors round-trip as values. Reading a printed descriptor under its
type recovers the same value, using the existing
[type-directed text contract](../../TYPE-VALUES-BOOTSTRAP.md#global-and-local-typed-text).

A lone type reference resolves to the referenced type. Nested `pattern`
forms collapse. Each explicit `struct` boundary creates a distinct type and is
retained in the descriptor.

```pattern
assert (pattern pattern Int) === Int

type Foo pattern Int | String
t = struct Foo
expect t is Struct(Int | String)

expect (struct Int) is Struct(Int)
expect (struct (struct Int)) is Struct(Struct(Int))
(primitive :: Type) = Int
(wrapper :: Type) = Struct(Int)
assert primitive !== wrapper
assert Struct(Int) !== Struct(Struct(Int))
```

Use `==` and `!=` for numeric equality and inequality. Use `===` and `!==`
for exact equality and inequality. Exact comparison requires overlapping
static domains and compares the value, including its concrete type.

## Grammar for Patterns

Patterns can be:
  
  - single symbol: :Singleton
  - single-type: Int
  - expression trees: Rect(Int, Int)
  - alternatives: Int | Float
  - predicates: Int .where (n -> n > (0 :: Int))


Any of these patterns can be wrapped in `struct`.

## Expected types for construction

A constructor expression or symbolic alternative requires an unambiguous concrete
type to designate a value. A quotation can still produce typed syntax for Code
or another grammar.

  expect x = :None fails "...need a type for expression `None`"

  t = struct :None
  x = :None :: t
  assert x is :None :: t

## Facets

So what if a pattern is an expression tree:

  pattern Rect(Float, Float)

This is a *facet*. It is an abstract type, that can match many different concrete types: namely struct Rect(Float, Float) but also any concrete refinements such as `struct Rect(Float, Float) .where isSquare`

  type Rectangular pattern Rect(Float, Float)
  type Square struct Rect(Float, Float) .where isSquare
  (r :: Rectangular) = Rect(2, 2) :: Square
  expect r is Rect(2, 2) :: Square

## ASIDE: new syntax for spreads.

First, let's drop `**` and use `...` for both positional and keyword argument spreads. The type indicates what arguments are accepted in the spread and how to collect them into a value.

Second, let's put the capture with it's type and place the spread operator outside:

  (ints :: String*)...     # One more strings, collected into a String*
  (args :: {...})...       # Any arguments, collected into a type matching pattern {...}

So for example this test now loos like this:

  test "An anonymous matrix pattern keeps horizontal and vertical repetition"
    type Matrix struct [
      (cells :: Float32**)...
      ...
    ]
    anonymous = struct [
      (Float32**)...
      ...
    ]
    matrix = ([
      ()
      0.5
      1, 2
    ] :: Matrix)

    assert Matrix === anonymous
    assert matrix .matches anonymous
  end

Example: 

  type ColoredRectangle struct Rect(Float, Float, color: Color)
  r = Rect(3, 5, color: :Red) :: Rectangle
  (contents :: {...})... = r...

So `r...` dropped the `Rect` head and spread the body of `r`. The type `{...}` collect the body into a struct with head `{}` and any body contents. 

The variable `contents` now has static abstract type `pattern {...}`. But the compiler can nail down the concrete type.

  expect contents is {3, 5, color: :Red} :: struct {Float, Float, color: Color}

You can also collect into a concrete type

  (contents :: Rectangle)... = r...

Note the symmetry

  (contents :: Rectangle)... = (r :: Rectangle)...

An open facet can match concrete structs with different sets of fields:

  type Person pattern Person(name: String, id: Id, (details :: {...})...)

Now Person is a pattern type that fits *one of many concrete types*.

  type Superhero struct Person(name: String, id: Id, power: String)
  (batman :: Person) = Person(name: "Batman", id: 2, power: "Gadgets and confidence") :: Superhero
  expect batman hasType Superhero
  expect batman.details is {power: "Gadgets and confidence"} :: struct {power: String}

Example: nested union pattern

  type Num pattern Int | Float
  type Rectangular pattern Rect(Num, Num)

Now Rectangular can match one of many concrete types (Rect(Int, Int), Rect(Int, Float), etc.)

  type IntRectangle struct Rect(Int, Int)
  (x :: Rectangular) = Rect(2, 2) :: IntRectangle
  expect x is Rect(2, 2) :: IntRectangle

The four combinations of concrete field types can also be written as an
explicit union of `Rect(Int, Int)`, `Rect(Int, Float)`, `Rect(Float, Int)`
and `Rect(Float, Float)`. Use matching to show that equivalence. Descriptor
identity uses the existing [structural normalization and identity
rules](../../TYPE-VALUES-BOOTSTRAP.md#normalization-and-identity). There is
no new normalization rule that distributes a union across fields.

A constructor pattern and a reference to a concrete type have different
roles in a concrete description:

    type Rectangle struct Rect(Num, Num)
    type IntRectangle struct Rect(Int, Int)
    type WrappedIntRectangle struct IntRectangle

    (r :: Rectangle) = Rect(2 :: Int, 2 :: Int)
    (i :: IntRectangle) = Rect(2 :: Int, 2 :: Int)
    (w :: WrappedIntRectangle) = i

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

  type Num pattern Int | Float
  type NumRectangle struct Rect(struct Num, struct Num)
  type IntRectangle struct Rect(Int, Int)
  type Rectangular pattern Rect(Num, Num)

  (x :: NumRectangle) = Rect(1 :: Int, 1 :: Int)
  (y :: IntRectangle) = Rect(1 :: Int, 1 :: Int)

  expect x === y fails "disjoint types"

Why does the following fail? Rectangular matches Rect(Int, Int), Rect(Int, Float), etc...e.g. any type where both width and height are concrete fixed-precisions numbers struct Num is not one of those.

  expect (z :: Rectangular) = x fails "value of type `NumRectangle` does not designate a value of type `Rectangular`"

  (z :: Rectangular) = y
  expect z = Rect(1, 1) :: IntRectangle

A symbol pattern can also describe an abstract type

  type None pattern :None
  type T? struct T | :None

  (v :: None) = :None :: Int?

  expect v is None :: Int?

  expect (v :: None) = 5 :: Int fails ...

Symbol, LowerCamelSymbol, etc. are primitive *abstract types*. They can be wrapped to define concrete types.

  expect y = :Foo :: UpperCamelSymbol fails "Missing concrete type for :Foo (UpperCamelSymbol is abstract)..."

  type TypeName struct UpperCamelSymbol
  x = :MyType :: TypeName
  expect x is MyType :: TypeName

Values cannot have Symbol types (because they are abstract), but *variables* can.

  (z :: UpperCamelSymbol) = x
  expect x is MyType :: TypeName

What if I define

  MaybeInt = pattern :None | Int

This is odd and probably not a good idea. But it is coherent:

  # Abstract type that admits Ints, or values of any type designated by :None

  type AbstractOption<T> pattern :None | T
  type T? struct :None | T

  expect (w :: AbstractOption<Int>) = :None fails Missing concrete type for :None...

  # AbstractOption<Int> admits any value that matches :None
  (w :: AbstractOption<Int>) = :None :: Int?
  assert w === :None :: Int?

  (x :: AbstractOption<Int>) = 5 :: Int
  assert x === 5 :: Int

  expect (y :: AbstractOption<Int>) = 5 :: Int? fails "value of type `Int?` does not designate a value of type `AbstractOption<Int>`"

  expect x === (5 :: Int?) fails "disjoint types"



# Examples

# Single-symbol patterns

An abstract symbol pattern such as `pattern :Red` can stand alone as a
type. It admits values from concrete types with that symbol at the
matched boundary and preserves their concrete identity. A concrete
singleton has one value in its own value space.

## Abstract symbol patterns

  t = pattern :None
  expect (v :: t) = :None fails "...no concrete type for `:None`"
  (v :: t) = :None :: Int?
  assert v === :None :: Int?

## Struct singleton

  t = struct :None
  (v :: t) = :None
  expect (v !== (:None :: Int?)) fails "disjoint types"

## enums: Unions of Single-Symbol Patterns

  type PrimaryColor struct :Red | :Green | :Blue
  type Transparent struct :Transparent

  # An abstract union over concrete enums
  type Color pattern PrimaryColor | Transparent

  (c :: PrimaryColor) = :Red
  (x :: Color) = c
  expect x is Red :: PrimaryColor

  (y :: Color) = :Transparent
  expect y is Transparent :: Transparent

  def describe(c :: PrimaryColor) $"The color $c"

  def describe(t :: Transparent) "Transparent"

## Wrapped Enum

  type Status struct PrimaryColor

  # Wrapping a concrete type in `struct` creates a nested concrete type.
  assert Status === Struct(Struct(:Red | :Green | :Blue))

  # Outer types do not inherit functions from inner types

  # Value can be designated by *expression* from inner type if unambiguous
  (s :: Status) = :Red
  expect s is (:Red :: PrimaryColor) :: Status

  # Value of outer type cannot designate value of inner type
  (c :: PrimaryColor) = :Red
  expect
    (underlying :: PrimaryColor) = s
    underlying
  fails "does not designate a value of type"

  # Can't compare wrapped value with it's designator
  expect s === c fails "Values of disjoint types `Status` and `PrimaryColor` cannot be equal"

  # Explicitly wrap designator so values have same concrete type
  assert s === c :: Status

An abstract symbol pattern can admit a value from a different concrete enum:

    type TrafficLight struct :Red | :Amber | :Green
    type RedPattern pattern :Red
    redPattern = pattern :Red
    assert RedPattern === redPattern

    def takesRed(x :: RedPattern) "red pattern"
    def takesPrimary(x :: PrimaryColor) "primary color"

    light = :Red :: TrafficLight
    expect takesRed(light) is "red pattern"
    expect takesPrimary(light) fails "no method"

    expect takesPrimary(s) fails "no definition for `takesPrimary(Status)`"

`takesPrimary(s)` requires a `PrimaryColor` value. The abstract symbol
pattern also respects the concrete wrapper boundary. 

  expect takesRed(s) fails "no definition for `takesRed(Status)`"

Use `match` to get at the symbol inside `Status`.

  match s c :: Color

  expect takesRed(c) is "red pattern"

Value of outer type cannot designate value of inner type

  expect
    (u :: Color) = s
  fails "value of type `Struct(Color)` does not designate a value of type `Color`"

# Single-type Patterns

## Abstract Single-Type Pattern: Alias.

  t = pattern String
  expect t is String :: PrimitiveType

  x = "hello" :: t
  expect x is "hello" :: String

## Concrete Single-Type Pattern: "Newtypes"

  id = struct Int
  expect id is Struct(Int)

  # Value of inner type can designate value of outer type if unambiguous
  (x :: id) = 5

  # Value of outer type cannot designate value of inner type
  expect
    (y :: Int) = 5 :: id
  fails "value of type `Struct(Int)` does not designate a value of type `Int`"

# Unions

## Unwrapped: Abstract Unions

  t = pattern String | :None
  expect t is Pattern(String | :None)

  u = pattern String | :None
  assert t === u

  (a :: t) = :None :: String?
  (b :: t) = "hello"

  expect a is None :: String?
  expect b is "hello" :: String
  assert a !== b

## Wrapped: Concrete Unions

  type Option(Int) struct Int | :None

  expect Option(Int) is Struct(Int | :None)

  assert Option(Int) !== Option(String)

  (a :: Option(Int)) = :None
  expect a is None :: Option(Int)

  (b :: Option(String)) = :None
  expect b is None :: Option(String)

  expect 
    a === b
  fails "Values of disjoint types `Option(Int)` and `Option(String)` cannot be equal"

## Refinements and carveouts

### Pattern refinements

  t = pattern Int .where isNonZero
  expect t is Pattern(Int .where isNonZero)

  (x :: t) = 5
  expect x * 2 is 10 :: Int

  expect 
    (y :: t) = 0
  fails "...fails predicate..."


### Struct carveouts

  t = struct Int .where isPositive
  expect t is Struct(Int .where isPositive)

  (x :: t) = 5

  expect x * 2 fails "* not defined for values of type `Struct(Int .where Positive)`"

  expect 
    (y :: t) = 0
  fails "...fails predicate..."


# Expression Trees

## Concrete Expression Trees

  t = struct Rect(Int, Int)
  expect t is Struct(Rect(Int, Int))

  (r :: t) = Rect(2, 3)

  Rect(w, h) = r
  expect w is 2 :: Int
  expect h is 3 :: Int

  def area(Rect(w, h)) w * h
  expect area(r) is 6 :: Int

## Abstract Expression Trees: Facets

A pattern with ... is abstract: it can match a variety of concrete struct types.

  type Rectangle struct Rect(width :: Number, height :: Number)
  type ColoredRectangle struct Rect(width :: Number, height :: Number, color: Color)
  type AugmentedRectangle pattern Rect(width :: Number, height :: Number, properties... :: {...})

  (x :: AugmentedRectangle) = Rect(3, 5, color: :Red) :: ColoredRectangle
  expect x is Rect(3, 5, color: :Red) :: ColoredRectangle
  expect x.properties is {color: :Red} :: struct {color: Color}

  (y :: AugmentedRectangle) = Rect(3, 5) :: Rectangle
  expect y is Rect(3, 5) :: Rectangle
  expdect y.properties is {} :: struct {}

  # Comparison across value spaces works because x and y have same abstract type
  assert x !== y

## Wrapped Abstract Expression Trees: Variadic Structs

  type Circle struct Circle(radius :: UInt)
  type Rectangle struct Rect(w :: UInt, h :: UInt)
  type Figure struct {x :: UInt, y :: UInt, shape: Circle | Rectangle}
  type Picture struct Picture(figures... :: Figure+)

  p = Picture(
      {5, 10, Rectangle(3,5)},
      {5, 5, Circle(2)}
  ) :: Picture

## Wrapped Partial Matches: Ad-hoc Structs

  type WrappedAugmentedRectangle struct Rect(width :: Number, height :: Number, properties... :: {...})

  # Can designate a concrete rectangle with any expression matching the defining pattern.
  (z :: WrappedAugmentedRectangle) = Rect(3, 5, color: :Red :: Color)

  expect z is Rect(3, 5, color: :Red :: Color) :: WrappedAugmentedRectangle

  x = Rect(3, 5, color: :Red) :: ColoredRectangle

  # But ColoredRectangle is a different concrete value space
  expect z === x fails "Values of disjoint types `WrappedAugmentedRectangle` and `ColoredRectangle` cannot be equal"

Now what is x.properties? I guess it has type.

  struct {...}

A value space over arbitrary argument packs. I guess a sort of special `Dict` type.

So you can't do

  expect x.properties is {color: :Red} :: struct {color: Color}

Instead:

  expect x.properties is {color: :Red} :: struct {...}

  expect x.keys is [:color]
  expect x.get(:color) is :Red

Maybe this needs to be thought through some more. Maybe we disallow wrapping patterns with spreads collected into types like {...} but still support spreads into lists.

## Set example:

  type Set<T> struct {elements... :: T*} .where isSorted

  expect (x :: Set<Int>) = {3, 1, 2} fails "...fails predicate isSorted(elements)"

### More on Predicates

# Function parameters are *patterns*. So a function is defined over any concrete type that matches that pattern. 

  def isSquare(Rect(w :: Number, h :: Number)) w == h

So isSquare is defined over a pattern that matches many concrete types.

  s = Rect(10, 10) :: struct Rect(Float, Float)
  assert isSquare(s)

  type Square pattern Rect(w :: Float, h :: Float) .where isSquare

Now Square is a pattern that matches a value of any concrete type that can be passed to isSquare and that satisies the isSquare predicate

  (t :: Square) = s
  expect t === s

Just like this:

  def isNonZero(n :: Number) n != 0
  type NonZeroNumber pattern Number .where isNonZero

These abstract types admit values of any concrete type that match the pattern and the predicate.

An alternative definition of nonzero

  type NonZero<T :: Numeric> pattern T .where isNonZero

  x :: NonZero<Int> = 2 :: Int
  expect x is 2 :: Int .where isNonZero
  expect 2.3 NonZero<Int> fails "...`2.3` does not satisfy predicate `fitsInt64` required by type `Int`" 

  y :: NonZeroNumber = 2 :: Int
  expect y is 2 :: Int .where isNonZero
  expect x === y

Can wrap a predicate pattern in `struct`

  type ConcreteSquare struct Rect(w :: Float, h :: Float) .where isSquare

You can define a predicate over a facet:

  def isSquare _(width: Float, height: Float, ...) -> width == height

  type Rectangular pattern Rect(width: Float, height: Float, ...)
  type SquareShaped pattern _(width: Float, height: Float, ...) .where isSquare
  type Colored pattern _(color: Color, ...)

And wrap intersections of facets in `struct`

  type ColoredSquare struct Rectangle & SquareShaped & Colored

Same as

  type ColoredSquare struct Rect(width: Float, heigth: Float, color: Color) .where isSquare


  x = Rect(2, 2, color: :Red) :: ColoredSquare
  (y :: SquareShaped) = x
  (z :: Colored) = x
  (z :: Colored) = x


A facet name in a `struct` declaration supplies its pattern. A constructor
pattern gives the new concrete type its outer constructor and fields.
A reference to a concrete type supplies a typed member.

  type Rectangular pattern Rect(Int, Int)
  type Rectangle struct Rectangular
  (x :: Rectangular) = Rect(2, 3) :: Rectangle

  type Foo pattern Int
  type Bar struct Foo

  expect
    (i :: Foo) = 5 :: Bar
    i
  fails "does not designate"

`Foo` refers to `Int`, and the binding requires an `Int` as the whole
value. The whole value has type `Bar`.

# Pattern Matching Rules

An expression tree pattern can match a value directly with a deconstructing binding

  r = Rect(2, 3) :: Rectangle
  Rect(w, h) = r

The `match` macro handles abstract and concrete unions. An abstract union
carries an already typed member. A match against a concrete union can
select its active alternative and bind its typed payload. A symbolic
alternative can select an arm without producing a raw symbol value.
An explicit match projects one concrete boundary at a time. Ordinary
bindings and function arguments still respect that boundary.

Match over concrete union:

  concreteUnion = struct Int | String
  y :: concreteUnion = 5

  expect y === 5 :: Int fails "disjoint types"

  v = match y
    when i :: Int $"$i"
    else "String"
  end

  expect v "5"

  (x :: Int) = 10

  y = match x
    (value :: ExactRational) -> value
  end
  expect y is 10 :: ExactRational

Match over abstract union

  abstractUnion = pattern Int | String

  x :: abstractUnion = 5

  v = match x
    when i :: Int $"$i"
    else "String"
  end

A constructor pattern tests the concrete types held in abstract fields.
A `Rectangle` whose two `Num` fields hold Int values matches
`pattern Rect(Int, Int)`. The `Rectangle` keeps its concrete type. A
rectangle with a Float in the second field reaches the other arm.

```pattern
test "A rectangle matches the concrete members held in its fields"
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

test "A match selects absence without binding a raw symbol"
  absent = :None :: Int?
  result = match absent
    :None -> "absent"
    (value :: Int) -> "present"
  end
  expect result is "absent"
end
```

Match over enum

  type TrafficLight struct :Red | :Amber | :Green

  x = :Green :: TrafficLight

  s = x match
    case :Red "Red"
    case :Green "Green"
    case :Blue "Blue"
  end

  expect s is "Green"

Match over abstract symbol pattern

  type RedPattern pattern :Red
  (y :: RedPattern) = :Red :: TrafficLight

  y match :Red

Note can't capture raw symbols

  expect y match (symbol :: :Red) fails "..."

  (r :: Rectangle) = IntRectangle(5, 5)
  expect r match (_ :: Symbol)(Float, Float) fails "..."



## Projection patterns and overloaded matching

`.as` is lower implementation priority than the core type model. It
makes the match-to-overload rewrite expressible with the same patterns.

`P .as T` requires concrete type `T` and tests `P` at the boundary of
its active alternative. Symbol and constructor patterns see the tag and
fields declared at that boundary. A typed member pattern can bind the
immediate stored value. Another `.as` can open that member’s boundary.
On `Int??`, `:None .as Int??` selects outer absence, and
`(:None .as Int?) .as Int??` selects stored inner absence.

```pattern
type SomeInt pattern (inner :: Int) .as Int?

(i :: SomeInt) = 5 :: Int?
expect i is 5 :: Int?
expect i.inner is 5 :: Int
```

For `x` of concrete wrapper type `T`, the following match has the same
behavior as a call to one local overloaded function when `P1` and `P2`
are disjoint at that boundary.

```pattern
match x
  when P1 V1
  when P2 V2
  default V3
end

def f(P1 .as T) V1
def f(P2 .as T) V2
def f(_ :: Remaining) V3
f(x)
```

`Remaining` denotes the values of `T` that neither arm matches. If arms
overlap, each later overload covers the part of its pattern left after
the preceding arms. This preserves first-match order and keeps the
effective overloads disjoint. The call evaluates `x` once and dispatches
on the active alternative. A match on an abstract union uses the
unprojected patterns as parameters.

A `struct` can appear inside another type expression.

  type User struct {name: String, id: struct PositiveInt}

  # Positive int can designate value of wrapped type.
  u = {name: "John", id: 5} :: User

  expect (u.id !== 5) fails "disjoint types"
  assert u.id === 5 :: struct PositiveInt

  test "Structural match of wrapped integer"
    type Id struct PositiveInt
    assert toString(u.id) is "5 :: Id"
  end


## Executable contracts

The [type model tests](../../tests/specification/type-values.test) and
[construction and quotation tests](../../tests/specification/raw-expressions.test)
capture the core rules. The [contract record](../implemented/refined-type-model.md)
links the affected suite cases and tracks the transition from bootstrap behavior.

# POssible Future Goal:

Allow a raw pattern (without pattern/Pattern) in places where type is expected:

  Option<String | Float>
  (x :: String | Float) = "foo"

Also in type definitions, make pattern optional.

  type T String | Float

In fact, the grammar of the pattern spec itself identifies it as a pattern.

  t = String | Float

In nested positions we alrady allow this:

  type Foo Foo(String | Float, String | Float)

The only issue here is expression-tree patterns. If I just say

  t = Rect(Float, Float)

This looks like a value, not a type. But I guess it would match the grammar of Pattern values and this is fine. 

But what about a single symbol.
  
  :Foo

That could be a pattern or a value, depending on context. 

So let's make this a future goal. For now you have to do

  pattern Rect(Float, Float)
  Pattern(Rect(Float, Float))
  pattern :Foo

etc.



  

