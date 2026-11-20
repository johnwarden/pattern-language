# Refinements and canonical values

## Superseding scope — 7 November 2026

This remains exploratory and is not adopted wholesale by the integrated decision
record. Type defaults and implicit normalizers remain excluded. ConstructedBy is
tabled entirely until refinement decoding is solved; no replay, witness or unchecked
insist policy is selected. Ordinary where evidence/refinements and one-boundary
projection follow LANGUAGE-DECISIONS.md. Earlier candidate spellings below do not
supersede the current contract or establish implemented behavior.


**DRAFT — NOT ACCEPTED OR IMPLEMENTED AS A WHOLE.**

This is an independent design recommendation responding to the 1 November 2026
refinement/canonical-types attachment. It does not change the current language
contract. Examples below describe proposed behavior, not executable tests today.
Declaration sugar is provisional. They use `()` packs, self-evaluating primitive
type atoms `Int` and `Float`, ordinary bound type names, quoted literal symbols,
and literal constructor-application heads.

## Accepted user clarifications and remaining proposals

The following directions were clarified by the user during review. They are
recorded here as accepted design intent, not claims about the implementation:

- Every ordinary observation and function argument requires canonical form by
  default. An explicitly `nonCanonical` argument is the opt-out. This includes
  equality, quote/unquote, pattern observation, and `count(Set)`, not just printing.
- A canonical subset can serve as the representative model of a quotient; the
  language need not expose a separate quotient mechanism or semantic equality.
- Idempotence is required but may be difficult to prove automatically.
- `A & B` for facets is another abstract facet preserving the member's concrete
  identity, not a new merged concrete space.
- Patch fields use `None` for no update and `Some(v)` for update. An option-valued
  original field uses nested options: `None` means unchanged, `Some(None)` means
  clear, and `Some(Some(v))` means set to `v`.

Everything below described as recommended, provisional, or a candidate remains a
proposal. In particular, declaration spelling, initial trust/checking policy,
portable closure encoding, and the implementation sequence still need acceptance.

## Recommended minimum

1. A refinement recognizes values without changing them or their concrete space.
2. A canonical declaration associates a base-preserving normalizer with its
   fixed-point subset. Its initial implementation normalizes eagerly at explicit
   canonical construction/interpretation boundaries.
3. Ordinary observations receive canonical trees. Later private deferred storage
   may postpone normalization until a default boundary requires it.
4. `nonCanonical` is an explicit permission to accept a deferred representation,
   supported initially by trusted declarations rather than inferred proofs.

This permits useful ratios and sets without changing ordinary structural equality
or introducing constructor lookup influenced by which types happen to be in scope.

## Values and structural identity

A concrete descriptor determines one value space. A refinement of that space
retains the descriptor and operations of its base. An abstract constraint retains
each accepted value's actual concrete descriptor.

Type values themselves are ordinary values. Their normalized public description
trees determine equality through the same tree comparison used for other values.
Compiler caches, host object addresses, generated closure IDs, source-file paths,
and declaration names do not contribute hidden identity. No comparison attempts
to prove that arbitrary predicates or normalizers compute the same function.

An explicit type constructor may normalize its output tree according to specified
structural rules. Equality does not normalize arbitrary quoted data. A cached and
an uncached interpretation of the same public tree must behave identically.

## Refinements recognize; they do not convert

The public form is provisionally `Where(B)(p)`, preserving its two application
packs. `B` is initially a concrete type or an existing refinement of a concrete
type. `p` is a function value accepting that base and producing `Bool`.

```text
NonZeroInt = Where(Int)(n -> n != 0)
PositiveInt = Where(Int)(n -> n > 0)
```

Membership first checks the base, then evaluates the predicate. `True` accepts
the unchanged value; `False` rejects it. A non-Boolean result or predicate error
is an error, not a second interpretation or an overload fallback. Termination is
not guaranteed for arbitrary user code. An implementation resource limit reports
an explicit inability to complete the check, rather than inventing a result.

For every successfully accepted `v`:

```text
concreteType(accept(Where(B)(p),v)) == concreteType(v)
accept(Where(B)(p),v) == v
```

