# Language specifications

Accepted specifications live directly under `specs/` on `master`. To propose
a change, create a topic branch and edit the relevant document in place or add a
new one here. Record open questions on that branch and discuss them with Jonathan.
Keep settled behavior in the same document as it gains tests and implementation.

Use indented code blocks for draft sketches and display-only examples.
Top-level unlabeled and `pattern` fences run. A fence
can introduce definitions for later fences or contain `expect`, `assert`, or
named tests. Before merging, cover agreed behavior and mark unmet checks
`todo`. Existing `.test` files under `tests/` remain valid.

The approved spec can land with those pending tests. Use a follow-up PR to
migrate existing tests where needed. Implementation PRs make the tests pass,
remove fulfilled todos and retire superseded legacy checks. Each stage can land
on `master` in its own PR.

The [development workflow](../design/TESTING-WORKFLOW.md) describes how to
stage and review these changes. The [executable specification](../tests/specification/README.md)
indexes the topical `.test` contracts. Historical material lives in
[archive/](archive/).

A companion rationale can explain the design with worked examples, as in
[type values](type-values-rationale.md).
