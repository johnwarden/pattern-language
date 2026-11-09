# Remaining TypeScript test migration audit

Status: audit and first migration batch in progress. Owner:
`/root/test_migration_audit`, coordinated through this PR. The baseline includes
the merged LSP, tab-safe source extraction and minus/type-capture migrations.

Audit `test/*.test.ts` by the observations each test makes. Move ordinary
language behavior into the shared `.test` corpus where the DSL can express the
same contract clearly. Keep host/API observations in TypeScript and split mixed
tests only when each observation retains an explicit home.

## First selected batch

| Host file | Candidate language observations | Host coverage to retain |
| --- | --- | --- |
| test/macros.test.ts | Unevaluated arguments, recursive expansion, user-defined control forms, binder/default hygiene, definition-scope helpers, local grammar and generated definitions | Parser/AST and canonical-tree assertions, exact diagnostics and locations, REPL/state observations, resource limits |
| test/registration.test.ts | Suppressed argument evaluation, sidefix builder delegation, raw runtime references/syntax arguments and hygienic builder delegation | Exact diagnostic-code checks, multi-entry REPL/registration state, rollback and host execution observations |

The implementing agent will record completed moves and retained observations,
audit the remaining files, and validate the selected batch. This initial scope
does not claim that the candidates have already migrated.

## Coverage rules

Expected data is authored explicitly. Preserve complete pack checks and exact
failure codes where the host test checks those boundaries. Reading stored Code
does not replace executing it. Preserve evaluation counters, fresh environments,
transport, transaction/isolation, harness, CLI, DOM and build checks.

This is test migration, with no runtime semantics changes. Do not invent pending
behavior, replace missing behavior with todo markers, or promote legacy/todo
observations as a side effect. Avoid the active intrinsic String/symbol and
declaration/accessor workstreams. Public inspection/decoding and function-value
policies remain outside this PR; equivalent declarations/accessor collisions stay
errors. Inbox discovery remains optional.

Update [TEST-MIGRATION.md](TEST-MIGRATION.md) for completed moves. Run targeted
checks and `just check` on the final PR revision, distinguishing observed checks
from unavailable local tools and pending CI.
