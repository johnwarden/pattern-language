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

## First bounded batch

The first batch moves 17 scalar macro/registration observations from `test/macros.test.ts` and
`test/registration.test.ts` into `tests/macros/evaluation.test` and
`tests/macros/hygiene.test`. The 12 new cases use ordinary `expect ... result ... :: Rational`
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
| pattern-schema, milestone-two, vertical-spread                                                                                   | Implemented assertion-level pass; mixed remainder            | Quoted operator heads, open-label/rest matching, type-description evaluation, dispatch defaults, empty/evaluated matrix rows, application-row capture and Body final-row rules live in `tests/matching/`, `tests/types/descriptions.test` and `tests/spreading/`. Schema/decoder, Grammar objects, exact dimension/duplicate/type-description codes, Float32 serialization, fresh-interpreter transport and ambiguous row partitions stay. Keyword-rest `{**rest}` was not selected. |
| nested-option-designation, concrete-unions                                                                                       | Implemented assertion-level pass; mixed remainder            | Existing `tests/bindings/nested-option-designation.test` and `tests/specification/concrete-unions.test` cover the shared positives. Unique inner-absence projection, constructor-vs-inward arms, already-typed inward designation and reverse-order peer ambiguity live in `tests/unions/concrete.test`. Exact `E_PATTERN_MISMATCH` / `E_NO_METHOD` / `E_AMBIGUOUS_PATTERN`, fresh-interpreter typed-text transport and test-harness expected-data stay. |
| abstract-values, disjoint-unions, structural-slots, type-atoms, value-representation, value-spaces                               | Assertion-level pass started; mixed remainder                | Unique D05 identity, `unionType` normalization, type-argument packs, bound type matchers and compiled/quoted type trees live in `tests/types/identity.test` and `tests/types/value-trees.test`. `inspect`/`parseLocal`/REPL names, `env.bindings` surgery, `parseExpression` trees, optional/numeric concrete-identity incomparability, facet metadata and function-value printing stay. `True(1)`/`1(1)` heads were not frozen. |
| declaration-boundaries, type-definition-evaluation, description-scope, milestone-four, type-operations, type-unions, type-values | Defer active declaration/transport work                      | Separate portable semantics from declaration/accessor products and representation/transport checks after #31/#32 stabilize. Equivalent declarations and accessor collisions remain errors.                                                                                            |
| rational-primitives                                                                                                              | Implemented assertion-level pass; mixed remainder            | Unique Float membership/designation and `((1 / 3) * 3) == 1` live in `tests/specification/primitives.test` C03 and `tests/numeric/syntax-tree.test`. Direct Rational/binary64 helpers, `syntaxTree(0f0.1)` display, exact `E_VALUE_SERIALIZATION` and `0.5 :: Int` until D07 stay. IEEE/family/edge policy is not chosen by migration. |
| binding-defaults, minus, titlecase-captures                                                                                      | Prior migrations; retain remainder                           | Remaining host invocation/default evaluation, parser forms, Interpreter.evaluateCode, exact diagnostics and hygiene checks were deliberately retained by earlier batches. Do not treat these files as unreviewed easy deletions.                                                      |
| cli, repl, playground                                                                                                            | Retain host boundary                                         | Process behavior, state across submissions, DOM interactions and storage restoration require host access. Their examples are not evidence that the host tests are redundant.                                                                                                          |
| diagnostics, grammar-diagnostics, source-normalization, indent-prefix, layout-ends, formatting                                   | Retain host boundary; mixed semantic extras may be separable | Exact codes, coordinates, normalized byte/text boundaries, parser entry points and canonical source formatting need host assertions. End-ownership semantics also have source cases; preserve the independent reader/session checks.                                                  |
| elaboration, lowering, matcher-resources, syntax-inspection, code-grammar, typed-grammar-quotes, quotation-spec                  | Retain host boundary; mixed semantic extras may be separable | Direct core execution/reader APIs, capture structure, raw/typed transport, resource bounds and no-execution canaries need the host. Do not replace executing stored Code with reading it.                                                                                             |
| lsp-analysis, lsp-protocol, test-source-indentation                                                                              | Retain host/editor/extraction boundary                       | Protocol framing and child processes, cancellation/deadlines, exact UTF-16 ranges, no-execution canaries, original-source extraction, raw string indentation and setup replay require host access.                                                                                    |
| setup-alternatives, source-suite, source-suite-reporting, test-cli, test-suite, todo-tests                                       | Retain host/harness boundary                                 | They validate discovery, optional inbox behavior, fixture replay/isolation, unexpected-success handling, exact process/reporting output, canonicalization and schema synchronization. Re-expressing these as ordinary source subjects would test a different system.                  |

## Safe migration procedure

1. Name each original host observation and its proposed source case. Distinguish
   value semantics from exact printing, full packs, state and representation.
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

The targeted source cases pass: 12 cases and 17 ordinary assertions. All 25
remaining macro/registration host tests pass. A source/code-pair comparison also
confirms that all 23 exact diagnostic helper checks remain unchanged. No legacy
or todo assertion was added or changed.

On this batch revision, local typecheck, build, all 694 host tests, all 244 source
cases and Dockerfile/devbox alignment passed. The source report has 577 ordinary
assertions, with the existing 59 legacy and 96 expected todo failures unchanged.
`just check` was attempted but `just`, ShellCheck and entr are unavailable in
the local environment; the complete shell/recipe gate requires PR CI. CI is
reported by exact head, not inferred from these local checks.
