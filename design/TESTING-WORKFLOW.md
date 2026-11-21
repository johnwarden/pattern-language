# Specification-first development

Discuss new language rules with Jonathan. Use one topic per coherent change.
Use the existing specs and tests as the starting point. Keep unsettled choices
and motivating examples with the draft until the behavior is agreed.

| Stage | Change | What to review |
| --- | --- | --- |
| Draft spec | Edit or add a document under `specs/` on a topic branch. Use indented code blocks for sketches. | Intended behavior, motivating examples and open choices. |
| Finalize spec | Put executable contracts beside the agreed rules in top-level unlabeled or Pattern fences. Cover the main positive, negative, boundary and cross-context cases. | The tests demonstrate the agreed behavior. Mark unmet expectations `todo` and inspect their failures. |
| Migrate existing tests | In a follow-up PR, update tests affected by the new spec. Retain obsolete expectations that still pass as `legacy` while their replacements are pending. | Use a same-subject `todo` where required by the [legacy coverage rules](LEGACY-ASSERTIONS.md). |
| Implement | Make the executable spec cases and affected tests pass. Remove fulfilled todos and retire the superseded legacy checks. | Run the contracts as ordinary checks. A partial implementation may leave explicit todos for later slices. |

The spec PR, test migration PR and implementation PRs can each merge to
`master` when reviewed and authorized. Skip the migration PR when existing
tests need no changes. After a prerequisite is squash-merged, update any
stacked follow-up on top of `master` so its diff shows only its own work.
PRs to `master` use squash merge when Jonathan authorizes the merge. The todo
cases themselves are the implementation queue; do not maintain a parallel
backlog document that duplicates them.

## Writing and validating contracts

- Use unlabeled or `pattern` fences for executable spec
  examples. Definitions and values are available to later fences. Simple
  checks can use `expect` or `assert` directly. Use named tests for independent
  cases. The [numeric literals and text spec](../specs/numeric-literals-and-text.md)
  shows both forms.
- Use `todo test` when the whole case or its local setup needs the feature.
  Use `todo expect` or `todo assert` for individual unmet expectations.
- Verify a todo fails for the intended reason. If new syntax is unavailable to
  the test reader, pass it as text to the relevant language reader inside the test.
- Reuse coverage that already expresses the agreed behavior. Name the relevant
  files and cases in implementation PRs. Keep useful explanations beside the
  tests and update spec links to companion cases as they move.
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
