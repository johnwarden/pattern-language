# Language specifications

Accepted specifications live directly under `specs/` on `master`. To propose
a change, create a topic branch and edit the relevant document in place or add a
new one here. Record open questions on that branch and discuss them with Jonathan.
Keep settled behavior in the same document as it gains tests and implementation.

A topic can have several review PRs. Settle the specification first, then add or
revise the executable contracts in the active source suite. Mark behavior the
current code cannot satisfy as `todo`. Implementation PRs make the relevant
tests pass and remove the fulfilled markers. A slice is ready for merge to
`master` once its spec, tests and implementation agree. Planned follow-ups can
retain their own explicit todos.

The [development workflow](../design/TESTING-WORKFLOW.md) describes how to
stage and review these changes. The [executable specification](../tests/specification/README.md)
indexes the tests. Historical material lives in [archive/](archive/).
