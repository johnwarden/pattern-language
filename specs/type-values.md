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
test "A match sees the concrete member stored in an abstract field"
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
test "A field union and a union of shapes have distinct descriptors"
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
either pattern. An expected refinement can establish evidence by checking
any constant expression, including a bound constant. Runtime values require
evidence from their types or earlier explicit checks. The [Predicate enum](refinement-predicates.md) supplies the
initial refinement predicates. See the [refinement evidence proposal](https://github.com/johnwarden/pattern-language/pull/89).

```pattern
todo test "Abstract refinement and concrete carveout both use named predicates"
  type NonZeroRational pattern NumericValue .where isNonZero
  type NonZeroId struct NumericValue .where isNonZero

  (n :: NonZeroRational) = 2
  (id :: NonZeroId) = 2
  expect n is 2 :: NumericValue
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
| `NumericValue`, `String` | Concrete. |
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
defines numeric formats as prelude structs over `NumericValue`, with
`Int` and `Float` as ordinary bindings of `Int64` and `Float64` (`Int = Int64`) and `Number` as an abstract union.
`Code` and `Body` are grammar-defined types. `ReservedSymbol` is internal
to the bootstrap. Quoting a self-evaluating type name or Boolean literal
name in executable source raises `E_QUOTED_PRIMITIVE`. The Code reader
preserves that source spelling.

Exact equality uses the ordinary rule for overlapping static domains. Bootstrap
`===` / `!==` currently share the same implementation as `==` / `!=`; they do
not yet check a stricter identity. `Int64` and `Struct(Int64)` describe
different concrete value spaces. The abstract bindings below admit both
descriptors, so the comparison returns `False`:

```pattern
todo test "Int64 and Struct(Int64) compare unequal through Type"
  (x :: Type) = Int64
  (y :: Type) = Struct(Int64)
  assert not(x === y)
end
```

Once fixed formats are prelude definitions, both values in this example have
descriptor kind `Struct`. Their payloads differ because `y` adds a boundary.
With `String` in place of `Int64`, the two concrete kinds are `PrimitiveType`
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
test "Descriptor inspection binds the typed pattern field"
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
  def p(n :: NumericValue)
    calls = calls + 1
    n != 0
  end

  expect parse(Type)("Pattern(NumericValue .where p)") fails "E_EXPECTED_PREDICATE"
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

### Milestone 5a.2 acceptance: single-field struct round trip

The first structural-interoperability **milestone acceptance test** for
[5a.2](../ROADMAP.md#5a2-align-the-bootstrap-with-the-revised-value-model--in-progress)
is a single-field `BoxedText` text round trip. A producer block declares the
named type, builds one boxed string, and returns only the two printed texts.
Outside that block the producer's name and `.value` accessor are not visible.
Reading those strings with `parse(Type)` and `parse(restoredType)` reconstructs
both. The reconstructed type must equal an independently constructed
`struct Box(String)`, the reconstructed value must equal the corresponding
independently constructed box, and both must print back to the same text.
A reader in the shared interpreter and a reader in a fresh interpreter with
the same prelude must give the same results from those two strings. In both
readers, `.value` is out of scope and a local declaration can supply `.content`.
Each named test case starts a fresh interpreter with the same prelude, so the
shared-reader case below reconstitutes in the producer interpreter outside the
declaration block, and the fresh-reader case reconstitutes from only those two
strings in a separate case.

Supporting destination identity, plain-construction accessor locality, and
same-process interop are the live cases below (and matching cases in
[declarations.test](../tests/specification/declarations.test)).

```pattern
test "5a.2 acceptance: BoxedText type and value travel as printed text"
  (typeText, valueText) = (
    type BoxedText struct Box(value :: String)
    box = Box("hello") :: BoxedText
    (toString(Type)(BoxedText), toString(BoxedText)(box))
  )
  assert typeText == "Struct(Box(String))"
  assert valueText == "Box(\"hello\")"
  restoredType = parse(Type)(typeText)
  box = parse(restoredType)(valueText)
  plain = struct Box(String)
  assert restoredType === plain
  assert box === (Box("hello") :: plain)
  assert toString(Type)(restoredType) == typeText
  assert toString(restoredType)(box) == valueText
  expect box.value fails "E_UNBOUND_NAME"
  type LocalBox struct Box(content :: String)
  (local :: LocalBox) = box
  assert local.content == "hello"
end

test "5a.2 acceptance: BoxedText texts reconstruct in a fresh interpreter"
  typeText = "Struct(Box(String))"
  valueText = "Box(\"hello\")"
  restoredType = parse(Type)(typeText)
  restored = parse(restoredType)(valueText)
  plain = struct Box(String)
  assert restoredType === plain
  assert restored === (Box("hello") :: plain)
  assert toString(Type)(restoredType) == typeText
  assert toString(restoredType)(restored) == valueText
  expect restored.value fails "E_UNBOUND_NAME"
  type LocalBox struct Box(content :: String)
  (local :: LocalBox) = restored
  assert local.content == "hello"
end

test "5a.2 acceptance: BoxedText equals capture-free struct Box(String)"
  type BoxedText struct Box(value :: String)
  plain = struct Box(String)
  assert BoxedText === plain
  assert toString(Type)(plain) == "Struct(Box(String))"
  (box :: plain) = Box("hello") :: BoxedText
  assert box.value == "hello"
end

test "5a.2 acceptance: plain struct construction installs no accessor"
  plain = struct Box(String)
  (box :: plain) = Box("hello")
  expect box.value fails "E_UNBOUND_NAME"
  expect
    bad = struct Box(item :: String)
    bad
  fails "E_PLAIN_TYPE_CAPTURE"
end

test "5a.2 acceptance: independently named boxes interoperate in-process"
  produced = (
    type BoxedText struct Box(value :: String)
    Box("hello") :: BoxedText
  )
  expect produced.value fails "E_UNBOUND_NAME"

  consumed = (
    type LocalBox struct Box(content :: String)
    (local :: LocalBox) = produced
    local.content
  )
  assert consumed == "hello"

  independent = Box("hello") :: (struct Box(String))
  assert produced === independent
end
```

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
Bootstrap `Type(...)` remains recognized as a constructor and in parseable
text; it rewrites to the same descriptor as `Struct(...)`.

```pattern
test "Bootstrap Type(...) constructors and text still rewrite to Struct(...)"
  assert Type(Rect(Int)) === Struct(Rect(Int))
  assert parse(Type)("Type(Rect(Int))") === Struct(Rect(Int))
  expect toString(Type)(Type(Int)) is "Struct(Int)" :: String
end

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

### Constructor heads versus function calls

An ordinary UpperCamel application head is a constructor designator; a
lowerCamel head is a function call. `Box(3)`, `Rect(2, 2)`, and `Some(Int)`
construct when the head has no callable binding; `box(3)` calls. The bootstrap
already enforces that split when evaluating applications
([`src/runtime.ts`](../src/runtime.ts): a bare UpperCamel or punctuation symbol
head with no callable binding builds a term). TitleCase user `def` names are
type factories, not ordinary callables. A few prelude UpperCamel names remain
callable (for example `String(...)`). That casing rule is how the language distinguishes ordinary constructor
designators from calls — for example an inline `Box(3)` match subject versus a
multi-valued call result that must be bound before `match`
([#109](https://github.com/johnwarden/pattern-language/pull/109); single-result
calls may be matched directly).

```pattern
test "UpperCamel heads construct; lowerCamel heads call"
  def box(n) n
  expect box(3) is 3 :: NumericValue
  expect Box(3) :: Expression is Box(3) :: Expression
  type IntBox concrete Box(NumericValue)
  expect Box(3) :: IntBox is Box(3) :: IntBox
end

test "A TitleCase definition is a type factory, not an ordinary function call"
  def Box(x) x
  expect Box(3) fails "E_EXPECTED_TYPE"
end
```

### Concrete interpretation

Construction interprets a designator in its expected concrete type. A raw
constructor expression or symbol tag requires a concrete interpretation
supplied by its context or an explicit ascription. Without that type, a bare
UpperCamel constructor application or bare symbol-tag designator used as an
expression raises `E_UNTYPED_EXPRESSION` (distinct from `E_PATTERN_MISMATCH`,
which remains a failed match against an expected pattern). A shape can construct
a new struct from field designators. An already typed struct cannot be
reinterpreted as an unrelated struct just because its payload would fit.
An expected wrapper can store an already typed member when the wrapper's
pattern admits it. A direct match at the expected concrete boundary wins
over recursive inward designation. Equally ranked distinct peer paths
are ambiguous. See [ambiguous value designators](ambiguous-values.md).

```pattern
todo test "A bare constructor expression without a type raises E_UNTYPED_EXPRESSION"
  expect
    x = Rect(2, 2)
    x
  fails "E_UNTYPED_EXPRESSION"
end

todo test "A bare symbol tag without a type raises E_UNTYPED_EXPRESSION"
  expect
    x = :None
    x
  fails "E_UNTYPED_EXPRESSION"
end
```

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
the unmatched arguments into an `ArgPack`, including in an open
concrete type. See [Spreads and ArgPacks](spreads-and-argpacks.md).

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

### Match arm domains

A `match` takes exactly one unlabeled value. A call whose result can be
more than one value — a function or overload group whose possible results
span more than one type or arm — must be bound to a local before matching;
a direct multi-valued call subject raises `E_MATCH_CALL_SUBJECT`. Binding
names the value whose static type the arms compare. Single-result calls
and operator calls with a single result type may be matched directly. An
UpperCamel head is a constructor designator, never evaluated as a function
call, so it is not a call subject
([#110](https://github.com/johnwarden/pattern-language/pull/110) elaborates
that rule).

Peer arms must be pairwise disjoint. The checker verifies that rule during
elaboration, when it resolves the scrutinee type and arm patterns. It checks
the match even if execution never reaches it. The bootstrap still uses
ordered first-match. Overlap raises `E_OVERLAPPING_MATCH_ARMS`. See
[MATCH-DISJOINTNESS](../design/MATCH-DISJOINTNESS.md).

The admitted scrutinee domain is the set of values the scrutinee's static
type permits at that match. Compare the arms on that same set of original
inputs, counting the one-boundary projection allowed by `match`. Overlap
outside that input domain is irrelevant to disjointness. For an `Int`
scrutinee, arms annotated with `Int | Bool` and `String | Bool` do not
overlap because the input domain excludes `Bool` and `String`. Abstract
unions also require the arms to match their declared alternatives exactly.

An `Outer` whose immediate member is `Inner` can reach an `Outer` arm as a
whole or an `Inner` arm through projection. Both arms accept the same input.
A second concrete boundary requires another projection.

A raw designator can have more than one concrete interpretation even when
the resulting typed values match disjoint arms. For example, the Int and
Float field arms can both interpret `Box(3)`. This is
`E_AMBIGUOUS_VALUE_DESIGNATOR`. An explicitly typed field can resolve it.

A function parameter or match arm cannot use `P | Q` as its binding pattern,
even when constructor tags distinguish the alternatives. Write separate arms
or overloads. Union types remain valid in annotations.

Erase refinement predicates only when comparing peer domains for disjointness.
Keep concrete boundaries, tags and fields. If disjointness cannot be proved,
raise `E_OVERLAPPING_MATCH_ARMS` and report that lack of proof. The checker
still enforces the selected arm's refinement statically. A refined binding
requires evidence for the value being bound, for example from its static type
or an earlier explicit check. Selection does not run a predicate to supply
missing evidence or fall through to `else`. For ordered predicate checks, put
`if` / `.matches` inside one base-type arm. See
[refinement evidence](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md#disjointness-of-predicate-refined-peers).

When the scrutinee's static type is an abstract union, require one explicit
peer arm for each declared alternative and no additional arms. Each arm's
domain must equal its alternative before restricting the arm to the scrutinee.
An alternative may itself be concrete or abstract. For `Int | String`, the
arms are `Int` and `String` in either order. Adding `Bool` to an arm or as a
third arm is an error. A scrutinee with static type `Int` is covered by an
`Int` arm. The peer domains must also satisfy the disjointness rule. For
example, the alternatives of `Any | Int` cannot each have a peer arm, since
both would accept the same Int values.

At most one `else` may appear, and only as the last arm. On a scrutinee outside
the abstract-union rule, it takes any value left by the peer arms. A provably
unreachable `else` is an error. In particular, a match with all the required
abstract-union arms has no residual. Peer arms keep `->`.

```pattern
todo test "Overlapping match arms raise E_OVERLAPPING_MATCH_ARMS"
  expect
    match 1 :: Int
      (a :: Int) -> 1
      (b :: Int) -> 2
    end
  fails "E_OVERLAPPING_MATCH_ARMS"
end

todo test "Outer wrapper and projected Inner arms overlap on one Outer value"
  type Inner concrete Box(String)
  type Outer concrete Wrapper(Inner)
  (inner :: Inner) = Box("hi")
  (o :: Outer) = Wrapper(inner)
  expect
    match o
      (x :: Outer) -> "outer"
    end
  is "outer"
  expect
    match o
      (x :: Outer) -> "outer"
      (y :: Inner) -> "inner"
    end
  fails "E_OVERLAPPING_MATCH_ARMS"
end

test "A bound Int reaches a single match arm"
  n = 3 :: Int
  expect
    match n
      (i :: Int) -> i
    end
  is 3 :: Int
end

# The next contracts depend on enum refinements. The standalone membership
# test tracks setup separately from the overlap and evidence checks.
todo test "The refinement match fixtures admit their designated values"
  type Positive pattern Int .where isPositive
  type NonZero pattern Int .where isNonZero
  assert (3 :: Int) .matches Positive
  assert (-2 :: Int) .matches NonZero
end

todo test "A refined arm can use evidence from an earlier explicit check"
  type Positive pattern Int .where isPositive
  def checked(n :: Int)
    assert n .matches Positive
    match n
      (p :: Positive) -> "positive"
    end
  end
  expect checked(3 :: Int) is "positive"
  expect
    def unchecked(n :: Int)
      match n
        (p :: Positive) -> "positive"
      end
    end
    "defined"
  fails "missing isPositive"
end

todo test "An overlapping match is rejected even inside an uncalled function"
  expect
    def unused(n :: Int)
      match n
        (a :: Int) -> 1
        (b :: Int) -> 2
      end
    end
    "defined"
  fails "E_OVERLAPPING_MATCH_ARMS"
end

todo test "A refinement arm overlapping its base raises E_OVERLAPPING_MATCH_ARMS"
  n = 3 :: Int
  assert n .matches Int
  type Positive pattern Int .where isPositive
  assert n .matches Positive
  expect
    match n
      (x :: Positive) -> "positive"
      (i :: Int) -> "other"
    end
  fails "E_OVERLAPPING_MATCH_ARMS"
end

todo test "Two different refinements of Int cannot select peer match arms"
  n = -2 :: Int
  assert n .matches Int
  type Positive pattern Int .where isPositive
  type NonZero pattern Int .where isNonZero
  assert n .matches NonZero
  expect
    match n
      (n :: Positive) -> "positive"
      (n :: NonZero) -> "nonzero"
    end
  fails "E_OVERLAPPING_MATCH_ARMS"
end

todo test "Disjoint tags still cannot form a union binding pattern in an arm"
  expect
    match Left(1, 2)
      (Left(x, _) | Right(_, x)) -> x
    end
  fails "union pattern"
end

todo test "Disjoint tags still cannot form a union binding pattern in a function"
  expect
    def selected((Left(x, _) | Right(_, x))) x
    "definitions complete"
  fails "union pattern"
end

test "Separate arms can extract the same name from different fields"
  def selected(p)
    match p
      Left(x, _) -> x
      Right(_, x) -> x
    end
  end
  expect selected(Left(1, 2)) is 1
  expect selected(Right(1, 2)) is 2
end

test "An abstract-union match covers each declared alternative"
  type Input abstract Int | String
  (v :: Input) = 3 :: Int
  expect
    match v
      (i :: Int) -> "int"
      (s :: String) -> "string"
    end
  is "int"
  todo expect
    match v
      (i :: Int) -> "int"
    end
  fails "non-exhaustive match"
end

test "An abstract union rejects wider and additional arms"
  type Input abstract Int | String
  type Left abstract Int | Bool
  type Right abstract String | Bool
  (v :: Input) = 3 :: Int
  todo expect
    match v
      (i :: Left) -> "int"
      (s :: Right) -> "string"
    end
  fails "declared alternative"
  todo expect
    match v
      (i :: Int) -> "int"
      (s :: String) -> "string"
      (b :: Bool) -> "bool"
    end
  fails "declared alternative"
end

# Non-abstract Int scrutinee: Left/Right overlap only on Bool, outside the
# input domain, so the arms are disjoint for this match.
test "Overlap outside the scrutinee type does not make two arms overlap"
  type Left abstract Int | Bool
  type Right abstract String | Bool
  n = 3 :: Int
  expect
    match n
      (i :: Left) -> "int"
      (s :: Right) -> "string"
    end
  is "int"
end

test "An abstract union can have an abstract alternative with its own arm"
  type Tagged pattern Box(Int)
  type IntBox struct Box(Int)
  type Input pattern Tagged | String
  (v :: Input) = Box(3 :: Int) :: IntBox
  expect
    match v
      (b :: Tagged) -> "box"
      (s :: String) -> "string"
    end
  is "box"
end

test "Box(3) :: NumBox is an ambiguous designator on its own"
  type NumBox concrete Box(Int | Float)
  expect Box(3) :: NumBox fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end

test "Explicitly typed Box field selects one arm"
  type NumBox concrete Box(Int | Float)
  (b :: NumBox) = Box(3 :: Int)
  expect
    match b
      Box(n :: Int) -> "int"
      Box(n :: Float) -> "float"
    end
  is "int"
end

# Destination: bare Box(3) is ambiguous because the arms supply competing
# Int/Float field interpretations. Bootstrap currently picks the first arm.
todo test "Bare Box(3) is ambiguous when Int and Float field arms both compete"
  expect
    match Box(3)
      Box(n :: Int) -> "int"
      Box(n :: Float) -> "float"
    end
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
  expect
    match Box(3)
      Box(n :: Float) -> "float"
      Box(n :: Int) -> "int"
    end
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end

todo test "An else arm is rejected unless it is last"
  expect
    match 1 :: Int
      else -> 0
      (i :: Int) -> i
    end
  fails "E_OVERLAPPING_MATCH_ARMS"
end

test "A constructor designator may be matched without binding first"
  expect
    match Box(3 :: Int)
      Box(n :: Int) -> n
    end
  is 3 :: Int
end

test "A single-result call may be matched directly"
  def one() 1 :: Int
  expect
    match one()
      (i :: Int) -> i
    end
  is 1 :: Int
end

test "Bind positional results before matching one value"
  def pair()
    (1, 2)
  end
  (first, second) = pair()
  expect
    match second
      n -> n
    end
  is 2
  todo expect
    match pair()
      (a :: String, b :: String) -> "strings"
      else -> "other"
    end
  fails "E_MATCH_CALL_SUBJECT"
end

test "Bind labeled results before matching one value"
  def labeled()
    (x: 1, y: 2)
  end
  (x: first, y: second) = labeled()
  expect
    match second
      n -> n
    end
  is 2
  todo expect
    match labeled()
      (x: a, y: b) -> "labeled"
    end
  fails "E_MATCH_CALL_SUBJECT"
end
```

Trailing `else` sketch (indented display-only):

    match subject
      P1 -> V1
      P2 -> V2
      else -> fallback
    end

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
bare case name, as in `Pattern(NumericValue .where isNonZero)`. The
predicate grammar interprets the name as an enum tag in nested
descriptors and in a fresh scope using the same prelude. See [refinement predicates](refinement-predicates.md).
Portable user-defined predicates are a later extension.

For supported types and values, `parse(Type)(toString(Type)(t))`
returns the same descriptor, and `parse(T)(toString(T)(v))` returns the
same exact value. For the same expression, inputs and visible definitions, shared and fresh
interpreters must produce the same result or language error. This applies
to reading and printing global text as well. A typed value's text supplies member tags and nested
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
