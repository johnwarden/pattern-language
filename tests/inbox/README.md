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
| `2026-raw-and-typed-expressions.test` (retired) | Raw runtime Expressions approved for now; draft converted | [Decision and tests](../../specs/implemented/raw-expression-values.md), on master. Raw construction/designation and explicit matching are ordinary checks; ordinary constructor-binding rejection remains todo. #39 stays closed, with its branch preserved. |
| `2026-11-09-bug-bare-function-name-in-where-clause.test` (retired) | Named functions resolve to closed function values | [Approved decision](../../specs/approved/named-function-values.md), on master. Binding/passing/returning/predicate uses have explicit todos; portable no-free-variable representation is not yet captured by tests. |
| `2026-09-11-printing-values-of-ambiguous-concrete-types.test` (retired) | Existing type-directed printing contract applies | [Decision and tests](../../specs/implemented/ambiguous-value-text.md), on master. The String?? example now checks member annotation and reconstruction under String?? and Any. |

This register records triage, not completed implementation. The inbox-processing
handoff #39 is closed; discussion and clarification belong in the project chat.
After agreement, create approved records, then write or update actual contracts
in a PR for those records. Preserve unresolved parts until the author decides.

The first two drafts were restored before triage, with placeholder `assert 1 == 1`
checks removed. After clarification, their meaningful cases and the printing
example were converted in the initial specification-queue commit on master;
corresponding drafts were retired in favor of
the records and tests above. History preserves the original syntax and strings.
Do not comment out new proposals or replace them with passing no-ops to get green
checks; discovery already provides the optional inbox boundary. The directory
remains an explicit-path input for future submissions even when it has no cases.
