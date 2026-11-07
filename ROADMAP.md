# Roadmap and current specification

Updated 7 November 2026. This is the current design, implementation boundary and
milestone sequence, not a development history. The integrated
[decision/conformance record](design/LANGUAGE-DECISIONS.md) supplies reasons, status
and 27 named design cases. [VALUE-SPACES.md](VALUE-SPACES.md),
[TYPE-VALUES.md](TYPE-VALUES.md) and [GRAMMAR.md](GRAMMAR.md) detail the contract.

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
  and f are distinct. Dot/infix/outfix are sugar; infix has equal precedence and
  right associativity. Labels are lowercase, unique and canonically sorted after
  positional fields. () is an empty pack, not an implicit unit value.
- Patterns share structural recognition/capture rules. Packs tolerate extra labels;
  constructed shapes are exact unless open. Positional rests never collect labels.
  Each repeated dimension adds one list layer; horizontal-plus-vertical has T**.
- Type identity is normalized structural descriptor equality. Capture/declaration
  names and caches do not participate. This is not extensional predicate equivalence.
- Concrete designation may recurse only along a unique justified inward path.
  Explicit match projection crosses one concrete boundary; ordinary bindings and
  dispatch do not unwrap. Predicate evidence and single-arm coverage are required.
  These decisions are settled.
- All numeric literals denote exact Rationals. 0f selects a Float64-rounded Rational;
  it is not a Float64-typed value. Exact designation never silently rounds. Explicit
  converters return fixed-precision values with their own operations.
- General abstract unions may have overlapping spellings. A separate unambiguous
  grammar requirement supports annotation-free DSL text. Typed general text retains
  sufficient member reconstruction information; no branch priority is introduced.
- Declarations register type/accessor/local-printing metadata. Plain type construction
  is capture-free and has no accessor-installation effect. Binding defaults supply
  captures only; type defaults and implicit normalization remain excluded.
- Refinement-qualified functions are legal. Missing evidence is a checking failure;
  overlapping base/refinement overloads do not gain priority by evaluating predicates.
- Structured runtime values require an established concrete interpretation. Optional
  runtime Expression and descriptor-to-value decoding remain undecided. Distinct
  source syntax evaluating to the same primitive is not a type-equality exception.
- Global typed text is independent of lexical aliases. For a fixed T, equal values
  have equal canonical text and parse(T)(toString(T)(v)) == v for the supported subset.
  Local variants may reuse names in the same scope. Abstract slots retain type metadata
  where needed; concrete paths need not universally retain it.
- Code-producing functions do not automatically register macros. Explicit registration,
  phase availability and hygiene remain separate from runtime Code-valued functions.

### Deliberately deferred or provisional

ConstructedBy is tabled entirely until decoding its refinement values is solved.
No replay/image/provenance model, arbitrary witness format or unchecked insist is
selected. Ordinary where refinements remain in scope.

IEEE signed zero, NaN identity/payloads and infinities remain deferred. Numeric
family aliases, edge rounding/overflow and canonical spelling remain provisional.

Type declaration keywords, angle parameter sugar, MemberOf, bare-family facets,
parameter recovery, singleton abstract policy, duplicate local names/accessor
imports and runtime Expression remain explicitly provisional/unresolved. First-class
overload sets are not accepted. Specialization is only a deferred optimization of
already defined abstract-call semantics, never a source-visible overload generator.

## What is implemented now

The reference is TypeScript prototype 0.2. **All 128 source cases execute**, with
**250 passing assertions (70 legacy)** and **116 todo expected failures**. The corpus
includes 76 playground examples, 14 other conformance cases, nine migrated binding/
default cases and the 27 C01–C27 design cases. Host/canonical/control checks execute
separately; expected failures are not counted as passing assertions. The complete
verification gate passes 741 tests with no skips, plus build/type checks.

