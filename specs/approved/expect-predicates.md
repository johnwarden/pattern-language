# Expectation predicates: is and fails

Approved by Jonathan in the project chat on 9 November 2026. This records a
surface-syntax migration; the corresponding mass edits need not add test cases.

Replace the current expectation delimiters with:

```text
expect subject is expected :: Type
expect subject fails "diagnostic"
```

`is` replaces `result`; `fails` replaces `error`. Preserve the existing equality,
typed expected-data and diagnostic contracts. Expected values remain authored
inert data. Preserve todo/legacy execution, unexpected-success reporting, optional
inbox discovery, explicit-path runs and filename diagnostics. Do not rename words
inside unrelated program strings, quoted code or deliberate malformed fixtures.

Examples of the target spelling live in
[`test/fixtures/expect-predicates.test`](../../test/fixtures/expect-predicates.test).
That fixture is pending parser input, not executed corpus coverage on the current
runner. Convert existing assertions and update the shared Test schema, runner,
host/source fixtures, documentation and affected editor consumers together.

The coordinated migration is authorized for `master` and affected branches at
03:00 Europe/Madrid on 10 November. Preserve branch work with exact-head leases;
do not merge unrelated features. This timing is for the migration, not a general
license to choose unspecified language behavior.

`expect subject contains expected` now has the separately
[approved String-substring contract](expect-contains.md). Its
[draft fixtures](../../test/fixtures/expect-contains.test) include both successful
checks and intentionally failing runner inputs with authored outcomes. Include
the predicate and real harness checks in the coordinated migration. Leave room
for later predicates such as `isApprox` without implementing them now.

Move this record to `../implemented/` when real tests capture the new syntax;
replace the pending-fixture note with links to those tests and the migration PR.
No corresponding inbox submission exists to remove for this decision.
