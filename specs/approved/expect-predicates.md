# Expectation predicates: is, contains and fails

Approved by Jonathan in the project chat on 9 November 2026; reaffirmed for
implementation on 10 November. This is a coordinated surface-syntax migration.

```pattern
expect subject is expected
expect subject is expected :: Type
expect subject contains "needle"
expect subject fails "diagnostic"
```

`is` replaces `result`; `fails` replaces `error`. Preserve existing equality,
inert authored expected data and diagnostic matching. An omitted RHS type uses
the subject value's type, as specified in
[test-runner improvements](test-runner-improvements.md). `contains` follows the
[approved String-substring contract](expect-contains.md). Future predicates such
as `isApprox` remain unimplemented.

Preserve todo/legacy execution and unexpected-success reporting, explicit-path
runs, optional inbox discovery and filename diagnostics. Rename assertion clauses,
not unrelated program strings, quoted code or deliberate malformed-input cases.
Update the shared Test schema, runner, CLI, source corpus, host tests,
documentation and affected editor consumers together in one implementation PR.
Reconcile affected active branches when rebasing after its authorized merge;
do not merge unrelated features as part of the migration.

[Predicate input](../../test/fixtures/expect-predicates.test) and
[contains input](../../test/fixtures/expect-contains.test) drive runner acceptance.
Passing language examples belong in `tests/` once supported. Keep deliberately
failing or malformed inputs in `test/fixtures` only when host tests assert their
reports; those inputs are not a default passing corpus or language-feature todos.
The contains fixture's [authored outcomes](../../test/fixtures/expect-contains.md)
remain the acceptance criteria, rather than observed output.

The earlier scheduled migration wording is superseded by this implementation
request. Move this record to `../implemented/` when executable tests capture the
change, with links to the tests and implementation PR. No inbox file remains to
remove for this decision.