Here `accept` and `concreteType` express specification operations; this draft does
not require exposing them as new built-ins. Ascription can interpret raw syntax
against the base and validate it, but cannot change an already interpreted value
into another concrete space without an explicit conversion.

The proposed `subType (n :: Int) -> ...` can be sugar for this construction. It
must take the domain from an explicit parameter annotation, rather than infer an
entire concrete space from an arbitrary function body. Initially disallow an
abstract domain such as `Numeric`; member-preserving refinements of abstract
domains are a coherent extension, not a mathematical impossibility.

## Portable predicate and function identity

An exportable predicate must be represented by ordinary closed data containing:

- its executable code in the specified core language;
- immutable captured values, each with a portable representation;
- called definitions and their transitive dependencies;
- finite references for recursive definitions;
- stable descriptions of primitive operations at the bootstrap boundary.

For example, predicates capturing `limit = 5` and `limit = 10` must carry different
captured values. Serializing only `n -> n < limit` is insufficient. A capture-free
predicate calling a local helper also needs that helper's definition: absence of
lexical captures alone does not establish portability.

The closing algorithm must deterministically allocate dependency/binder references
and erase local resolution names in favor of those references. Binder-index code
is a suitable candidate; the exact core representation remains a prerequisite
decision. Equality compares the resulting finite tree, including captured values
and dependency bodies. It does not prove program equivalence or graph equivalence.
Renaming source binders can produce equal closed code if the specified closing
algorithm removes those names; that is construction policy, not special equality.

```text
Where(Int)(n -> n != 0)
Where(Int)(n -> 0 != n)
```

These need not be equal type values despite accepting the same integers. Their
members retain the same `Int` concrete space, so unequal refinements do not make
their shared accepted integer values unequal.

A small pure, deterministic predicate subset is recommended for the first portable
milestone. Mutable captures, process resources, ambient environment access, and
effects should be explicitly rejected there. Captures of portable immutable values
need not be banned. Later general closures should reuse the same representation.
Portable parsing reconstructs closed code as data; it does not execute that code.
Checking membership subsequently executes the reconstructed predicate.

## Normalization and canonical subsets

Let `B` be a concrete base and `c : B -> B` an ordinary function. An explicit call
`c(v)` constructs a result. Plain refinement recognition does not transform its
input. Canonical construction/interpretation is a separate operation that applies
`c`, while canonical membership asks whether an existing public tree is a fixed
point. Forcing a private deferred canonical value implements its already selected
canonical interpretation; it does not silently convert an arbitrary raw `B` value.
Domain/range equality alone does not make `c` a canonicalizer:
`n -> n + 1` has the right shape but no stable output.

A canonicalizer must be pure, deterministic, and total on its stated valid base
domain and satisfy the following laws there:

```text
c(x) belongs to B
c(c(x)) == c(x)
```

Its canonical subset is mathematically `Where(B)(x -> c(x) == x)`. A dedicated
canonical declaration should retain `c` in its public type description so that
construction and future forcing need not rediscover it from predicate code. The
exact descriptor spelling is undecided. This subset shares `B`'s concrete identity.
Calling `c` returns a value in the subset if the laws hold. Ordinary equality
compares the resulting public trees. Pending private representations are forced
before that comparison, rather than compared by a new semantic equality rule.

Worked ratio example, with the base domain explicitly excluding zero and negative
denominators:

```text
RatioRep = type Ratio(Int,PositiveInt)
# reduceRatio(Ratio(a,b)) divides a and b by gcd(abs(a),b).
# Zero is normalized to Ratio(0,1).
ReducedRatio = Where(RatioRep)(r -> reduceRatio(r) == r)

# In RatioRep:
reduceRatio(Ratio(2,4)) == Ratio(1,2)
Ratio(2,4) != Ratio(1,2)
# ReducedRatio accepts Ratio(1,2), rejects Ratio(2,4).
```

The final two trees remain different base-space values. An ordinary ratio factory
can call `reduceRatio` explicitly before returning a validated reduced value.
Set factories can similarly sort and deduplicate their element sequence. These
factories require an explicit element ordering consistent with element equality;
generic `Set(T)` must not silently assume such an ordering exists for every `T`.

### Candidate initial trusted contract

