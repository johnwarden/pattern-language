# Language decisions and conformance specification

**Integrated 7 November 2026. This specifies design direction, not implementation status.**

This is the integrated decision record authorized by the author. Confirmed and retained rules are the intended contract; passages explicitly marked proposed or deferred keep that status. Named cases C01–C27 live in [tests/specification](../tests/specification) and execute through the test DSL, with assertion-level todo and legacy modifiers. Those `.test` files are the executable specs; this document explains the decisions with focused examples and does not have to match them byte-for-byte. Expected failures record future contracts; supported assertions already pass normally. This does not claim conformance with all of the future language semantics. [TEST-SUITE.md](TEST-SUITE.md) defines the runner contract; the [roadmap](../ROADMAP.md) tracks the language work separately.

## Status and sources

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
| L9 | Author ruling on 9 November 2026, 12:01 Madrid: no special logic for absent option values; `None` is an ordinary symbol. Value text prints `None`; `:None` is only the code form where an unquoted name would bind. |
| L10 | Author ruling on 9 November 2026, 12:39 Madrid: every ordinary symbol prints bare in value text; colon quotation is only for code where a bare name would bind. Remove the `Number` alias/type until its definition is decided. Primitive names (`True`, `False`, `Rational`, `String`, `Float64`, …) are not ordinary symbols; quoted forms such as `:True` / `:Rational` / `:Number` are rejected. |
| L11 | Author ruling on 9 November 2026, 13:02–13:04 Madrid: no layout-keyword quoting in value text; parse value text against the expected type's own grammar. Primitive names are `ReservedSymbol` values. Type-schema PrimitiveTag is the reserved symbol itself (`Int`, not `:Int`). `:(Int)` is a quoted expression; only `:Int` is `E_QUOTED_PRIMITIVE`. `Number` will later be an abstract union of fixed-width number types; keep it removed. |
| L12 | Author clarification on 9 November 2026 on PR #31: keep values distinct from the expressions that evaluate to them. `ReservedSymbol` is disjoint from `UpperCamelSymbol`. `Symbol` is not reserved; it is an ordinary abstract union in the prelude. |
| L13 | Author ruling on 9 November 2026, 13:42 Madrid: `:Int` is allowed at surface syntax. `E_QUOTED_PRIMITIVE` comes only from Code interpretation (evaluate/declaration), never from the surface parser. |

The spelling `type Name concrete/refinement/abstract ...` is used consistently for review. The declaration keyword, `concrete` versus `struct`/`data`, qualifier order, predicate spelling, generic constraints and some rest notation remain provisional where the attachments offered alternatives. Examples do not ratify those lexical details by repetition.

## Current decision specification

### D01. Preserve the structural application model — retained

An application has one head and one argument pack. `f(a)(b)` differs from `f(a,b)`; bare `f` differs from `f()`. Empty and multiple results are packs, not implicit unit/tuple values. Ordinary partial application consumes complete packs. Infix operators retain equal precedence and right associativity; parentheses preserve intended grouping. Type-parameter notation must not flatten runtime packs. Reason: these are the common structural rules; none of the new proposals withdraws them. **Sources:** O, A, S.

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
are Rational, and ordinary quoted symbols have their intrinsic symbol classes.
`ReservedSymbol` is the category for primitive reserved symbols and is disjoint
from `UpperCamelSymbol`: `Int` is not an ordinary UpperCamelSymbol because of its
spelling. `Symbol` itself is not reserved.

P proposes self-evaluating `PrimitiveType`, including `Bool :: PrimitiveType` and `PrimitiveType :: PrimitiveType`, with `Type` no longer a reserved primitive atom. This vocabulary is recorded as the proposed primitive representation, not a completed metatype specification. Int/Float families are intended to be definable fixed-precision types rather than primitive numeric atoms.

