# Workstream 1: refresh the conformance baseline

Status: **landed** (historical). Merged via the conformance-baseline work that
fed master; no longer an active claim. Scope was documentation and test
classification only.

## Seed change

C03's Float64 designation already works. Its expected value used the noncanonical
`0f0.1` spelling, so the todo failed in expected-data validation before exercising
designation. The ordinary check now uses `0x1.999999999999Ap-4`, the exact value
already specified independently by C02. No expected result was inferred from
interpreter output. A negative check also verifies that exact Rational `0.1`
cannot be designated as Float64 without rounding.

The checklist no longer freezes obsolete corpus sizes. The roadmap records the
author's current collision policy: equivalent declarations and accessor collisions
remain errors while the replacement policy is deferred. Declaration/accessor
separation can proceed with that guard intact.

## Promoted supported checks

C24 successive packs and C25 equal-precedence infix already ran. Their todos
failed because expected data wrapped the whole setup block as the observed type
(and used String results). Ordinary checks now use Rational subjects already
covered in `tests/conformance/expressions.test` and
`tests/bindings/defaults.test`. The remaining C24 todo is the intended
two-result capture diagnostic, not missing pack semantics.

C03 Float64 designation is documented in the seed change above.

## Todo classification

Each remaining todo is one of:

| Unmet requirement | Where | Leave to |
| --- | --- | --- |
| Intrinsic String identity (`result … :: String`) | C01 `"hello"`; overlapping-union and example `toString` / quotation / local-text pairs | landed in #31 |
| Destination `struct` / `pattern` spelling, angle parameters, remaining capture-free gaps | Remaining C04–C18 todos, Packet rest, spreading/round-trip todos | #32/#48 landed bootstrap `concrete`/`abstract`; #88 retargets to `struct`/`pattern`; angle syntax stays parked (#62) |
| Proposed syntax that bootstrap `def … type` success does not fulfill | Remaining C16/C17/C18 parameterized subjects | keep pending where still todo |
| Canonical expected-data spelling | C03 Float64 was this; remaining String/`0f` text | #31 landed String identity; do not invent spellings |
| Deferred numeric families | C03 `Decimal32`, `Int16` | stay pending |
| Unresolved PrimitiveType metatype | C01 `Bool :: PrimitiveType` | author's metatype choice; not chosen here |
| Unresolved public inspection/decoding | LEGACY-ASSERTIONS D03/D02 type-text rows; example inspect/rebuild and descriptor `toString(Type)` subjects | author's examples |
| Future diagnostic wording | C24 two-result capture error text; current failure is `E_PATTERN_MISMATCH` | stay pending |
| Exploratory / undecided prohibition | C27 redundant primitive quotation in Code | stay pending; prohibition not finally chosen |
| Isolation harness | C26 future names | stay todo; surrounding checks already prove isolation |
| Future lifting | `specification/postfix` `sqrt?` | stay pending |
| Milestone 7 evidence | C07–C10 refinement/overload evidence | stay pending |

Do not promote a todo just because a bootstrap-syntax rewrite would pass. Future
declaration spelling is a distinct contract.

## Superseded open PRs

Recommend closing without merging, preserving branches and history. #27/#28
already landed the corresponding work on master `d8a6fb0`.

| PR | Why close |
| --- | --- |
| [#22](https://github.com/johnwarden/pattern-language/pull/22) | Exact `NumberLiteral(Rational)` landed in #27 |
| [#15](https://github.com/johnwarden/pattern-language/pull/15) | Distinct postfix and `T?` convention landed in #27/#28; branch is behind and dirty |
| [#26](https://github.com/johnwarden/pattern-language/pull/26) | Rebuild of #15 onto an older master; current master already has postfix/touching operators |
| [#21](https://github.com/johnwarden/pattern-language/pull/21) | Nested-option designation/projection is on master (`tests/bindings/nested-option-designation.test`) |
| [#14](https://github.com/johnwarden/pattern-language/pull/14) | Already marked superseded by #25 |
| [#25](https://github.com/johnwarden/pattern-language/pull/25) | Expected-grammar pack propagation is on master (`tests/specification/expected-grammar.test`) |

#29/#30/#31/#32 and #48 have landed. Do not reopen their ownership claims.

## Ownership and coordination

Own `TODO.md`, milestone/status prose in `ROADMAP.md`, and settled todo promotions
in `tests/specification/primitives.test` and `tests/specification/language.test`.
Claim additional test files in the PR conversation before editing them. Do not
edit `src/`, the test runner, or intrinsic String/declaration implementation
branches.

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

Use `just test-language tests/specification/primitives.test` and
`just test-language tests/specification/language.test` while working and
`just check` before requesting merge. Merge requires the author's explicit
authorization for this PR.
