# Value spaces and interpretation

Updated 7 November 2026. This is the intended semantic contract integrated from
[the decision record](design/LANGUAGE-DECISIONS.md). Confirmed rules are distinct
from explicitly provisional choices. The TypeScript bootstrap has not yet been
updated to all of them; its compatibility boundary is listed below.

## Values, concrete identity and descriptors

Each runtime value has one concrete interpretation. Its concrete space determines
its operations and eventual packed representation. A finite normalized structural
descriptor identifies that space; a declaration name or capture name does not.
Equal descriptors denote equal types. Physical field labels, field types, nested
concrete boundaries and the set of concrete alternatives remain structural.

Type equality is ordinary structural value equality, not host identity, a declaration
ID, or extensional equivalence of arbitrary predicates. Evaluating distinct syntax
can yield the same value. That does not imply that every inert syntax description
is automatically the evaluated type/value it describes. Optional runtime Expression
support and that descriptor-decoding boundary remain explicitly undecided.

Values in different known concrete spaces are not made comparable by identical
payload spelling. `None` in a String option and `None` in a Float32 option can
belong to different concrete spaces. Adding an alternative changes a concrete
space; an abstract union instead preserves its member spaces. Equal structural
definitions in independent scopes can interoperate without shared nominal names.

This is descriptor agreement, not a claim that two arbitrary predicates admitting
the same mathematical set have equal code/descriptors.

## Three interpretation roles

| Role | Effect on the value | Typical recipes |
| --- | --- | --- |
| Concrete | Establishes a structural concrete space | Tagged structures, concrete alternatives, predicate carveouts |
| Refinement | Restricts an existing space, preserving identity and base operations | Nonzero, nonempty, exact-fit requirements |
| Abstract | Preserves each admitted member's concrete identity | General unions, open facets and facet combinations |

The working spellings are `type Name concrete/refinement/abstract ...`. Their exact
surface sugar is provisional. Concrete structures may contain abstract-typed fields;
those positions retain member descriptors. Facet combinations require both constraints
without merging records or inventing a concrete identity. Intersection is the reviewer's
recommended term; the terminology is not a new semantic mechanism.

A written singleton abstract union was proposed for rejection. Collapse of a computed
singleton to its member is a separate, unratified recommendation. A restricted facet
may admit only one concrete space; the abstract qualification/counting policy remains
open. Nothing here creates a distinct wrapper merely to preserve an abstract label.

## Binding views and abstract storage

A concrete variable can hold a packed payload. An abstract variable must also retain
the actual concrete descriptor, as do abstract fields, parameters and container
elements. A compiler may use payload/type pointers; exact layout is a backend choice.
Boxing, narrowing and passing through a compatible view preserve value identity.

Refinement facts belong to the available guarantees about a value. Equal values may
be held through variables with different guarantees, and a function requiring a
refinement can be callable on only one of those variables. That alone is not a
violation of functional equality. The same function, under the same applicable
contract, cannot distinguish equal payloads by hidden construction history.

Known incompatible concrete spaces remain incomparable directly. A shared abstract
comparison domain can order members by structural concrete descriptor and then payload.
The eventual checker must define comparability independently of incidental boxing
history. No specialization-dependent comparison rule is introduced.

## Construction/designation and projection — settled

Designation interprets a value description in an expected concrete space. It may
recursively establish inward interpretations **only when there is exactly one justified
path**. Every required predicate needs evidence. This rule does not insert missing
fields, round numbers, select a preferred alternative or erase existing boundaries.

```text
# Intended notation; these examples are pending conformance cases.
type Option<T> concrete T | :None
(outer :: Option<Option<String>>) = "Hello"
# Unique path: inner String option, then outer option.
# :None is ambiguous between absence at different levels and is rejected.
```

This example uses an unwrapped optional representation. An independently defined
`concrete :None | Some(T)` retains its explicit Some node; designation/projection
must not silently strip arbitrary constructor nodes.

Projection crosses **one explicitly requested concrete boundary** by match-based
extraction. Ordinary typed binding and function dispatch do not unwrap. Repeating
boundaries requires repeating explicit projections. An unannotated capture preserves
the value it receives. A single-arm extraction requires coverage of the statically
admitted input domain; otherwise use multiple arms or establish the needed fact.

```text
type Small concrete Rational .where small
type Wrapped concrete Small .where smaller
# Given w :: Wrapped:
match w (s :: Small)
match s (r :: Rational)
# Direct Wrapped -> Rational projection is not allowed.
```

The checking algorithm remains implementation work. The uniqueness, evidence and
one-boundary rules are settled, not open policy choices. C03, C11 and C12 in the
decision record cover positive designation, ordinary-binding rejection, nested
absence ambiguity and required extraction coverage.

## Refinement evidence and functions

Successful explicit checks, assertions, proven facts and specified function guarantees
can establish evidence about the exact value and predicate environment. Missing
evidence is a checking failure, not proof of nonmembership. A refinement preserves
its base space; it is not a conversion or an automatic normalization operation.

A function accepting only a refinement is legal. What remains excluded is choosing
between overlapping base/refinement overloads by running their predicates:

```text
def median(xs :: SortedList<Float32>) ...       # permitted with evidence
# f(List<Float32>) and f(SortedList<Float32>) overlap if SortedList is a refinement.
# No implicit predicate test or specificity preference selects one of them.
```

Unrelated concrete domains can coexist. A selected function can require evidence;
selection must not speculatively evaluate defaults or predicates to manufacture it.
Explicit conditional checks can establish branch facts. Both possible results of a
conditional must justify a later refinement, not only its true branch.