Quoted primitive *names* are rejected when Code interpretation gives `:` its
meaning (L10 / D20 / 13:42 Madrid): evaluating `:True`, `:Rational`, or `:Number`
is `E_QUOTED_PRIMITIVE`. The surface parser still accepts those quote trees;
`parse(Code)(":Int")` succeeds. `:(Int)` is a quoted expression (`:()` quotes an
expression), so it is the quoted Code expression `Int`, not a symbol (L11).
Redundant numeric quotation such as `:5` remains an exploratory Code-form
candidate (C27); it is not decided here. Ordinary symbolic quotation, raw colon
quotation of non-primitive names, explicit typed interpolation and separation of
quotation from execution otherwise remain unchanged. **Sources:** A
“Descriptions/Equality/Identity,” P “Reserved Symbols,” AR; R2; L10; L11; L12.

### D03. Structured runtime values require concrete interpretation — confirmed; parse into Expression

A structured expression cannot become a runtime value with unspecified concrete identity. An explicit annotation, typed quotation or a sufficiently informative context must determine its interpretation. Thus an unconstrained `z = Rect(2,2)` is rejected; `Rect(2,2) :: Rectangle` can succeed. Primitive literals already have intrinsic interpretations.

The parser destination is Expression. Number literals in that domain are exact Rationals (D04). The bootstrap currently has three trees: host `Syntax` (parser product, including quote/sequence/block/form), runtime `Value` (`term` ≈ `apply`, plus packs/literals/symbols), and public `SyntaxNode` transport (`NumberLiteral(Rational) | Apply | Postfix | …`, via `syntaxTree` / `syntaxExpression` / `parseSyntax`). Exact numeric syntax transport is implemented. Those Syntax layers are adapters to remove after staged consumer migration with behavior preserved. The migration is not implemented yet and is not a prerequisite for distinct postfix application.

Whether ordinary programs expose a first-class Expression *value* to compute over remains optional. If they do, an Expression-typed descriptor does not automatically equal the type it describes. R2's recommendation to require explicit decoding remains a recommendation. There is no pending public `NumberLiteral(Float)` A/B redesign. **Sources:** A “Require Annotation…,” P “Raw Expressions…,” AR “Expression”; R2; L8.

### D04. All numeric literals denote exact Rational values — confirmed

Decimal, hexadecimal and binary spellings denote exact values. `0f` first selects the Float64-rounded value and denotes that value **as an exact Rational**, not as a Float64-typed value. Consequently `0f0.5` equals Rational 1/2 and can be designated into Decimal32. A stored result of `float64(...)`, by contrast, already has Float64 identity.

Explicit converters such as `float32` and `float64` return their fixed-precision typed values. Exact designation must not silently round: `0.1 :: Float32` fails, whereas an explicit converter may round. Finite fixed-precision types are concrete carveouts of representable Rational values with their own operations. Cross-space operations/conversions must be explicit; base arithmetic is not inherited merely because a Rational representation exists.

Default short type names, the Number union's exact membership, complete format families, ties/overflow policies, integer wrap/check policies, numeric separators and canonical numeric spelling remain to be finalized. Hexadecimal canonical output and nearest-ties-to-even are proposals, not ratified here. Rational runtime arithmetic may be omitted; literal representation, equality and projection still require a defined model. Non-dyadic exact results such as `1/3` keep their internal Rational value; they currently have no ratified source spelling, so formatting reports `E_VALUE_SERIALIZATION` rather than inventing a fraction form. Exact Rational literals belong on Expression; there is no pending public `SyntaxNode` `NumberLiteral(Float)` A/B redesign (L8). **Sources:** P, N, K “Refinement Type vs Carveouts,” AR “0f” and “Rationals and IEEE Floats”; L8.

### D05. Structural descriptor identity remains the rule — confirmed/retained

Equal normalized structural descriptors denote equal types, independently of declaration names and positional capture names. Physical field labels and nested type boundaries remain structural. Adding an alternative changes a concrete descriptor and therefore its concrete space. Two equal-looking payloads in different concrete spaces are not directly comparable as though the spaces were identical.

This is **descriptor equality**, not proof of extensional equality of arbitrary predicates. The author accepted that correction. Functions/predicates eventually need portable representations; no new host-identity exception is approved. Canonical same-value/same-type printing and parse/print round trips remain goals. **Sources:** A “Structurally equal types…,” AR agreement on extension versus descriptor identity; O.

### D06. Concrete, refinement and abstract interpretations have different effects — confirmed direction

