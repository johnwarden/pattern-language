# Parallel language work

Updated 9 November 2026. PR conversations are the durable handoff and ownership
record. Each implementation branch starts independently from master; none of
these workstreams chooses the public inspection/decoding boundary while the
author writes examples.

## Work and ownership

| Workstream                 | Initial scope                                                                        | Implementation ownership                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 1: conformance baseline    | Audit todo/legacy reasons, promote accepted supported behavior, refresh status prose | Documentation and fixture audit; String promotions belong to 2, declaration cases to 3    |
| 2: intrinsic String values | String literals and String-returning operations have intrinsic String identity       | Literal/native result paths, String-related source expectations and transport regressions |
| 3: declaration products    | Plain type construction is capture-free; named declarations install accessors        | Declaration/compiler/registration paths and C05/C16/C18 semantic coverage                 |

The coordinator prepares scopes, reviews changes and integrates approved PRs.
The other agent can claim and implement the drafts, using separate sessions or
checkouts for parallel work. A GitHub username alone is insufficient to identify
an owner when agents share an account: include an agent/session label or URL.

Before coding, post `Claim: workstream N; session ...; branch ...; shared methods
to edit ...` on that PR. Keep one owner per branch. Progress comments should name
the commit, validation, changed scope and actual blockers. Release or transfer a
claim explicitly. Do not force-push another owner's branch.

## Next implementation queue

The following PRs start as independent draft handoffs from master. Their initial
changes are contracts and coordination documentation, not implementations. The
coordinator owns the seeds; implementation is unclaimed until an agent posts its
session, branch and exact shared methods on the selected PR. A draft does not
mean that an agent is running, and green documentation CI is not feature evidence.

| Workstream / PR                                                                            | First deliverable                                                   | Owned boundary                                                                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [4: grammar analysis (#43)](https://github.com/johnwarden/pattern-language/pull/43)        | Bounded internal uniqueness/ambiguity/unknown analysis              | A focused proof module and tests; audit existing union-disjointness rules without changing general union membership        |
| [5: expected-grammar fields (#44)](https://github.com/johnwarden/pattern-language/pull/44) | Existing Rational/Int fields alongside String in single-line DSLs   | expected-grammar.ts and named existing runtime elaboration methods; one mechanism across current binding/call entry points |
| [6: one-or-more matching (#45)](https://github.com/johnwarden/pattern-language/pull/45)    | Shared internal nonempty repetition with correct capture dimensions | Matcher/compiler and focused tests; no premature source suffix or descriptor integration                                   |

Workstreams 4 and 5 can develop their independent foundations while #31 finishes;
verify primitive/String classification and rebase after its authorized integration.
#32 continues to own declaration/accessor products. The concrete matching-role
regressions and handoff already exist in [#39](https://github.com/johnwarden/pattern-language/pull/39);
do not duplicate that work or assume that its implementation has an owner.
Workstream 6 must coordinate matcher methods with #39. Workstream 4 must leave new
repetition forms unknown until it has sound proof rules for them.

The `unambiguous` qualifier spelling/protocol and `T+` source integration remain
provisional. Internal foundations do not select them. Public inspection/decoding,
return/layout DSL expansion, numeric families and the deferred collision policy
are not added by these drafts. Keep each PR draft until its stated internal slice
is implemented, tested and accurately described. Replace the handoff PR description
with actual behavior and final validation when marking it ready. Each merge still
requires Jonathan's explicit authorization for that PR.

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
  metatype, raw Expression exposure, descriptor equality/decoding or new syntax.
- The public inspection/decoding examples belong to the author. If a workstream
  genuinely depends on that decision, report the smallest concrete example and
  continue independent work; do not invent the boundary.
- Deferred numeric, family-recovery, module/import and lifting policies stay out
  of these PRs. Preserve the documented formatting-safety rule and its exceptions.