| Implemented foundation | Boundary |
| --- | --- |
| Shared pattern compiler/matcher; exact/open fields; captures/rest/defaults | Revised declaration-only accessor and proof rules need alignment |
| Structural Type data/schema, recursion, abstract slots, facets, typed text | Public type/predicate/function coverage remains bounded |
| Scoped sidefix registration, typed grammar quotes, interpolation and diagnostics | No full prepare-once elaborator or source evaluator |
| Source-defined Test data and shared playground/CLI corpus | Grouped .test files, setup/check steps and executed todo/legacy assertions; full executable nested suites remain deferred |
| Mutually recursive declaration groups and typed code inspection | Code still uses its public SyntaxNode/TreeGrammar bridge |
| Vertical collection matching and bounded source Body grammar | General Code coverage, vertical value spreading and keyword capture remain work |

### Bootstrap behaviors superseded by the intended design

- JS-backed Int/Float/Float32 and Number-as-Float, rather than exact Rational literals.
- Syntax-disjointness required for every UnionType, rather than a separate DSL requirement.
- Old def/type construction and accessor products; duplicate structural declarations
  rejected across visible scopes, with a replacement policy still unresolved.
- Raw Expression compatibility values, legacy primitive-atom/cache equality and runtime
  subset checking; the revised identity/evidence/designation model is not yet integrated.
- Ordinary parameter packs for generics; proposed angle sugar is not in the current parser.

The [bootstrap guide](BOOTSTRAP-GUIDE.md), [grammar](GRAMMAR-BOOTSTRAP.md) and
[type reference](TYPE-VALUES-BOOTSTRAP.md) retain runnable existing syntax. Do not
rewrite their current observations as if all target changes were shipped.

## Milestones

### Accepted surface and test-runner work

[SURFACE-EXTENSIONS.md](design/SURFACE-EXTENSIONS.md) records the accepted postfix,
ASCII symbol, nonempty-list, typed macro, expected-DSL and setup-alternative contracts.
[WHITESPACE.md](design/WHITESPACE.md) specifies significant whitespace and mandatory
explicit layout termination, including shared string/if terminator ownership.

- Implemented ASCII LowerCamelSymbol / UpperCamelSymbol / UpperSnakeSymbol classes;
  preserve the disambiguation table, defer Unicode casing and UpperSnake binding roles.
- Implemented grammar diagnostics with found input, active expected form and locations.
  Contextual type-inference diagnostics still depend on milestones 6/7.
- Extend the shared tree/value/pattern/serialization adapters with distinct postfix
  expressions. Suffixes are one character each: T** is (T*)*, and String?*^! wraps
  from the nearest suffix outward. Type-name/head rules apply to every suffix.
- Add T+ as a nonempty-list refinement of T*. Retain the explicit vertical ... marker
  and replace TestFileContent's first/tail workaround once common repetition supports it.
- Implement explicit layout end ownership and migrate source/host fixtures together.
  Reject missing inner ends; clause continuations belong to one grammar form, not
  unrelated statements. Support strings ending at a dedented clause and a final
  end shared with their containing form. Keep EOF rejection and existing string data.
- Implemented legacy/todo setup alternatives from the same incoming scope; do not allow
  duplicate-name failures or leaked bindings to mask a fulfilled todo.

