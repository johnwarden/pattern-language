# Workstream 6: one-or-more matching foundation

Status: draft implementation handoff. This PR initially adds this contract only;
it does not add matcher behavior, `T+` syntax or a new source type. It supports
the roadmap's nonempty-list/repetition goal through a bounded internal first step.

## Current boundary

The shared `Pattern<T>` repeat case in `src/pattern.ts` includes the empty match.
`TestFileContent` consequently uses a required first TestBlock and a repeated tail
to express a nonempty file. A file containing only one `todo test` is already valid
and must remain so. Ordinary Code bodies still require a final result row; test
bodies follow their separate setup/check grammar.

`T+` is a future nonempty-list proposal. [POSTFIX.md](../POSTFIX.md) explicitly
does not include `+` in the accepted generic suffix inventory. This PR must not
silently extend that inventory, reinterpret infix addition or choose a new marker.
Source syntax integration and replacement of TestFileContent's workaround remain
pending until their grammar is explicitly approved.

## First deliverable

Add reusable internal one-or-more matching through the common matcher/compiler
boundary. Choose a minimal internal representation and document its semantics.
Zero-or-more behavior must remain unchanged. Count successful repetitions, not
consumed tokens: one row or pattern occurrence can consume several fields.
Never return the empty state as a successful one-or-more result.

Preserve capture collection order, aggregate annotations and one list layer per
repeated dimension. A horizontal rest repeated vertically still collects a list
of row lists; a single nonempty row must not flatten into a scalar or lose a layer.
Independent duplicate captures remain errors. Zero-width repetition and excessive
search must retain bounded, explicit failures rather than loop or pick a result.

The first deliverable may remain internal. Before exposing any portable type,
prove that identity and serialization preserve the repetition constraint with
existing agreed representations. Never encode a one-or-more constraint as an
unconstrained Repeat merely to pass transport tests. If that requires an unresolved
public descriptor form, record the boundary and leave source-type exposure pending.
Do not invent a new public inspection/decoding constructor for this foundation.

## Acceptance cases

| Case                                                       | Required behavior                                        |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Empty input                                                | Zero-or-more succeeds; one-or-more does not              |
| One or several complete occurrences                        | Both accept, with the same order and capture shape       |
| One occurrence consumes several fields                     | It counts as one occurrence, not several                 |
| Vertical-only and horizontal-plus-vertical captures        | Preserve one and two list layers respectively            |
| A required label or element fails partway through          | No partial successful match or leaked captures           |
| A nullable repeated pattern or excessive alternatives      | Existing progress/budget safeguards apply                |
| A single todo test file and optional inbox discovery       | Existing runner behavior remains unchanged               |
| An internal constraint reaches identity/transport adapters | It is preserved or explicitly unsupported, never dropped |

Use focused host matcher/compiler tests for this internal slice. Retain resource,
vertical capture, defaults/rollback and source-suite controls. Do not turn future
source spelling failures into proof that the matching feature works. Run
`just check` on the final implementation head before marking it ready.

## Ownership and coordination

Own the focused matcher/compiler changes and tests; announce exact shared methods
before coding. The grammar-certification workstream must treat new repetition
forms as unknown until its sound proof rules cover them. Coordinate with #39 on
matcher roles: this PR changes multiplicity, not concrete-boundary projection.
#32 keeps declaration/accessor ownership and #31 keeps primitive/value-text work.
Avoid broad runtime, parser, Test schema or type-schema edits in this first step.

The coordinator seeds this handoff; implementation is unclaimed until an agent
posts its session, branch and methods on the PR. Start independently from master.
Keep equivalent declarations/accessor collisions as errors and leave the public
inspection boundary, lifting, generic syntax and numeric policies unchanged.
Mark ready only for the implemented internal slice, with source integration still
clearly pending. Each merge needs Jonathan's authorization for this PR.
