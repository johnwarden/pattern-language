# Engineering checklist

Updated 9 November 2026. [ROADMAP.md](ROADMAP.md) owns milestone order and completion
criteria; [LANGUAGE-DECISIONS.md](design/LANGUAGE-DECISIONS.md) owns the integrated
agreement and future conformance examples. Checked items describe the bootstrap
subset, not completion of the revised design.

## Existing foundations

- [x] One TypeScript implementation for CLI, REPL and generated playground.
- [x] Common structural pattern compiler/matcher, binder metadata and source schemas.
- [x] Exact/open fields, independent rest axes and binding-only defaults.
- [x] Structural type descriptions, abstract slots/facets and supported typed text.
- [x] Explicit sidefix registration, typed quotation/interpolation and diagnostics.
- [x] Shared source corpus, executable playground examples and named design cases C01–C27. Run `just test-language` for current case/assertion totals.
- [x] Recursive declaration groups, rollback, portable recursive descriptions and inspection.
- [x] Vertical aggregate captures and bounded source Body grammar.
- [x] Integrate the revised decision record into docs, with provisional/deferred status.

## Completed: milestone 5a.1 — test DSL conformance

- [x] Define revised Test/setup/assert/expect/error and todo data grammar and isolation.
- [x] Preserve complete result packs and expected-value-as-data semantics.
- [x] Implement assertion-level todo/legacy forms; todos execute and must fail, legacy checks must pass.
- [x] Verify assertion isolation, silent expected failures, unexpected-pass failures and setup/host error boundaries.
- [x] Add C01–C27 with assertion-level todo/legacy contracts and traceable decision mappings.
- [x] Add minimal approved surface recognition needed to store future cases; reject malformed source.
- [x] Inventory TypeScript semantic tests using design/TEST-SUITE.md; select a cogent batch.
- [x] Mark superseded bootstrap expectations for replacement, not mechanical active migration.
- [x] Migrate verified language-level cases and remove duplicate host assertions selectively.
- [x] Retain DOM, transport, resource, metadata, API, transaction and build tests in TypeScript.
- [x] Report passing assertions, legacy checks and todo expected failures separately; discovery only reads source.
- [x] Keep executable playground options on the shared corpus; do not expose expected-failure assertions as runnable examples.
- [x] Record final coverage mapping and actual counts. Do not require source code.evaluate.
- [x] Pair settled legacy changes with executable todos; inventory/check unresolved replacements and promote stable assertions.

## Next: alignment, then subsequent language work

- [x] 5a.2 slices: overlapping abstract unions, exact numeric values/syntax, source-defined optional convention and explicit concrete union members.
- [ ] 5a.2: finish declaration/plain-value separation and remaining value-model alignment.
- [x] 5a.2 slice: one-boundary match projection and direct-arm/inward designation; checker-dependent guarantees remain pending.
- [ ] 5a.2: settle and implement approved mirrored spreading and typed keyword remainders.
- [ ] 5b: freeze public syntax/descriptor mapping and grow Body into full interpreted Code.
- [ ] 5c: source-language evaluator and explicit portable closed-callable subset, then Test execution.
- [ ] 6: prepare-once expansion and phase/capture/registration contracts.
- [ ] 7: static comparability, call/evidence/coverage checking and assertion facts.
- [ ] 8: compile-time type factories/introspection; specialization remains a private optimization.
- [ ] 9: modules, accessor imports and structural interchange beyond the lexical-scope experiment.
- [ ] 10: portable predicate/function dependencies and broader canonical typed text.
- [ ] 11: bounded pre-evaluation/optimization with stable behavior and failure timing.
- [ ] 12: self-hosting compiler and reproducible bootstrap.

## Decisions not to implement by accident

- [ ] Duplicate equivalent declarations and accessor collisions remain errors while the replacement policy is deferred. Do not infer an alias/import policy from functional equality.
- [ ] Resolve generic-family membership/parameter recovery, MemberOf and singleton policies.
- [ ] Choose exact type/generic/rest/unambiguous spellings before treating tentative cases as parser contracts.
- [ ] Decide optional runtime Expression and descriptor decoding explicitly.
- [ ] Keep constructedBy tabled until refinement decoding is solved.
- [ ] Leave IEEE special identities and numeric edge/canonical spellings provisional until decided.
- [ ] Do not add first-class overload sets, unchecked insist, type defaults or implicit normalization under another feature's name.