These are focused slices, not new completed milestones. Postfix value identity and
transport must be coherent across all common adapters before its syntax is shipped.
Environment-aware macros belong to 6/7; expected DSL elaboration belongs to 5b.

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
or more named test blocks. Files use **.test**, are grouped by topic under **tests/**,
and are recursively discovered. Assertions may be plain, legacy or todo. Modifiers
do not apply to tests. Ordinary/legacy checks must pass. Todos execute; their own
language-level failures are silent expected failures. A success fails the suite with
“This assertion now passes; remove todo.” Fixture/setup/file/host errors remain failures.

The suite checks separately checked return values, exact observed types, canonical expected data,
expected subject errors and assertions. Result observations use expect e result v :: T;
multiple returns are destructured into separately checked captures. Each subject has a separate child scope;
no assertion grants checking facts or leaks declarations to the next. All assertions
run even after a failed check. Minimal source-only adapters retain future spellings,
which still have to pass the ordinary reader when executed. No future numeric/type
feature is implemented merely by storing or attempting its assertion.

All 128 cases run, including C01–C27. The corpus has 250 passing assertions (70
legacy) and 116 todo expected failures. The Widget observation is already an ordinary
passing contract. C03's supported Float32 designation and C19's empty/singleton rest
checks have no todo. C27 remains exploratory. Current bootstrap observations are
explicitly legacy where they depend on raw Expression behavior.

The 90 original source cases retain their intended payloads, with inaccurate type
and expected-spelling assertions fixed. Nine binding/default host tests remain
migrated. Necessary host/API/AST/UTF-8/DOM/resource/transaction/build and 14 canonical-
source checks remain. All 76 playground options use the same source
corpus, including their shared setup and optional displayed return pack. CLI program output is annotated like REPL output.

[TEST-SUITE.md](design/TEST-SUITE.md) specifies the working grammar and execution.
[TEST-MIGRATION.md](design/TEST-MIGRATION.md) maps coverage. **5a.2 is next**: implement
approved value-model slices, remove fulfilled todo markers and explicitly retire
legacy assertions as their compatibility requirements end.

Every remaining legacy assertion is accounted for in
[LEGACY-ASSERTIONS.md](design/LEGACY-ASSERTIONS.md): 48 have executable same-subject
todo replacements, and 22 await a stated design decision. Stable checks are ordinary
assertions. The inventory is checked against the suite, and companion todos do not
remove supported playground programs.

### 5a.2. Align the bootstrap with the revised value model — staged after suite support

Implement independently reviewable slices against future assertions:

- Plain type values versus declaration/accessor products; explicit interpreted-value
  boundaries and structural interop. Resolve alias/import policy before encoding it.
- General abstract unions with member tags, separating unambiguous DSL certification.
- Exact Rational literal representation and typed numeric converters, without choosing
  deferred IEEE details or implicit rounding. Retain explicit unsupported boundaries.
- One-boundary projection and unique contextual designation for the supported
  non-predicate subset. Checker-dependent cases remain pending for milestone 7.
- Approved mirrored spreading/keyword remainder rules after their grammar is settled.

**Complete when each slice:** its approved assertions pass and can lose todo; supported
values/descriptors round-trip without identity changes; superseded bootstrap tests
are explicitly replaced; errors and declaration effects agree across contexts.
C18's independent lexical-scope interop experiment comes before a full module system.
No unaccepted spelling, first-class overload policy or family inversion is chosen
merely to satisfy a future assertion.

### 5b. Grow Body into interpreted Code grammar

Propagate expected grammars through bindings, calls and returns, allowing unquoted
DSL forms with normally evaluated field expressions. Keep literal keywords quoted
in grammar patterns and unquoted in grammar-directed data text. Reject ambiguity.

Define useful Code categories as ordinary pattern/grammar types over one stated
surface representation. Extend the bounded source grammar with functions, control
forms, matching and complete bodies. Freeze the public raw-tree/typed-code/descriptor
mapping first; optional runtime Expression/ExpressionTree is a remaining choice,
not a mandatory new primitive taxonomy. Avoid generic applications swallowing
statement forms by accidental priority.

**Complete when:** direct ordinary patterns classify/destructure representative Code,
typed quotes/splices preserve its grammar and packs, recursive grammar groups work,
and raw reading does not execute the stored program. General arbitrary sidefix
repetition/alternation and unrelated syntax additions are not prerequisites.

### 5c. Source-language code.evaluate

Implement an evaluator in the language over a documented pure Code subset: literals,
symbols, complete packs, application, bindings, functions, conditionals and matching.
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

Define a closed, finite code/dependency representation for supported predicates and
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
host invariants where they can be checked meaningfully. Pending counts expose intended
coverage gaps instead of hiding them as passes. Public playground examples are executable
cases, not promises copied from the design record. Changes to ambiguous union policy,
primitive interpretation or accessors must replace obsolete expectations deliberately.

The string/quotation specification remains implemented for its documented subset.
The older canonicalization proposal is separate exploratory work; it does not reintroduce
implicit normalizers, defaults in types or an assumed constructedBy implementation.