No unchecked ordinary insist operation or general theorem prover is approved.
Static proof inference is a planned checker capability; todo assertions attempt future contracts; their expected failures are not
claims that this checker exists today.

## Numeric values

All numeric literals denote exact Rational values. Decimal, binary and hexadecimal
spelling do not choose a concrete arithmetic family. `0f0.1` denotes the exact
Rational selected by Float64 rounding of 0.1, rather than a Float64-typed value.
`0f0.5` is exactly 1/2 and is eligible for exact Decimal32 designation.

Finite fixed-precision types are concrete carveouts of representable Rational
values. They have their own arithmetic, not inherited Rational arithmetic.
Exact designation cannot silently round; converters return typed values directly.

```text
(0.5 :: Float32)       # exact designation
(0.1 :: Float32)       # rejected: 1/10 is not exactly representable
float32(0.1)           # explicit rounding, returns Float32
```

Constant predicates may be proved; nonconstant designation requires evidence or an
explicit checked operation. Runtime Rational arithmetic itself is optional. Numeric
family aliases, complete precision sets, rounding edge/overflow policies and canonical
spelling remain provisional. IEEE signed zero, NaN identity/payloads and infinities
remain deferred; no finite-only or IEEE-complete policy is silently selected here.

## General unions and unambiguous grammars

General abstract unions may contain different concrete spaces with overlapping
surface spellings. Already interpreted members retain their concrete identities.
Where member selection is ambiguous, typed serialization must carry enough concrete
reconstruction information. No branch priority is introduced.

Unambiguous is a separate grammar requirement for DSLs whose text needs no such
reconstruction annotations. It applies to the complete grammar, including nested
abstract fields/facets; it does not establish a new concrete space. The exact
qualifier spelling, certification protocol and supported proof subset remain planned.
A general union must not be rejected merely because it is unsuitable for an
annotation-free DSL grammar.

## Patterns, accessors and defaults

One recognition/capture algebra serves bindings, parameter packs, match arms,
type descriptions, macro signatures and DSL grammars. Roles add explicit policy:

- Pack boundaries tolerate extra labels; a constructed shape is exact unless open.
- Positional rest captures collect positional values only. A vertical repeated row
  adds another list layer; a horizontal rest inside repeated rows has T**, not T*.
- Bindings produce local captures. Named type declarations produce scoped accessors.
  Constructor subpatterns and explicit nested type boundaries remain distinct.
- Plain type construction is capture-free and must not install methods. Declarations
  register local accessor/printing metadata separately from structural identity.
- Defaults are binding-only. They supply an absent capture, not a field in the
  input. Type descriptions reject defaults. Ordinary factories can return complete
  values using defaulted parameters; no implicit constructor/normalizer is installed.

Different names for equal descriptors do not inherently break functional equality.
The replacement policy for duplicate local declarations, imported accessor bundles
and preferred display names remains unresolved; the prototype's blanket ban is not
silently retained as a final rule.

Typed keyword remainders and mirrored vertical spreading are intended extensions.
The remainder is an actual typed record preserving labels and field types; it is
not intrinsically a homogeneous map and does not require specialization to exist.
Their exact capture/spread spelling and unknown-shape typing remain provisional.

## Text and portability

For each supported T, the intended global contract is:

```text
parse(T)(toString(T)(v)) == v
v == w  =>  toString(T)(v) == toString(T)(w)  # for the same T
```

Canonical text is relative to the expected decoding type/grammar. Global text does
not depend on lexical type names; local variants may reuse valid visible aliases
and require that same scope to parse. REPL inspection can show the variable's known
guarantees; it need not equal serialized text for a different expected type.

A complete descriptor and point in its space must be recoverable when required by
abstract positions. Encoding source/history as arbitrary certificates cannot bypass
canonicality. Portable predicate/function representations and general every-type
coverage remain work; unsupported cases must fail explicitly.

## Deferred and provisional boundaries

ConstructedBy is **tabled entirely until refinement decoding is solved**. Its
motivating intent is retained; image membership, provenance, fixed-point replay,
original witnesses and unchecked assertions are not chosen implementations.
Ordinary where refinements are not tabled with it.

Specialization is only a later compiler optimization preserving an independently
defined abstract-call contract. First-class overload-set values are a separate
unaccepted proposal. Bare generic-family facets, MemberOf constraints and parameter
recovery remain proposals; no nominal construction history is inferred from a family
name. Runtime Expression and automatic descriptor decoding remain optional/unsettled.

## Current bootstrap boundary

The current bootstrap has structural descriptors, abstract slots/facets, runtime
subsets, canonical typed-text support, recursive groups and typed Body inspection.
Ordinary numeric literals are exact Rationals; Int/Float/Float32 remain concrete
carveouts of representable Rationals (with JS payloads in this bootstrap). It still
rejects syntax-overlapping UnionType members, admits raw Expression compatibility
values, installs accessor products under the old type forms, and lacks the revised
evidence/projection checker. These are implementation facts, not new accepted
constraints. Details are in
[the bootstrap type reference](TYPE-VALUES-BOOTSTRAP.md).

[The roadmap](ROADMAP.md) schedules alignment. [The decision record](design/LANGUAGE-DECISIONS.md)
contains 27 named design cases; [the suite specification](design/TEST-SUITE.md) defines
how all cases execute. Assertions can be ordinary, legacy (must pass until retired),
or todo (must fail; a pass demands removal of todo). These are assertion modifiers,
not alternate kinds of test or value. Every value expectation checks the observed
result type as well as value identity. No assertion grants proof facts to another.
Running the suite does not implement the revised evidence or projection checker.
Program CLI output uses the annotated REPL display.
