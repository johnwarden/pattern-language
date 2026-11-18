# Remaining TypeScript test migration audit

Owner: `/root/test_migration_audit`, coordinated through PR #40.

This is an inventory of migration opportunities and host boundaries, not a claim
that the source suite replaces the TypeScript suite. The reference census covers
57 `test/*.test.ts` files after the LSP, indentation and minus/type-capture
migrations. All 57 have a file-level classification below; assertion-level
migrations are claimed only for the mapped macro/registration, language,
cross-context matching/availability, generated-grammar staging,
quotes/postfix, spreading/schema-evaluation, nested-option/concrete-union,
rational-primitive membership, and type-identity/value-tree observations.
The method is file-level inspection and targeted assertion review, supported by a
search for parser, representation, diagnostic, state, process and UI observations.
A file classified as mixed still needs an assertion-level pass before
further migration, except language, matching/availability, staging,
quotes/postfix, spreading/schema-evaluation, nested-option/concrete-union,
rational-primitives and the type-identity/value-tree slice of the value
group, which now have that mapping.

The completed coverage map remains [TEST-MIGRATION.md](TEST-MIGRATION.md). Only
implemented, passing source checks belong in that map. This document also records
work that remains available or deliberately deferred. Macro/registration and
language, matching, availability, staging, quotes/postfix,
spreading/schema-evaluation, nested-option/concrete-union,
rational-primitives and type-identity/value-trees now have
assertion-level mappings there; other mixed files still need that pass.

## Destination-contract correction after #60

