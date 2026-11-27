# Workstream 4: bounded unambiguous-grammar analysis

Status: draft implementation handoff. This PR initially adds this contract only;
it does not implement certification or a language qualifier. Roadmap 5a.2, D07,
C13/C14 and [UNION-GRAMMARS.md](../UNION-GRAMMARS.md) supply the accepted direction.

## First deliverable

Build a conservative, bounded internal analysis of whether an existing grammar
can interpret unannotated text uniquely. Keep this separate from general union
membership: overlapping abstract unions remain legal. Certification must preserve
the member value and concrete identity, including inside nested fields and facets;
proving only that outer constructor heads differ is insufficient.

The internal result must distinguish proved uniqueness, demonstrated ambiguity and
unknown. These are engineering results, not new public language constructors.
Return unknown for unsupported readers, unresolved recursion, predicates or budget
exhaustion. Unknown must never be accepted as a proof or reported as demonstrated
ambiguity. Sampling examples is not a uniqueness proof.

Audit `src/union-disjointness.ts` before reuse. Its existing `patternOverlap`
answers structural overlap questions; that is not automatically a proof about
text interpretation or preservation of distinct concrete members. Explain each
sound rule and its supported grammar subset. Opaque hooks must remain opaque;
never run a user predicate, default, macro, constructor or reader to obtain proof.

The initial subset should cover literal/primitive and bounded structural
alternatives only where the existing grammar provides enough information.
Propagate unknown through composition. Demonstrate actual ambiguity using a
checked witness or a sound overlap rule; do not claim one merely because a proof
of disjointness failed. Record the supported and unsupported cases explicitly.

## Acceptance cases

| Case                                                                            | Required result                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Rational versus String text in the supported primitive grammar                  | Unique interpretation                                                    |
| Float32 versus Float64 at a shared exactly representable spelling such as `0.5` | Ambiguous member interpretation                                          |
| Distinct concrete members with identical surface patterns                       | Ambiguous even though their concrete identities differ                   |
| A nested abstract field with ambiguous members                                  | The containing grammar cannot be certified by ignoring that field        |
| An opaque predicate/reader, unresolved recursive path or exhausted budget       | Unknown; no user hook is executed                                        |
| An ordinary overlapping UnionType without a certification request               | Existing construction, designation and typed-text behavior remains valid |

Keep source C14's proposed declaration syntax pending. Add targeted host proof
tests and retain active C13 union/typed-text controls. Report exact evidence for
each rule, including boundedness and no-execution canaries. Run `just check` on
the final implementation head; a green documentation PR is not implementation.

## Scope and ownership

Own a focused internal analyzer and its tests, with deliberate audited reuse of
`src/union-disjointness.ts`. Do not restore `requireDisjointUnion` as a requirement
for every union. Avoid global parser/runtime edits for the first deliverable.
The existing general-union and descriptor/typed-text paths are regression
boundaries, not opportunities to select new policy.

Start independently from master. Claim this PR with agent/session, branch and
intended shared methods before coding. #31 owns reserved-symbol/value-text
alignment, so rebase and verify primitive classification after its authorized
integration. #32 owns declaration products; #39 owns concrete matching roles.
The new nonempty-repetition work must coordinate proof rules for repetition;
unsupported new patterns are unknown until sound rules exist.

## Decisions deliberately left open

The public qualifier spelling, certification protocol and complete proof subset
remain provisional. This first PR implements reusable analysis, not the public
`unambiguous` declaration or a new metatype. Do not invent a public inspection or
decoding representation, first-success parsing, predicate-based branch priority,
singleton-union policy, family recovery or module behavior. Equivalent
declarations and accessor collisions remain errors. Inbox discovery stays
optional by default and available through explicit paths.

Mark ready only when the claimed implementation and its evidence are present.
Each merge needs Jonathan's authorization for this PR.
