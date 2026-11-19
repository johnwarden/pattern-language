# Language specifications

Accepted specifications live directly under `specs/` on `master`. To propose
a change, create a topic branch and edit the relevant document in place or add a
new one here. Record open questions on that branch and discuss them with Jonathan.
Keep settled behavior in the same document as it gains tests and implementation.

From the Rational literals pilot forward, put new executable contracts in
top-level `pattern test` fences in the spec itself. Use plain `pattern` fences
for draft or illustrative examples. Before the spec merges, add `pattern test`
fences that cover its agreed behavior. Mark unmet contracts `todo` inside the
fence. Existing `.test` files under `tests/` remain valid; migrate a topic into
its spec when that record is the right home.

The approved spec can land with those pending tests. Use a follow-up PR to
migrate existing tests where needed. Implementation PRs make the tests pass,
remove fulfilled todos and retire superseded legacy checks. Each stage can land
on `master` in its own PR.

The [development workflow](../design/TESTING-WORKFLOW.md) describes how to
stage and review these changes. The [executable specification](../tests/specification/README.md)
indexes the topical `.test` contracts. Historical material lives in
[archive/](archive/).
