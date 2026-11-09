# Inbox triage register

Follow [the specification-first workflow](../../design/TESTING-WORKFLOW.md).
Inbox files are optional author drafts, runnable by explicit path. Route settled
content to a bugfix regression, a specification todo, or a runnable example.
Pending decisions remain explicit; comments and placeholder assertions are not
coverage. Record destination cases and a PR before calling an item resolved.

New proposals belong in [`specs/inbox/`](../../specs/inbox/). Discuss and clarify
them in the project chat; accepted changes get a record in `specs/approved/`.
Retire the corresponding inbox file when that record preserves all of its intent;
split unresolved portions first. Existing drafts here retain their explicit-path
runner support during triage. See [the lifecycle](../../specs/README.md).

| Submission                                                    | Current disposition                                                                      | Destination / next action                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-raw-and-typed-expressions.test` | Original code restored; raw runtime Expression/mode decision pending | [Raw-expression proposal](../../specs/inbox/raw-expression-values.md). #39 is closed at Jonathan's request; its branch is preserved as a regression seed, not an active implementation. |
| `2026-11-09-bug-bare-function-name-in-where-clause.test` | Both examples restored; bare-name form and callable policy pending | [Named-predicate proposal](../../specs/inbox/named-where-predicates.md). Both authored examples currently contain the same lambda. Preserve that source until the intended difference is clarified here in the project chat. |
| `2026-09-11-printing-values-of-ambiguous-concrete-types.test` | Nested-absence semantics already specified; exact printing intent pending | [Value-text proposal](../../specs/inbox/ambiguous-value-text.md). Existing nested-option and concrete-union tests cover branch identity. The authored text/tag expectations remain unchanged. |

This register records triage, not completed implementation. The inbox-processing
handoff #39 is closed; discussion and clarification belong in the project chat.
After agreement, create approved records, then write or update actual contracts
in a PR for those records. Preserve unresolved parts until the author decides.

The commented code in the first two files was restored at Jonathan's request and
their placeholder `assert 1 == 1` checks were removed. These submissions retain
their original draft syntax, including obsolete `value` clauses and nested test
examples; explicit runs may report syntax errors. They remain optional in default
runs. Do not comment out meaningful examples or replace them with passing no-ops
to get green checks; discovery already provides the optional inbox boundary.
