# Ordinary prelude patterns for type kinds

Draft requested by Jonathan on 10 November 2026. This proposes the ordinary
prelude definitions behind
[the approved kind constructors](../approved/type-values.md). The earlier
decision remains approved; the additional definitions and inspection choices
below await review.

## Proposed kind definitions

```pattern
type ConcreteType concrete ConcreteType(TypePattern)
type AbstractType concrete AbstractType(TypePattern)
type RefinementType concrete RefinementType(Type, Function)
type Type abstract AbstractType | ConcreteType | RefinementType | PrimitiveType
```

The first three are concrete data types. Their instances describe concrete types,
abstract types and refinements, respectively. The kind of a descriptor value is
separate from the interpretation it gives its member values.

Fields are positional and capture-free. These declarations generate no `pattern`,
`base` or `predicate` accessors. Named accessors would be an additional public
inspection decision.

| Binding | Concrete kind of the value bound to it |
| --- | --- |
| `ConcreteType` | `ConcreteType` |
| `AbstractType` | `ConcreteType` |
| `RefinementType` | `ConcreteType` |
| `Type` | `AbstractType` |
| `PrimitiveType` | `PrimitiveType` |

For example, the schema named AbstractType is itself a concrete type value.
`AbstractType(Rational | String)` is an instance of that schema. The Rational and
String members admitted by that descriptor keep their own concrete identities.

```pattern
test "Kind schemas and their union are ordinary type values"
  assert ConcreteType .matches ConcreteType
  assert AbstractType .matches ConcreteType
  assert RefinementType .matches ConcreteType
  assert Type .matches AbstractType
  assert Type .matches Type
  assert PrimitiveType .matches PrimitiveType

  assert :ConcreteType .matches UpperCamelSymbol
  assert :AbstractType .matches UpperCamelSymbol
  assert :RefinementType .matches UpperCamelSymbol
  assert :Type .matches UpperCamelSymbol
end
```

## Supporting pattern domains

Proposed supporting definitions:

```pattern
type PatternLiteral abstract Rational | String | Bool | Symbol
type PatternForm refinement Expression .where isCaptureFreePatternForm
type TypePattern abstract Type | PatternLiteral | PatternForm
```

TypePattern admits actual Type values as references, literal pattern values, and
inert structural pattern forms. It is an abstract domain preserving those values'
existing concrete interpretations.

PatternForm uses the current intended Expression space for structural forms.
This depends on the Code/Expression boundary; it does not select a new public AST
or expose bootstrap `Apply`/`Recursive` encodings.

The ordinary predicate `isCaptureFreePatternForm` must implement the following
contract through the common pattern-recognition rules:

- Recognize the supported structural pattern algebra: constructed shapes and
  complete packs, alternatives, openness, repetition, postfix forms and supported
  predicate forms.
- Check each component by its role. Type-reference positions contain actual Type
  values; nested pattern positions satisfy TypePattern; predicate positions contain
  function values. A stored type reference is not an unresolved lexical name.
- Reject declaration captures and binding defaults at every depth. Physical field
  labels remain allowed. Literal strings and quoted symbols are not rejected
  merely because their spelling resembles declaration syntax.
- Preserve nested concrete boundaries, labels, packs, alternative order and
  repetition dimensions. Recognition does not normalize the input.
- Inspect structure without executing predicates, defaults, Code or other user
  program fragments. Unsupported forms reject explicitly.

This is the semantic definition of the classifier. Its source body should reuse
the shared pattern machinery, not introduce a divergent parser. Exact recursive
reference representation and any broader public structural grammar still need
focused contracts.

```pattern
test "Nested references preserve their concrete type boundary"
  inner = ConcreteType(Cell(Rational))
  outer = ConcreteType(Box(inner))
  def keep(t :: Type) t

  assert inner .matches TypePattern
  assert outer .matches ConcreteType
  assert keep(outer) == outer
  assert outer != ConcreteType(Box(Cell(Rational)))
end
```

## Refinement function field

Function denotes the ordinary callable-value domain from the approved
[closed-function decision](../approved/named-function-values.md) and
[immutable dependency rule](../approved/library-closure-and-local-printing.md).

Its exact ordinary source grammar remains a dependency to settle. Do not add a
reserved Function primitive or silently replace the field with Any. A predicate
is a function value containing its complete admitted captures and dependencies,
not quoted Code, an unversioned symbolic name or a host closure identifier.

