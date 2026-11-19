# Types, descriptors, and type expressions

Draft for review. A type is a value defined by a pattern. Every type has a
writable expression. The same pattern rules serve type declarations, bindings,
parameters, and match arms, with each context controlling captures, designation,
and projection.

See [worked examples and rationale](type-values-rationale.md).

## Concrete spaces and abstract patterns

`struct P` establishes a concrete value space. A constructor or tag pattern
defines the visible shape of that space. A reference to an existing concrete
type defines a typed payload, adding a boundary around the referenced type.
`pattern P` describes an abstract domain. A value admitted by that domain keeps
its concrete identity, including when stored in an abstract field or binding.

```pattern
todo test "A facet view preserves concrete identity; a struct wrap adds a boundary"
  type Rectangular pattern Rect(Int, Int)
  type Rectangle struct Rect(w :: Int, h :: Int)
  type WrappedRectangle struct Rectangle

  r = Rect(2, 3) :: Rectangle
  (view :: Rectangular) = r
  (wrapped :: WrappedRectangle) = r
  assert view === r
  expect wrapped is r :: WrappedRectangle
end
```

`view` holds the same Rectangle as `r`. `wrapped` holds that Rectangle
inside a new concrete boundary. A `Rectangular` binding can admit `r`
through its visible constructor and fields. It cannot implicitly open
`wrapped` to find those fields. A facet with abstract fields can admit
different concrete field types. A facet requiring `Int` can recognize an
abstract field currently holding an `Int` when the context inspects
the value.

Pattern forms include type references, literals, symbol tags, constructed
shapes and packs, alternatives, repetitions, open fields, and refinement
constraints. `pattern Int` yields the referenced `Int` type. `struct Int`
creates a wrapper, and `struct (struct Int)` creates two boundaries.
Wrapping an abstract facet uses its pattern, including its outer constructor
and fields. For example, `struct Rectangular` above denotes the same type as
`struct Rect(Int, Int)`. Descriptor identity does not distribute a union
over fields even when the expanded patterns admit the same values.

A tag facet such as `pattern :None` admits a typed value bearing that tag
at the matched boundary. An abstract union may mix tags, facets, and type
references. For example, `pattern Int | :None` admits `5 :: Int` and
`:None :: Int?`. It requires a concrete type for a bare `:None` and
does not open `5 :: Int?` to obtain its `Int` payload. A tag can also
define a concrete singleton with `struct :None`.

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

`Type` is an ordinary prelude abstract union of `Struct | Pattern |
PrimitiveType`. `Struct` and `Pattern` are concrete types whose values
each contain one positional, capture-free type pattern. A refinement uses
that same field, as in `Pattern(T .where p)` and `Struct(T .where p)`.
The prelude can define these mutually recursive schemas using a finite
declaration group. `Struct` and `Pattern` themselves are struct descriptors.
`Type` itself is a pattern descriptor.

A primitive type is self-evaluating. This is a property of the descriptor
and is independent of whether it describes a concrete or an abstract domain.
Primitive type values have concrete kind `PrimitiveType`. The proposed
initial inventory is:

| Types | Domain |
| --- | --- |
| `ExactRational`, `String`, `Bool` | Concrete. `True` and `False` are Bool values, as are computed Boolean results. |
| `PrimitiveType` | Concrete. It includes itself. |
| `Any`, `LowerCamelSymbol`, `UpperCamelSymbol`, `UpperSnakeSymbol`, `PunctuationSymbol` | Abstract. The symbol classes admit already typed ordinary symbols; they do not admit reserved symbols. |

`Symbol` is the prelude union of the ordinary symbol classes. Those abstract
classes — `LowerCamelSymbol`, `UpperCamelSymbol`, `UpperSnakeSymbol`,
`PunctuationSymbol`, and therefore `Symbol` — do not admit reserved symbols.
Reserved names such as `True`, `False`, and the primitive type names are
outside every ordinary symbol class:

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

`Struct(P)` and `Pattern(P)` directly construct descriptor values. Their
field is typed pattern data. It records a structural pattern, with resolved
type references, literal tests, tags, packs, alternatives, repetition,
and `Predicate` members. It preserves field labels and nested concrete
boundaries. The public pattern-data schema is open.

