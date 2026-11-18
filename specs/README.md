# Language specifications

Accepted specifications live directly under `specs/` on `master`. To propose
a change, create a topic branch and edit the relevant document in place or add a
new one here. Record open questions on that branch and discuss them with Jonathan.
Keep settled behavior in the same document as it gains tests and implementation.

Each stage can land on `master` in its own PR. Merge the approved
specification first, then add or revise the executable contracts in the
active source suite. Use `todo` for behavior the current code cannot satisfy.
Later implementation PRs make those tests pass and remove fulfilled markers.

The [development workflow](../design/TESTING-WORKFLOW.md) describes how to
stage and review these changes. The [executable specification](../tests/specification/README.md)
indexes the tests. Historical material lives in [archive/](archive/).
