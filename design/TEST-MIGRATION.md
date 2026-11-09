# Test migration inventory

Current conformance homes for milestone 5a.1. `.test` case IDs are path-relative to
`tests/`. Existing source expectations are retained; the mappings below let
a reader locate them after grouping. This is coverage accounting, not a language
semantics changelog.

## TypeScript semantics moved into the DSL

All entries below were active tests in `test/binding-defaults.test.ts`. Their
language assertions now run in `tests/bindings/defaults.test`; the duplicate host
blocks were removed only after the source cases passed. Mixed host checks remain.

| Former test | Current case suffix in bindings/defaults | Checks retained |
| --- | --- | --- |
| ordinary factory functions supply defaults and return complete typed values | explicit-factories-supply-defaults-and-complete-typed-values | missing/supplied defaults, accessor, equality |
| declaring types cannot rewrite ordinary symbolic construction | declarations-cannot-rewrite-symbolic-construction | symbolic heads and field completeness |
| destructuring defaults bind captures without adding fields | destructuring-defaults-bind-captures-without-adding-fields | unchanged raw value, explicit/implicit captures |
| named and anonymous parameter defaults share binding semantics | named-and-anonymous-parameter-defaults-share-binding-semantics | both parameter contexts |
| match defaults bind missing captures without changing the scrutinee | match-defaults-preserve-the-scrutinee | capture and unchanged value |
| supplied values are validated and never replaced by defaults | supplied-values-are-validated-and-never-replaced-by-defaults | supplied value, rejected supplied/default values |
| supplied fields select an overload before binding its omitted defaults | supplied-fields-select-an-overload-before-binding-defaults | both supplied domains and omitted ambiguity |
| defaults retain lexical bindings and whole-pack partial application | defaults-retain-lexical-bindings-and-successive-packs | lexical scope and successive packs |
| binding defaults preserve option-type semantics | binding-defaults-preserve-option-semantics | valid unwrapped default and invalid tagged default |

Expected values/types are written explicitly; old display-string tests are not
silently converted into self-generated expected outputs. Failure substrings preserve
the old error conditions. The source corpus also checks exact full packs.

## Retained and deferred coverage

tests/setup/alternatives.test adds the current/future declaration pair as a real
setup alternative. tests/symbols/classes.test checks the complete ASCII class table.
Host tests retain trial isolation, duplicate-name unmasking, recursive grouping,
fixture replay, source spelling and host-failure boundaries.

[The legacy inventory](LEGACY-ASSERTIONS.md) accounts for every remaining legacy
assertion. Defaults, concrete accessor results, structural equality/round trips and
pack distinctions now use ordinary checks where their behavior is supported.
Arithmetic/rest/default examples establish concrete types when their purpose does
not depend on raw Expression fallback. Settled future changes retain executed todo
assertions; `just test-language` reports the current suite. Unresolved replacements
are recorded individually and checked against the corpus.
No failing placeholder is substituted for an unspecified target result.

