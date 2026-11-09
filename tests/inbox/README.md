# Inbox triage register

Follow [the specification-first workflow](../../design/TESTING-WORKFLOW.md).
Inbox files are optional author drafts, runnable by explicit path. Route settled
content to a bugfix regression, a specification todo, or a runnable example.
Pending decisions remain explicit; comments and placeholder assertions are not
coverage. Record destination cases and a PR before calling an item resolved.

| Submission                                                    | Current disposition                                                                      | Destination / next action                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2026-raw-and-typed-expressions.test`                         | Split: concrete-boundary regression; raw-expression mode remains pending                 | [#39](https://github.com/johnwarden/pattern-language/pull/39) seeds `tests/bindings/concrete-value-boundary.test`: ordinary bindings/dispatch cannot open a concrete value; explicit match can. The two negative cases need implementation. Keep the optional raw runtime Expression mode question open. |
| `2026-11-09-bug-bare-function-name-in-where-clause.test`      | Pending a concrete bare-name example and the named-function-value decision               | The two commented examples currently contain the same lambda; `assert 1 == 1` covers neither. Clarify the intended bare-name form before adding its specification todo or claiming a bug. A supported lambda control can become an example; do not enable first-class overload sets implicitly.          |
| `2026-09-11-printing-values-of-ambiguous-concrete-types.test` | Split: nested-absence semantics already specified; exact printing intent remains pending | Active nested-option cases live in `tests/bindings/nested-option-designation.test` and `tests/specification/concrete-unions.test`. Resolve the outer `String` versus `String??` tag and global/local text intent before adopting new goldens. The original `value` clause is obsolete.                   |

This register records triage, not completed implementation. #39 is still a draft;
its regression seed does not mean an implementing agent has claimed it. Preserve
the unresolved parts until Jonathan supplies their decisions. When destinations
are implemented or accepted into the specification/examples, update the links and
retire the covered inbox content so it cannot become a competing contract.
