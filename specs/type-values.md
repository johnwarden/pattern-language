# Types, descriptors, and type expressions

A type is a value with a writable expression. A pattern describes the values
a type admits.

See [worked examples and rationale](type-values-rationale.md).

## Concrete spaces and abstract patterns

A constructor pattern such as `Rect(Int, Int)` describes a shape. With
`struct`, it defines a concrete type with that shape. With `pattern`, it
defines a facet, an abstract type that can match values of several concrete
types. A facet view preserves the value's concrete type.

Using an existing concrete type as the pattern in a `struct` creates a
wrapper. The wrapper has a new concrete type and stores a value of the
original type inside it.

```pattern
todo test "A facet view preserves concrete identity; a struct wrap adds a boundary"
  type Rectangular pattern Rect(Int, Int)
  type Rectangle struct Rect(w :: Int, h :: Int)
  type WrappedRectangle struct Rectangle

  r = Rect(2, 3) :: Rectangle
  (view :: Rectangular) = r
  (wrapped :: WrappedRectangle) = r
  assert view === r
  inner = match wrapped
    (rect :: Rectangle) -> rect
  end
  assert inner === r
end
```

`view` holds the original Rectangle. The wrapper holds it as a separate
payload. `Rectangular` sees the `Rect` shape on `r` directly. Use an
explicit projection to reach the rectangle inside `wrapped`.

### Facets and field types

`NumericReading` accepts a `Reading` shape with either an `Int` or a
`Float` field. Below, it matches values of two distinct concrete types
whose field declarations fix different types.

```pattern
todo test "A facet with a union field admits different concrete field types"
  type NumericReading pattern Reading(Int | Float)
  type IntReading struct Reading(value :: Int)
  type FloatReading struct Reading(value :: Float)

  ints = Reading(5) :: IntReading
  floats = Reading(5) :: FloatReading
  assert ints .matches NumericReading
  assert floats .matches NumericReading
end
```

A single concrete type can also declare its field as `Int | Float`. Each
instance stores one concrete member of that union. When a match inspects the
field, the arm `Reading(Int)` selects instances whose field holds an
`Int`.

```pattern
todo test "A match sees the concrete member stored in an abstract field"
  type Reading struct Reading(value :: (Int | Float))

  def kind(r :: Reading)
    match r
      Reading(Int) -> "int"
      Reading(Float) -> "float"
    end
  end

  expect kind(Reading(5 :: Int) :: Reading) is "int"
  expect kind(Reading(5 :: Float) :: Reading) is "float"
end
```

`pattern Reading(Int | Float)` and `pattern Reading(Int) | Reading(Float)`
admit the same readings. Their descriptors compare unequal. The first has a
union inside one constructor pattern. The second has a union of two
constructor patterns.

```pattern
todo test "A field union and a union of shapes have distinct descriptors"
  fieldUnion = pattern Reading(Int | Float)
  shapeUnion = pattern Reading(Int) | Reading(Float)
  assert fieldUnion !== shapeUnion
end
```

### Pattern forms

A type pattern can be a type reference, a literal, a symbol tag, a
constructed shape, a union, or a refinement. Packs, repetitions, and
catch-all fields occur inside constructed shapes. For example,
`type RectPattern pattern Rect(x :: Int, y :: Int, ...)` is valid. A bare
argument pack after `pattern`, as in
`type RectPattern pattern (x :: Int, y :: Int, ...)`, is a syntax error.

`pattern Int` returns the referenced `Int` type. `struct Int` wraps an
`Int`, and wrapping that type again adds another layer. With a facet such
as `Rectangular`, `struct Rectangular` uses the facet's shape and is
equivalent to `struct Rect(Int, Int)`.

A tag facet such as `pattern :None` matches a concrete value whose outer
alternative is `:None`. For example, it matches `:None :: Int?`. If that
value is stored inside another struct, the inner tag is visible after an
explicit projection. An abstract union can combine a type reference and
a tag facet. `pattern Int | :None` admits `5 :: Int` and `:None :: Int?`.
A bare `:None` still needs a concrete type. `struct :None` defines a
concrete singleton.