| Area | Current home and reason |
| --- | --- |
| Pattern metadata, compiler captures and Grammar rest maps | test/pattern-bindings.test.ts; portable matching/hygiene moved to tests/matching; host keeps compiled capture metadata |
| Default host invocation counters, declaration rollback and exact source diagnostics | test/binding-defaults.test.ts; API/state/span observations need host access |
| Type identity, abstract slots, caches, unsupported host environments and transport | existing type/value/abstract tests; retain direct representation/fresh-process checks |
| Numeric exactness/conversion, overlapping unions and remaining type/evidence behavior | host and tests/numeric/*.test regressions; supported slices replace their corresponding legacy expectations |
| Typed quotes, byte normalization and raw syntax encode/decode | tests/quotes/evaluation.test plus host quotes/postfix files; kind/key/encode-decode, empty preludes and hole locations stay |
| Vertical matching, row keys, ambiguity, descriptor transfer | tests/spreading/*.test plus test/vertical-spread.test.ts; host keeps dimensions, Float32 text, locations, ambiguous partitions and fresh-interpreter transport |
| Canonical source behavior of the former test/cases suite | test/source-suite.test.ts; canonicalizes then runs the same DSL expectation |
| Test schema round trips, execution/isolation traps, fixtures and error phases | test/test-suite.test.ts; checks the harness rather than language examples |
| Recursive discovery, CLI process status and expected-failure reporting | test/test-cli.test.ts; needs filesystem/process observations |
| Actual controls, sorting and old/new storage restoration | test/playground.test.ts; every executable example exercised through DOM controls |
| Resource limits, staging rollback, build/schema synchronization | test/staging.test.ts plus tests/macros/staging.test; host keeps parse-only, REPL reuse after failure and transactional rollback |
| Revised primitives, value spaces, proof evidence, projections, facets and spreads | tests/specification/*.test; C01–C27 execute assertion-level todos, C27 explicitly exploratory |
| PR9 layout behavior (EOF/`end`/quoted clauses/mixed indent/incomplete infix/extra `end`) | tests/layout/*.test via live eval and `expect parse(Code)(text) error`; host keeps Grammar-object `parseSurface`, session-macro probe/then success and extra-`end` parse failure, REPL completeness, and indent-prefix unit checks |
| Parse-failure harness (`parse(Code)` of quoted payload, ordinary `expect … error`) | test/test-suite.test.ts plus tests/layout/explicit-ends.test `infix` |
| Suffix wrap order, prefix `+Int`/`+(Int)` identity, tight `Int+` not prefix `+` | tests/specification/postfix-suffixes.test |

No whole-file migration is claimed for candidate files outside the selected batch.
A smaller TypeScript-only suite does not imply lost semantic coverage; expected failures
are not new passing assertions.

## Minus and type-capture migration

The next batch moves ordinary language observations out of
`test/minus.test.ts` and `test/titlecase-captures.test.ts`. It adds no runtime
features or todo assertions. Expected values remain explicit data.

| Former host observations | Source home | Retained host boundary |
| --- | --- | --- |
| Prefix negation, parenthesized negation, subtraction and a negated right operand | tests/numeric/minus.test | Four exact parser/normal-form assertions remain in test/minus.test.ts |
| Prefix/infix minus Code text round trips | tests/numeric/minus.test | All six direct Interpreter.evaluateCode checks remain; source tests do not substitute reading stored Code for executing it |
| Type-valued captures in factories, bindings, labeled parameters and match arms | tests/bindings/type-captures.test | Invalid-capture diagnostics and bare UpperCamel reference rules remain in test/titlecase-captures.test.ts |
| Type-valued accessors and structural type equality | tests/bindings/type-captures.test | Macro hygiene and capture-validation diagnostics remain in test/titlecase-captures.test.ts |

The minus host tests also keep both exact `E_NO_METHOD` checks proving that the
first infix pack is validated before a missing right operand is evaluated,
including the quoted-Code execution path. No source evaluator API is introduced
for this migration.

## Macro evaluation and hygiene migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) classifies the host
suite by its observations and records the later candidates and decision boundaries.
Its first implemented batch moves 17 scalar observations from two mixed host files
into 12 ordinary source cases. Expected results are authored directly; the
defaulted Int parameter keeps its Int result and the other results are Rational.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| macros: sidefix macros receive unevaluated arguments and recursively expand Code | macros/evaluation#sidefix-macros-receive-syntax-and-recursively-expand-code | All four results: direct/recursive expansion, unused failing operand and lazy branch |
| macros: a user-defined if expands into match and keeps the other branch unevaluated | macros/evaluation#user-defined-if-expands-into-match-and-leaves-the-other-branch-inert | The user-defined match transformer and failing unselected branch remain in the program |
| macros: quotation keeps caller names separate from template lambda binders | macros/hygiene#inserted-caller-references-stay-separate-from-template-lambda-binders | Both caller-shadowing and binder-reuse examples |
| macros: template free functions resolve in the macro definition scope | macros/hygiene#template-free-functions-resolve-in-the-macro-definition-scope | Caller-local helper still conflicts with the definition-site helper |
| macros: template block bindings and defaulted lambda labels are hygienic | macros/hygiene#template-block-bindings-preserve-caller-references; macros/hygiene#template-lambda-labels-retain-defaulted-captures | Caller/template block bindings and the defaulted Int capture remain separate checks |
| macros: macro templates retain locally declared sidefix grammars | macros/hygiene#macro-templates-retain-locally-declared-sidefix-grammars | Nested macro's definition-time grammar |
| macros: macro expansion supports definitions in a generated local block | macros/hygiene#macro-expansion-supports-definitions-in-a-generated-local-block | Generated local definition is called after expansion |
| registration: only explicit registration suppresses argument evaluation | macros/evaluation#only-registered-expansion-suppresses-argument-evaluation | Positive expansion moved; ordinary-builder E_UNBOUND_NAME remains in TypeScript |
| registration: sidefix registration can delegate to an ordinary code builder | macros/evaluation#sidefix-registration-delegates-to-an-ordinary-code-builder | Positive delegation moved; implicit-registration E_MACRO_REGISTRATION remains in TypeScript |
| registration: raw references and macro syntax arguments do not read runtime values | macros/evaluation#quoted-runtime-references-and-inserted-syntax-stay-available | Both quoted-runtime reference and ordinary-builder insertion examples |
| registration: registered transformers retain hygienic helper references | macros/hygiene#registered-ordinary-builders-retain-hygienic-helper-references | Ordinary builder keeps definition-site helper despite caller-local shadowing |

Nine complete host blocks and two positive assertions in mixed blocks were removed
after the source cases passed. Retained macro/registration host coverage includes
all exact error-code checks, REPL/parse-only/rollback state, call/definition related
locations, expansion limits, canonical-tree round trips, complete packs and Code
display observations. The mixed host blocks were renamed to describe the failures
they still check. No expected-failure or legacy marker was added or changed.

## Language evaluation migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) marked `test/language.test.ts`
as the next mixed batch. Ordinary call, block, label, rest, type and namespace
observations now run as source cases under `tests/language/`. Expected results are
authored data. Empty packs use destructuring assertions because a result check
requires one positional value. Parse failures of malformed text use
`expect parse(Code)(…) error "…"`.

The former shared `cases` table both evaluated programs and drove canonical
round trips. Evaluation now lives in the `.test` files. Host round trips parse
each executable `program: true` source case (skipping error-only cases),
canonicalize its extracted program, and re-run it. Printer and empty-pack display
programs that cannot be expressed as result data stay next to their host assertions
and are round-tripped from that same list, so there is still one inventory per
program.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| cases: function value | — | `<function>` printer output remains in TypeScript; closures have no structural result data |
| cases: empty results / empty lambda | language/blocks#empty-results; language/blocks#empty-lambda | Empty-pack display `()` remains in TypeScript as a complete-pack observation |
| cases: multiple results, named binding capture/ignore, extra names | language/calls#multiple-results; language/calls#ignore-named-binding-result; language/calls#capture-named-binding-result; language/calls#ignore-preceding-extra-name | Original programs and Rational/String results |
| cases: lowercase captures, empty outfix, vectors, tuples, recursive values | language/types#lowercase-captures-only; language/types#empty-outfix; language/types#repeated-type; language/types#nested-vector; language/types#tuple-type-args; language/types#empty-tuple-type-args; language/types#recursive-type | Uninterpreted `[]` keeps `:: Expression`; Vector/Tuple/List results keep their constructed types |
| cases: lazy names | — | `Type(Recursive(…))` printer spelling remains in TypeScript; expected Type data cannot name `List(Int)` and still match the observed value |
| cases: field accessor/function/capture, rest accessor, interpretation equality, ordering, quoted symbol, pattern union | language/types#field-accessor; language/types#field-function; language/types#field-name-versus-capture; language/types#rest-accessor-returns-list; language/types#interpretation-equality; language/types#structural-ordering; language/types#quoted-symbol; language/types#pattern-union | Positive evaluation moved; no structural-accessor discovery and equal named interpretations stay as source errors |
| cases: blocks, nested def, anonymous block, if, match, macro in head | language/blocks#block-result-pack; language/blocks#block-def; language/blocks#nested-definition; language/blocks#anonymous-block; language/blocks#if-clauses; language/blocks#match; language/calls#macro-in-head | Original programs |
| cases: anonymous type macro, option, list of options, result | language/types#anonymous-type-macro; language/types#option; language/types#list-of-options; language/types#result | The anonymous type-macro program is included in canonical round trips |
| failures: arity, packs, captures, numeric mixing, Number, recursion, program/block endings | language/calls and language/types error cases; language/blocks#program-final-binding; language/blocks#block-final-binding; language/blocks#program-final-definition | Message substrings preserved; program-ending checks are live subjects, not `parse(Code)` |
| failures: infix spaces, named-before-positional, duplicate labels | language/namespaces#infix-needs-spaces; language/namespaces#named-precedes-positional; language/namespaces#duplicate-labels | `parse(Code)` of quoted payloads |
| nested bindings / ignored labels, constructor shape, shared type references, complete fields | language/calls#nested-bindings-require-explicit-label-openness; language/calls#nested-function-patterns-permit-explicitly-ignored-labels; language/types#constructor-shape-independent-of-interpretation-names; language/types#parameter-annotations-and-destructuring-share-type-references; language/types#type-annotation-checks-all-declared-fields | Original programs |
| opaque function/partial equality | language/types#opaque-functions-require-a-structural-representation-for-equality; language/types#opaque-partial-applications-cannot-use-host-identity-as-equality | Language error; not a host-identity check |
| labels, defaults, option `?` fields, named matching/order | language/labels/* | `parseExpression` canonical field order and duplicate-label trees remain in TypeScript |
| rest captures at every length and binding boundary | language/rest/* | Each length/boundary is an explicit case |
| extra names, wrappers, partial applications | language/calls#all-calls-ignore-extra-names; language/calls#accessors-ignore-extra-names; language/calls#calls-require-positional-and-named-pattern-fields; language/calls#anonymous-wrappers-remain-values; language/calls#pack-partial-applications-remain-values | Original programs |
| built-in exact labels, local named captures, grouped layout, ambiguous patterns | language/types#built-in-concrete-types-require-exact-labels; language/types#named-type-captures-stay-local-to-each-interpreted-instance; language/blocks#grouped-layout-must-consume-every-source-line; language/namespaces#ambiguous-patterns-do-not-silently-fall-through-match-arms; language/namespaces#ambiguous-patterns-do-not-silently-dispatch | Layout uses `parse(Code)` |
| namespaces, defined functions not values, direct calls | language/namespaces/* | Exact `E_AMBIGUOUS_CALL` and `<function>` display remain in TypeScript |
| equals-in-block, actions absent, reserved `!` | language/blocks#equals-*; language/namespaces#actions-are-absent; language/namespaces#prefix-exclamation-stays-reserved | `parseExpression("()!").kind` and `normal("Int!")` remain in TypeScript |

Retained language host coverage is printer/pack display, `parseExpression` structure and ASCII spelling, Grammar-object parse/rejection, REPL commit/rollback, and the exact `E_AMBIGUOUS_CALL` code on competing callable/accessor names. No expected-failure or legacy marker was added or changed. `#48` (concrete/abstract declaration spelling) and `#52` (application-head specification queue) were not edited; bootstrap `def … type` setup and existing head-evaluation examples stay on current syntax.

## Matching and availability migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) grouped `test/consistency.test.ts`,
`test/pattern-bindings.test.ts` and `test/milestone-two-review.test.ts` as the next
mixed batch. Portable cross-context matching and available-default examples now
run under `tests/matching/` and `tests/macros/availability.test`. Expected results
are authored data. `#32` has landed; bootstrap `def … type` remains setup, not a
declaration-product change.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| consistency: sidefix spread rejected but argument-pack spread remains valid | matching/sidefix#argument-pack-rest-is-valid-in-a-pair-constructor; matching/sidefix#argument-pack-rest-is-valid-in-args | Positive Pair/Args rest moved; exact `E_SIDEFIX_SPREAD` stays in TypeScript |
| consistency: a list annotation means a list in direct and constructor-shaped sidefix parameters | matching/sidefix#a-list-annotation-means-a-list-in-a-constructor-shaped-sidefix-parameter; matching/sidefix#a-list-annotation-means-a-list-in-a-direct-sidefix-parameter; matching/sidefix#a-list-annotation-does-not-accept-adjacent-operands-as-a-list | Both positive lists and the adjacent-operand grammar error |
| consistency: a named structural pattern works in all five contexts | matching/cross-context#a-named-structural-pattern-works-as-* | Ascription, binding, function, Args macro, sidefix and match |
| consistency: named pattern grammar respects block scope and failed REPL transactions | — | Interpreter REPL commit/rollback remains a host session check |
| consistency: head quoting and structural interpolation produce the same data | matching/cross-context#head-quoting-and-structural-interpolation-produce-the-same-data | Quoted constructor head and interpolated Expression tree |
| consistency: source formatting of constructed literals | — | `normal` of host syntax trees plus `displayString` stays |
| consistency: no sequence repetition or alternation extension | matching/hygiene#no-sequence-repetition-or-alternation-extension-is-introduced | Language error moved; `parseExpression("x").kind` stays |
| pattern-bindings: compiled metadata, non-binding sites, alternative/duplicate paths, ref/map scopes | — | `patternBindings`, `validatePatternCaptures`, `bindingPattern` and direct Pattern objects stay |
| pattern-bindings: one positional and rest pattern across contexts | matching/cross-context#one-positional-and-rest-pattern-agrees-in-* | Binding, function, match, type accessor and macro; Grammar `parseAs` and compiled `first`/`rest` keys stay |
| pattern-bindings: hygiene of quoted literals, constructor heads, defaults, alternatives, inserted patterns | matching/hygiene#hygiene-preserves-quoted-literal-patterns; matching/hygiene#hygiene-preserves-literal-constructor-heads; matching/hygiene#default-expressions-use-the-surrounding-scope-before-binding-captures; matching/hygiene#hygiene-renames-all-alternative-sites-together; matching/hygiene#inserted-patterns-stay-in-their-caller-scope | Original programs |
| pattern-bindings: alpha-renaming cannot hide duplicate captures | matching/hygiene#alpha-renaming-cannot-hide-duplicate-captures-in-separate-parameter-packs | Message substring; not an exact diagnostic-code host check |
| milestone-two-review: omitted defaults, match captures, helper defaults/annotations hide runtime | — | Exact `E_MACRO_RUNTIME_CAPTURE` stays |
| milestone-two-review: constant defaults and quoted runtime references remain available | macros/availability#constant-defaults-remain-available-to-a-generated-macro; macros/evaluation#quoted-runtime-references-and-inserted-syntax-stay-available | Constant default moved; quoted runtime reference already had a source counterpart |
| milestone-two-review: quoted root heads agree between grammar, runtime types and macro signatures | matching/cross-context#quoted-root-heads-agree-at-runtime-types; matching/cross-context#quoted-root-heads-agree-in-a-macro-signature | `.matches` and sidefix take moved; Grammar-object `parseAs` stays |
| milestone-two-review: quoted annotation operators are literal heads | macros/availability#quoted-annotation-operators-are-literal-heads-not-pattern-computations | Positive match moved; the runtime-capture default failure stays |

Host remainder is compiler capture metadata, Grammar objects, REPL rollback, exact diagnostic codes, constructed-literal formatting and `parseExpression` kind. No expected-failure or legacy marker was added or changed. `#48` and `#52` were not edited.

## Staging migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) grouped `test/staging.test.ts`
as the next mixed batch. Scalar generated-grammar and definition-time-grammar
examples now run under `tests/macros/staging.test`. Expected results are authored
data. `#48` was not edited; bootstrap `def … type` remains setup.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| staging: a generated sidefix definition recognizes the following source line | macros/staging#a-generated-sidefix-definition-recognizes-the-following-source-line | Install then use `answer` in the same program |
| staging: generated grammar is local and reusable on separate function invocations | macros/staging#generated-grammar-is-reusable-on-separate-function-invocations; macros/staging#generated-grammar-does-not-escape-a-function-body | One-program reuse and post-call locality; REPL define/invoke/leak stays |
| staging: failed submissions roll back generated grammar and generated methods together | — | Transactional rollback and successful reuse after failure stay |
| staging: generated function parameters cannot capture inserted caller expressions | macros/staging#generated-function-parameters-cannot-capture-inserted-caller-expressions | Inserted `x` stays in the caller; generated `add` parameter remains distinct |
| staging: generated macro retains its own interpolation stage and parameter scope | macros/staging#a-generated-macro-retains-its-own-interpolation-stage-and-parameter-scope | Nested generated `twice` expands after install |
| staging: parse-only never runs an installer or commits its declaration | — | `Interpreter.parse` no-execution stays |
| staging: ordinary functions retain their definition-time grammar | macros/staging#ordinary-functions-retain-their-definition-time-grammar | Later `if` redefinition does not change `f` |
| staging: a generated final definition is still invalid as a program result | macros/staging#a-generated-final-definition-is-still-invalid-as-a-program-result | Message substring; same rule as ordinary final definitions |
| staging: a generated structural type participates in subsequent sidefix patterns | macros/staging#a-generated-structural-type-participates-in-subsequent-sidefix-patterns | Generated `Point` used as a later sidefix parameter |

Host remainder is parse-only no-execution, repeated REPL submissions, successful reuse after failure and transactional rollback. No expected-failure or legacy marker was added or changed.

## Quotes and postfix migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) grouped `test/quotes.test.ts`,
`test/postfix.test.ts` and `test/postfix-conventions.test.ts` as the next mixed
batch. Portable literal evaluation now runs under `tests/quotes/evaluation.test`
and `tests/postfix/values.test`. Expected results are authored data. `#31` has
landed; `#48` was not edited. Existing quotation and postfix specification cases
are reused rather than duplicated.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| quotes: head-only and whole-expression quotation remain distinct | examples/quotation#quoted-expression-values; quotes/evaluation#head-only-quotation-interpolates-whole-expression-quotation-does-not | `:f(1)` already existed; `:Box(x)` vs `:(Box(x))` is new |
| quotes: typed quote blocks expand macro templates with explicit interpolation | quotes/evaluation#typed-quote-blocks-expand-macro-templates-with-explicit-interpolation | Positive `addOne`; `Interpreter.parse` of an unclosed `Code` block stays |
| quotes: unknown reader functions produce a source-located name error | — | Exact `E_UNBOUND_NAME` and line stay |
| quotes: reader blocks preserve raw punctuation and indented end content | quotes/evaluation#reader-blocks-preserve-raw-punctuation-and-indented-end-content | Authored fragment text |
| quotes: canonical source retains explicit templates and residual dollar holes | — | Parse-tree kind plus `normal` re-run stays |
| quotes: hole errors identify the actual interpolation expression | — | Exact line/column stay |
| postfix: tight suffix punctuation is postfix, prefix remains apply | — | `parseExpression` kind, `syntaxKey`, `normal` and encode/decode stay |
| postfix: postfix values match payloads and differ from prefix application | postfix/values#a-postfix-*-value-matches-its-payload; postfix/values#prefix-star-and-caret-remain-ordinary-application; postfix/values#spaced-ampersand-and-tilde-remain-infix-data; postfix/values#prefix-question-mark-is-ordinary-application-not-an-optional; postfix/values#optional-type-descriptions-print-as-none-unions | Exact `E_RESERVED_OPERATOR` and `E_UNQUOTE_CONTEXT` stay; optional/`E_NO_METHOD`/`E_INCOMPARABLE_TYPES` already had source counterparts |
| postfix: keyword rest is prefix `**` and postfix `rest**` | — | Tree shape plus exact `E_KEYWORD_REST_UNSUPPORTED` stay |
| postfix: postfix `T*` / `T**` and prefix `**x` do not share a spaced tree | tests/specification/postfix.test already covers the portable `parse(Code)` equalities | Host `parseExpression` kind/`normal`/`syntaxKey` stay |
| postfix-conventions: postfix question mark has no optional meaning without a source definition | postfix/values#an-ordinary-postfix-question-mark-definition-coexists-with-the-optional-convention | Empty-prelude `Interpreter` checks stay |
| postfix-conventions: every accepted suffix survives syntax and typed value transport | — | Encode/decode and empty-prelude parse/toString stay |
| postfix-conventions: bootstrap list and result conventions remain usable | language/types#option; language/types result; specification/postfix-suffixes#the-bootstrap-list-convention-retains-list-matching | Already present |
| postfix-conventions: hash always starts a comment | specification/postfix#postfix-percent-remains-punctuation-hash-is-a-comment; quotes/evaluation#interpolating-a-postfix-percent-preserves-its-spelling | `normal(parseExpression("x#"))` stays |

Host remainder is syntax kind/key/encode-decode, independently configured empty preludes, exact diagnostic codes and interpolation hole locations. No expected-failure or legacy marker was added or changed.

## Spreading and schema-evaluation migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) grouped
`test/pattern-schema.test.ts`, `test/milestone-two.test.ts` and
`test/vertical-spread.test.ts` as the next mixed batch. Portable matching,
type-description evaluation and vertical spreading now run under
`tests/matching/quoted-heads.test`, `tests/matching/open-fields.test`,
`tests/types/descriptions.test` and `tests/spreading/`. Expected results are
authored data. Pending keyword-rest `{**rest}` was not selected. `#48` was not
edited; bootstrap `def … type` remains setup. Existing TodoList, 2-D Matrix and
nested-Body examples were reused rather than duplicated.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| pattern-schema: documented schema is the exact runtime bootstrap source | — | File vs `TYPE_SCHEMA` stays |
| pattern-schema: language schema gates descriptor shapes | types/descriptions#explicit-apply-describes-a-literal-reserved-head | Invalid-shape throws and user-scope `TypeDescription` gating stay |
| pattern-schema: work budgets; TypeDescription matcher; decoder agreement | — | Matcher/compiler schema checks stay |
| pattern-schema: quoted operator heads across matching contexts | matching/quoted-heads#* | Binding, function, match, type and quoted name |
| pattern-schema: alternative branch captures; String constructor round trips | types/descriptions#alternative-branch-captures-erase-without-shared-slots; types/descriptions#string-constructor-patterns-round-trip-without-becoming-string-literals | Original programs |
| pattern-schema: refinements preserve the concrete member; Any | types/descriptions#refinements-preserve-the-concrete-member-selected-by-a-union; types/descriptions#a-refinement-of-any-keeps-the-concrete-int-member | Current `.where` syntax; specification refinement todos were not edited |
| pattern-schema: failed dispatch candidates do not evaluate defaults | types/descriptions#failed-dispatch-candidates-do-not-evaluate-defaults | All three overload programs |
| pattern-schema: public type equality requires value trees | types/descriptions#unordered-union-types-compare-equal; types/descriptions#a-refinement-has-no-structural-representation-for-equality | Invalid `Type(Apply(:A,Int))` stays |
| milestone-two: Language schema file and AST/Grammar transport | types/descriptions#the-language-schema-round-trips-as-a-type-and-as-expression | File identity, encode/decode, `Grammar.fromDescription`, parse-only `parseSyntax` and fresh-grammar macros stay |
| milestone-two: binding/parameter/arm conformance | matching/open-fields#label-order-*; matching/open-fields#defaults-only-bind-omitted-captures-*; matching/open-fields#positional-rest-never-consumes-labels-* | `Grammar.parseAs` stays |
| milestone-two: required fields, exactness and ambiguity | matching/open-fields#a-missing-required-label-*; matching/open-fields#an-unexpected-label-*; matching/open-fields#overlapping-constructor-alternatives-* | `Grammar.parseAs` rejection stays |
| milestone-two: type defaults forbidden; facet accessors | matching/open-fields#type-definitions-cannot-carry-binding-defaults; matching/open-fields#facet-accessors-preserve-original-fields | Original programs |
| milestone-two: duplicate captures; malformed Type arities | — | Exact `E_DUPLICATE_CAPTURE` and `E_TYPE_DESCRIPTION` stay |
| vertical-spread: canonical row trees | — | `parseExpression` `syntaxKey` stays |
| vertical-spread: TodoList/Matrix/Body examples | examples/grammars#vertical-spreading-* | Existing source counterparts |
| vertical-spread: empty/evaluated rows; application-row capture | spreading/vertical#* | Spaced `todo (` syntax stays on the host |
| vertical-spread: Float32 reconstruction; dimension codes; locations; ambiguous partitions; fresh-interpreter transfer | — | Representation, exact codes and transport stay |
| vertical-spread: Body final row and unevaluated definitions | spreading/body#*; host session `E_UNBOUND_NAME` after capturing Body | Round trip moved; session non-installation stays |

Host remainder is schema/decoder identity, Grammar objects, encode/decode, exact dimension/duplicate/type-description codes, Float32 serialization, ambiguous row partitions and fresh-interpreter transport. No expected-failure or legacy marker was added or changed. Keyword-rest grammar was not selected.

## Nested-option and concrete-union migration

The [remaining TypeScript audit](TEST-MIGRATION-AUDIT.md) grouped
`test/nested-option-designation.test.ts` and `test/concrete-unions.test.ts` as
already having source counterparts. Shared positives stay in
`tests/bindings/nested-option-designation.test` and
`tests/specification/concrete-unions.test`. Unique remaining evaluations now run
under `tests/unions/concrete.test`. `#31` has landed; `#48` was not edited.

| Former host block | Current source case(s) | Coverage retained |
| --- | --- | --- |
| nested-option: unwrapped Nested / String?? designate a unique String | bindings/nested-option-designation#unwrapped-nested-option-designates-a-unique-string; bindings/nested-option-designation#nested-postfix-string-designates-a-unique-string | Existing counterparts |
| nested-option: match projects one option boundary | bindings/nested-option-designation#match-projects-one-unwrapped-option-boundary; bindings/nested-option-designation#match-projects-one-postfix-option-boundary | Existing counterparts |
| nested-option: ordinary binding/dispatch and match-arm defaults/predicates | bindings/nested-option-designation ordinary-binding and match-arm cases | Exact `E_PATTERN_MISMATCH` / `E_NO_METHOD` stay |
| nested-option: source optional convention | bindings/nested-option-designation#the-source-optional-convention-is-unwrapped-t-none | Exact tagged-`Some` `E_PATTERN_MISMATCH` stays |
| nested-option: nested postfix absence, including `:None :: String??` | bindings/nested-option-designation#nested-postfix-absence-preserves-explicit-member-evidence | Added the missing `same` ascription equality |
| concrete-unions: binding and expression annotations choose the same outer arm | specification/concrete-unions#a-direct-union-arm-takes-precedence-over-inward-designation | Existing counterpart |
| concrete-unions: explicit inner absence projects once | unions/concrete#an-explicit-inner-absence-projects-once-without-becoming-outer-absence | Exact outer-absence `E_PATTERN_MISMATCH` stays |
| concrete-unions: explicit members survive fresh-interpreter transport | — | Host typed-text transfer stays |
| concrete-unions: peer ambiguity does not depend on source order | unions/concrete#peer-optional-absence-is-ambiguous-regardless-of-branch-order; specification/concrete-unions already covers String? or Float? order | Exact `E_AMBIGUOUS_PATTERN` for both orders stays |
| concrete-unions: direct constructor arm vs inward path | unions/concrete#a-direct-constructor-arm-wins-over-an-inward-path; unions/concrete#a-direct-constructor-arm-wins-regardless-of-branch-order | Both branch orders |
| concrete-unions: already typed payloads designated inward | unions/concrete#already-typed-payloads-can-be-designated-inward-without-binding-projection | Original program |
| concrete-unions: nested annotation payloads remain data in the test DSL | — | Harness `expect` expected-data stays unevaluated |

Host remainder is exact diagnostic codes, fresh-interpreter typed-text transport and test-harness expected-data. No expected-failure or legacy marker was added or changed.

## Existing source cases

| Former source | Current `.test` case ID |
| --- | --- |
| examples/suite/abstractSlots.pattern | examples/expressions#abstract-slots-preserve-identity |
| examples/suite/accessor.pattern | examples/patterns#capture-accessors |
| examples/suite/ambiguity.pattern | examples/expressions#accessor-ambiguity |
| examples/suite/applicationForms.pattern | examples/grammars#dsl-infix-syntax-and-distinct-argument-packs |
| examples/suite/argumentDefaults.pattern | examples/patterns#defaults-in-function-arguments |
| examples/suite/arity.pattern | examples/expressions#result-arity-error |
| examples/suite/block.pattern | examples/expressions#function-block |
| examples/suite/canonicalAlternatives.pattern | examples/types#canonical-type-alternatives |
| examples/suite/codeSplicing.pattern | examples/types#typed-code-and-recursive-splicing |
| examples/suite/defaultConstruction.pattern | examples/types#factory-defaults-and-complete-types |
| examples/suite/defaults.pattern | examples/types#optional-labeled-defaults |
| examples/suite/definitionValues.pattern | examples/expressions#definitions-evaluate-their-bodies |
| examples/suite/empty.pattern | examples/expressions#zero-results |
| examples/suite/exactFields.pattern | examples/patterns#exact-fields-and-rest-markers |
| examples/suite/expectedSyntax.pattern | examples/expressions#deferred-expected-output |
| examples/suite/explicitFields.pattern | examples/types#type-fields-and-ignored-captures |
| examples/suite/generatedMacro.pattern | examples/macros#macro-generated-local-grammar |
| examples/suite/ignored.pattern | examples/expressions#ignore-named-results |
| examples/suite/inspectAnnotation.pattern | examples/expressions#narrow-an-abstract-slot |
| examples/suite/inspectPattern.pattern | examples/types#inspect-a-pattern-union |
| examples/suite/interpolation.pattern | examples/quotation#interpolation-and-literal-dollars |
| examples/suite/labelPattern.pattern | examples/patterns#labels-containing-patterns |
| examples/suite/labels.pattern | examples/patterns#named-result-capture |
| examples/suite/languageData.pattern | examples/expressions#language-as-data |
| examples/suite/localTypeText.pattern | examples/types#local-and-global-type-text |
| examples/suite/macro.pattern | examples/macros#sidefix-macro-choose |
| examples/suite/match.pattern | examples/expressions#match |
| examples/suite/mutualTypes.pattern | examples/types#mutually-recursive-mathematical-expression-types |
| examples/suite/nestedAccessors.pattern | examples/types#named-types-and-local-accessors |
| examples/suite/nestedTypeValues.pattern | examples/types#a-union-of-type-values |
| examples/suite/optionFactory.pattern | examples/types#option-factory-with |
| examples/suite/ordinaryGenerics.pattern | examples/types#type-arguments-use-ordinary-packs |
| examples/suite/ordinaryTypeEquality.pattern | examples/types#types-use-ordinary-value-equality |
| examples/suite/patternValue.pattern | examples/patterns#patterns-as-values |
| examples/suite/picturePattern.pattern | examples/patterns#picture-nested-pattern-captures |
| examples/suite/pictureType.pattern | examples/types#picture-named-shape-type |
| examples/suite/primitiveValues.pattern | examples/expressions#explicit-primitive-values |
| examples/suite/quotation.pattern | examples/quotation#quoted-expression-values |
| examples/suite/quoteModes.pattern | examples/quotation#raw-and-interpolated-typed-code |
| examples/suite/rawBlock.pattern | examples/expressions#raw-block-preserves-blank-lines-and-dollars |
| examples/suite/reader.pattern | examples/quotation#reader-interpolation |
| examples/suite/recursive.pattern | examples/types#recursive-type |
| examples/suite/recursiveFunctions.pattern | examples/expressions#mutually-recursive-function-definitions |
| examples/suite/recursiveTypeBlock.pattern | examples/types#local-recursive-type-block |
| examples/suite/recursiveTypeValue.pattern | examples/types#portable-recursive-type |
| examples/suite/registration.pattern | examples/macros#code-function-versus-registered-macro |
| examples/suite/results.pattern | examples/expressions#multiple-results |
| examples/suite/scopedConstructor.pattern | examples/types#ordinary-factory-with-defaults |
| examples/suite/sidefix.pattern | examples/macros#sidefix-macro-unless |
| examples/suite/sidefixData.pattern | examples/grammars#sidefix-data-dsl |
| examples/suite/simpleExpressionUnion.pattern | examples/grammars#dsl-recursive-expression-grammar |
| examples/suite/strict.pattern | examples/expressions#extra-named-arguments |
| examples/suite/stringModes.pattern | examples/quotation#raw-escaped-and-explicitly-interpolated-strings |
| examples/suite/structuralFacet.pattern | examples/expressions#open-structural-facet |
| examples/suite/subset.pattern | examples/types#subset-of-an-optional-type |
| examples/suite/syntaxInspection.pattern | examples/expressions#inspect-and-rebuild-syntax |
| examples/suite/taggedValues.pattern | examples/expressions#abstract-slots-and-ordering |
| examples/suite/tuple.pattern | examples/types#tuple-type |
| examples/suite/typeAtoms.pattern | examples/types#types-are-ordinary-values |
| examples/suite/typeFactory.pattern | examples/types#type-factory-ordinary-calls |
| examples/suite/typeFirstTestDsl.pattern | examples/grammars#dsl-tests-with-explicit-value-and-type |
| examples/suite/typeIdempotence.pattern | examples/types#type-normalization-and-wrappers |
| examples/suite/typeValues.pattern | examples/types#types-as-ordinary-values |
| examples/suite/typedCodeBinding.pattern | examples/types#inspect-a-typed-code-binding-without-evaluating-it |
| examples/suite/typedFor.pattern | examples/macros#typed-code-recursive-for-each-macro |
| examples/suite/typedQuote.pattern | examples/quotation#typed-expression-quotes |
| examples/suite/typedRoundTrip.pattern | examples/quotation#typed-parse-tostring-round-trip |
| examples/suite/typedTest.pattern | examples/grammars#test-dsl-with-typed-code |
| examples/suite/unannotatedUnion.pattern | examples/grammars#dsl-symbols-and-unannotated-unions |
| examples/suite/unionSpaces.pattern | examples/types#overlapping-unions-and-narrowing |
| examples/suite/userIf.pattern | examples/expressions#user-defined-if |
| examples/suite/valueSpaces.pattern | examples/types#numeric-spaces-and-conversion |
| examples/suite/vector.pattern | examples/expressions#vector |
| examples/suite/verticalBody.pattern | examples/grammars#vertical-spreading-inspect-a-nested-body |
| examples/suite/verticalMatrix.pattern | examples/grammars#vertical-spreading-two-dimensional-lists |
| examples/suite/verticalTodo.pattern | examples/grammars#vertical-spreading-todolist |
| test/cases/arithmetic.pattern | conformance/expressions#arithmetic |
| test/cases/dotIsFunctionCall.pattern | conformance/expressions#dot-is-function-call |
| test/cases/emptyCall.pattern | conformance/expressions#empty-call |
| test/cases/explicitNamedFunctionParameter.pattern | conformance/expressions#explicit-named-function-parameter |
| test/cases/independentCaptures.pattern | conformance/patterns#independent-captures |
| test/cases/listRestEmpty.pattern | conformance/patterns#list-rest-empty |
| test/cases/listRestSingleton.pattern | conformance/patterns#list-rest-singleton |
| test/cases/multiplePacks.pattern | conformance/expressions#multiple-packs |
| test/cases/noEagerExecution.pattern | conformance/expressions#no-eager-execution |
| test/cases/parameterInterpretation.pattern | conformance/expressions#parameter-interpretation |
| test/cases/samePrecedence.pattern | conformance/expressions#same-precedence |
| test/cases/singleGrouping.pattern | conformance/expressions#single-grouping |
| test/cases/singlePatternGrouping.pattern | conformance/patterns#single-pattern-grouping |
| test/cases/typedRest.pattern | conformance/types#typed-rest |

## Design-case map

| IDs | Source file | Status |
| --- | --- | --- |
| C01–C03 | tests/specification/primitives.test | future numeric/primitive semantics |
| C04–C06 | tests/specification/type-values.test | future interpreted/value-space model |
| C07–C10 | tests/specification/refinements.test | future evidence/overload model |
| C11–C15 | tests/specification/interpretations.test | future projection/designation/abstract model |
| C16–C18 | tests/specification/declarations.test | future declaration/default/interop model |
| C19–C22 | tests/specification/spreading.test | future revised numeric/spreading/keyword model |
| C23–C27 | tests/specification/language.test | future target contracts; C27 unaccepted candidate |

The specification excerpts are synchronized against the decision record by a host
check, while all cases execute; todo markers are removed from already-fulfilled assertions.

## Result-annotation refactor

The source suite follows the author's direct-check style: numbered observation
captures are removed, meaningful bindings stay near their uses, and sections/tests
have blank-line separation. Actual multiple returns retain descriptive captures.
The assertions and canonical expected payloads are unchanged. Legacy inventory
subjects were rewritten in place; C01–C27 remain in `tests/specification`. Playground
programs still use the same source cases and direct final result packs.

The suite uses expect subject result value :: Type. Separate value/type clauses
and the results pack form were removed. Pack expectations were split:
each call is destructured once, then each capture has its own result check or
predicate assertion. Empty returns use an explicit destructuring assertion. Host
coverage retains exact complete-pack label/arity observations rather than assuming
separate checks prove every pack property.

Splitting pack checks into per-capture assertions does not add language
features. Playground examples remain runnable; final ordinary packs expose
already captured results. Strict type/data checks and assertion-level modifiers are
unchanged. Canonical printer goldens were adjusted only for comma spacing, preserving
literal string contents and canonical round-trip checks.

C01–C27 execute from `tests/specification`. All source tests, schema
projections, CLI/DOM checks and documentation use result annotations. GitHub is the
source of truth, with read-only, credential-free CI and required host boundaries.
