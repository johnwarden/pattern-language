# Specification-first development

Discuss new language rules with Jonathan. Use one topic per coherent change.
Use the existing specs and tests as the starting point. Keep unsettled choices
and motivating examples with the draft until the behavior is agreed.

| Stage | Change on the topic | What to review |
| --- | --- | --- |
| Specification | Edit or add documents directly under `specs/` on the topic branch. | The proposed intended behavior, examples and migration impact. The branch's tests may still describe the previous rule. |
| Tests | After the spec is settled, submit a test PR against the spec branch or its next stacked branch. Add or revise active `.test` files by topic. | The tests now describe the proposed behavior. Mark behavior that the current code cannot satisfy as `todo` and inspect the actual failures. |
| Implementation | Implement a coherent slice and remove the todo markers from the cases it makes pass. | The spec, executable contracts and code agree for that slice. Follow-up cases can keep explicit todos. |

Review successive stages in separate or stacked PRs when helpful. A stacked PR
targets the preceding stage's branch so its diff shows just the new work. Keep the
spec, tests and implementation that belong to the delivered slice together in the
change proposed for `master`. PRs to `master` use squash merge when Jonathan
authorizes the merge. Long-running topics can land in several coherent slices.

## Writing and validating contracts

- Reuse existing coverage where it expresses the agreed behavior. Add focused
  positive, negative and cross-context tests as needed. Name the relevant
  `.test` files and cases in implementation PRs.
- Use the regular test suite for new or changed contracts, including future
  behavior. `todo test` covers a whole case whose shared setup needs the feature.
  A todo assertion covers one unmet expectation. Inspect failures before
  treating a todo as a useful specification.
- Remove a todo when its intended behavior passes. Retire paired legacy checks
  deliberately. Keep useful explanations beside the tests and update links in
  the spec when the cases are added.
- Keep host/protocol, native adapter, transport, syntax-encoding and diagnostic
  metadata checks at their appropriate host boundary. Source contracts describe
  the language an author writes. Expected results are inert authored data.
  See the [source-contract audit](TEST-CONTRACT-AUDIT.md).
- For a bug in specified behavior, add a focused regression and fix it. For an
  example of supported behavior, add a runnable case with meaningful assertions.
  A distinct design PR is useful when behavior itself needs a decision.
- Run targeted checks plus `just check` on the final PR head. Record the cases
  made to pass, remaining todos and any gaps in validation.

Read the [spec index](../specs/README.md) for document conventions and the
[roadmap](../ROADMAP.md) for implementation order.