- `concrete` establishes one structural concrete space; structs, alternatives and predicate carveouts are recipes for it.
- `refinement` restricts an existing concrete space while preserving its identity and operations.
- `abstract` preserves each accepted value's actual concrete identity; unions and open facets are recipes for it. Concrete structures may themselves contain abstract-typed fields.

Facet combinations require both constraints while preserving the member, not constructing a merged record. The author's documents call these products; R1/R2 recommend the term **intersection**, but that terminology has not been separately ratified. Likewise **abstract** versus **polymorphic** remains a naming choice; the recommendations favor abstract for the type category and polymorphic for functions.

The author proposed disallowing a written singleton union such as `abstract String`. Normalization to the sole member was a reviewer suggestion, **not accepted policy**. How an abstract qualifier behaves when constraints leave one admitted member remains open. **Sources:** A “Kinds…,” K, S; AR singleton question; R1/R2.

### D07. General abstract unions are separate from unambiguous grammars — confirmed direction

An abstract union may admit distinct concrete spaces with overlapping source spellings. This removes the old blanket syntax-disjointness requirement. Typed members retain their actual spaces; general typed text must carry enough reconstruction information where the spelling does not select a unique member.

A DSL can separately require an **unambiguous** grammar with no concrete-type reconstruction annotations in its value text. This requirement concerns the complete interpretation, including nested abstract fields and facets. It must not create another concrete value space merely by certifying the grammar. The qualifier's spelling, certification protocol and supported proof subset remain proposals. **Sources:** A “Disjoint Source Syntax / Unambiguous Grammars,” P union proposal; AR.

### D08. Named declarations install accessors; ordinary type construction does not — confirmed direction

The proposed `type Name ...` declaration binds the type and registers its local accessor/printing metadata. Ordinary type-valued expressions must be capture-free; `t = concrete Rect(w :: Float32,h :: Float32)` must not quietly install methods. Capture-free type values remain ordinary values and can be passed, stored and compared. Parameterized declarations can supply compact local names for instantiated type descriptions without changing identity.

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
as `:None :: String?`. The definition `type T? concrete T | :None` is a source
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

### D14. Interoperability follows structural descriptors — confirmed intent

Independently scoped declarations with equivalent capture-free descriptions exchange equal values without a shared nominal declaration or importing accessor names. Consumers may destructure their known shapes. This does not yet specify source modules, simultaneous imports or duplicate local accessor policy. **Sources:** I; A structural identity; O.

### D15. Repetition dimensions are consistent; new spreading/rest features are proposals

The horizontal/vertical capture contract is retained: one repeated dimension contributes one list layer to the aggregate capture. A horizontal rest alone has `T*`; horizontal rest repeated over rows has `T**`. The author corrected the specialization Matrix example's `N*` to the two-dimensional rule. Zero rows, one empty row and a flat empty pack remain distinct.

R proposes mirrored row spreading/capture and a keyword remainder represented by an actual typed record preserving its field labels and concrete field types. These are **intended proposals, not implemented guarantees**. Postfix `...` is preferred; prefix keyword-rest/spread `**rest` / `**(x)` / `**rest: {**}`, its exact grammar, dynamic typing policy and keyword spreading details remain provisional. Specialization may optimize a known remainder shape but is not its semantic justification. **Sources:** O dimension contract; R; AR Matrix correction; R1.

### D16. constructedBy is tabled entirely — deferred by latest decision

The motivating intent was explicit constructor calls granting guarantees without automatically retesting an arbitrary property, usable with refinement or concrete construction. The discussion distinguished static evidence, output-image membership and original call provenance. It did **not** ratify one final semantic model.

The author has now tabled the feature until decoding values of constructedBy refinement types can be solved. Do not implement constructor replay, fixed-point checks, retained witnesses, `insist`, or a chosen image/provenance semantics as part of this agreement. Different witnesses for equal outputs also cannot be assumed to provide canonical value text. Ordinary `where` refinements remain available. **Sources:** C, N, AR, R2; superseding L.

### D17. IEEE special-value details are deferred

