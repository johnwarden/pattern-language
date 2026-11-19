# Types, descriptors, and type expressions

Draft for review. A type is a value defined by a pattern. Every type has a
writable expression. The same pattern rules serve type declarations, bindings,
parameters, and match arms, with each context controlling captures, designation,
and projection.

## Concrete spaces and abstract patterns

`struct P` establishes a concrete value space. A constructor or tag pattern
defines the visible shape of that space. A reference to an existing concrete
type defines a typed payload, adding a boundary around the referenced type.
`pattern P` describes an abstract domain. A value admitted by that domain keeps
its concrete identity, including when stored in an abstract field or binding.

```pattern
type Rectangular pattern Rect(Int, Int)
type Rectangle struct Rect(w :: Int, h :: Int)
type WrappedRectangle struct Rectangle

r = Rect(2, 3) :: Rectangle
(view :: Rectangular) = r
(wrapped :: WrappedRectangle) = r
```

`view` holds the same Rectangle as `r`. `wrapped` holds that Rectangle
inside a new concrete boundary. A `Rectangular` binding can admit `r`
through its visible constructor and fields. It cannot implicitly open
`wrapped` to find those fields. A facet with abstract fields can admit
different concrete field types. Conversely, a facet requiring `Int` can
recognize an abstract field currently holding an `Int` when the context
inspects the value.

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
available. Initially `p` names a prelude predicate. See
[refinement predicates](refinement-predicates.md) and [refinement evidence][evidence].

```pattern
type NonZeroRational pattern ExactRational .where isNonZero
type NonZeroId struct ExactRational .where isNonZero

(n :: NonZeroRational) = 2
(id :: NonZeroId) = 2
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
| `Any`, `LowerCamelSymbol`, `UpperCamelSymbol`, `UpperSnakeSymbol`, `PunctuationSymbol` | Abstract. The symbol classes admit already typed values. |

`Symbol` is the prelude union of the ordinary symbol classes. The
fixed-precision numeric formats are prelude structs over `ExactRational`.
`Int` and `Float` alias fixed-width types. `Number` is a prelude abstract
union. See the [numeric proposal][numbers]. `Code` and `Body` are
grammar-defined types. Whether the bootstrap's `ReservedSymbol` has a
public role as an abstract view of reserved atoms is open. A quoted
self-evaluating primitive name in executable source remains
`E_QUOTED_PRIMITIVE`. The rule also applies to the reserved Boolean literal
names. Parsing Code can preserve the source spelling.

Exact equality uses the ordinary rule for overlapping static domains. `Int`
and `Struct(Int)` describe different concrete value spaces. The abstract
bindings below admit both descriptors, so the comparison returns `False`:

```pattern
(x :: Type) = Int
(y :: Type) = Struct(Int)
x === y
```

Once fixed formats are prelude definitions, both values in this example have
descriptor kind `Struct`. Their payloads differ because `y` adds a boundary.
With `String` in place of `Int`, the two concrete kinds are `PrimitiveType`
and `Struct`, and the comparison through `Type` still returns `False`.
The wrapper and its payload are also distinct when comparing member values.

## Constructing and inspecting descriptors

`Struct(P)` and `Pattern(P)` directly construct descriptor values. Their
field is typed pattern data. It records a structural pattern, with resolved
type references, literal tests, tag and pack structure, alternatives,
repetition, and refinement function values. It preserves field labels and
nested concrete boundaries. The field is neither executable Code nor a
general Expression value. Its full public data schema is open.

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
t = Struct(Rect(Int))
copy = match t
  Struct(p) -> Struct(p)
end
```

Ordinary whole-value bindings preserve the descriptor. `t(2)` is
`E_NOT_CALLABLE`. A function may accept or return a `Type` in ordinary
successive packs. For example, `def makeBox(T :: Type) struct Box(T)`
computes a type without declaring it. A Code value produced by
`parse(Code)("Struct(Rect(Int))")` stays Code. No implicit decoding from
Code or arbitrary syntax data is provided.

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

## Designation and matching