Recommend accepting a canonical declaration as the programmer's assertion of
purity, determinism, totality, domain preservation, and idempotence. The declaration
is trusted unless checked evidence is explicitly supplied; it is not presented as
a compiler theorem. The initial eager interpreter validates ordinary input/output
types and propagates a failed call as an error, without retrying another type.

Optional development checks can compute `y = c(x)` and `z = c(y)`, check both
against `B`, and require ordinary `z == y`. A failed check reports a canonicalizer
contract violation. Tests can exercise generated inputs and known edge cases.
These checks establish neither global idempotence nor totality/purity, and may
double normalization cost. They must not run forever trying to reach a fixed point.
Proofs or a restricted verifiable core may replace trust incrementally later.
Portable declarations must retain the same closed code and trust/evidence policy
in a fresh context; reconstruction must not silently upgrade a claim to a proof.

The behavior of a program violating a trusted contract needs a final policy. The
recommended first interpreter reports detected violations, makes no universal
guarantee for undetected violations, and avoids using these claims to remove checks
outside the documented optimization boundary. It must not introduce memory unsafety.

## Fixed points represent quotient classes

For any total idempotent `c : B -> B`, define `x ~ y` iff `c(x) == c(y)`. This is
an equivalence relation, and each class has exactly one fixed-point representative.
Thus the canonical subset already represents the quotient. No additional language
feature, distinct concrete tag, or semantic equality mechanism is required.
Raw base trees remain raw values; canonical interpretation maps them to the same
representative where appropriate.

An independently intended mathematical equivalence relation can still test whether
the chosen canonicalizer models the intended abstraction:

```text
x ~ c(x)
x ~ y  iff  c(x) == c(y)
```

For ratios, the intended relation is `Ratio(a,b) ~ Ratio(d,e)` iff `a*e == d*b`, using exact arithmetic
and the stated valid-denominator domain. Idempotence alone does not establish
this intended equivalence: the identity function is idempotent but never reduces
ratios. The relation itself must be an equivalence relation on the valid domain.

This adequacy condition is a specification/test obligation for a ratio library,
not a required separate `~` declaration. A fresh concrete wrapper may be useful
when different operations or layouts are desired, but is optional and separate
from this minimum. Base-preserving canonical subsets do not acquire fresh concrete
identity merely because they represent equivalence classes.

## Intersections preserve concrete identity

For the first milestone, intersection is permitted only for refinements retaining
the same concrete base. Its meaning is conjunction of recognition tests; it never
constructs or converts a value. The smallest implementation can use one explicit
predicate with `&&`, without adding a public intersection constructor yet.

If `&` is introduced, specify its descriptor construction separately. Recommended:
flatten nested intersections, sort by public structural trees, deduplicate exact
trees, and check predicates in that resulting order. This makes `A & B` and
`B & A` construct the same ordinary tree without proving predicate equivalence.
Errors remain errors. Commutative acceptance claims concern terminating Boolean
predicates, not arbitrary effects or divergence.

As clarified by the user, an intersection of abstract facets is also abstract. It tests all requirements
against the same identified value and retains all original fields and the original
concrete type. For example, `Person & Profile` may recognize a full record having
`name`, `id`, and `bio`; it must not manufacture a merged concrete record space.

Requiring matching constructor heads is a possible early restriction, not a
mathematical requirement. Matching heads also do not prove compatibility:
`{x: Int, **} & {x: String, **}` has no inhabitant under the distinct-space field
rules. Do not require a solver to discover every empty intersection. Concrete
types with different concrete identities cannot acquire shared members merely
because their raw constructor syntax overlaps. The member-preserving facet rule
is settled design intent; descriptor normalization and accessor-collision rules
remain implementation details to specify before implementation.

## Default omission requires an optional-field raw space

Default-bearing type patterns are not included in the recommended minimum.
An explicit factory can already accept a missing argument and create a complete
value. If default omission is later accepted, define its raw space before its
normalizer. Specification-level example:

```text
RectRaw =
  type
    Rect(Float,Float) | Rect(Float,Float,color: Color)
  end
end
# omitBlack leaves a missing color missing, removes an explicit black color,
# and retains every other supplied color. Black is a quoted Color symbol.
RectCanonical = Where(RectRaw)(r -> omitBlack(r) == r)
RectRequired = type Rect(Float,Float,color: Color)
```