AR proposes a concrete union of NaN/infinities and finite Rational carveouts when Rational itself is not their superset. This is a possible representation, not a settled specification. Signed zero, NaN equality/payloads, exact special-value vocabulary and finite-only versus IEEE-complete scope may remain unsettled for now. Do not ratify the reviewer's finite-only or reflexive-NaN recommendations. **Sources:** P, N, AR; L.

## D18. Test assertions and migration contracts

Files contain ordinary test blocks with shared setup. Assertions may use expect,
assert, expected-error and single-result forms. Modifiers apply to assertions,
never tests. Plain and legacy assertions must pass. Legacy identifies a current
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
vocabulary only as future contracts. Provisional type/angle/qualifier spellings do
not become approved language features just because their failing assertions are
stored and attempted. C27 remains an exploratory lexical candidate. Each executable
subject repeats any needed future setup in an isolated scope; unavailable future
types are not installed in shared setup merely to allow an assertion to be recorded.

### C01 — intrinsic primitive values

Confirmed direction; the PrimitiveType spelling/self-description is P's proposed vocabulary.
Live: `True :: ReservedSymbol`, `5 :: Rational`, `:Widget :: UpperCamelSymbol`.
`Int` is `ReservedSymbol`, not `UpperCamelSymbol`. `:Symbol` is an ordinary
`UpperCamelSymbol`. Legacy still treats `Bool` as Type. Todo: `Bool :: PrimitiveType`,
and `PrimitiveType :: PrimitiveType`.

### C02 — exact literals, including Float64-rounded Rational literals

Live. `0.1` and `0f0.5` are Rational; `0f0.1` is the Float64-rounded Rational
`0x1.999999999999Ap-4`, distinct from `0.1`. Hex/binary `0xFp8 == 0b1111p8`.
No halfway, overflow or nonfinite behavior is specified by this case.

### C03 — exact designation and explicit typed conversion

Live: `0.5 :: Float32` and `float32(0.5)` succeed; `0.1 :: Float32` errors because
it is not exactly representable; `.matches Float32` is True for `0.5` and False
for `0.1`. Todo: `0f0.5 :: Decimal32`, `0f0.1 :: Float64`, and `0.5 :: Int16`.

### C04 — structured values require interpretation

Todo. `Rect(2, 2) :: Rectangle` can succeed once `type Rectangle concrete Rect(...)`
is available; a bare `x = Rect(2, 2)` must still error with no concrete interpretation.
The first annotation supplies context. The second binding deliberately supplies none.

### C05 — ordinary capture-free type values and a type factory

Todo. A named `type Rectangle concrete Rect(w :: Rational, h :: Rational)` equals
the capture-free `concrete Rect(Rational, Rational)`. `Box<String>` equals
`concrete Box(String)`, and `Box("hello") :: Box<String>` destructures to `"hello"`.
This does not compare an Expression-typed descriptor with a type, or decide bare-family membership.

### C06 — alternative sets determine concrete identity

Todo. `:Red :: PrimaryColor` and `:Red :: TicketStatus` are incomparable concrete
spaces even though the source spelling `:Red` overlaps.

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
for a source-defined unwrapped `concrete T | :None`. Bare `:None` chooses a direct
outer arm; an inner annotation preserves inner absence. Peer branches remain
ambiguous without explicit member evidence. These bootstrap cases are active in
`tests/bindings/nested-option-designation.test` and
`tests/specification/concrete-unions.test`.

Guaranteed extraction remains future checking work: a single-arm consumer of an
optional String needs coverage evidence or an explicit absence arm. C18 separately
uses a tagged `:None | Some(T)` representation, which is a different convention.

### C13 — a general union admits overlapping spellings

Todo. `type EitherFloat abstract Float32 | Float64` keeps each member's concrete
identity: `float32(0.5)` stays Float32, `float64(0.5)` stays Float64.
`parse(EitherFloat)(toString(EitherFloat)(a)) == a` must reconstruct Float32.
The text must retain enough information; no exact descriptor spelling is approved here.

### C14 — unambiguous grammar requirements are separate