#68 restores the five #60 representation/decoding cases to their original host
blocks and removes their source counterparts. Identity and other semantic
migrations remain. The [coverage map](TEST-MIGRATION.md#type-identity-and-value-tree-migration)
records the restored checks; the [cleanup plan](TEST-CONTRACT-AUDIT.md) tracks
remaining native-adapter batches. Public inspection/decoding stays pending.

The numeric correction in #66 replaces the native syntax source cases with
[exact value and Code cases](../tests/numeric/exact-values.test). The
[numeric coverage map](TEST-MIGRATION.md#numeric-destination-contract-correction)
records retained host adapter payloads, text round trips and display goldens.

## First bounded batch

The first batch moves 17 scalar macro/registration observations from `test/macros.test.ts` and
`test/registration.test.ts` into `tests/macros/evaluation.test` and
`tests/macros/hygiene.test`. The 12 new cases use ordinary `expect ... is ... :: Rational`
assertions with authored values; the defaulted `size: Int` lambda retains its
Int result type. Nine complete host blocks and the two migrated positive
assertions in mixed blocks are removed only after the source cases pass. Preserve the original programs and their meaning;
no new runtime behavior, golden generation, todo markers or raw-Expression policy.

The selected examples cover unevaluated operands, recursive expansion,
user-defined if, template hygiene, definition-scope helpers, generated definitions
and grammars, and registered ordinary-builder delegation. Source hygiene checks
are still real hygiene checks: keep caller/template shadowing and inserted
expressions in the program rather than replacing the example with a constant.

All exact diagnostic-code assertions, multi-entry REPL/rollback checks, canonical
tree round trips, related locations, expansion limits and host hygiene metadata
remain in TypeScript. A mixed block can lose its moved result assertion while
retaining its host failure check. Complete-pack and Code display observations
remain unless a separate migration proves the same boundary. In particular,
`ordinary code builders may capture runtime parameters` prints `7` but returns
Code, not the Rational value 7. It stays in TypeScript; reading Code is not
substituted for executing it.

## Inventory and next batches

File names in the table omit `test/` and `.test.ts`. This is a file-level
classification; the mixed and deferred rows are a follow-up queue, not a claim
that every individual assertion in those files has already been mapped.

| Area / TypeScript files                                                                                                          | Classification                                               | Migration opportunity or retained boundary                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macros, registration                                                                                                             | Selected first batch; mixed files                            | Portable scalar expansion/hygiene examples move first. Exact failures, canonical Code/source and session behavior stay.                                                                                                                                                               |
| language                                                                                                                         | Implemented assertion-level pass; mixed remainder            | Ordinary calls, blocks, labels, rest, types and namespace examples live in `tests/language/`. Canonical round trips read executable programs from those `.test` files plus the retained display programs in `test/language.test.ts`. Pack/printer display, `parseExpression` trees, Grammar objects, REPL and exact `E_AMBIGUOUS_CALL` stay. |
| consistency, pattern-bindings, milestone-two-review                                                                              | Implemented assertion-level pass; mixed remainder            | Portable cross-context matching, sidefix pack rest, pattern hygiene and available constant defaults live in `tests/matching/` and `tests/macros/availability.test`. Compiler capture metadata, Grammar objects, REPL rollback, exact `E_SIDEFIX_SPREAD` / `E_MACRO_RUNTIME_CAPTURE` and binder/AST checks stay. |
| staging                                                                                                                          | Implemented assertion-level pass; mixed remainder            | Scalar generated sidefix, nested generated macros, generated function hygiene, definition-time grammar, generated types and final-definition errors live in `tests/macros/staging.test`. Parse-only no-execution, repeated REPL submissions, successful reuse after failure and transactional rollback stay. |
| quotes, postfix, postfix-conventions                                                                                             | Implemented assertion-level pass; mixed remainder            | Portable quotation interpolation, typed-quote expansion, reader-block text, postfix payload matching, prefix `*`/`^`, infix `&`/`~`, optional type printing and custom `?` coexistence live in `tests/quotes/` and `tests/postfix/`. Syntax kind/key/encode-decode, empty-prelude readers, exact `E_UNQUOTE_CONTEXT` / `E_RESERVED_OPERATOR` / `E_KEYWORD_REST_UNSUPPORTED` and hole/name locations stay. |
| pattern-schema, milestone-two, vertical-spread                                                                                   | Implemented assertion-level pass; mixed remainder            | Quoted operator heads, open-label/rest matching, type-description evaluation, dispatch defaults, empty/evaluated matrix rows, application-row capture and Body final-row rules live in `tests/matching/`, `tests/types/descriptions.test` and `tests/spreading/`. Schema/decoder, Grammar objects, exact dimension/duplicate/type-description codes, Float32 serialization and ambiguous row partitions stay. Fresh-interpreter typed-text transport lives in `test/round-trip-parsing.test.ts`. Keyword-rest `{**rest}` was not selected. |
| nested-option-designation, concrete-unions                                                                                       | Implemented assertion-level pass; host files deleted         | Existing `tests/bindings/nested-option-designation.test` and `tests/specification/concrete-unions.test` cover the shared positives. Unique inner-absence projection, outer-absence `E_PATTERN_MISMATCH`, constructor-vs-inward arms, already-typed inward designation and both peer-ambiguity orders live in `tests/unions/concrete.test`. Exact nested-option `E_` codes live in the source cases. Fresh-interpreter typed-text transport lives in `test/round-trip-parsing.test.ts`. Test-harness expected-data lives in `test/test-suite.test.ts`. |
| abstract-values, disjoint-unions, structural-slots, type-atoms, value-representation, value-spaces                               | Assertion-level pass started; mixed remainder                | D05 identity, `unionType` normalization, type-argument packs and bound type matchers live in `tests/types/identity.test` and `tests/types/value-trees.test`. Portable type-atoms Bool predicates, constructor heads and mixed alternative sort live in `tests/specification/primitives.test`, `tests/language/types.test` and `tests/examples/types.test`; duplicate type-atoms host blocks were removed after those cases gained any missing assertions. #68 restores representation/decoding blocks to host. Dedicated print→parse transport lives in `test/round-trip-parsing.test.ts`. `inspect`/`parseLocal`/REPL names, `env.bindings` surgery, `parseExpression` trees, optional/numeric concrete-identity incomparability, facet metadata and function-value printing stay. `True(1)`/`1(1)` heads were not frozen. |
| declaration-boundaries, type-definition-evaluation, description-scope, milestone-four, type-operations, type-unions, type-values | Defer active declaration work; transport extracted           | Separate portable semantics from declaration/accessor products after #31/#32 stabilize. Dedicated print→parse and fresh-Interpreter transport live in `test/round-trip-parsing.test.ts`. Equivalent declarations and accessor collisions remain errors.                                                                                            |
| rational-primitives                                                                                                              | Implemented assertion-level pass; mixed remainder            | Float membership/designation lives in C03. `tests/numeric/exact-values.test` checks exact arithmetic and the `(1/3)` print/read round trip. Host tests cover the Rational/binary64 helpers, native `NumberLiteral` payloads and the `0.5 :: Int` mismatch. Quoted-tree transport lives in `test/round-trip-parsing.test.ts`. |
| binding-defaults, minus, titlecase-captures                                                                                      | Prior migrations; retain remainder                           | Remaining host invocation/default evaluation, parser forms, Interpreter.evaluateCode, exact diagnostics and hygiene checks were deliberately retained by earlier batches. Do not treat these files as unreviewed easy deletions.                                                      |
| round-trip-parsing                                                                                                               | Retain host boundary                                         | Print→parse, fresh-Interpreter and reader transport. The `.test` DSL cannot observe a second Interpreter or host `env.bindings`. Mixed topical files keep parse-only, print-only, local-alias and incidental round-trip assertions.                                                  |
| cli, repl, playground                                                                                                            | Retain host boundary                                         | Process behavior, state across submissions, DOM interactions and storage restoration require host access. Their examples are not evidence that the host tests are redundant.                                                                                                          |
| diagnostics, grammar-diagnostics, source-normalization, indent-prefix, layout-ends, formatting                                   | Retain host boundary; mixed semantic extras may be separable | Exact codes, coordinates, normalized byte/text boundaries, parser entry points and canonical source formatting need host assertions. End-ownership semantics also have source cases; preserve the independent reader/session checks.                                                  |
| elaboration, lowering, matcher-resources, syntax-inspection, code-grammar, typed-grammar-quotes, quotation-spec                  | Retain host boundary; mixed semantic extras may be separable | Direct core execution/reader APIs, capture structure, resource bounds and no-execution canaries need the host. Print→parse and fresh-Interpreter transport live in `test/round-trip-parsing.test.ts`. Do not replace executing stored Code with reading it.                                                                                             |
| lsp-analysis, lsp-protocol, test-source-indentation                                                                              | Retain host/editor/extraction boundary                       | Protocol framing and child processes, cancellation/deadlines, exact UTF-16 ranges, no-execution canaries, original-source extraction, raw string indentation and setup replay require host access.                                                                                    |
| setup-alternatives, source-suite, source-suite-reporting, test-cli, test-suite, todo-tests                                       | Retain host/harness boundary                                 | They validate discovery, optional inbox behavior, fixture replay/isolation, unexpected-success handling, exact process/reporting output, canonicalization and schema synchronization. Typed-text transport of test-file values lives in `test/round-trip-parsing.test.ts`. Re-expressing these as ordinary source subjects would test a different system.                  |

## Safe migration procedure

1. Name each original host observation and its proposed source case. Confirm it
   is an approved destination-language contract, rather than a bootstrap adapter
   or undecided descriptor/decoding rule. Distinguish value semantics from exact
   printing, full packs, state and representation; keep implementation observations
   on host and map the retained coverage explicitly.
2. Write explicit expected data and keep definitions close to use, with blank
   separation between tests and logical sections. Avoid numbered observation
   captures. Destructure only actual multi-result programs.
3. Run the new source cases and the relevant retained TypeScript checks before
   removing duplicate assertions. Do not add a todo to make a migration pass.
4. Verify that remaining host blocks still prove their original boundary. Preserve
   exact diagnostic codes/locations and host counters where those were asserted.
5. Record completed mappings, run `just check` on the PR revision, and report any
   environment-limited checks separately. Do not claim counts measure semantic
   coverage by themselves.

The inbox stays optional by default and runnable by explicit path. No migration
chooses public inspection/decoding, raw Expression exposure, first-class overload
sets, declaration collisions, or a new language grammar.

## Validation of the first batch

The initial macro/registration batch passed its host/source checks, typecheck,
build and Dockerfile/devbox alignment without changing exact diagnostic, legacy
or todo expectations. Its full shell/recipe gate required PR CI. These are
historical results; current validation is reported by exact PR head.