Construction interprets a designator in its expected concrete type. A raw
constructor expression or symbol tag requires a concrete interpretation
supplied by its context or an explicit ascription. A shape can construct a
new struct from field designators. An already typed struct cannot be
reinterpreted as an unrelated struct just because its payload would fit.
An expected wrapper can store an already typed member when the wrapper's
pattern admits it. A direct match at the expected concrete boundary wins
over recursive inward designation. Equally ranked distinct peer paths
are ambiguous. See [designation and ambiguity][designation].

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

An explicit match can open one concrete boundary at a time. It can bind a
wrapper's typed member or inspect the tag and fields at that boundary.
Selecting a symbol tag needs no raw symbol value. Ordinary bindings and
parameters cannot implicitly unwrap a value. A single-arm extraction
requires coverage of its admitted input domain. A match on an abstract
union tests the stored concrete value. Concrete catch-all fields and
their `Dict` capture are defined in the [spread proposal][spreads] and
can be implemented later.

`P .as T` is a proposed explicit projection pattern of lower
implementation priority. It checks the outer concrete type `T` and
applies `P` at that boundary. A second projection can open the stored
member's boundary. For `Int??`, `:None .as Int??` selects outer
absence, while `(:None .as Int?) .as Int??` selects stored inner absence.

### Open dispatch question

Can an explicit projection in a function parameter select an overload by
inspecting stored field types? Consider a `Reading` whose field can hold
either `Int` or `Float`:

```pattern
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
```

The proposed result is that `classify` behaves like `kind` even
though the static type of `r` only guarantees `Reading`. The explicit
projection lets dispatch inspect the field's stored concrete type. It
does not grant a refinement by running a predicate. For an ordered match
with overlapping arms, the equivalent overloads use disjoint effective
patterns, subtracting earlier arms from later ones. The notation for that
subtraction and whether it needs to be public remain open.

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

Initially a refinement names a prelude function. The printer emits its
identifier, as in `Pattern(ExactRational .where isNonZero)`. The same
prelude resolves the reference in a fresh scope and in nested descriptors.
See [refinement predicates](refinement-predicates.md) for lookup and
identity. Portable user-defined predicates are a later extension.

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
descriptor in that scope. Prelude predicates retain their prelude names.
They can use sugar such as `T*` or
`T?` when it resolves to the exact descriptor. A shadowed or approximate
name is insufficient. An ambiguity diagnostic lists source expressions
that actually select the indicated surviving interpretations. If it
cannot write a selectable expression, report the count. Identical
alternatives in a non-normal concrete descriptor are one such case.

## Migration and remaining work

This draft consolidates the type model, descriptor kinds, and writable
type expressions. Destination contracts use `struct` / `Struct` and
`pattern` / `Pattern`. Migrate the legacy `Type(...)`, `UnionType(...)`
and `Facet(...)` forms using the corresponding constructor or macro
semantics. The prior `ConcreteType`, `AbstractType` and `RefinementType`
constructor proposals are replaced. Legacy syntax and encodings remain
documented in the [bootstrap reference](../TYPE-VALUES-BOOTSTRAP.md).

The requirement for concrete interpretation supersedes bare raw
runtime expression construction in [the raw-expression contract](raw-expression-values.md).
Preserve typed construction, quotation, and explicit one-boundary matching
coverage. The new catch-all struct rule supersedes the blanket prohibition
on concrete open descriptions in the
[syntax-retirement contract](retire-legacy-type-definition-syntax.md).
Raw patterns in general type-expression positions, public pattern data
and the projection dispatch question remain open. Portable user-defined
predicates remain later work.

After review, update the active source contracts for normalization,
non-normal direct constructors, descriptor inspection, type equality,
recursive and refined type expressions, exact typed text, and diagnostics.
Mark missing implementation with `todo`.

[evidence]: https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md
[numbers]: https://github.com/johnwarden/pattern-language/blob/spec/numeric-semantics/specs/fixed-precision-numbers.md
[designation]: https://github.com/johnwarden/pattern-language/blob/spec/numeric-semantics/specs/2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#designation-and-ambiguity
[spreads]: https://github.com/johnwarden/pattern-language/blob/spec/spreads/specs/spreads.md#catch-all-fields
