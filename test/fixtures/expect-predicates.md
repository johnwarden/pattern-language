# Pending expectation vocabulary migration

The [approved change](../../specs/approved/expect-predicates.md) records the settled
rename and scope; [the pending contains proposal](../../specs/inbox/contains-predicate.md)
records the remaining question for discussion in the project chat.

[expect-predicates.test](expect-predicates.test) illustrates the target `is` and
`fails` surface in actual `.test` syntax. It is a pending runner-input fixture,
outside default `tests/` discovery because the current runner cannot yet parse
the new clauses. Do not count it as executed conformance coverage or replace it
with a passing placeholder. The migration should use it to drive parser/harness
acceptance and mass-edit existing tests; it need not become new corpus cases.

The requested vocabulary is `expect ... is ...`, `expect ... contains ...`, and
`expect ... fails ...`, with possible later predicates such as `isApprox`. The
initial rename preserves the existing typed expected-data and failure contracts
unless the author supplies different examples. The exact meaning of `contains`
is still pending; no membership, output-inclusion or pattern policy is assumed.

The coordinated change is scheduled for 03:00 Europe/Madrid on 10 November 2026,
covering the integration branch `master` and all affected repository branches
while other work is quiet. Update the common schema, runner, fixtures, generated
examples, documentation and relevant editor consumers together, with branch-head
leases and validation. Preserve literal contents and deliberate malformed-input
examples when migrating assertion clauses. The new vocabulary is not being
enabled during the current work session.