The two alternatives establish one raw concrete space; they are not a union of
previously established member spaces. All field-presence states are deliberate
parts of that space. `omitBlack` is an endomorphism of `RectRaw` and is idempotent.
It is not an endomorphism of `RectRequired`: removing its required field produces
a tree outside that space.

`RectCanonical` is a subtype of `RectRaw` and retains `RectRaw`'s concrete identity.
It can be incomparable with the separately established `RectRequired` space,
despite overlapping raw source shapes. This is coherent because `RectRaw` and
`RectRequired` have different concrete descriptors. It cannot simultaneously
introduce a fresh concrete identity different from its own `RectRaw` base. If the
intended parent is `RectRequired`, the subtype claim fails for omitted-field forms.

The raw values with missing color and explicit black are unequal trees. Their
normalized results are equal. A color accessor supplying black for a missing
field is a computed operation, not evidence that a physical field exists. It
must not alter exact-field matching or the structural descriptor behind the value.

Type declaration scope must not implicitly resolve constructor applications.
An explicit factory or interpretation selects the space. Adding another type
with a matching input shape must not make a previously valid expression ambiguous.
Defaults or normalizers stored in type descriptions would also need portable
closed-function representations; they cannot reside only in declaration metadata
if reconstructing the type requires their behavior.

## Missing, None, and Partial

The accepted patch convention is `None` for no update and `Some(v)` for update.
For an original `Color?` field, the patch field is `(Color?)?`:

```text
# Original field Color:
Patch(color: None)             # unchanged
Patch(color: Some(red))        # set to red
# Original field Color?:
Patch(color: None)             # unchanged
Patch(color: Some(None))       # clear
Patch(color: Some(Some(red)))  # set to red
```

An omitted patch label can therefore normalize to the same public representation
as explicit outer `None`, without losing the ability to clear an option-valued
field. Which spelling is canonical is still a proposal; omission agrees with the
attachment's preference. Missing is not inherently equal to `None` in unrelated
raw spaces: this identification belongs to the declared patch normalizer.
The source type constructor for `Option(T)` and its concrete boundaries must be
specified consistently with existing optional types; this draft adds no new
special equality for nested options.

Positional omission still needs an explicit rule: omitting a later coordinate
must not shift it into an earlier one. A proposed `Partial(T)` maps each field to
an outer option and defaults that outer option to `None`. Optional raw fields and
canonical omission avoid enumerating an exponential family of unions. Macro
spelling and the field-introspection mechanism remain later work.

## Private deferred representations: future optimization only

Private deferred storage can represent a public canonical logical value without
changing its equality or concrete identity. The user-facing `nonCanonical`
parameter annotation explicitly permits an implementation to pass that storage
without first normalizing it; it does not establish another public value space.
The optimizer must preserve the observable behavior of the eager reference
program for declarations satisfying their contracts.

**Accepted default:** force before every ordinary function argument and every
observation, including equality, hashing, ordering, pattern matching, quote,
unquote, accessors, dispatch, text, reflection, and foreign calls. `count(Set)`
therefore sees canonical elements by default. Forwarding an opted-out argument
to an ordinary parameter forces it again at that boundary. Quote/unquote cannot
leak pending raw trees through the ordinary data representation.

An implementation may always force even at an opted-out parameter; the annotation
grants permission, not a guarantee that work is skipped. A function must behave
correctly on both canonical and permitted raw representations. To make ratio
multiplication useful, its implementation needs a deliberate operation for reading
the opted-out representation without forcing. The exact spelling/scope of such
raw pattern/accessor operations is unresolved. Ordinary pattern observations
inside that body still force unless explicitly covered by that permission.

A candidate trusted opt-out contract is representation independence. For canonical
result type with normalizer `d`, implementation `fRaw`, and eager reference `f`:

```text
d(fRaw(x)) == f(c(x))
```

For ordinary scalar results, omit `d`: the results must already be equal. For
multiple arguments apply each declared input normalizer. Invariant preservation
also requires raw outputs to remain in their valid base domains. Multiplying
unreduced ratios satisfies this contract when reduction of its result gives the
eager reduced result. Returning the raw numerator as an `Int` does not. Counting
raw set elements does not, while computing unique cardinality may.

