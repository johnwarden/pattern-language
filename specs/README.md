# Specification lifecycle

Discuss and clarify new language rules in the project chat. Capture the agreed
outcome here so implementing agents can work from a stable decision. PRs carry
implementation details and reviews; unresolved design questions return to chat.
The queue lives on `master`: commit proposals, approved records and validated
test-only contract updates directly there. Do not maintain a queue branch or PR.
Runtime implementation continues through feature PRs.

| Directory | Meaning | Next step |
| --- | --- | --- |
| `inbox/` | Proposals, examples and questions awaiting a decision | Discuss in chat; preserve unresolved portions explicitly |
| `approved/` | Agreed changes ready to be turned into executable contracts | Commit test-only contracts to master, then use implementation PRs as needed |
| `implemented/` | Decisions captured in actual tests | Follow the linked tests for runtime status; some may still be todo |
| `archive/` | Retired proposals kept for context | Use the linked approved records for any settled behavior |

Use a stable descriptive filename across moves. An approved record states the
decision, examples or syntax, intended change to existing behavior, important
boundaries, and originating inbox paths where applicable. Record only settled
behavior as approved. Split a submission when part is still undecided. Once a
record preserves all corresponding inbox content, remove that inbox file in the
same change instead of maintaining duplicate active proposals.

A PR may implement several approved specs. A spec may require editing existing
tests, mass migration, or just an illustrative example rather than a new test
case. There is no one-to-one spec/case/PR requirement. Write or update the actual
tests before changing runtime behavior. When actual tests capture the decision,
move its record to `implemented/` on master and add links to those files/cases and
their commit or implementation PR. Keep a partially converted record approved, or split it into coherent
decisions before moving the completed portion.

Here, **implemented means implemented as tests**. Todo tests are allowed and do
not mean the language feature works. The `.test` files are then the executable
contract; the moved record preserves the decision and points to those tests.
Update explanatory notes with the tests rather than evolve a second prose spec.
Existing accepted tests need no duplicate proposal just to authorize a bugfix.

New intake uses `specs/inbox/`. Existing optional `tests/inbox/` files remain
explicitly runnable during triage; move or retire them as their content is
processed. This directory change does not enable those drafts in default suites.
See [the development workflow](../design/TESTING-WORKFLOW.md) and the existing
[inbox register](../tests/inbox/README.md).