The qualifier spelling and certification diagnostics are provisional. Todo:
`type Token unambiguous abstract Rational | String` can round-trip `0.5`;
`type Bad unambiguous abstract Float32 | Float64` errors because the same numeric
spelling admits more than one interpretation. C13 remains legal without the
additional requirement.

### C15 — facets and their intersection preserve the complete member

The `abstract A & B` spelling records the proposed facet-combination recipe. Todo:
a `Card` value viewed as `ColoredRectangle` (`Rectangular & Colored`) remains the
same Card, including fields neither facet names. Intersection preserves the
complete member, not a merged record.

### C16 — accessor installation belongs to a declaration

Todo. `r.w` works after `type Rectangle concrete Rect(w :: Rational, h :: Rational)`.
`t = concrete Rect(width :: Rational, height :: Rational)` cannot declare
captures/accessors. No case assumes that two equal local declarations are either
permitted or forbidden; that policy is still pending.

### C17 — ordinary factories keep defaults out of types

Todo. A factory `rectangle(w, h, color: String = "black")` may default `color`;
`Rect(2, 3) :: Rectangle` still errors if required `color` is absent;
`type Invalid concrete Rect(color: String = "black")` is forbidden.

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

Capture dimensions are retained; mirrored vertical spreading is R's proposed extension.
Todo. `cells... :: Float32**` over repeated rows is `[[0.5, 1], [2, 4]]`, not
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

Todo. `(2 :: Float64) * (3 :: Float64) + (4 :: Float64)` denotes `2 * (3 + 4)`
and is `14 :: Float64`. `("left" .select "right")` is `"right"`. Each ascription
is grouped explicitly so the example does not accidentally change its tree.

### C26 — todo assertions execute without leaking local state

**Implemented assertion-level policy.** Unknown future operands are attempted, and
failed subjects cannot change the surrounding case scope. `marker = 1` stays 1
after a todo that binds `marker = 2` and `def futureLocal()`; later
`futureLocal()` is unbound. Discovery reads source only. Todo does not hide setup
or harness errors. C08 independently records the future evidence requirement.

### C27 — candidate lexical prohibition on redundant primitive quotation

Quoted primitive *names* are confirmed rejected when that Code is interpreted
(D20): evaluating `:Bool` is `E_QUOTED_PRIMITIVE`; `parse(Code)(":Bool")`
succeeds. Redundant numeric quotation `:5` remains an
exploratory Code-form candidate, not a confirmed decision. No corresponding
expected result is assigned for raw Expression computation of `:5`, which may
be omitted entirely.

### D19. Symbol value text is unquoted; colon quotation is a code form — confirmed 9 November 2026

There is no special printer or absent-option rule. Every symbol prints bare in
value text, with no exceptions: `toString` of `None` is `"None"`, of `:Widget` is
`"Widget"`, of `:foo` is `"foo"`, of a Test DSL value is `test "body" expect …`
rather than `:test` / `:expect`. Colon quotation is a *code* form, used where a
bare name would bind (`:None`, `:Black`, `:foo`, `:result`). Whether
`test`/`expect` is read as a layout form depends on context: value text is parsed
against the expected type's own grammar (the Test DSL schema for `parse(Test)`),
not the default language layout forms. Type-pattern descriptors keep the same
code split (`Type(:None | String)`). Source still writes `a = :None :: Int?`.

`toString(Expression)` and other code-domain text keep `:MissingType` / `:None` /
`:foo`, because that text is code. Value inspection of `Int` is
`Int :: ReservedSymbol`; `:(Int)` is the quoted expression, not that value.
Printing has no TitleCase, alias, layout-keyword, or primitive-name special
cases. Union `::` tags stay the reconstruction rule (D07): keep the tag only
when untagged text would not reconstruct the same member/value. Unique `None`
in `String?` needs no tag; inner absence in `String??` still prints a `::` tag
so parse reconstructs the inner member. **Sources:** L9, L10, L11, L12.

### D20. Primitive names are ReservedSymbol; Number is withdrawn — confirmed 9 November 2026

