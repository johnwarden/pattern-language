# Test migration inventory

Current conformance homes for milestone 5a.1. `.test` case IDs are path-relative to
`tests/`. All 90 existing source expectations are retained; the mappings below let
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
| binding defaults preserve option-type semantics | binding-defaults-preserve-option-semantics | valid Some default and invalid bare default |

Expected values/types are written explicitly; old display-string tests are not
silently converted into self-generated expected outputs. Failure substrings preserve
the old error conditions. The source corpus also checks exact full packs.

## Retained and deferred coverage

tests/setup/alternatives.test adds the current/future declaration pair as a real
setup alternative. tests/symbols/classes.test checks the complete ASCII class table.
Host tests retain trial isolation, duplicate-name unmasking, recursive grouping,
fixture replay, source spelling and host-failure boundaries.

[The legacy inventory](LEGACY-ASSERTIONS.md) accounts for every remaining legacy
assertion. Of the original 139, 69 are now ordinary checks: defaults, concrete
accessor results, structural equality/round trips and pack distinctions were not
obsolete behavior. Arithmetic/rest/default examples now establish concrete types
when their purpose does not depend on raw Expression fallback. Forty-five new
todo assertions accompany settled changes, giving 48 paired legacy assertions.
The remaining 22 have explicit unresolved decisions, checked against the corpus.
No failing placeholder is substituted for an unspecified target result.

| Area | Current home and reason |
| --- | --- |
| Pattern metadata, compiler captures, hygiene and cross-context grammar maps | test/pattern-bindings.test.ts; mixed language/host invariants are retained intact |
| Default host invocation counters, declaration rollback and exact source diagnostics | test/binding-defaults.test.ts; API/state/span observations need host access |
| Type identity, abstract slots, caches, unsupported host environments and transport | existing type/value/abstract tests; retain direct representation/fresh-process checks |
| Old union disjointness, bootstrap numeric/type/evidence behavior | existing host regressions; replace only when C01–C18 implementations land |
| Typed quotes, byte normalization and raw syntax encode/decode | quotation/source/syntax tests; host transport and coordinate checks remain |
| Vertical matching, row keys, ambiguity, descriptor transfer | test/vertical-spread.test.ts; mixed source/representation assertions retained |
| Canonical source behavior of the 14 former test/cases cases | test/source-suite.test.ts; canonicalizes then runs the same DSL expectation |
| Test schema round trips, execution/isolation traps, fixtures and error phases | test/test-suite.test.ts; checks the harness rather than language examples |
| Recursive discovery, CLI process status and expected-failure reporting | test/test-cli.test.ts; needs filesystem/process observations |
| Actual controls, sorting and old/new storage restoration | test/playground.test.ts; every executable example exercised through DOM controls |
| Resource limits, staging rollback, build/schema synchronization | existing host tests; preserve their boundary observations |
| Revised primitives, value spaces, proof evidence, projections, facets and spreads | tests/specification/*.test; C01–C27 execute assertion-level todos, C27 explicitly exploratory |

No whole-file migration is claimed for candidate files outside the selected batch.
Lower TypeScript-only counts do not imply lost semantic coverage; expected failures
are not new passing assertions.

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
subjects and C01–C27 excerpts follow the rewritten subjects; the 76 playground
programs still use the same source cases and direct final result packs.

The suite uses expect subject result value :: Type. Separate value/type clauses
and the results pack form were removed. Fifty-seven pack expectations were split:
each call is destructured once, then each capture has its own result check or
predicate assertion. Empty returns use an explicit destructuring assertion. Host
coverage retains exact complete-pack label/arity observations rather than assuming
separate checks prove every pack property.

The same 128 cases execute, with 249 passing assertions (70 legacy) and 117 todo
expected failures. Higher assertion counts reflect split checks, not additional
language features. All 76 examples remain runnable; final ordinary packs expose
already captured results. Strict type/data checks and assertion-level modifiers are
unchanged. Canonical printer goldens were adjusted only for comma spacing, preserving
literal string contents and canonical round-trip checks.

The reviewed C01–C27 excerpts match their .test sources. All source tests, schema
projections, CLI/DOM checks and documentation use result annotations. GitHub is the
source of truth, with read-only, credential-free CI and required host boundaries.