The field schema alone does not prove that the function accepts base values and
returns Bool. Those are the separate refinement/checking obligations; do not
establish them by speculatively running the predicate.

```pattern
test "A refinement stores an ordinary function value"
  nonZero = n -> n != 0
  t = RefinementType(Rational, nonZero)

  assert t .matches RefinementType
  assert t .matches Type
  assert t != Rational
  assert 2 .matches t
  assert not(0 .matches t)
end
```

## Construction and structural identity

Use ordinary unquoted constructor forms, preserving the
[application-head distinction](../../tests/specification/application-heads.md).
A type value stored in a variable does not become a constructor function, and an
evaluated Symbol does not become callable.

```pattern
test "A kind constructor form differs from calling a type value"
  t = ConcreteType(Rect(Rational))

  assert t .matches ConcreteType
  assert t .matches Type
  expect t(1) fails "E_NOT_CALLABLE"

  kind = ConcreteType
  expect kind(Rect(Rational)) fails "E_NOT_CALLABLE"
  expect :ConcreteType(Rect(Rational)) fails "E_NOT_CALLABLE"
end
```

The already approved bare constructor expressions must produce usable type
values through the ordinary construction/interpretation rules. If the bootstrap
needs a bridge, specify that general rule rather than special-casing these
constructor names. Its exact phase/expected-type behavior is a review item below.

Kind shapes are exact: ConcreteType and AbstractType each have one positional
field, and RefinementType has two. Missing/extra fields, unexpected labels, an
invalid pattern or a nonfunction predicate do not satisfy the respective schema.
A familiar tag alone does not grant Type identity.

Declarations may produce canonical descriptor data, erase positional capture
names and register separate local accessor/display products. Direct kind
construction and equality do not sort alternatives, flatten type boundaries,
deduplicate members or identify predicates extensionally.

```pattern
test "Direct construction preserves the supplied data"
  a = AbstractType(Rational | String)
  b = AbstractType(String | Rational)

  assert a != b
  assert a != ConcreteType(Rational | String)

  type Either abstract String | Rational
  assert Either == a
end
```

## Recursive prelude and bootstrap boundary

Initialize the mutually dependent schemas through the existing finite recursive
declaration-group mechanism. Type refers to the kind schemas; their fields refer
back to TypePattern and Type. Do not infinitely expand that graph.

PrimitiveType and the existing primitive atoms remain the bootstrap boundary.
Retain their approved membership cases, including PrimitiveType self-membership.
This proposal does not choose a new complete primitive vocabulary or classify
every ReservedSymbol as a primitive type.

The other names above are ordinary lexical definitions. Host caches, declaration
tokens and allocation identities do not participate in structural equality.
Independent realizations of equal schemas must agree structurally.

## Explicit matching: proposed inspection consequence

Recommended additional decision: ordinary explicit one-boundary matching can
expose a concrete kind value's positional payload.

```pattern
test "Explicit matching exposes the ordinary kind payload"
  t = ConcreteType(Rect(Rational))
  payload = match t
    ConcreteType(p) -> p
  end

  assert payload .matches TypePattern
  assert payload == Rect(Rational)
end
```

This is a narrow proposed inspection decision beyond the earlier approval, which
left descriptor-field extraction pending. Review it explicitly before accepting
this example. Ordinary bindings still do not project concrete values.

Reading `parse(Code)("ConcreteType(Rect(Rational))")` still yields Code, without
Type identity. General Expression-to-Type decoding and exact canonical descriptor
text remain separate decisions.

## Decisions to review and implementation handoff

1. The outer kind schemas and capture-free positional fields.
2. The TypePattern decomposition, the classifier and its Expression dependency.
   Finish recursive cases without inventing a competing public AST.
3. The ordinary Function grammar/admissible predicates, or an explicitly bounded
   initial supported subset.
4. The general construction/interpretation rule for bare constructor expressions.
5. Whether ordinary explicit matching exposes kind payloads as proposed.

After approval, write focused executable contracts before runtime changes.
Include malformed shapes, nested capture/default rejection, recursive-group
termination and independent-context structural agreement. Apply the already
approved Type/UnionType migration.

These are draft source contracts, not claims that the bootstrap executes them.
Execution checks were unavailable while this draft was written.