Primitive names (`True`, `False`, `Int`, `Rational`, `String`, `Float64`, …)
are values of type `ReservedSymbol`, a primitive type like `String` or
`Rational`. `expect Int result Int :: ReservedSymbol` and
`expect True result True :: ReservedSymbol`. `type Int` is still the Int type
(`Int :: Type`); `1 == 1` is still `True :: Bool`. Quoted forms such as
Evaluating `:True`, `:Rational`, or `:Number` is `E_QUOTED_PRIMITIVE`: they
do not produce an `UpperCamelSymbol`. The surface parser still accepts those
quote trees — `parse(Code)(":Int")` is `:Int :: Code`. The diagnostic is raised
only by Code interpretation (evaluate or declaration), never by the surface
parser. `ReservedSymbol` is disjoint from `UpperCamelSymbol`:
`Int .matches UpperCamelSymbol` is False. `:None` is still an ordinary symbol;
`None` is not a primitive.

`Symbol` is not reserved. The prelude defines it as the ordinary abstract union
of the four intrinsic classes (`LowerCamelSymbol | UpperCamelSymbol |
UpperSnakeSymbol | PunctuationSymbol`). That is the agreed symbol model, not a
new member list or inspection format: `:foo` still inspects as
`foo :: LowerCamelSymbol`, and `ReservedSymbol` is not a member. `:Symbol` is
an ordinary `UpperCamelSymbol`. Type-schema `OrdinaryHead` is
`Symbol | ReservedSymbol` (with `Type`/`String` still dedicated constructors);
`Data` includes `ReservedSymbol` so `Literal(String)` stays valid. Neither
change adds `ReservedSymbol` to `Symbol`.

`:(Int)` is legal as both surface syntax and evaluated Code: `:()` quotes an
expression, so it is the quoted Code expression `Int`, not a symbol. `:Int` is
the same at the Code-tree level; evaluating that quote is
`E_QUOTED_PRIMITIVE`. Value inspection and source quotation stay in their
respective roles. Type value text still writes `Int`, not `:Int` — that is the
Type grammar's decoding, not this diagnostic.

The type description of a primitive is the reserved symbol itself (`Int`), not
`:Int`. Drop the `Int == :Int` bootstrap convention. Quoted primitive heads are
errors: write `type String([65])` and `Type(String(A))`, not `:String([65])` or
`type :String(:A)`.

The `Number` alias/type stays removed. It will later be defined as an abstract
union of fixed-width number types; do not restore it until that membership is
written. Tests that designated or unioned `Number` now use `Float`.

`PrimitiveType` remains proposed in D02 as a possible metatype; `ReservedSymbol`
is the inspectable type of primitive *names*. **Sources:** L10, L11, L12, L13.

## Remaining and deferred items

| Item | Precise status |
| --- | --- |
| constructedBy, its evidence semantics and decoding | **Tabled entirely.** Preserve motivation; do not select a replay/image/provenance model or add conformance results now. |
| IEEE NaN/infinities, signed zero and special equality | **Deferred.** AR's union recipe is a possibility, not a chosen representation. |
| Designation/projection | **Settled.** Only faithful wording/checking and eventual tests remain; no renewed policy debate is requested. |
| Bare generic-family facets, MemberOf and parameter recovery | **Proposed.** Constraint vocabulary, structural matching and non-injective cases remain unresolved. |
| Duplicate local type names, accessor bundles/imports and preferred display names | **Deferred policy; current errors retained.** Equivalent declarations and accessor collisions remain errors for now. No final alias/import policy is selected. |
| Singleton abstract unions and qualifiers narrowed to one member | **Unresolved.** Author proposed rejecting explicit singleton unions; normalization is only a reviewer recommendation. |
| Runtime Expression *value* computation and descriptor/value comparison | **Optional.** Ordinary programs may omit computing over Expression. Separate from the parser destination, which is Expression (L8); Syntax/`SyntaxNode` cleanup follows staged consumer migration. |
| Public `NumberLiteral(Float)` redesign | **Superseded.** Do not choose an A/B SyntaxNode numeric encoding; literals on Expression are exact Rationals. |
| Specialization | **Deferred optimization only.** No source-visible generated overload semantics. |
| First-class overload sets | **Unaccepted proposal.** No approved bare-name callable-value behavior change. |
| Numeric aliases/families, rounding edge policies and canonical spelling | **Provisional.** `Number` stays removed (D20) until it is defined as an abstract union of fixed-width number types; do not infer a definition from old Float-alias tests. |
| Predicate/source portability, general canonicalization and unchecked insist | **Not solved here.** No new exemption from structural identity or serialization goals; no approved unchecked escape. |
| Exact type/generic/facet/unambiguous/rest syntax and terminology | **Provisional.** Examples adopt review spellings without making every spelling a decision. |
| Test DSL modifiers | Implemented assertion-level todo/legacy execution and reporting; see TEST-SUITE.md. Future language semantics remain separate work. |
| Postfix vs prefix punctuation application | **Decided.** Tight `~ ! @ $ % ^ & * ?` are distinct postfix constructions. `#` is a comment, not a postfix operator (`x#` and `x #` are both `x`). Definitions supply meaning; optional `?` is a source-prelude convention. Explicit member evidence distinguishes inner absence; raw None selects a direct outer arm. Prefix and postfix operators must touch their operand (`T * *`, `* *x`, and `- (x)` are errors; `1 * *x`, `-(x)`, `-x`, and `1 - (x)` parse). Prefix `-(a)` negates; infix `-(a)(b)` subtracts. Lifting remains future work. See [POSTFIX.md](POSTFIX.md). |

