# Parallel language work

Updated 9 November 2026. PR conversations are the durable handoff and ownership
record. Each implementation branch starts independently from master; none of
these workstreams chooses the public inspection/decoding boundary while the
author writes examples.

## Work and ownership

| Workstream | Initial scope | Implementation ownership |
| --- | --- | --- |
| 1: conformance baseline | Audit todo/legacy reasons, promote accepted supported behavior, refresh status prose | Documentation and fixture audit; String promotions belong to 2, declaration cases to 3 |
| 2: intrinsic String values | String literals and String-returning operations have intrinsic String identity | Literal/native result paths, String-related source expectations and transport regressions |
| 3: declaration products | Plain type construction is capture-free; named declarations install accessors | Declaration/compiler/registration paths and C05/C16/C18 semantic coverage |

The coordinator prepares scopes, reviews changes and integrates approved PRs.
The other agent can claim and implement the drafts, using separate sessions or
checkouts for parallel work. A GitHub username alone is insufficient to identify
an owner when agents share an account: include an agent/session label or URL.

Before coding, post `Claim: workstream N; session ...; branch ...; shared methods
to edit ...` on that PR. Keep one owner per branch. Progress comments should name
the commit, validation, changed scope and actual blockers. Release or transfer a
claim explicitly. Do not force-push another owner's branch.

## Current priority and parked handoffs

Implement accepted existing specification todos before starting new foundations.
The concrete/abstract declaration syntax in C05/C06/C13/C15/C16, its plain
type-producing counterpart, and parameterized C05/C12/C18 cases are explicit
roadmap targets. #31's value alignment and #32's declaration-product separation
are integrated. #39's inbox handoff is closed pending clarification in the project
chat and approved spec records; its branch is preserved for reference. #48's
non-generic concrete/abstract syntax is integrated. #52's draft is retired. See the
[proposed todo implementation queue](workstreams/08-todo-implementation-queue.md)
for the next coherent slices and their dependencies.

[#48](https://github.com/johnwarden/pattern-language/pull/48) is merged after
independent review and passing CI. Its
[scope](workstreams/07-declaration-syntax-conformance.md) records the fulfilled
non-generic C05/C06/C13/C16 assertions and remaining obligations. The separate
test-migration agent retains its own workstream.

Follow [TESTING-WORKFLOW.md](TESTING-WORKFLOW.md): review proposals on topic
branches, write or revise active tests once the spec is settled, then implement
the tests and remove fulfilled todos. Claim an implementation by naming its
cases and shared methods.

The following later handoffs are **parked**, unclaimed and not active implementation
work. Do not start them until the current specification priorities are addressed
and each proposed slice has executable acceptance tests.

| Parked PR                                                     | Proposed later work                   | Remaining boundary                                                                 |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| [#43](https://github.com/johnwarden/pattern-language/pull/43) | Internal unambiguous-grammar analysis | Public qualifier/protocol remains provisional; preserve general overlapping unions |
| [#44](https://github.com/johnwarden/pattern-language/pull/44) | Expected-grammar fields beyond String | Current specification todos have priority over this expansion                      |
| [#45](https://github.com/johnwarden/pattern-language/pull/45) | Internal one-or-more matching         | `T+` source integration and public representation remain open                      |

## Shared files

`src/runtime.ts` is the main overlap. Workstream 2 owns literal evaluation and
String-returning native paths; workstream 3 owns plain type construction,
declarations, type products and accessor registration. Announce additional
shared methods before editing them. Workstream 1 does not edit `src/`.

Workstream 1 owns roadmap/checklist status and this coordination record. Feature
branches keep implementation-specific notes in their own workstream files and
let the coordinator reconcile shared status prose. Avoid whole-file formatting
or unrelated fixture rewrites. Tests whose behavior changes belong to the feature
PR; the baseline audit should not race those migrations.

## Integration

Land the baseline audit independently. Review String alignment before declaration
separation, then rebase the declaration branch and rerun its checks against the
updated trunk. Parallel implementation does not imply simultaneous merges.
If a real dependency appears, record it in both PR conversations instead of
silently stacking or copying another branch's changes.

Run targeted checks during development and the complete `just check` gate on the
final PR revision. A green todo failure is not evidence that the intended feature
is missing: distinguish subject failures from proposed syntax or malformed
expected data. Preserve the expected-value-as-data rule and the legacy inventory.

Merge remains squash-only and requires the author's authorization for that PR.
The earlier authorization for #27/#28 does not authorize these new PRs.

## Decision boundaries

- Equivalent declarations and accessor collisions remain errors for now. The
  replacement policy is deferred; it does not block separating ordinary type
  construction from declaration effects.
- Intrinsic String behavior is accepted. It does not choose the PrimitiveType
  metatype, descriptor equality/decoding or new syntax. Raw runtime Expressions
  are separately allowed for now; see [their contracts](../specs/raw-expression-values.md).
- The public inspection/decoding examples belong to the author. If a workstream
  genuinely depends on that decision, report the smallest concrete example and
  continue independent work; do not invent the boundary.
- Deferred numeric, family-recovery, module/import and lifting policies stay out
  of these PRs. Preserve the documented formatting-safety rule and its exceptions.
