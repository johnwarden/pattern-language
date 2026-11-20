# Language decisions and conformance notes

**Decision rationale and case index. Executable language contracts live in `.test` files and in unlabeled or `pattern` fences under `specs/`.**

This is the integrated decision record authorized by the author. Confirmed and retained rules are the intended contract; passages explicitly marked proposed or deferred keep that status. Named cases C01–C27 live in [tests/specification](../tests/specification) and execute through the test DSL, with assertion-level todo and legacy modifiers. Those `.test` files and executable Markdown fences are the executable specs; this document explains the decisions with focused examples and does not have to match them byte-for-byte. Expected failures record future contracts; supported assertions already pass normally. This does not claim conformance with all of the future language semantics. [TEST-SUITE.md](TEST-SUITE.md) defines the runner contract; the [roadmap](../ROADMAP.md) tracks the language work separately.

## Status and sources

The source suite (`.test` files and unlabeled or `pattern` fences) is the language
specification. This record preserves rationale and links to cases; it must not
evolve into a competing prose contract. New rules are discussed in the project
chat and proposed under `specs/` on topic branches. Once settled, write or revise
executable contracts in the spec or active `.test` files before implementation,
with adjacent explanations where needed. See [the lifecycle](../specs/README.md) and
[the specification index](../tests/specification/README.md).

- **Confirmed:** an explicit author decision or subsequent clarification.
- **Retained:** an existing contract not withdrawn by the new decisions.
- **Proposed:** exploratory syntax, recipes or reviewer policy awaiting approval.
- **Deferred:** deliberately outside the next integration; no particular solution is ratified.

