# Roadmap and conformance status

This is the current design, implementation boundary and milestone sequence, not a
development history. The integrated
[decision/conformance record](design/LANGUAGE-DECISIONS.md) supplies reasons, status
and 27 named design cases. [VALUE-SPACES.md](VALUE-SPACES.md),
[the type-value spec](specs/type-values.md) and [GRAMMAR.md](GRAMMAR.md) detail the contract.

The executable contracts in [specs](specs/README.md) and
[the source suite](tests/specification/README.md) define the language. This roadmap and the linked prose explain its decisions and
track implementation, rather than maintain an independent specification. Discuss
new rules in the project chat and draft them in `specs/` on a topic branch.
Once settled, review the active test updates before changing implementation.
See [the specification lifecycle](specs/README.md).

## Vision and accepted direction

One structural pattern algebra should serve types, bindings, parameter packs,
match arms, macro signatures and DSL recognition. Concrete spaces have structural
descriptors; refinements preserve the base space; abstract views preserve members.
Typed quotation interprets grammar data without executing it. Canonical typed text
and independent structural interoperability should make the model transportable,
then a small source interpreter and compiler should make it self-hosting.

Shared representations are not evidence of elegance by themselves. Each milestone
must test composition and state role differences explicitly.

### Core contracts

- One application has an expression head and one complete pack. f(a)(b), f(a,b), f()
  and f are distinct. Dot/infix/outfix are sugar; accepted infix chains have equal
  precedence and right associativity, and among grouping-sensitive operators
  (`+ - * / % ^`, comparisons, `&&`/`||`/`and`/`or`, `|`, `::`) parentheses may
  be omitted only for repeated associative operators (`+`, `*`, `|`, `&&`/`and`,
  `||`/`or`); `->` and dotted word operators stay outside
  ([arithmetic-grouping](specs/arithmetic-grouping.md)). Labels are lowercase,
  unique and canonically sorted after positional fields. () is an empty pack, not
  an implicit unit value.
- Callability is checked when Code is evaluated, not by restricting application
  syntax. See [application-head contracts](tests/specification/application-heads.test)
  and their [phase explanation](tests/specification/application-heads.md).
- Formatting and whitespace mistakes must produce syntax errors, never logic
  errors, within a form fixed by the applied grammar. Raw layout and explicitly
  declared keyword alternatives are exceptions; see
  [WHITESPACE.md](design/WHITESPACE.md) for examples and remaining review boundaries.
- Patterns share structural recognition/capture rules. Packs tolerate extra labels;
  constructed shapes are exact unless open. Positional rests never collect labels.
  Each repeated dimension adds one list layer; horizontal-plus-vertical has T**.
- Type identity is normalized structural descriptor equality. Capture/declaration
  names and caches do not participate. This is not extensional predicate equivalence.
- Concrete designation preserves explicit members, then prefers a direct arm over
  inward designation. Equally valid peer paths remain ambiguous.
  Explicit match projection crosses one concrete boundary; ordinary bindings and
  dispatch do not unwrap. Predicate evidence and single-arm coverage are required.
  These decisions are settled.
- All numeric literals have type `NumericValue`. `0f` selects an exact
  magnitude by Float64 rounding. Exact designation never silently rounds. Explicit converters return
  fixed-precision values with their own operations. Destination unions:
  `Real` (fixed non-complex), `Complex` (fixed complexes), `Number` = `Real | Complex`.
  See [numeric literals](specs/numeric-literals-and-text.md) and
  [fixed-precision numbers](specs/fixed-precision-numbers.md).
  Fixed-width arithmetic, including exact integer division into ratios, follows
  refinement predicates, evidence, and refined signatures.
- Primitive names such as `Int` are `ReservedSymbol` values. `True` and `False` are
  `Bool` values, the type of computed comparisons: `(1 == 2) == False` is `True`.
- General abstract unions may have overlapping spellings. A separate unambiguous
  grammar requirement supports annotation-free DSL text. Typed general text retains
  sufficient member reconstruction information; no branch priority is introduced.