The proposed construction rule is grammar-directed construction of a typed
field. A resolved constructor head supplies the expected field grammar.
Thus in `Struct(Rect(Int))`, the field grammar reads `Rect(Int)` as a
constructor pattern with one type reference. A bound `Type` can supply a
reference within the grammar. A value already holding typed pattern data can
fill the field directly, including data returned by inspecting another
descriptor. This uses the same pattern grammar as `struct` and `pattern`.
The prelude constructor bindings supply the concrete schema for the two
kind constructors. Calling a bound type value still fails. A type
declaration introduces no constructor binding for its pattern's tag.

Direct constructors validate the field's pattern structure, including
recursive reference scope. They reject declaration captures, defaults, and
malformed fields at any depth. Validation does not run refinement predicates
or execute arbitrary syntax. An explicit match can inspect a descriptor and
bind its typed field. No accessor needs to be installed to do this:

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

A function may accept or return a `Type` in ordinary successive packs.
For example, `def makeBox(T :: Type) struct Box(T)` computes a descriptor.
`parse(Code)("Struct(Rect(Int))")` produces inert source data. Only the
evaluated descriptor has type `Type`.

## Declarations, normalization, and identity

`type Name struct P` and `type Name pattern P` bind named types and can
register declaration products such as scoped accessors. Plain type
construction registers none. Positional capture names disappear from
descriptor identity. Physical labels, pack boundaries, and concrete
type boundaries remain. Defaults belong to binding patterns and do not
complete a type or a value during designation. Independently constructed
equal descriptors interoperate. Existing duplicate declaration and accessor
collision diagnostics remain in force pending a naming and import policy.

Only the `pattern` and `struct` macros normalize. They resolve type
references, collapse nested abstract pattern forms, sort
alternatives canonically, and remove repetitions of exactly equal
alternatives. They preserve explicit concrete boundaries. If a quoted and
unquoted alternative denote the same type in the current scope, report
`E_REDUNDANT_QUOTE` during macro normalization. A quote that prevents a
name from resolving to a different type, such as a call to a type-valued
factory, remains meaningful. This check is distinct from
`E_QUOTED_PRIMITIVE`.

Direct constructors preserve the supplied pattern data. `Pattern(Int)` is
a valid non-normal descriptor whose domain consists of Int values.
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
overload raises `E_AMBIGUOUS_CALL` at the definition. For example, a
base type and its refinement share the values admitted by the refinement.
See [refinement evidence and functions](../VALUE-SPACES.md#refinement-evidence-and-functions).

```pattern
test "Overlapping overload domains are rejected at definition time"
  todo expect
    def f(x :: Any) 1
    def f(x :: Int) 2
    "definitions complete"
  fails "E_AMBIGUOUS_CALL"
end
```

An explicit projection in a parameter may inspect a stored field's
concrete type. A `Reading` with an `Int` field and a `Reading` with a
`Float` field satisfy disjoint parameter patterns:

```pattern
todo test "Projected overloads classify Reading like match"
  type Reading struct Reading(value :: Int | Float)

  def kind(r :: Reading)
    match r
      Reading(Int) -> "int"
      Reading(Float) -> "float"
    end
  end

  def kindByOverload(Reading(Int) .as Reading) "int"
  def kindByOverload(Reading(Float) .as Reading) "float"

  def classify(r :: Reading) kindByOverload(r)

  ints = Reading(5 :: Int) :: Reading
  floats = Reading(5 :: Float) :: Reading
  expect kind(ints) is "int"
  expect kind(floats) is "float"
  expect classify(ints) is "int"
  expect classify(floats) is "float"
end
```

Both definitions may coexist because their projected field patterns are
disjoint. `classify` behaves like `kind` even though the static type of
`r` guarantees only `Reading`. Refinement requirements in either overload
still rely on existing evidence.

An ordered match gives priority to the first matching arm. Its equivalent
overloads must express disjoint effective domains by subtracting the
values covered by earlier arms. Public notation for that subtraction is
open.

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
`Recur(0)` referring to the nearest enclosing binder. Read recursive
references under the binder even across a nested kind constructor:
`Struct(Recursive(:Leaf | Node(Struct(:Empty | Some(Recur(0))))))`.
Kind constructors read structural patterns in this context, including
quoted lower-case heads. The canonical printer must choose spellings that
retain constructor-head meaning under the pattern grammar.

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
