# Type values, declarations and typed text

Updated 7 November 2026. This describes the intended model and explicitly marked
open choices. [TYPE-VALUES-BOOTSTRAP.md](TYPE-VALUES-BOOTSTRAP.md) documents the
unchanged implementation's concrete descriptor encoding and syntax.

## Identity is structural

Types are ordinary values with finite structural representations. A compiled matcher,
accessor cache, lexical alias or object address does not participate in their public
identity. Equal normalized descriptors denote equal types. This is not a solver for
extensional equivalence of arbitrary predicates or functions.

Captures are interpretation/declaration products rather than physical fields in the
stored value. Erasing a positional capture name preserves descriptor identity;
changing a physical field label or nested concrete boundary does not. Concrete
alternatives describe one concrete space; general abstract unions retain their
existing member spaces. Duplicate/ambiguous concrete alternatives do not gain an
ordered first-match interpretation. Match-arm order is a different policy.

## Evaluation, primitive values and descriptions

Values stay distinct from the expressions that evaluate to them. Distinct source
syntax may evaluate to the same primitive; quotation/printing of source and
inspection of values keep those roles separate. Numeric literals denote
exact Rationals; ordinary strings, Bool values and symbolic values have intrinsic
interpretations. Reserved primitive atoms cannot simultaneously become ordinary
UpperCamelSymbol values because of their spelling. `Symbol` is a prelude union,
not a reserved primitive.

The proposed primitive vocabulary includes self-evaluating PrimitiveType, with Bool
and PrimitiveType as its values. The complete metatype and redundant primitive-quote
policy remain provisional. Nonprimitive numeric types should be definable carveouts.
Primitive names are `ReservedSymbol` values, and the type description of
`type Int` is the reserved symbol `Int` itself, not `:Int`. A quoted primitive
name such as `:Int` is an error in program source, including type declarations,
which write `type String(:A)` rather than `type :String(:A)` (D20). `True` and
`False` are `Bool` values like computed comparison results, not `ReservedSymbol`
values.

An explicitly interpreted Expression descriptor, if exposed, need not equal the result
of evaluating it. Whether runtime Expression computation exists, and the exact public
decoding operation for descriptors, remain unsettled. The raw parsing/pattern domain
need not become a permanent additional runtime space.

## Declarations and plain type values

Working notation separates declarations from type-producing expressions:

```text
type Rectangle concrete Rect(w :: Float32,h :: Float32)
t = Rectangle
u = concrete Rect(Float32,Float32)
```

The declaration binds/registers the type name and local accessor/printing metadata.
Plain type construction is capture-free and must not install methods. This makes
ordinary type values storable, passable and comparable without a declaration effect.
The concrete/abstract declaration and type-expression forms already written in
`tests/specification/` are current implementation targets; their missing support
is tracked as todo. Additional qualifiers and policies remain provisional where
the decision record says so. See the roadmap's immediate conformance priorities.

Local aliases and parameterized display names do not change structural identity.
Functional equality alone does not justify banning multiple names for an equal
descriptor. The author has deferred the replacement collision/import/preferred-name
policy. For now, equivalent declarations and accessor collisions remain errors.
Preserve that guard while separating declaration effects from plain type construction;
it is a temporary policy, not the final alias/import design.

## Kinds and factories

| Type-producing role | Identity effect |
| --- | --- |
| concrete P | A structural concrete value space defined by P |
| refinement T .where p | A restriction of T's space with evidence, preserving identity |
| abstract A | An identity-preserving domain of concrete members |

Unions, open facets and facet combinations are recipes for abstract domains;
concrete types can contain abstract fields. Whether an explicitly written singleton
abstract union is rejected or a computed singleton collapses remains a policy choice.
Terminology does not require adding a new runtime wrapper for an abstract label.

Parameterized factories continue to operate on ordinary type values. The simple
angle declaration/application forms in C05/C12/C18 are current todo targets; they
do not collapse the runtime pack distinction between f(a)(b) and f(a,b). The
bootstrap currently uses ordinary packs, for example `List(Int)`. Unspecified
parameter constraints and family-recovery policies remain separate decisions.

Bare-family facets, for example Rectangle admitting some Rectangle<N>, and MemberOf
constraints remain proposals. Parameters need not be recoverable from a descriptor:
a family ignoring T can produce identical types for all T. No hidden nominal token
or creation history may be assumed to solve that inversion. First-class overload sets
are a separate unaccepted proposal, not a consequence of type-valued factories.

## Concrete designation and explicit projection

[VALUE-SPACES.md](VALUE-SPACES.md) defines the settled judgments. Recursive designation
requires a unique justified inward path. Projection requests exactly one concrete
boundary, explicitly by matching; ordinary bindings and dispatch do not unwrap.
A single-arm match needs coverage of the admitted input domain. Evidence is required
for every predicate along a designation path; neither branch priority nor implicit
rounding/default completion is available.

## Evidence and portable representation

Refinement-qualified functions are legal. Overlapping base/refinement overloads do
not acquire a priority by running predicates. Assertions/checks and valid guarantees
can establish facts; missing evidence does not show nonmembership. Portable predicate
code, lexical dependencies and checker proof representation remain implementation work.
Host identity must not fill that gap.

ConstructedBy is tabled until its refined values can be decoded. No constructor replay,
fixed-point verifier, arbitrary witness format or unchecked insist has been selected.
General automatic normalization and type defaults are not reinstated.

## Global and local typed text

For supported T and v, parse(T)(toString(T)(v)) equals v. Equal values under the same
expected T have equal canonical text. The expected decoding grammar matters:
abstract positions may need member descriptions that concrete or unambiguous positions
do not. Global text is independent of lexical aliases; local variants may use visible
names, including factory instances, and require the same scope to parse them.

Canonical text need not reproduce original formatting. Surface label sorting is part
of pack syntax; sorting concrete alternatives is descriptor-construction normalization.
Refinement guarantees and local display names do not introduce a separate equality law.
Unsupported closure/predicate transport must remain explicit.

## Implementation encoding and gaps

The bootstrap currently exposes primitive atoms, Type, Facet, UnionType, Literal,
Fields/OpenFields, Repeat, Apply, Recursive/Recur and Row/Collect/Sequence in an
ordinary source-defined schema. These encodings are implementation contracts for
that supported subset, not an instruction to treat every descriptor constructor as
another fundamental source-language concept.

[The bootstrap reference](TYPE-VALUES-BOOTSTRAP.md) retains the full vocabulary and
working examples. The upcoming conformance milestone classifies legacy observations
before migration: a test enforcing syntax-disjointness for every union, raw primitive
cache equality or old accessor side effects cannot be promoted as the intended rule.
Concrete-space revision, proof checking and portable functions have separate roadmap
milestones. Full IEEE identity, numeric edge policies and canonical numeric spelling
remain explicitly deferred/provisional.