- Declarations register type/accessor/local-printing metadata. Plain type construction
  is capture-free and has no accessor-installation effect. Binding defaults supply
  captures only; type defaults and implicit normalization remain excluded.
- Refinement-qualified functions are legal. Missing evidence is a checking failure;
  overlapping base/refinement overloads do not gain priority by evaluating predicates.
- A constructor expression or symbol tag requires a concrete interpretation from
  its context or an explicit ascription. That requirement supersedes bare raw
  runtime construction; see
  [Designation and matching](specs/type-values.md#designation-and-matching) and
  the deprecated [raw-expression note](specs/raw-expression-values.md). Distinct
  source syntax evaluating to the same primitive is not a type-equality exception.
  The parser destination is Expression, not a lasting parallel syntax tree:
  number literals in Expressions are exact Rationals. Host `Syntax`, public
  `SyntaxNode` (`NumberLiteral(Rational)`, `Apply`, `Postfix`, …), and `syntaxTree` /
  `syntaxExpression` / `parseSyntax` are bootstrap adapters. Migrate consumers
  while preserving behavior, then delete the legacy Syntax/public-adapter layer.
  That migration is not implemented yet. There is no pending public
  `NumberLiteral(Float)` redesign choice. Distinct postfix application is a
  separate, smaller surface item and is not blocked on the full migration.
- Global typed text is independent of lexical aliases. For a fixed T, equal values
  have equal canonical text and parse(T)(toString(T)(v)) == v for the supported subset.
  Local variants may reuse names in the same scope. Abstract slots retain type metadata
  where needed; concrete paths need not universally retain it.
- Code-producing functions do not automatically register macros. Explicit registration,
  phase availability and hygiene remain separate from runtime Code-valued functions.
- A named function resolves to a self-contained function value. An overloaded
  name offers the alternatives in its static scope. A use can select one
  alternative or capture the whole group with `saved = f` (no ascription
  required; `f :: PolymorphicValue` remains an allowed explicit form). Stored
  groups preserve direct-call dispatch.
  See the [function value specification](specs/named-function-values.md).

### Deliberately deferred or provisional

ConstructedBy is tabled entirely until decoding its refinement values is solved.
No replay/image/provenance model, arbitrary witness format or unchecked insist is
selected. Ordinary where refinements remain in scope.

IEEE signed zero, NaN identity/payloads and infinities remain deferred.
Fixed integer overflow is panic/`E_OVERFLOW` for now; wrap/configurable
overflow is deferred. [Numeric literals and exact text](specs/numeric-literals-and-text.md)
defines destination atom spelling and canonical round-trip text.

The `struct` / `pattern` declaration forms already written in
`tests/specification/` and [type-values](specs/type-values.md) remain current
implementation targets. Angle-bracket generic syntax is accepted but deferred:
[#62](https://github.com/johnwarden/pattern-language/pull/62) is parked at the
author's request. Ordinary argument packs for type-valued factories cover the
current milestones. Preserve the angle-syntax todos, but do not treat them as
blockers for 5a.2 or 5b while this work is parked. Unspecified extensions to
generic constraints, MemberOf, bare-family facets, parameter recovery and
singleton abstract policy remain provisional/unresolved. Equivalent local
declarations and accessor collisions remain errors for now; the recommended
replacement is the **proposed** collision policy in
[D21](design/LANGUAGE-DECISIONS.md#d21-name-collision-and-equivalent-redeclaration-policy--proposed)
(identical same-scope redeclarations as no-ops once the runtime applies content
keys plus matching capture/accessor names; accessor/`def` as one disjoint
overload group; explicit type aliases; import/local `E_NAME_BOUND` with `as`).
Specialization is a deferred optimization of already defined abstract-call
semantics. It preserves visible overloads. Requiring concrete interpretation
does not settle public descriptor decoding or require the parser's Expression
migration to be completed first.

## What is implemented now

The reference is TypeScript prototype 0.2. The executable language corpus includes
`tests/**/*.test` and unlabeled or `pattern` fences under `specs/`. Runnable playground
programs come from `tests/examples/`.
`just check` runs the complete gate. `just test-language` reports passing assertions,
legacy assertions and expected todo failures separately. Do not copy those
figures into this document.

| Implemented foundation | Boundary |
| --- | --- |
| Exact NumericValue literals and public numeric syntax payloads | Finite Float32/Float64 conversion; IEEE special-value policy remains deferred |
| Generic postfix values, patterns and portable descriptions | Optional `?` is defined in the source prelude; lifting remains future work |
| Shared pattern compiler/matcher; exact/open fields; captures/rest/defaults | Revised declaration-only accessor and proof rules need alignment |
| Structural Type data/schema, recursion, abstract slots, facets, typed text | Public type/predicate/function coverage remains bounded |
| Scoped sidefix registration, typed grammar quotes, interpolation and diagnostics | No full prepare-once elaborator or source evaluator |
| Source-defined Test data and shared playground/CLI corpus | Grouped .test files, setup/check steps and executed todo/legacy assertions; full executable nested suites remain deferred |
| Mutually recursive declaration groups and typed code inspection | Code still uses its public SyntaxNode/TreeGrammar bridge |
| Vertical collection matching, single-template mirrored row spreading and bounded source Body grammar | General Code coverage, broader row templates and keyword capture remain work |

### Bootstrap behaviors superseded by the intended design

- Legacy safe-range Int and Float-as-binary64 names; exact NumericValue literals and
  finite Float32/Float64 conversion are implemented.
- Explicit syntax-disjointness certification remains future work; general
  overlapping UnionType members are supported.
- Old def/type construction and accessor products. Duplicate structural declarations
  and accessor collisions remain errors while their replacement policy is deferred.
- Legacy bare-raw Expression compatibility values, legacy primitive-atom/cache equality
  and runtime subset checking; the revised identity/evidence/designation model is
  not yet integrated.
- Ordinary parameter packs for generics; proposed angle sugar is not in the current parser.

The [bootstrap guide](BOOTSTRAP-GUIDE.md), [grammar](GRAMMAR-BOOTSTRAP.md) and
[type reference](TYPE-VALUES-BOOTSTRAP.md) retain runnable existing syntax. Do not
rewrite their current observations as if all target changes were shipped.

## Milestones

### Immediate priority: implement the executable specification

Development is specification first:

1. Finalize rules with executable spec contracts (`todo` where unmet).
2. Migrate affected source tests in a follow-up PR (same-subject `todo` /
   `legacy` as required).
3. Implement against those contracts; remove fulfilled todos.

The todo cases in `tests/` and `specs/` are the work queue. See
[TESTING-WORKFLOW.md](design/TESTING-WORKFLOW.md). A todo failing at an
unsupported declaration does not demonstrate that the deeper rule in that
assertion has been implemented correctly.

The current declaration syntax includes these targets:

| Target form | Existing specification and next work |
| --- | --- |
| `type Rectangle struct Rect(w :: NumericValue, h :: NumericValue)` | C05/C06/C16: declare one concrete space and its local products |
| `struct Rect(NumericValue, NumericValue)` | C05/C16: construct an equal capture-free type value without declaration/accessor effects |
| `type EitherFloat pattern Float32 \| Float64` | C13: retain overlapping members and their concrete identities; no first-match branch priority |
| `pattern Float32 \| Float64` | C13: construct the same abstract member domain as an ordinary value without a named declaration |
| `type Rectangular pattern {width: Float32, height: Float32, **}` | C15: identity-preserving abstract views and facet composition |
| `type Box<T> struct Box(T)` and `Box<String>` | C05/C12/C18: accepted but deferred; #62 is parked. Use ordinary-pack type factories for current work |
| `type NonZero pattern NumericValue .where isNonZero` | C07-C10: refinement syntax, then the separately specified evidence and overload rules |

#31's value alignment, #32's declaration-product separation and #48's non-generic
declaration recognition are landed (bootstrap `concrete` / `abstract` spelling;
#88 retargets the destination forms to `struct` / `pattern`). #39's inbox handoff
is closed; accepted parts now have contracts. #52 is retired. Remaining work is
the open todos and specs themselves—generic packing (#62 parked), refinements,
spreading and value-boundary slices—not a separate queue document. Isolate
recognition from later evidence obligations so failures identify the actual
missing feature. Preserve current equivalent-declaration/accessor-collision
errors and the deferred public inspection boundary. Add missing focused cases
before implementing a gap; reconcile stale tests with settled decisions rather
than changing the language to satisfy them.

The internal-foundation drafts #43, #44 and #45 are parked behind this conformance
work. Their existence is not authorization to start implementation before their
specification and executable acceptance tests exist. `unambiguous` details,
nonempty-list source syntax and other unresolved policies remain explicitly open.

### Accepted surface and test-runner work

[SURFACE-EXTENSIONS.md](design/SURFACE-EXTENSIONS.md) records the accepted postfix,
ASCII symbol, nonempty-list, typed macro, expected-DSL and setup-alternative contracts.
[WHITESPACE.md](design/WHITESPACE.md) specifies significant whitespace and mandatory
explicit layout termination, including shared string/if terminator ownership.

- Implemented ASCII LowerCamelSymbol / UpperCamelSymbol / UpperSnakeSymbol classes;
  preserve the disambiguation table, defer Unicode casing and UpperSnake binding roles.
- Implemented grammar diagnostics with found input, active expected form and locations.
  Contextual type-inference diagnostics still depend on milestones 6/7.
- Audit remaining newline and collection-row behavior against formatting safety.
  Distinguish raw layout and declared keyword alternatives from accidental
  reinterpretation; ordinary expression-row boundaries remain under review.
- Implemented distinct postfix expressions across the shared
  tree/value/pattern/serialization adapters. Suffixes are one character each: T** is (T*)*, and String?*^! wraps
  from the nearest suffix outward. Type-name/head rules apply to every suffix.
  The suffix inventory is `~ ! @ $ % ^ & * ?`; `#` is a comment, not a postfix
  operator. Optional T? (`T | :None`) is defined in source; the bootstrap retains list T*
  and result T^ type constructors. Prefix `+Int` and `+(Int)`
  are the same application tree; tight `Int+` is not rewritten to prefix `+`.
  Prefix and postfix operators must touch their operand. Prefix `-(a)` negates;
  infix `-(a)(b)` subtracts.
- Add T+ as a nonempty-list refinement of T*. Retain the explicit vertical ... marker
  and replace TestFileContent's first/tail workaround once common repetition supports it.
- Implement explicit layout end ownership and migrate source/host fixtures together.
  Reject missing inner ends; clause continuations and form completeness come from
  the active surface grammar, not hardcoded keyword lists. Support strings ending
  at a dedented clause and a final end shared with their containing form. Keep EOF
  rejection and existing string data. The REPL submits a finished grammar form on
  its last line.
- Implemented legacy/todo setup alternatives from the same incoming scope; do not allow
  duplicate-name failures or leaked bindings to mask a fulfilled todo.

The postfix clarification and current source-prelude boundary are specified in
[POSTFIX.md](design/POSTFIX.md). Optional types are not built-in matcher cases.
These are focused slices, not new completed milestones. Postfix values are
distinct from prefix application. Environment-aware macros belong to 6/7; expected
DSL elaboration belongs to 5b.

### 1–4. Bootstrap foundations — implemented within the boundary above

1. Structural matching/storage/text: exact constructed fields, independent openness,
   positional rest, binding-only defaults, abstract slots/facets, supported global/local
   round trips and explicit unsupported-representation errors.
2. Authoritative pattern and language descriptions: shared binder metadata, source
   schemas and finite recursive descriptors, bounded readers/recognition.
3. Typed quotation and Test data: grammar-directed interpretation, structural splicing,
   explicit single-pass interpolation, Unicode/layout rules, source-only test discovery and
   a common source corpus for CLI/browser.
4. Recursive groups and typed inspection: sibling recursion, finite recursive unions,
   fresh-context transport, rollback, compact local names and public inspection bridge.

These are prototype achievements, not retroactive completion of the revised semantics.
The conformance suite and alignment slices below address their accepted replacements.

### 5a. Vertical spreading and bounded typed Body — implemented

Ordinary source types describe TodoList, Matrix, definitions/destructuring bindings
and a Body with repeated statement rows plus one required final result row. Empty
result () is allowed; an absent result or a final statement rejects. The common
matcher collects typed list dimensions, rejects ambiguous row partitions, preserves
numeric interpretation and source locations, and supports portable descriptions.
Typed quote/read/print and inspection remain inert.

The source Body is opt-in; it does not replace the full bootstrap executable reader.
See [BODY-GRAMMAR.md](design/BODY-GRAMMAR.md) and
[examples/body-grammar.pattern](examples/body-grammar.pattern). These use current
bootstrap declaration spelling and are distinct from pending declaration changes.

### 5a.1. Test DSL conformance suite and selective migration — implemented

Ordinary source Test types and the external runner recognize files containing one
or more named test blocks. Files use **.test** under **tests/**, and Markdown
specs under **specs/** may carry executable unlabeled or `pattern` fences. Both are
discovered with the source suite. Assertions may be plain, legacy or todo. A whole
test may also be marked todo. Ordinary and `todo test` blocks may share a file.
Legacy does not modify whole tests. Ordinary/legacy checks must pass. Todos execute;
their own language-level failures are silent expected failures. A success fails the
suite with “This assertion now passes; remove todo.” Fixture/setup/file/host errors
remain failures.

The suite checks separately checked return values, exact observed types, canonical expected data,
expected subject errors and assertions. Result observations use expect e is v [:: T] (an omitted type is the subject value's type; an explicit one is the exact type);
multiple returns are destructured into separately checked captures. Each subject has a separate child scope;
no assertion grants checking facts or leaks declarations to the next. All assertions
run even after a failed check. Minimal source-only adapters retain future spellings,
which still have to pass the ordinary reader when executed. No future numeric/type
feature is implemented merely by storing or attempting its assertion.

The suite includes C01–C27, the distinct postfix regression, and the
explicit-end layout contracts. The Widget observation is already an ordinary
passing contract. C03's supported Float32/Float64 designation, C19's empty/singleton
rest checks, C24's successive-pack results and C25's equal-precedence infix have no
todo on those supported checks. C24 still records the intended two-result capture
error; C27 remains exploratory. Current bootstrap observations are explicitly
legacy where they depend on superseded bare-raw Expression behavior.

Original source cases retain their intended payloads, with inaccurate type
and expected-spelling assertions fixed. Migrated binding/default host tests
remain. Necessary host/API/AST/UTF-8/DOM/resource/transaction/build and
canonical-source checks remain. Playground options use the same source
corpus, including their shared setup and optional displayed return pack. CLI program output is annotated like REPL output.

[TEST-SUITE.md](design/TEST-SUITE.md) specifies the working grammar and execution.
[TEST-MIGRATION.md](design/TEST-MIGRATION.md) maps coverage. **5a.2 is in progress**: implement
approved value-model slices, remove fulfilled todo markers and explicitly retire
legacy assertions as their compatibility requirements end.

Every remaining legacy assertion is accounted for in
[LEGACY-ASSERTIONS.md](design/LEGACY-ASSERTIONS.md) by a same-subject todo or a
specific unresolved decision. The host suite checks the inventory against source.

### 5a.2. Align the bootstrap with the revised value model — in progress

Implemented slices: exact numeric values/syntax, overlapping abstract unions,
source-defined postfix conventions, direct-member concrete designation and bounded
match-only projection. The unified source/host suite checks their composition.

The first structural-type slice uses `type BoxedText struct Box(value :: String)`
(C05, C16, C18). A producer prints its descriptor and one boxed string. In a
fresh interpreter with the same prelude, the reader reconstructs both from
text. The descriptor must equal an independently constructed `struct Box(String)`,
and the value must equal the corresponding independently constructed box.
Both must print back to the same text. The producer's `.value` accessor is
local to its declaration. The reader can declare its own accessor for the
restored value. The [declaration tests](tests/specification/declarations.test)
and [transport tests](test/round-trip-parsing.test.ts) cover this slice.

Remaining alignment slices:

- Plain type values versus declaration/accessor products; explicit interpreted-value
  boundaries and structural interop. Preserve current equivalent-declaration and
  accessor-collision errors while the replacement policy is deferred; this does
  not block separating declaration effects from ordinary type construction.
- Unambiguous DSL certification, separate from the implemented overlapping abstract unions.
- Extend numeric family/width support without choosing deferred IEEE details or implicit rounding.
- Use a prelude `Predicate` enum for initial refinement descriptors and canonical text.
  Extend designation/projection with checking evidence in milestone 7.
- Extend mirrored spreading beyond the single-row-template slice; settle keyword
  remainder grammar before implementation.

**Complete when each slice:** its approved assertions pass and can lose todo; supported
values/descriptors round-trip without identity changes; superseded bootstrap tests
are explicitly replaced; errors and declaration effects agree across contexts.
C18's independent lexical-scope interop experiment comes before a full module system.
No unaccepted spelling, first-class overload policy or family inversion is chosen
merely to satisfy a future assertion.

### 5b. Grow Body into interpreted Code grammar

The bootstrap implements the single-line String-field slice: annotated bindings and
a uniquely known callable's current pack share one expected-grammar elaborator,
associated by field label or position. Returns, layout, Code categories and
canonical `toString :: String` remain later work.

Propagate expected grammars through bindings, calls and returns, allowing unquoted
DSL forms with normally evaluated field expressions. Keep literal keywords quoted
in grammar patterns and unquoted in grammar-directed data text. Reject ambiguity.

Define useful Code categories as ordinary pattern/grammar types over one stated
surface representation. Extend the bounded source grammar with functions, control
forms, matching and complete bodies. Freeze the public raw-tree/typed-code/descriptor
mapping first; parse directly into Expression remains a later migration, not a
mandatory new primitive taxonomy. Avoid generic applications swallowing
statement forms by accidental priority.

**Complete when:** direct ordinary patterns classify/destructure representative Code,
typed quotes/splices preserve its grammar and packs, recursive grammar groups work,
and raw reading does not execute the stored program. General arbitrary sidefix
repetition/alternation and unrelated syntax additions are not prerequisites.

### 5c. Source-language code.evaluate

Implement an evaluator in the language over a documented pure Code subset: literals,
symbols, complete packs, application, bindings, functions, conditionals and matching.
Code gains `QuotedSymbol` (Symbols only): `:Foo` parses as `:Foo :: QuotedSymbol` and `:Int` is rejected.
Environments, primitive callable vocabulary and closed dependencies are explicit.
Start a portable closed-callable subset without claiming general closure transport.
An embedding adapter may handle external files/console; no source-language native
JavaScript evaluator escape is installed.

**Complete when:** source and bootstrap evaluators agree on the subset and failures;
closed callables transfer independently of host environment identity. Then move Test
execution into the language while preserving the same corpus and assertion modifier semantics.

### 6. Separate elaboration/preparation from runtime execution

Registered macros consume values of grammar types through expandMacro(env)(form).
Registration remains explicit; Code categories beyond sidefix may be registered.
Expose a read-only preparation environment, preserve hygiene/spans, and validate
contextual constraints after structural selection without predicate-based fallback.
Environment-dependent refinements require milestone 7's type queries and remain
preparation-only until portable environment/predicate identity is specified.

Expand registered macros once during preparation, including uncalled function bodies.
Resolve lexical macro/type dependencies and enforce required-known values. Ordinary
Code-returning functions remain runtime functions unless explicitly registered for
expansion. Make capture availability, hygiene, rollback and expansion budgets explicit.

**Complete when:** prepared code has no pending expansion and runtime neither
rediscovers grammar nor repeats macro execution. Failure timing and pack structure
remain stable. Scoped registrations do not imply unrestricted runtime captures.

### 7. Static checker and refinement evidence

Check concrete/abstract comparability, call domains, complete pack arity/labels,
projection coverage and required predicate evidence. Explicit successful checks and
assertions add facts; unnecessary assertions can become warnings as checking improves.
Constant exact-fit proofs are distinct from runtime rounding. Both branches of a
conditional must justify its resulting guarantee. No predicate-driven overload fallback.

**Complete when:** C07–C12's evidence/coverage rules and corresponding cross-context
cases are checked without making specialization the definition of validity. No arbitrary
theorem prover, unchecked insist or constructedBy mechanism is required.

### 8. Compile-time factories and bounded introspection

A generic parser factory returns a function, e.g. parseJson(T)(text). Inspect approved
pattern/type metadata during preparation to generate a decoder/encoder. Capture names
need not remain available on concrete runtime paths; abstract slots keep descriptors
where needed. Settle MemberOf and family recovery before promising bare-family facets.

**Complete when:** two structurally independent types produce specialized JSON codecs,
including recursion/labels/options, without a runtime reflection escape. Generated
implementations are private; specialization preserves already defined abstract calls,
overload selection, errors and portability. Dynamic unknown-member behavior is explicit.

### 9. Modules and structural interoperability

Build on the early lexical-scope experiment. Specify exports/imports, equivalent type
aliases, accessor bundles, local printing and dependency closure. Generic factory
identity does not depend on a declaration's name or creation history.

**Complete when:** independently authored producer/consumer modules exchange equal
structural values without importing a shared nominal type definition, and collisions
have explicit diagnostics/policy. Include schema-evolution and simultaneous-import cases.

### 10. Portable predicates/functions and broader typed text

Extend refinement descriptors beyond the initial `Predicate` enum. Define a closed,
finite code/dependency representation for supported predicates and
functions, including recursive helpers and admissible primitive vocabulary. Substitute
or encode captures without hidden host identities. General descriptor/value decoding
and supported evidence transport need explicit contracts.

**Complete when:** supported callable/predicate-bearing descriptions transfer to a fresh
scope with equal values and canonical text. Every-type coverage remains a goal with
visible limitations. ConstructedBy stays tabled until its decoding problem is explicitly
solved; this milestone must not quietly select replay or witness semantics for it.

### 11. Bounded automatic pre-evaluation and optimization

Fold known pure computations and residualize dynamic inputs. Memoize/share private
specializations. Bound work, recursion, output and specialization count. Optional
optimization may fall back; required preparation must report inability to finish.
Preserve control flow and failure timing; do not execute unreachable failures or
external effects. Compiler optimization cannot add visible overloads or change validity.

**Complete when:** constant parsing can happen early, dynamic parsing still works,
repeated specializations share code, and budget exhaustion has a defined result.

### 12. Self-hosting and compiler

Port the matcher and remaining structural algorithms, implement the compiler using a
backend chosen on merit, then rebuild it with itself. Preserve pack boundaries,
concrete layouts, abstract metadata where required, diagnostics and conformance.
Early compiled execution need not wait for broad automatic optimization.

**Complete when:** bootstrap, source and compiled execution agree on supported active
cases, the compiler rebuilds itself, and remaining host primitives/build steps are explicit.

## Evidence and guardrails

Keep positive, negative and cross-context cases in the shared language corpus; keep
host invariants where they can be checked meaningfully. Pending todos expose intended
coverage gaps instead of hiding them as passes. Public playground examples are executable
cases, not promises copied from the design record. Changes to ambiguous union policy,
primitive interpretation or accessors must replace obsolete expectations deliberately.

The string/quotation specification remains implemented for its documented subset.
The older canonicalization proposal is separate exploratory work; it does not reintroduce
implicit normalizers, defaults in types or an assumed constructedBy implementation.