A refinement restricts the admitted values while preserving their concrete
identity. A concrete carveout adds its own boundary. Use `T .where p` in
either pattern. Literal designation and explicit checks establish predicate
evidence. Bindings and dispatch on bound arguments use the evidence already
available. The [Predicate enum](refinement-predicates.md) supplies the
initial refinement predicates. See the [refinement evidence proposal](https://github.com/johnwarden/pattern-language/pull/89).

```pattern
todo test "Abstract refinement and concrete carveout both use named predicates"
  type NonZeroRational pattern ExactRational .where isNonZero
  type NonZeroId struct ExactRational .where isNonZero

  (n :: NonZeroRational) = 2
  (id :: NonZeroId) = 2
  expect n is 2 :: ExactRational
  expect id is 2 :: NonZeroId
end
```

## Descriptor kinds and primitive types

`Type` is the prelude union of `Struct | Pattern | PrimitiveType`.
`Struct` and `Pattern` each have one field containing a type pattern.
`Struct` and `Pattern` are themselves struct descriptors. `Type` is a
pattern descriptor. The prelude can define this group recursively.

A primitive type is self-evaluating. This is a property of the descriptor
and is independent of whether it describes a concrete or an abstract domain.
Primitive type values have concrete kind `PrimitiveType`. The proposed
initial inventory is:

| Types | Domain |
| --- | --- |
| `ExactRational`, `String` | Concrete. |
| `PrimitiveType` | Concrete. It includes itself. |
| `Any`, `LowerCamelSymbol`, `UpperCamelSymbol`, `LowerSnakeSymbol`, `UpperSnakeSymbol`, `PunctuationSymbol` | Abstract. |

The prelude defines `type Bool struct True | False`. The values `True`
and `False` are self-evaluating. Boolean literals and computed Boolean
results share that concrete type.

```pattern
test "Boolean literals and comparison results belong to Bool"
  assert True .matches Bool
  assert False .matches Bool
  computed = 1 == 1
  expect computed is True :: Bool
  todo assert Bool .matches Struct
end
```

`Symbol` is the prelude union of the ordinary symbol classes, including
`LowerSnakeSymbol`. These classes admit typed ordinary symbols and exclude
reserved values such as `True`, `False`, and primitive type names.

```pattern
test "Ordinary symbol classes reject reserved names"
  assert not(True .matches UpperCamelSymbol)
  assert not(False .matches UpperCamelSymbol)
  assert not(String .matches UpperCamelSymbol)
  assert not(True .matches Symbol)
  assert not(String .matches Symbol)
  assert :Widget .matches UpperCamelSymbol
  assert :Widget .matches Symbol
end
```

```pattern
todo test "A lower snake symbol belongs to its ordinary symbol class"
  type SensorName struct LowerSnakeSymbol
  name = parse(SensorName)("sensor_id")
  assert name .matches LowerSnakeSymbol
  assert name .matches Symbol
end
```

The [fixed-precision numeric proposal](https://github.com/johnwarden/pattern-language/pull/86)
defines numeric formats as prelude structs over `ExactRational`, with
`Int` and `Float` as aliases and `Number` as an abstract union.
`Code` and `Body` are grammar-defined types. `ReservedSymbol` is internal
to the bootstrap. Quoting a self-evaluating type name or Boolean literal
name in executable source raises `E_QUOTED_PRIMITIVE`. The Code reader
preserves that source spelling.

Exact equality uses the ordinary rule for overlapping static domains. `Int`
and `Struct(Int)` describe different concrete value spaces. The abstract
bindings below admit both descriptors, so the comparison returns `False`:

```pattern
todo test "Int and Struct(Int) compare unequal through Type"
  (x :: Type) = Int
  (y :: Type) = Struct(Int)
  assert not(x === y)
end
```

Once fixed formats are prelude definitions, both values in this example have
descriptor kind `Struct`. Their payloads differ because `y` adds a boundary.
With `String` in place of `Int`, the two concrete kinds are `PrimitiveType`
and `Struct`, and the comparison through `Type` still returns `False`.
The wrapper and its payload are also distinct when comparing member values.

## Constructing and inspecting descriptors

`Struct` and `Pattern` have ordinary constructor forms. In
`Struct(Rect(Int))`, the field contains the constructor pattern
`Rect(Int)`. In `Pattern(Int | String)`, the field contains a union.
`Pattern(T .where p)` and `Struct(T .where p)` put a refinement in that
same field.

The field's grammar defines which patterns it accepts, including how
recursive references are scoped. Descriptor patterns reject captures and
defaults at any depth. Rules that need to inspect the parsed pattern can
use pure prelude predicates in the grammar; they do not run user code.
An ordinary match can extract the field and use it to construct another
descriptor.

```pattern
todo test "Descriptor inspection binds the typed pattern field"
  t = Struct(Rect(Int))
  copy = match t
    Struct(p) -> Struct(p)
  end
  assert copy === t
  expect t(2) fails "E_NOT_CALLABLE"
end
```

Functions can take and return descriptors. For example,
`def makeBox(T :: Type) struct Box(T)` computes a descriptor from a
type argument.

`parse(Code)("Struct(Rect(Int))")` reads program syntax.
`parse(Type)("Struct(Rect(Int))")` reads a `Struct` value. That value
matches the abstract type `Type`.

Parsing or validating a type descriptor runs no user code. It does not
call refinement predicates and does not execute arbitrary syntax. At most
it may consult pure prelude predicates that belong to the descriptor
grammar. It rejects captures and defaults at any depth. The same rules
apply to direct `Struct(...)` / `Pattern(...)` construction and to
`parse(Type)`.

```pattern
todo test "Reading a descriptor as Type produces a Struct value"
  code = parse(Code)("Struct(Rect(Int))")
  descriptor = parse(Type)("Struct(Rect(Int))")

  assert code .matches Code
  assert not(code .matches Type)
  assert descriptor .matches Struct
  assert descriptor .matches Type
  assert descriptor === Struct(Rect(Int))
end
```

```pattern
todo test "parse(Type) on text with .where p does not call p"
  calls = 0
  def p(n :: ExactRational)
    calls = calls + 1
    n != 0
  end

  expect parse(Type)("Pattern(ExactRational .where p)") fails "E_EXPECTED_PREDICATE"
  assert calls == 0
end
```

## Declarations, normalization, and identity

A `type Name struct P` or `type Name pattern P` declaration binds
a name and can register scoped accessors for captures. Standalone
`struct` and `pattern` expressions produce descriptors without
registering accessors. Positional capture names belong to the declaration.
Field labels, pack structure, and concrete boundaries are part of
descriptor identity. Defaults belong to binding patterns. Existing
duplicate declaration and accessor collision rules apply.

The `pattern` and `struct` macros resolve type references, collapse nested
abstract pattern forms, sort alternatives canonically, and remove repeated
alternatives that compare exactly equal. They preserve explicit concrete
boundaries. If quoted and unquoted alternatives denote the same type in
the current scope, report
`E_REDUNDANT_QUOTE` during macro normalization. A quote that prevents a
name from resolving to a different type, such as a call to a type-valued
factory, remains meaningful. This check is distinct from
`E_QUOTED_PRIMITIVE`.

`Struct(P)` and `Pattern(P)` preserve the pattern as supplied.
`Pattern(Int)` is a valid non-normal descriptor whose domain consists of
Int values.
`Struct(Int | Int)` preserves both alternatives, and
`Pattern(Int | String)` and `Pattern(String | Int)` preserve their
respective orders. Equality compares exact descriptors without normalizing
the operands or testing extensional equivalence. Compiled matchers,
accessors, aliases, allocation identities and construction history do not
participate. A policy requiring normal form can be considered separately.

```pattern
todo test "Macros normalize alternatives and direct descriptors preserve them"
  normal = struct Int | Int
  repeated = Struct(Int | Int)
  left = Pattern(Int | String)
  right = Pattern(String | Int)

  assert normal === Struct(Int)
  assert normal !== repeated
  assert left !== right
  assert parse(Type)(toString(Type)(left)) === left
  assert parse(Type)(toString(Type)(right)) === right
end
```

## Designation and matching

Construction interprets a designator in its expected concrete type. A raw
constructor expression or symbol tag requires a concrete interpretation
supplied by its context or an explicit ascription. A shape can construct a
new struct from field designators. An already typed struct cannot be
reinterpreted as an unrelated struct just because its payload would fit.
An expected wrapper can store an already typed member when the wrapper's
pattern admits it. A direct match at the expected concrete boundary wins
over recursive inward designation. Equally ranked distinct peer paths
are ambiguous. See [ambiguous value designators](ambiguous-values.md).

For an abstract union, several accepting alternatives that yield the
same exact typed value count as one interpretation. For example,
`pattern Any | String` admits `"hi" :: String` once. Ambiguity remains
when alternatives yield different typed results. Inside a concrete
descriptor, explicit alternative occurrences remain separate choices.
For example, designating `3 :: Int` into the direct-constructor
`Struct(Int | Int)` yields two interpretations, even though the two
alternatives have the same pattern. Its normalized macro counterpart
`struct Int | Int` has one. This revises the acceptance-counting rule in
[ambiguous value designators](ambiguous-values.md).

```pattern
todo test "Abstract alternatives can agree on a value while repeated concrete alternatives remain ambiguous"
  either = pattern Any | String
  (text :: either) = "hi" :: String
  expect text is "hi" :: String

  repeated = Struct(Int | Int)
  expect
    (n :: repeated) = 3 :: Int
    n
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end
```

An explicit match can open one concrete boundary at a time. It can bind a
wrapper's typed member or inspect the tag and fields at that boundary.
Selecting a symbol tag needs no raw symbol value. Ordinary bindings and
parameters cannot implicitly unwrap a value. A single-arm extraction
requires coverage of its admitted input domain. A match on an abstract
union tests the stored concrete value. A catch-all spread can collect
the unmatched arguments into an `ArgPack(T)`, including in an open
concrete type. See [Spreads and ArgPacks](https://github.com/johnwarden/pattern-language/pull/85).

`P .as T` is a proposed explicit projection pattern of lower
implementation priority. It checks the outer concrete type `T` and
applies `P` at that boundary. A second projection can open the stored
member's boundary. For `Int??`, `:None .as Int??` selects outer
absence, while `(:None .as Int?) .as Int??` selects stored inner absence.

### Overload domains and projection dispatch

Overloads of one function must have pairwise disjoint parameter domains.
Adding a definition that shares an admitted argument pack with an existing
overload raises `E_OVERLAPPING_OVERLOAD` at the definition. The specific
code for overloads distinguished only by refinements is `E_REFINED_OVERLOAD`. For example, a
base type and its refinement share the values admitted by the refinement.
Compare the whole pack after erasing refinement predicates. A distinct tag in
another argument can establish disjointness. See [disjointness of predicate-refined peers](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md#disjointness-of-predicate-refined-peers).

```pattern
test "Overlapping overload domains are rejected at definition time"
  todo expect
    def f(x :: Any) 1
    def f(x :: Int) 2
    "definitions complete"
  fails "E_OVERLAPPING_OVERLOAD"
end
```

An explicit projection in a parameter may inspect a stored field's
concrete type. A `Reading` with an `Int` field and a `Reading` with a
`Float` field satisfy disjoint parameter patterns:

```pattern
todo test "Projected overloads classify Reading like match"
  type Reading struct Reading(value :: (Int | Float))

  def kindByOverload(Reading(Int) .as Reading) "int"
  def kindByOverload(Reading(Float) .as Reading) "float"

  def classify(r :: Reading) kindByOverload(r)

  ints = Reading(5 :: Int) :: Reading
  floats = Reading(5 :: Float) :: Reading
  expect classify(ints) is "int"
  expect classify(floats) is "float"
end
```

Both definitions may coexist because their projected field patterns are
disjoint. `classify` gives the same results as the earlier `match`
example. It takes a `Reading` and dispatches on the field's concrete
type. Refinement requirements in either overload use existing evidence.

Peer match arms follow the same disjointness rule. A trailing residual
covers the part of the subject domain outside all preceding arms. Public
notation for that subtraction is open. See [match arm domains](https://github.com/johnwarden/pattern-language/pull/100).

## Canonical expressions and typed text

Every type has a canonical expression that evaluates to an exactly equal
descriptor in a fresh environment with the same primitive and prelude
definitions. Equal descriptors have identical canonical expressions.
Self-evaluating types print as their names. Constructed descriptors print
in their direct kind-constructor form. Printing composes over the pattern
data, including nested type boundaries, alternative order, field labels,
and repetitions. Parenthesize according to the grammar. The canonical
form of a non-normal descriptor preserves its supplied structure.

Keep the existing `Recursive(body)` and `Recur(n)` spelling, with
`Recur(0)` referring to the nearest enclosing binder. In the pattern
grammar, a binder remains in scope across a nested descriptor, as in
`Struct(Recursive(:Leaf | Node(Struct(:Empty | Some(Recur(0))))))`.
The canonical printer uses constructor-head spellings that preserve the
same pattern when read back.

```pattern
todo test "Canonical recursive type text preserves a reference across a struct boundary"
  t = Struct(Recursive(:Leaf | Node(Struct(:Empty | Some(Recur(0))))))
  assert parse(Type)(toString(Type)(t)) === t
end
```

Initially a refinement holds a `Predicate` enum value. The printer emits its
bare case name, as in `Pattern(ExactRational .where isNonZero)`. The
predicate grammar interprets the name as an enum tag in nested
descriptors and in a fresh scope using the same prelude. See [refinement predicates](refinement-predicates.md).
Portable user-defined predicates are a later extension.

For supported types and values, `parse(Type)(toString(Type)(t))`
returns the same descriptor, and `parse(T)(toString(T)(v))` returns the
same exact value. A typed value's text supplies member tags and nested
ascriptions where the expected grammar needs them. Global printing
uses no lexical aliases. Where a struct wrapper's immediate member
needs an ascription, the text preserves it independently of the outer
ascription. For example, the outer and inner absence cases for
`String??` must reconstruct different values.

For any global text `s` accepted by `parse(T)`, let
`c = toString(T)(parse(T)(s))`. Then `toString(T)(parse(T)(c)) == c`.
Several input spellings may designate one value. For a fixed decoding type
the first print already produces its canonical spelling. See the distinction
between reading and choosing a printed spelling in [Rendel and Ostermann,
*Invertible Syntax Descriptions*, §§2–3](https://www.informatik.uni-marburg.de/~rendel/unparse/).

`toStringLocal` and diagnostics follow the established
[exact local printing](library-closure-and-local-printing.md#exact-local-printing)
rule. They can use a visible type name when it denotes the same
descriptor in that scope. Refinement predicates retain their bare case names.
They can use sugar such as `T*` or
`T?` when it resolves to the exact descriptor. A shadowed or approximate
name is insufficient. An ambiguity diagnostic lists source expressions
that actually select the indicated surviving interpretations. If it
cannot write a selectable expression, report the count. Identical
alternatives in a non-normal concrete descriptor are one such case.

## Migration and remaining work

Migrate the [bootstrap descriptor forms](../TYPE-VALUES-BOOTSTRAP.md)
using the corresponding `struct` / `Struct` and `pattern` / `Pattern` semantics.

The requirement for concrete interpretation supersedes bare raw
runtime expression construction in [the raw-expression contract](raw-expression-values.md).
Preserve typed construction, quotation, and explicit one-boundary matching
coverage. The new catch-all struct rule supersedes the blanket prohibition
on concrete open descriptions in the
[syntax-retirement contract](retire-legacy-type-definition-syntax.md).
Raw patterns in general type-expression positions, public pattern data
and the open projection notation question remain open. Portable user-defined
predicates remain later work.
