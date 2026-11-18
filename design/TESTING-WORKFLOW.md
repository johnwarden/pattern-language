# Specification-first development

Discuss new language rules with Jonathan. Use one topic per coherent change.
Use the existing specs and tests as the starting point. Keep unsettled choices
and motivating examples with the draft until the behavior is agreed.

| Stage | Change on the topic | What to review |
| --- | --- | --- |
| Specification | Edit or add documents directly under `specs/` on the topic branch. | The proposed intended behavior, examples and migration impact. The branch's tests may still describe the previous rule. |
| Tests | After the spec is settled, add or revise executable spec fences or active `.test` files in a test PR. Base it on `master` if the spec has merged, or stack it on the spec branch for review. | The tests now describe the proposed behavior. Mark behavior that the current code cannot satisfy as `todo` and inspect the actual failures. |
| Implementation | Implement a coherent slice and remove the todo markers from the cases it makes pass. | The spec, executable contracts and code agree for that slice. Follow-up cases can keep explicit todos. |

Each stage can merge to `master` when reviewed and authorized. An approved
spec can land before its tests. The test PR can land before implementation
with unmet expectations marked `todo`. Later PRs can implement the contracts
in several coherent slices.

Stack PRs when it helps to review a stage before its prerequisite lands. Once
the prerequisite is squash-merged, update the next PR on top of `master` so its
diff contains only its own changes. PRs to `master` use squash merge when
Jonathan authorizes the merge.

## Writing and validating contracts

- Reuse existing coverage where it expresses the agreed behavior. Add focused
  positive, negative and cross-context tests as needed. Name the relevant
  files and cases in implementation PRs. The [Rational literals spec](../specs/rational-literals-and-text.md)
  pilots contracts beside the rules they exercise. Use a top-level `pattern test`
  fence for those contracts. A plain `pattern` fence is an example.
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
