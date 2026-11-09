# Workstream 1: refresh the conformance baseline

Status: draft for another agent to continue. Scope is documentation and test
classification; this workstream changes no language implementation or policy.

## Seed change

C03's Float64 designation already works. Its expected value used the noncanonical
`0f0.1` spelling, so the todo failed in expected-data validation before exercising
designation. The ordinary check now uses `0x1.999999999999Ap-4`, the exact value
already specified independently by C02. No expected result was inferred from
interpreter output. A negative check also verifies that exact Rational `0.1`
cannot be designated as Float64 without rounding.

The checklist no longer freezes obsolete corpus totals. The roadmap records the
author's current collision policy: equivalent declarations and accessor collisions
remain errors while the replacement policy is deferred. Declaration/accessor
separation can proceed with that guard intact.

## Remaining audit

- Classify each todo by its actual unmet requirement: language semantics, proposed
  syntax, canonical expected-data spelling, or a still-unresolved contract.
- Promote only accepted behavior demonstrated by positive, negative and relevant
  cross-context checks. A todo whose expected data is malformed does not prove its
  subject is unsupported.
- Keep tests that use future declaration spellings explicitly pending; successful
  behavior under bootstrap syntax alone does not fulfill a future syntax contract.
- Reconcile stale implementation-status prose with executable coverage. Use runner
  output for current totals instead of duplicating counts throughout the docs.
- Review superseded PRs against the merged consolidation and recommend closures
  individually. Preserve branches and history; do not merge obsolete heads.

## Ownership and coordination

Own `TODO.md`, milestone/status prose in `ROADMAP.md`, and settled todo promotions
in `tests/specification/primitives.test`. Claim additional test files in the PR
conversation before editing them. Do not edit `src/`, the test runner, or intrinsic
String/declaration implementation branches.

The intrinsic String workstream owns String-related promotions. The declaration
workstream owns C05/C16/C18 semantics and declaration fixtures. Let their feature
PRs carry tests whose behavior they implement; this audit should not race them.
Preserve the existing public Expression/inspection/decoding boundary while the
author writes examples. No metatype, module/import or collision policy is chosen
here.

## Acceptance criteria

- Every promoted assertion targets accepted behavior, with a documented reason it
  was previously marked todo.
- Each remaining legacy assertion still has a same-subject todo or an entry in
  `design/LEGACY-ASSERTIONS.md`.
- Targeted source cases pass; the complete source suite and PR CI remain green.
- No broad assertion rewrite, generated-from-output expectations, placeholder
  failures, or source-language implementation changes are introduced.

Use `just test-language tests/specification/primitives.test` while working and
`just check` before requesting merge. Merge requires the author's explicit
authorization for this PR.