| Key | Source |
| --- | --- |
| O | [Original review](https://chatgpt.com/library?file_id=libfile_69243ccbd4fc81919e6e5d44dc5fb0dd&account_id=personal) — baseline concerns and retained-contract references |
| A | [Answers](https://chatgpt.com/library?file_id=libfile_08976976c6d481918d9566d5b22c8bd6&account_id=personal) |
| K | [Kind recipes](https://chatgpt.com/library?file_id=libfile_6c2918274f288191a2dd3e44b3de23d3&account_id=personal) |
| P | [Primitive types](https://chatgpt.com/library?file_id=libfile_a0f669a38e5c81918e18445b7534e195&account_id=personal) |
| N | [Fixed-precision numbers](https://chatgpt.com/library?file_id=libfile_ea21b8d12df48191b831e95829ad1dbc&account_id=personal) |
| C | [Refinements, carveouts and constructedBy](https://chatgpt.com/library?file_id=libfile_d48279c3419c8191a88228fd9c14e9d2&account_id=personal) |
| S | [Specialization](https://chatgpt.com/library?file_id=libfile_12da41d01b748191a1d5346cfe6ba0d0&account_id=personal) |
| R | [Rest capture and spreading](https://chatgpt.com/library?file_id=libfile_a0b325976f8c8191b62dece0f273d8a2&account_id=personal) |
| I | [Interop sketch](https://chatgpt.com/library?file_id=libfile_d520e298e4e88191952e5fad68938fbb&account_id=personal) |
| AR | Author's subsequent response in this conversation |
| R1 | [Follow-up review](https://chatgpt.com/library?file_id=libfile_0f1ee920426c819190adddb95c69bcb3&account_id=personal) — reviewer recommendations, not automatically decisions |
| R2 | [Reviewer reply](https://chatgpt.com/library?file_id=libfile_ff4abc7dd604819185664bd581ab04cb&account_id=personal) — clarifications and recommendations, not automatically decisions |
| L | Author clarification on 6 November: table constructedBy; settle designation/projection as stated below; defer IEEE details; add todo to the intended test DSL |
| L7 | Author instruction on 7 November: integrate this record into the project docs and plan a small DSL-suite milestone covering these cases and cogent TypeScript migrations |
| L8 | Author instruction on 8 November: parse directly into Expression; Expression number literals are exact Rationals; get rid of the lasting syntax-tree layer. This supersedes any pending public `NumberLiteral(Float)` redesign. Distinct postfix punctuation application is a separate smaller item, not blocked on full parser migration. |
| W9 | Author clarification on 9 November, alongside #28: formatting and whitespace errors may produce syntax errors, never logic errors; raw expression/layout parsing and explicitly supported alternatives for a keyword are exceptions. |
| L9 | Author rulings on 9 November 2026 for PR #31 (settled 14:17 Madrid, refined 14:34 and 14:59): Strings are intrinsic primitives. Every symbol prints bare in value text, including `None`; `:` is needed only in code where a bare name would bind. Value text is read with the expected type's own grammar, with no layout-keyword quoting. Primitive names are `ReservedSymbol` values, not symbols, and type descriptions use them directly. A quoted primitive name such as `:Int` in program source is an error, including application heads and type declarations; parsing Code and decoding value text have no special check for it. `Number` is removed for now. |
| L10 | Author ruling on 9 November 2026 (15:02 Madrid): master's Boolean behavior is correct. Literal `True`/`False` are `Bool` values, the same type as computed comparison results, not `ReservedSymbol` values. Refined 15:11: match arms use bare `True`/`False`; a quoted primitive in any pattern stays `E_QUOTED_PRIMITIVE`. |
| L11 | Author's subsequent clarification on 9 November: `True(1)`, `1(1)` and similar applications remain valid parsed Code. A head must be a Symbol constructor head or evaluate to a function; invalid head values fail during evaluation, not grammar recognition. The executable contract is application-heads.test and its adjacent note. The grammar-rejection proposal in #49 is superseded. |
| L12 | Author's subsequent clarification on 9 November: a named function resolves to a function value containing the full implementation, with no free user variables; primitive and possibly prelude/standard-library names form the remaining callable vocabulary. An interim permission for bare raw runtime Expressions is superseded by D03 / [type-values](../specs/type-values.md). `toString(T)` follows its already documented type-directed contract. See the linked approved/implemented records below. |

The working spellings are `type Name struct P` and `type Name pattern P`, with
refinements written as `T .where p` inside either form. Angle-parameter sugar and
some rest notation remain provisional where the attachments offered alternatives.
Examples do not ratify those lexical details by repetition.

## Current decision specification

### D01. Preserve the structural application model — retained

An application has one head and one argument pack. `f(a)(b)` differs from `f(a,b)`; bare `f` differs from `f()`. Empty and multiple results are packs, not implicit unit/tuple values. Ordinary partial application consumes complete packs. Accepted infix chains retain equal precedence and right associativity; parentheses may be omitted only for repeated associative operators (`+`, `*`, `|`, `&&`/`and`, `||`/`or`) ([arithmetic-grouping](../specs/arithmetic-grouping.md)). Type-parameter notation must not flatten runtime packs. Reason: these are the common structural rules; none of the new proposals withdraws them. **Sources:** O, A, S.

Formatting and whitespace mistakes must produce syntax errors rather than logic
errors within a form fixed by the applied grammar. They must not silently select
a different scope, call, fixity, clause or comment interpretation. Raw parsing
without an applied grammar may retain different expression/layout trees, and a
grammar may explicitly admit both forms of a keyword. These exceptions do not
justify silently repairing malformed use of one form. Explicit aligned `end`s
and the call/operator spacing constraints follow from this rule. `#` is always a
comment rather than a whitespace-selected postfix operator.
[WHITESPACE.md](WHITESPACE.md) records the examples and remaining bootstrap review
boundaries. **Source:** W9.

### D02. Primitive values and syntax are distinct levels — confirmed direction; lexical details proposed

Values stay distinct from the expressions that evaluate to them. Distinct source
expressions may compute the same value; source quotation/printing and value
inspection keep those roles separate. Primitive values have intrinsic concrete
interpretations: ordinary strings are String, booleans are Bool, numeric literals
are Rational, ordinary quoted symbols have their intrinsic symbol classes, and
primitive names are `ReservedSymbol` values (D20).

P proposes self-evaluating `PrimitiveType`, including `Bool :: PrimitiveType` and `PrimitiveType :: PrimitiveType`, with `Type` no longer a reserved primitive atom. This vocabulary is recorded as the proposed primitive representation, not a completed metatype specification. Int/Float families are intended to be definable fixed-precision types rather than primitive numeric atoms.

A proposes rejecting redundant `:5` and quoted primitive atoms in Code while
permitting their raw syntax in the Expression parsing domain. For primitive
names the direction is now D20's future `QuotedSymbol`; `:5` remains the C27
candidate. Ordinary symbolic quotation, raw colon quotation, explicit typed
interpolation and separation of quotation from execution otherwise remain
unchanged. **Sources:** A “Descriptions/Equality/Identity,” P “Reserved
Symbols,” AR; R2; L9.

### D03. Constructor expressions need a concrete interpretation; parse into Expression

L12's interim permission for bare raw runtime Expressions is superseded by the
requirement for concrete interpretation in
[type-values](../specs/type-values.md#designation-and-matching). A constructor
expression or symbol tag such as `Rect(2, 2)` or `:None` requires a concrete
interpretation from its context or an explicit ascription. Interpreted fields
follow the concrete type. Ordinary binding does not implicitly unwrap that
concrete boundary. See
[Migration and remaining work](../specs/type-values.md#migration-and-remaining-work)
and the deprecated [raw-expression note](../specs/raw-expression-values.md).

The parser destination is Expression. Number literals in that domain are exact Rationals (D04). The bootstrap currently has three trees: host `Syntax` (parser product, including quote/sequence/block/form), runtime `Value` (`term` ≈ `apply`, plus packs/literals/symbols), and public `SyntaxNode` transport (`NumberLiteral(Rational) | Apply | Postfix | …`, via `syntaxTree` / `syntaxExpression` / `parseSyntax`). Exact numeric syntax transport is implemented. Those Syntax layers are adapters to remove after staged consumer migration with behavior preserved. The migration is not implemented yet and is not a prerequisite for distinct postfix application.

Requiring concrete interpretation does not make an Expression-typed descriptor
equal the type it describes or choose the public descriptor-decoding API. R2's
recommendation to require explicit decoding remains a recommendation. There is no
pending public `NumberLiteral(Float)` A/B redesign. **Sources:** A “Require
Annotation…,” P “Raw Expressions…,” AR “Expression”; R2; L8; L12 interim
permission superseded by type-values.

### D04. All numeric literals denote exact Rational values — confirmed

Decimal, hexadecimal and binary spellings denote exact values. `0f` first selects the Float64-rounded value and denotes that value **as an exact Rational**, not as a Float64-typed value. Consequently `0f0.5` equals Rational 1/2 and can be designated into Decimal32. A stored result of `float64(...)`, by contrast, already has Float64 identity.

Explicit converters such as `float32` and `float64` return their fixed-precision typed values. Exact designation must not silently round: `0.1 :: Float32` fails, whereas an explicit converter may round. Finite fixed-precision types are concrete carveouts of representable Rational values with their own operations. Cross-space operations/conversions must be explicit; base arithmetic is not inherited merely because a Rational representation exists.

Default short type names, the Number union's exact membership, complete format families and fixed-format rounding and overflow policies remain separate decisions. [Rational literals](../specs/rational-literals-and-text.md) give every exact Rational a source spelling, including `(1/3)` for one third. [Canonical text](../specs/rational-canonical-text.md) selects the shortest exact spelling across the numeric families. Exact Rational literals belong on Expression; there is no pending public `SyntaxNode` `NumberLiteral(Float)` A/B redesign (L8). **Sources:** P, N, K “Refinement Type vs Carveouts,” AR “0f” and “Rationals and IEEE Floats”; L8.

### D05. Structural descriptor identity remains the rule — confirmed/retained

Equal normalized structural descriptors denote equal types, independently of declaration names and positional capture names. Physical field labels and nested type boundaries remain structural. Adding an alternative changes a concrete descriptor and therefore its concrete space. Two equal-looking payloads in different concrete spaces are not directly comparable as though the spaces were identical.

This is **descriptor equality**, not proof of extensional equality of arbitrary predicates. The author accepted that correction. Functions/predicates eventually need portable representations; no new host-identity exception is approved. Canonical same-value/same-type printing and parse/print round trips remain goals. **Sources:** A “Structurally equal types…,” AR agreement on extension versus descriptor identity; O.

### D06. Concrete, refinement and abstract interpretations have different effects — confirmed direction

- `struct` establishes one structural concrete space; alternatives and predicate carveouts are recipes for it.
- `T .where p` restricts an existing space while preserving its identity and operations (under `pattern` as an abstract refinement; under `struct` as a concrete carveout).
- `pattern` preserves each accepted value's actual concrete identity; unions and open facets are recipes for it. Concrete structures may themselves contain abstract-typed fields.

Facet combinations require both constraints while preserving the member, not constructing a merged record. The author's documents call these products; R1/R2 recommend the term **intersection**, but that terminology has not been separately ratified. Likewise **abstract** versus **polymorphic** remains a naming choice; the recommendations favor abstract for the type category and polymorphic for functions.

The author proposed disallowing a written singleton union such as `pattern String`. Normalization to the sole member was a reviewer suggestion, **not accepted policy**. How an abstract form behaves when constraints leave one admitted member remains open. **Sources:** A “Kinds…,” K, S; AR singleton question; R1/R2.

### D07. General abstract unions are separate from unambiguous grammars — confirmed direction

An abstract union may admit distinct concrete spaces with overlapping source spellings. This removes the old blanket syntax-disjointness requirement. Typed members retain their actual spaces; general typed text must carry enough reconstruction information where the spelling does not select a unique member.

A DSL can separately require an **unambiguous** grammar with no concrete-type reconstruction annotations in its value text. This requirement concerns the complete interpretation, including nested abstract fields and facets. It must not create another concrete value space merely by certifying the grammar. The qualifier's spelling, certification protocol and supported proof subset remain proposals. **Sources:** A “Disjoint Source Syntax / Unambiguous Grammars,” P union proposal; AR.

### D08. Named declarations install accessors; ordinary type construction does not — confirmed direction

The proposed `type Name ...` declaration binds the type and registers its local accessor/printing metadata. Ordinary type-valued expressions must be capture-free; `t = struct Rect(w :: Float32, h :: Float32)` must not quietly install methods. Capture-free type values remain ordinary values and can be passed, stored and compared. Parameterized declarations can supply compact local names for instantiated type descriptions without changing identity.

The author accepted that functional equality alone does not justify a permanent ban on all duplicate declaration names for equal descriptors. **On 9 November the author deferred the replacement policy and explicitly retained equivalent-declaration and accessor-collision errors for now.** Preserve that guard while separating declaration effects from ordinary type construction. No final alias/import/preferred-name policy is selected. **Sources:** A “Local Accessors,” AR acknowledgment; R1/R2; subsequent author clarification.

### D09. Designation and projection are settled, different operations — confirmed

Designation into an expected concrete type first preserves an explicit immediate
member. Otherwise a matching arm at the current boundary takes precedence over
recursive inward designation. If none matches directly, one justified inward
path may establish the required interpretations. Predicate constraints require
evidence; fields cannot be invented and numbers cannot be rounded implicitly.
There is no source-order priority among peer alternatives.

The author's 9 November clarification distinguishes outer and inner absence:
`(outer :: Float??) = :None` selects the outer arm, just like
`outer = :None :: Float??`; `(inner :: Float??) = :None :: Float?` identifies the
inner member. A union of peers `String? | Float?` needs an explicit member such
as `:None :: String?`. The definition `type T? struct T | :None` is a source
convention, not a built-in optional rule. See [POSTFIX.md](POSTFIX.md) for the
source prelude, punctuation inventory and deferred lifting semantics.

Projection crosses **exactly one explicitly requested concrete boundary**. It is performed by explicit match-based extraction, not by an ordinary typed binding or by function dispatch. Repeated boundaries require repeated explicit projections. An unannotated capture preserves the value rather than stripping wrappers. Single-arm extraction must be guaranteed over its admitted input domain; otherwise a multi-arm match or additional evidence is required.

These are settled rules, **not remaining design blockers**. Wording and checking rules must faithfully implement uniqueness, evidence and single-arm coverage; no new alternative policy is requested. **Sources:** A “Binding, Contextual Type Inference,” AR projection clarification; L.

### D10. where constraints need evidence; refinement-qualified functions are allowed — retained/clarified

Explicit successful checks, assertions, proven facts and specified result guarantees can supply evidence about the exact value and predicate environment. Missing evidence is a checking failure, not proof of nonmembership. A sole function over a refinement is allowed and callable with sufficient evidence.

The no-predicate-dispatch boundary rejects selecting between overlapping base/refinement implementations by running predicates. A base-domain overload and its refinement overload overlap; without an accepted specificity rule, they are rejected/ambiguous rather than prioritized. Unrelated concrete domains can coexist. No unchecked ordinary `insist`, predicate-based fallback or new static specificity rule is approved. **Sources:** O retained overload rule; C “where”; AR question and evidence clarification; R2 explanation.

### D11. Explicit factories and binding-only defaults remain in force — retained

No subsequent decision reinstates defaults in type descriptions. Binding defaults supply missing local captures without adding fields to the input. Types describe complete values and reject defaults. Ordinary factories can use defaulted parameters and explicitly return complete values. Required type fields remain required during designation, membership and parsing. **Sources:** O baseline, especially “Necessary asymmetries”; no superseding change in A–AR.

### D12. Generics remain type-valued; family facets are a proposal — partly confirmed, partly proposed

Type values are ordinary values; parameterized type factories produce structural type values. The author proposes angle parameters whose declaration-site `<T>` binds a type parameter without writing `<T :: Type>` every time. These examples use that spelling provisionally. Constraints such as `MemberOf<Number>` are proposed for concrete parameters; their exact admissible members and metatype remain unsettled.

The intended bare-family view, such as using `Rectangle` to admit some `Rectangle<N>`, is a proposal. Its structural membership and parameter recovery must not be claimed solved. Phantom/non-injective parameters cannot generally be recovered from a descriptor. The reviewer recommendation to make this existential, structural membership rather than declaration provenance has not itself completed the design. K also contains incompatible broad statements about abstract types inside patterns; its individual recipes are not all ratified restrictions. **Sources:** A type parameters, K “Generics / Type Constructors,” S; R1/R2.

### D13. Specialization is only a later compiler optimization — confirmed and deferred

It must preserve abstract-call behavior, dispatch and errors; it must not create source-visible overloads or make otherwise invalid definitions valid only at known call sites. The exploratory overload-expansion account in S is superseded by AR. First-class overload-set values remain a separate **unaccepted proposal**; returning a defined function name as `OverloadedFunction(...)` is not approved by accepting specialization. **Sources:** S; AR “only a compiler optimization”; R1/R2.

L12 separately approves ordinary named-function values: a name resolves to the
full closed implementation, without free user variables. It may be bound,
passed, returned and supplied directly to `where`. Primitive callable references
are the baseline; the exact admissible prelude/standard-library vocabulary and
the rule for a name with multiple definitions remain unspecified. This decision
does not depend on specialization. See
[the approved record and partial contracts](../specs/named-function-values.md).

### D14. Interoperability follows structural descriptors — confirmed intent

Independently scoped declarations with equivalent capture-free descriptions exchange equal values without a shared nominal declaration or importing accessor names. Consumers may destructure their known shapes. This does not yet specify source modules, simultaneous imports or duplicate local accessor policy. **Sources:** I; A structural identity; O.

### D15. Repetition dimensions are consistent; broader rest features remain proposals

The horizontal/vertical capture contract is retained: one repeated dimension contributes one list layer to the aggregate capture. A horizontal rest alone has `T*`; horizontal rest repeated over rows has `T**`. The author corrected the specialization Matrix example's `N*` to the two-dimensional rule. Zero rows, one empty row and a flat empty pack remain distinct.

The single-template mirrored row-spreading slice is exercised by [vertical-values.test](../tests/spreading/vertical-values.test), alongside C20. Broader row templates and R's keyword remainder represented by an actual typed record remain **intended proposals, not implemented guarantees**. Postfix `...` is preferred; prefix keyword-rest/spread `**rest` / `**(x)` / `**rest: {**}`, its exact grammar, dynamic typing policy and keyword spreading details remain provisional. Specialization may optimize a known remainder shape but is not its semantic justification. **Sources:** O dimension contract; R; AR Matrix correction; R1.

### D16. constructedBy is tabled entirely — deferred by latest decision

The motivating intent was explicit constructor calls granting guarantees without automatically retesting an arbitrary property, usable with refinement or concrete construction. The discussion distinguished static evidence, output-image membership and original call provenance. It did **not** ratify one final semantic model.

The author has now tabled the feature until decoding values of constructedBy refinement types can be solved. Do not implement constructor replay, fixed-point checks, retained witnesses, `insist`, or a chosen image/provenance semantics as part of this agreement. Different witnesses for equal outputs also cannot be assumed to provide canonical value text. Ordinary `where` refinements remain available. **Sources:** C, N, AR, R2; superseding L.

### D17. IEEE special-value details are deferred

AR proposes a concrete union of NaN/infinities and finite Rational carveouts when Rational itself is not their superset. This is a possible representation, not a settled specification. Signed zero, NaN equality/payloads, exact special-value vocabulary and finite-only versus IEEE-complete scope may remain unsettled for now. Do not ratify the reviewer's finite-only or reflexive-NaN recommendations. **Sources:** P, N, AR; L.

## D18. Test assertions and migration contracts

Files contain ordinary test blocks with shared setup. Assertions may use expect,
assert, `fails` and single-value `is` forms. Todo can also modify a whole test;
ordinary and `todo test` blocks may share a file. Legacy modifies assertions/setup,
not whole tests. Plain and legacy assertions must pass. Legacy identifies a current
compatibility contract to be explicitly retired as the roadmap advances. Todo
assertions execute and are required to fail; their failures emit no diagnostics.
A success fails the suite: “This assertion now passes; remove todo.” Pending is not
a syntax modifier or skipped-test state. The term inert retains its capability/value
meaning and does not describe a test outcome.

Each assertion has its own evaluation scope. Language errors belonging to a todo
check count as expected failures; shared setup/fixture errors, malformed source and
host exceptions fail normally. All assertions are attempted, including those after
an ordinary check failure. No assertion installs definitions or grants proof facts
for another assertion. The static evidence checker is future work, independent of
the host test DSL. Expected values are data; their exact observed types, canonical
spelling and complete pack boundaries are checked rather than only their payloads.

Named cases C01–C27 are the executable specs in [tests/specification](../tests/specification).
The examples below explain each decision; they are not complete tests and need not
match those files byte-for-byte. Supported assertions already pass as ordinary
checks, retained bootstrap observations are legacy, and unfinished contracts carry
todo. In particular Widget already has UpperCamelSymbol, so that expectation is not
todo. Numeric cases assume the proposed exact Rational model and finite numeric
vocabulary only as future contracts. The author's specification-first priority
makes the `struct` / `pattern` declaration forms and simple C05/C12/C18 parameterized
forms explicit implementation targets. Other provisional qualifiers, generic
constraints and policies do not become approved merely because a failing assertion
mentions them. C27 remains an exploratory lexical candidate. Each executable
subject repeats any needed future setup in an isolated scope; unavailable future
types are not installed in shared setup merely to allow an assertion to be recorded.

### C01 — intrinsic primitive values

Confirmed direction; the PrimitiveType spelling/self-description is P's proposed vocabulary.
Live: `"hello" :: String`, `True :: Bool`, `Int :: ReservedSymbol`, `5 :: Rational`,
`:Widget :: UpperCamelSymbol`. Legacy still treats `type Bool` as Type. Todo:
`Bool :: PrimitiveType` and `PrimitiveType :: PrimitiveType`.

### C02 — exact literals, including Float64-rounded Rational literals

Live. `0.1` and `0f0.5` are Rational; `0f0.1` is the Float64-rounded Rational
`0x1.999999999999Ap-4`, distinct from `0.1`. Hex/binary `0xFp8 == 0b1111p8`.
No halfway, overflow or nonfinite behavior is specified by this case.

### C03 — exact designation and explicit typed conversion

Live: `0.5 :: Float32` and `float32(0.5)` succeed; `0.1 :: Float32` errors because
it is not exactly representable; `.matches Float32` is True for `0.5` and False
for `0.1`. Todo: `0f0.5 :: Decimal32`, `0f0.1 :: Float64`, and `0.5 :: Int16`.

### C04 — concrete interpretation for constructor expressions

A constructor expression or symbol tag needs a concrete interpretation from its
context or an explicit ascription; bare raw runtime construction is superseded.
The explicit `type Rectangle struct ...` spelling remains todo. Bootstrap
declaration syntax already supplies the concrete designation and explicit-match
controls in
[raw-expressions.test](../tests/specification/raw-expressions.test); ordinary
constructor binding through the concrete boundary remains a todo rejection.

### C05 — ordinary capture-free type values and a type factory

Live (non-generic): a named concrete declaration equals its capture-free plain
construction under today's bootstrap `concrete` spelling in
[type-values.test](../tests/specification/type-values.test). Destination spelling
under #88 is `type Rectangle struct Rect(w :: Rational, h :: Rational)` equals
`struct Rect(Rational, Rational)`. Todo: parameterized `Box<String>` equals
`struct Box(String)`, and an explicit match opens
`Box("hello") :: Box<String>` to obtain `"hello"`. An ordinary constructor binding
does not open that concrete boundary.
This does not compare an Expression-typed descriptor with a type, or decide bare-family membership.

### C06 — alternative sets determine concrete identity

Live: `:Red :: PrimaryColor` and `:Red :: TicketStatus` are incomparable concrete
spaces even though the source spelling `:Red` overlaps
([type-values.test](../tests/specification/type-values.test)). Destination
declarations use `struct` under #88.

### C07 — where evidence preserves identity and permits a sole refined function

Todo. After `nonZero(0.5)` succeeds, `(n :: NonZero) = 0.5` keeps the same value:
`n == x`, and `keep(n)` returns `0.5 :: NonZero`. The expectation retains the
NonZero qualification; refinement adds no new concrete space beyond Rational.
This case does not choose how a REPL distinguishes displayed guarantees from
concrete identity, or require refinements to print only their base type.

### C08 — isolated assertions grant no evidence to another subject

The static evidence model remains future work. The unchecked function has no
assertion establishing its required refinement; a separate test assertion cannot
grant it a fact. Todo: `unchecked(1)` errors because refinement evidence is missing
inside `unchecked`.

### C09 — overlapping base/refinement overloads do not gain priority

Todo. `def choose(x :: Rational)` together with `def choose(x :: NonZero)` is
rejected: overlapping base and refinement overload domains. No predicate-dispatch
priority.

### C10 — unrelated overload domains and explicit branch evidence

Todo. `choose` on `NonZero` versus `String` can coexist. `checked(x :: Rational)`
must branch on `nonZero(x)` before calling `choose`; `checked(1)` is `"number"`,
`checked(0)` is `"zero"`, `choose("hello")` is `"string"`. The conditional
explicitly checks the predicate; overload selection does not run it speculatively.

### C11 — explicit projection crosses one boundary only

Todo. `Wrapped` over `Small` over `Rational` needs two explicit matches:

```text
match w (s :: Small)
match s (r :: Rational)
r    # 0 :: Rational
```

Ordinary binding `(direct :: Rational) = w`, a match that skips Small, and
`consume(w)` for `def consume(x :: Rational)` must not unwrap Wrapped.

### C12 — recursive designation, nested absence and guaranteed extraction

Unique designation `(outer :: Option<Option<String>>) = "Hello"` is allowed
for a source-defined unwrapped `struct T | :None`. Bare `:None` chooses a direct
outer arm; an inner annotation preserves inner absence. Peer branches remain
ambiguous without explicit member evidence. These bootstrap cases are active in
`tests/bindings/nested-option-designation.test` and
`tests/specification/concrete-unions.test`.

Guaranteed extraction remains future checking work: a single-arm consumer of an
optional String needs coverage evidence or an explicit absence arm. C18 separately
uses a tagged `:None | Some(T)` representation, which is a different convention.

### C13 — a general union admits overlapping spellings

Live under bootstrap `abstract` spelling in
[interpretations.test](../tests/specification/interpretations.test). Destination
spelling under #88 is `type EitherFloat pattern Float32 | Float64`. Each member's
concrete identity is retained: `float32(0.5)` stays Float32, `float64(0.5)` stays
Float64. `parse(EitherFloat)(toString(EitherFloat)(a)) == a` reconstructs
Float32. The text must retain enough information; no exact descriptor spelling is
approved here.

### C14 — unambiguous grammar requirements are separate

The qualifier spelling and certification diagnostics are provisional. Todo:
`type Token unambiguous pattern Rational | String` can round-trip `0.5`;
`type Bad unambiguous pattern Float32 | Float64` errors because the same numeric
spelling admits more than one interpretation. C13 remains legal without the
additional requirement.

### C15 — facets and their intersection preserve the complete member

The `pattern A & B` spelling records the proposed facet-combination recipe. Todo:
a `Card` value viewed as `ColoredRectangle` (`Rectangular & Colored`) remains the
same Card, including fields neither facet names. Intersection preserves the
complete member, not a merged record.

### C16 — accessor installation belongs to a declaration

Live under bootstrap `concrete` spelling in
[declarations.test](../tests/specification/declarations.test): `r.w` works after
a named declaration; plain construction cannot declare captures/accessors.
Destination spelling under #88 is `type Rectangle struct …` /
`t = struct Rect(…)`. No case assumes that two equal local declarations are
either permitted or forbidden; that policy is still pending.

### C17 — ordinary factories keep defaults out of types

Todo. A factory `rectangle(w, h, color: String = "black")` may default `color`;
`Rect(2, 3) :: Rectangle` still errors if required `color` is absent;
`type Invalid struct Rect(color: String = "black")` is forbidden.

### C18 — independent scopes interoperate structurally

Todo. Isolated blocks can declare `Option` and `Optional` with equivalent
`:None | Some(T)` descriptors; `Some("hello")` values compare equal. A third
local type can `match`/`read` the producer value without importing its accessor
bundle. These are isolated lexical blocks, not a new source-module syntax.

### C19 — horizontal captures retain positional-only list semantics

Live: `copy()` is `[] :: Float32*` and `copy(0.5)` is `[0.5] :: Float32*`.
Todo: `Packet(first, rest... :: Float32*, color: c, **)` collects only remaining
positions into `rest`; labels such as `color` are not consumed by the positional
capture. Independent `...`/`**` openness retains the original pack/constructed distinction.

### C20 — horizontal plus vertical capture/spread has two dimensions

Capture dimensions and single-template mirrored reconstruction are covered by
[focused source cases](../tests/spreading/vertical-values.test). C20's first
reconstruction assertion is ordinary coverage; its three larger scenario todos
also require evaluated-Code assert, which remains unsupported in this slice.
`cells... :: Float32**` over repeated rows is `[[0.5, 1], [2, 4]]`, not
`Float32*`. Spreading those rows rebuilds the same Matrix. Zero rows `[]` differ
from one empty row `[()]`. The annotation describes the aggregate capture. Row
widths need not be equal without a separate constraint.

### C21 — vertical repetition alone adds one list layer

Todo. A vertically repeated `todos :: String*` field is `["first", "second"] :: String*`,
one list layer, not a nested matrix.

### C22 — keyword remainder is a typed record

**Proposal, not an implemented or fully spelled feature.** The `rest**: {**}`
capture syntax follows R's sketch and still needs grammar approval. Todo sketch:
destructuring `{name, id, rest**: {**}}` from a Person view of a PersonRecord
yields `{age: 48}` at the remaining record type. This corrects R's inconsistent
id-width example. It makes no claim that specialization is required to give
`rest` a descriptor or that its shape is always statically known. Keyword spread
spelling is not settled by this capture example.

### C23 — canonical typed text remains a value round trip

Todo. `parse(Rectangle)(toString(Rectangle)(r)) == r` and the printed text is
stable. This does not choose a constructedBy decoder or a raw Expression/type
equality policy.

### C24 — whole-pack application and result consumption remain intact

Todo. `combine("a", "b")` is a partial waiting for `(z)`; `partial("c")` unpacks
to `"a"`, `"b"`, `"c"`. `x = ("a", "b")` cannot feed one capture from two
positional results. Empty `()` remains an empty pack.

### C25 — equal precedence and right associativity are preserved

**Implemented with associative-repetition grouping.**  
`(2 :: Float64) * ((3 :: Float64) + (4 :: Float64))` denotes `2 * (3 + 4)`
and is `14 :: Float64`. `("left" .select "right")` is `"right"`. Only repeated
`+`, `*`, `|`, `&&`/`and`, or `||`/`or` may omit parentheses.

### C26 — todo assertions execute without leaking local state

**Implemented assertion-level policy.** Unknown future operands are attempted, and
failed subjects cannot change the surrounding case scope. `marker = 1` stays 1
after a todo that binds `marker = 2` and `def futureLocal()`; later
`futureLocal()` is unbound. Discovery reads source only. Todo does not hide setup
or harness errors. C08 independently records the future evidence requirement.

### C27 — candidate lexical prohibition on redundant primitive quotation

**Exploratory expectation only, awaiting the author's lexical choice.** It must
not be integrated as a confirmed decision. Todo candidates: `:5` and `:Bool` are
not Code forms. No corresponding expected result is assigned for raw Expression
computation, which may be omitted entirely. D20 records the settled direction
for quoted primitive names.

### D19. Symbol value text is unquoted; colon quotation is a code form — confirmed 9 November 2026

Every symbol prints bare in value text, with no special cases:
`toString(Color)(:Black)` is `"Black"` and `None` in `String?` prints `None`.
Code keeps `:` where a bare name would bind: `a = :None :: Int?`,
`Type(:None | String)`, `toString(Expression)(:foo)`. Value text is read with the
expected type's grammar, so `test` or `expect` are keywords only where that
grammar makes them so. Union `::` tags still follow D07: `None` in `Float??`
prints `None`, while the inner member prints `None :: Type(Float | :None)`.
**Sources:** L9.

### D20. Primitive names are ReservedSymbol values — confirmed 9 November 2026

Primitive names are values of the primitive type `ReservedSymbol`, which is
disjoint from the ordinary symbol classes:

```text
expect Int is Int :: ReservedSymbol
assert (type Int) == Int
assert (Int .matches UpperCamelSymbol) == False
```

The type description of `type Int` is the reserved symbol itself, not `:Int`.
`Symbol` is not reserved; the prelude defines it as the union of the four ordinary classes.
Prelude `not : Bool -> Bool` is the ordinary function `def not(x :: Bool) x == False`.

`True` and `False` are reserved names but not `ReservedSymbol` values. They are
`Bool` values, the same type as computed comparison results (L10):

```text
expect True is True :: Bool
expect (1 == 2) == False is True :: Bool
expect True .matches ReservedSymbol is False :: Bool
```

Match arms use the bare names; `:True ->` is `E_QUOTED_PRIMITIVE`:

```text
match 1 == 1
  True -> "yes"
  False -> "no"
end
# "yes" :: String
```

A quoted primitive name in program source is an error, including application
heads and type declarations, which write the bare reserved name instead. Parsing
Code and decoding value text have no special check for it:

```text
expect :Int fails "E_QUOTED_PRIMITIVE"
expect :True fails "E_QUOTED_PRIMITIVE"
expect Int == :Int fails "E_QUOTED_PRIMITIVE"
expect type :String(:A) fails "E_QUOTED_PRIMITIVE"
assert (type String(:A)) == Type(Apply(Literal(String), Fields(:A)))
expect :(Int) is Int :: Expression
expect parse(Code)(":Int") is :Int :: Code
```

Once the Code grammar defines `QuotedSymbol` (Symbols only),
`parse(Code)(":Foo")` is `:Foo :: QuotedSymbol` and `parse(Code)(":Int")` is
rejected. These are todo checks today. `Number` is removed for now.
**Sources:** L9, L10.

## Remaining and deferred items

| Item | Precise status |
| --- | --- |
| constructedBy, its evidence semantics and decoding | **Tabled entirely.** Preserve motivation; do not select a replay/image/provenance model or add conformance results now. |
| IEEE NaN/infinities, signed zero and special equality | **Deferred.** AR's union recipe is a possibility, not a chosen representation. |
| Designation/projection | **Settled.** Only faithful wording/checking and eventual tests remain; no renewed policy debate is requested. |
| Bare generic-family facets, MemberOf and parameter recovery | **Proposed.** Constraint vocabulary, structural matching and non-injective cases remain unresolved. |
| Duplicate local type names, accessor bundles/imports and preferred display names | **Deferred policy; current errors retained.** Equivalent declarations and accessor collisions remain errors for now. No final alias/import policy is selected. |
| Singleton abstract unions and qualifiers narrowed to one member | **Unresolved.** Author proposed rejecting explicit singleton unions; normalization is only a reviewer recommendation. |
| Runtime Expression *value* computation and descriptor/value comparison | **Concrete interpretation required (D03 / type-values); L12 interim bare-raw permission superseded.** Descriptor decoding/equality is separate and remains unsettled. Syntax/`SyntaxNode` cleanup follows staged consumer migration. |
| Public `NumberLiteral(Float)` redesign | **Superseded.** Do not choose an A/B SyntaxNode numeric encoding; literals on Expression are exact Rationals. |
| Specialization | **Deferred optimization only.** No source-visible generated overload semantics. |
| Named functions and first-class overload sets | **Named function values approved (L12).** Full closed implementation, with no free user variables. A new overload-set representation and multiple-definition resolution remain unspecified. |
| Numeric aliases/families, rounding edge policies and canonical spelling | **Provisional.** Do not infer these from isolated draft typos or examples. |
| Predicate/source portability, general canonicalization and unchecked insist | **Not solved here.** No new exemption from structural identity or serialization goals; no approved unchecked escape. |
| Exact type/generic/facet/unambiguous/rest syntax and terminology | **Provisional.** Examples adopt review spellings without making every spelling a decision. |
| Test DSL modifiers | Implemented assertion-level todo/legacy and whole-test todo execution/reporting; see TEST-SUITE.md. Future language semantics remain separate work. |
| Postfix vs prefix punctuation application | **Decided.** Tight `~ ! @ $ % ^ & * ?` are distinct postfix constructions. `#` is a comment, not a postfix operator (`x#` and `x #` are both `x`). Definitions supply meaning; optional `?` is a source-prelude convention. Explicit member evidence distinguishes inner absence; raw None selects a direct outer arm. Prefix and postfix operators must touch their operand (`T * *`, `* *x`, and `- (x)` are errors; `1 * *x`, `-(x)`, `-x`, and `1 - (x)` parse). Prefix `-(a)` negates; infix `-(a)(b)` subtracts. Lifting remains future work. See [POSTFIX.md](POSTFIX.md). |

Obvious draft slips are normalized only to express the intended rules: String/sqrt examples meant an integer type; inconsistent normalizer names refer to one function; the Float union's self-reference is not a proposed recursive numeric member; mismatched id widths and Matrix dimensions are corrected explicitly. No semantic decision is extracted from those slips.

## Decision-to-case index

| Decision | Named cases / coverage |
| --- | --- |
| D01 application, packs, precedence | C24, C25; runtime packs remain distinct from generic parameters in C05 |
| D02 primitives and quotation | C01; C27 is an **unaccepted lexical candidate**, not confirmed behavior |
| D19 symbol value text vs code quotation | C01 `Widget`; `None` in the postfix, nested-option and concrete-union specs |
| D20 ReservedSymbol and quoted primitive names | C01; quoted primitive names in Code, including QuotedSymbol todos; symbol-class disjointness |
| D03 concrete interpretation / parse into Expression | C04 and raw-expressions.test; bare raw construction superseded; explicit concrete boundaries remain; SyntaxNode numeric A/B superseded |
| D04 numeric meaning and conversion | C02, C03; C11 verifies explicit Rational projection; IEEE details deliberately unassigned |
| D05 structural identity | C05, C06, C18, C23 |
| D06 struct / `.where` / pattern kinds | C06, C07, C13, C15; singleton policy deliberately unassigned |
| D07 general unions versus unambiguous grammars | C13, C14; qualifier spelling remains provisional |
| D08 declaration-only accessors | C05, C16; duplicate-name/import outcomes deliberately unassigned |
| D09 recursive designation / one-boundary projection | C03, C11, C12, C17 |
| D10 evidence and refinement-qualified functions | C07–C10; C08 depends on the future static evidence checker |
| D11 factories and binding-only defaults | C17 |
| D12 type-valued generics / proposed family views | C05, C12, C18; no case pretends family recovery or MemberOf is settled |
| D13 specialization and named function values | named-function-values.test captures approved binding/argument/return/predicate uses; closed representation and overload selection remain work. C09/C10/C12 stay independent of specialization |
| D14 structural interoperability | C18, with transport law in C23 |
| D15 captures/spreading/keyword remainders | C19–C22; new spread/rest surface mechanics explicitly proposed |
| D16 constructedBy deferral | No active or pending expected-result case selects a semantics |
| D17 IEEE deferral | No expected result selects NaN/signed-zero/special-value policies |
| D18 intended DSL and todo | All cases execute; assertions use todo/legacy as appropriate. C08 records evidence requirements and C26 checks evaluation isolation |
