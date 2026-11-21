# Parallel language work

Historical coordination for the November 2026 conformance slices. Those
implementation PRs have landed. Current language work follows
[TESTING-WORKFLOW.md](TESTING-WORKFLOW.md): finalize a spec with executable
contracts, migrate affected tests (often as `todo`) in a follow-up PR, then
implement against those todos. The todo cases in `tests/` and `specs/` are the
work queue; there is no separate implementation-queue document.

## Landed slices

| Workstream / PR | Outcome |
| --- | --- |
| 1: conformance baseline ([#30](https://github.com/johnwarden/pattern-language/pull/30)) | Landed. Todo/legacy audit and status refresh. |
| 2: intrinsic String values ([#31](https://github.com/johnwarden/pattern-language/pull/31)) | Landed. Intrinsic String identity and related primitive-name rulings. |
| 3: declaration products ([#32](https://github.com/johnwarden/pattern-language/pull/32)) | Landed. Capture-free plain construction; declaration-only accessors. |
| Declaration syntax ([#48](https://github.com/johnwarden/pattern-language/pull/48)) | Landed. Non-generic `concrete` / `abstract` recognition (bootstrap spelling). [#88](https://github.com/johnwarden/pattern-language/pull/88) retargets the destination spelling to `struct` / `pattern`. |
| #39 inbox handoff | Closed; accepted parts have contracts. |
| #52 | Retired. |

The per-slice notes under [workstreams/](workstreams/) are historical. Do not
treat their old “claimed” / “awaiting review” / “active” lines as current
ownership.

## Current process

1. Discuss and draft under `specs/` on a topic branch.
2. Finalize with executable fences; unmet checks are `todo`.
3. Migrate existing `.test` coverage in a follow-up PR (same-subject `todo` /
   `legacy` as required).
4. Implement; remove fulfilled todos and retire superseded legacy checks.

See also [ROADMAP.md](../ROADMAP.md) and [AGENTS.md](../AGENTS.md). Open
follow-ups owned elsewhere keep their own specs (for example named function
values, infix grouping follow-ups, match-arm work); link them neutrally and do
not restates their rules here.

## Parked later handoffs

Unclaimed and not active until each has a settled spec and executable acceptance
tests:

| Parked PR | Proposed later work | Remaining boundary |
| --- | --- | --- |
| [#43](https://github.com/johnwarden/pattern-language/pull/43) | Internal unambiguous-grammar analysis | Public qualifier/protocol remains provisional; preserve general overlapping unions |
| [#44](https://github.com/johnwarden/pattern-language/pull/44) | Expected-grammar fields beyond String | Current specification todos have priority over this expansion |
| [#45](https://github.com/johnwarden/pattern-language/pull/45) | Internal one-or-more matching | `T+` source integration and public representation remain open |
| [#62](https://github.com/johnwarden/pattern-language/pull/62) | Angle-bracket generic syntax | Parked draft; ordinary packs cover type factories for now |

## Decision boundaries that still apply

- Equivalent declarations and accessor collisions remain errors for now. The
  replacement policy is deferred; it does not block separating ordinary type
  construction from declaration effects.
- Intrinsic String behavior is accepted. It does not choose the PrimitiveType
  metatype or descriptor equality/decoding.
- Constructor expressions need a concrete interpretation from context or
  ascription; see [type-values](../specs/type-values.md#designation-and-matching).
- The public inspection/decoding examples belong to the author. Do not invent
  that boundary.
- Deferred numeric, family-recovery, module/import and lifting policies stay
  out of opportunistic doc edits. Preserve the documented formatting-safety
  rule and its exceptions.