The annotation initially asserts this contract; it proves nothing automatically.
Optional tests compare raw and eager paths on generated representations. Begin
with trusted built-ins or explicitly trusted user declarations, and allow future
proofs without changing semantics. Effects, exceptions, divergence, and resource
observations need a precise policy before arbitrary effectful opt-outs can be
optimized; an initial pure, total subset avoids claiming those cases solved.
Public raw trees remain available in `RatioRep` but ordinary canonical observations
never expose them. This preserves ordinary tree equality for all public values.

## Testable acceptance laws

- Refinement acceptance preserves both value and concrete identity.
- Equal public type trees behave identically with and without compiled caches.
- Exporting a supported predicate-bearing type, reconstructing it in a fresh
  context, and exporting again preserves its tree and canonical text.
- Changing a captured constant changes the closed predicate tree; local helper
  dependencies survive reconstruction without their original lexical bindings.
- Plain refinement recognition never transforms its input. Canonical construction
  applies its selected normalizer; ordinary observations force pending canonical
  values before operating on their public trees.
- An explicitly certified canonicalizer preserves its base domain and satisfies
  idempotence on the test corpus; certification records which claims are trusted.
- Raw unequal representations remain unequal; their explicit normalized results
  can be equal. No equality operation attempts function equivalence.
- Abstract intersection preserves the original concrete descriptor and extra fields.
- Omitted-default normalization returns a member of its optional-field raw space.
- Patch outer `None` means no update; nested `Some(None)` clears an optional field.
  Missing and outer `None` normalize together only in the specified patch space.
  A normalized value round-trips with its concrete descriptor intact.
- Any later deferred implementation agrees with eager evaluation across all listed
  observations, including invalid inputs and failure behavior.

## Smallest feasible sequence

1. Specify canonical construction separately from fixed-point membership, using
   the user's accepted observation/default rules. Establish an eager reference
   implementation and trusted-idempotence policy before deferred storage.
2. Specify and implement a small portable closed-predicate core with stable
   primitive operations and fresh-context reconstruction. Reject unsupported
   captures/dependencies explicitly. Dynamic checks validate descriptor shape,
   base membership, and Boolean results; purity follows the restricted vocabulary.
3. Expose `Where(B)(p)` through ordinary public type descriptions and add refinement
   sugar if desired. Add same-base conjunction examples; optionally add structurally
   normalized intersection construction. Do not infer behavioral equivalence.
4. Add canonical declarations retaining portable normalizer code, with trusted
   laws and optional dynamic result/idempotence checks. Test the fixed-point and
   quotient-representative correspondence without a separate equality mechanism.
5. Implement member-preserving facet intersections, then consider optional-field
   descriptors, default elision, and option-based `Partial`, with representation
   and nested-option tests. Their exact declaration sugar remains provisional.
6. Specify raw access under `nonCanonical` and test representation independence.
   Add private deferred storage conservatively behind the eager reference model.
   Compiler inference of opt-out safety or proof of idempotence is later work;
   neither is required for a first trusted implementation.

## User decisions still needed

- What canonical declaration/descriptor spelling retains the normalizer while
  distinguishing canonical construction from fixed-point recognition?
- Is an eager reference implementation followed by deferred storage the desired
  implementation order?
- Should portable predicates initially use a restricted pure core, and which
  primitive operations and immutable captures belong in it?
- What structural normalization should `&` construction perform, and how should
  accessor collisions be reported for an abstract facet intersection?
- Should default omission become a type-level feature at all, rather than a
  factory convention over an explicitly described raw space?
- Is omission the canonical patch spelling for outer `None`, including nested
  option-valued fields?
- Is the proposed initial trusted canonicalizer/opt-out contract acceptable, which
  optional checks should run, and how should detected contract violations report?
- What syntax grants raw inspection of an opted-out argument while ordinary
  quote/unquote, patterns, accessors, and nested calls continue to force by default?

These remaining items are proposed decisions. Only the clarifications explicitly
listed at the start record accepted user intent. No implementation should treat
the rest of this draft as accepted or silently replace the current specification.