Obvious draft slips are normalized only to express the intended rules: String/sqrt examples meant an integer type; inconsistent normalizer names refer to one function; the Float union's self-reference is not a proposed recursive numeric member; mismatched id widths and Matrix dimensions are corrected explicitly. No semantic decision is extracted from those slips.

## Decision-to-case index

| Decision | Named cases / coverage |
| --- | --- |
| D01 application, packs, precedence | C24, C25; runtime packs remain distinct from generic parameters in C05 |
| D02 primitives and quotation | C01; quoted primitive *names* confirmed in D20; C27 `:5` remains an unaccepted numeric-quotation candidate |
| D19 symbol value text vs code quotation | C01 Widget already uses unquoted value text; Option/`None` in types, postfix, nested-option and concrete-union specs; lowercase value text in types/grammars examples |
| D20 ReservedSymbol vs ordinary symbols; Number withdrawn | C01 `Int`/`True` :: ReservedSymbol; C01 `parse(Code)(":Int")`; C27 evaluating `:Bool`; types examples reject `:True` / `:Number`; `:(Int)` is a quoted expression; ReservedSymbol disjoint from UpperCamelSymbol; Symbol is a prelude union |
| D03 mandatory interpretation / parse into Expression | C04, C05; first-class Expression *value* computation remains optional; SyntaxNode numeric A/B superseded |
| D04 numeric meaning and conversion | C02, C03; C11 verifies explicit Rational projection; IEEE details deliberately unassigned |
| D05 structural identity | C05, C06, C18, C23 |
| D06 concrete/refinement/abstract kinds | C06, C07, C13, C15; singleton policy deliberately unassigned |
| D07 general unions versus unambiguous grammars | C13, C14; qualifier spelling remains provisional |
| D08 declaration-only accessors | C05, C16; duplicate-name/import outcomes deliberately unassigned |
| D09 recursive designation / one-boundary projection | C03, C11, C12, C17 |
| D10 evidence and refinement-qualified functions | C07–C10; C08 depends on the future static evidence checker |
| D11 factories and binding-only defaults | C17 |
| D12 type-valued generics / proposed family views | C05, C12, C18; no case pretends family recovery or MemberOf is settled |
| D13 specialization and first-class overloads | No optimization-dependent expected result; C09/C10/C12 must retain their semantics independently of specialization |
| D14 structural interoperability | C18, with transport law in C23 |
| D15 captures/spreading/keyword remainders | C19–C22; new spread/rest surface mechanics explicitly proposed |
| D16 constructedBy deferral | No active or pending expected-result case selects a semantics |
| D17 IEEE deferral | No expected result selects NaN/signed-zero/special-value policies |
| D18 intended DSL and todo | All cases execute; assertions use todo/legacy as appropriate. C08 records evidence requirements and C26 checks evaluation isolation |
