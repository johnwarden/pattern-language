# Expectation predicates: is, contains and fails

Approved by Jonathan in the project chat on 9 November 2026; reaffirmed for
implementation on 10 November. This is a coordinated surface-syntax migration.

```pattern
test "Expectation predicates"
  expect 1 is 1
  expect 1 is 1 :: NumericValue
  expect "hello world" contains "world"
  expect parse(Code)("x + ") fails "E_SYNTAX"
end
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

[Predicate input](../test/fixtures/expect-predicates.test) and
[contains input](../test/fixtures/expect-contains.test) drive runner acceptance.
Passing language examples belong in `tests/` once supported. Keep deliberately
failing or malformed inputs in `test/fixtures` only when host tests assert their
reports; those inputs are not a default passing corpus or language-feature todos.
The contains fixture's [authored outcomes](../test/fixtures/expect-contains.md)
remain the acceptance criteria, rather than observed output.

## Captured as tests

Implemented in [#70](https://github.com/johnwarden/pattern-language/pull/70),
squash commit `40645dd`, together with [#71](https://github.com/johnwarden/pattern-language/pull/71)'s
optional expected type:

- [expect-predicates.test.ts](../test/expect-predicates.test.ts) runs the
  [predicate](../test/fixtures/expect-predicates.test) and
  [contains](../test/fixtures/expect-contains.test) inputs, checks that the
  old `result`/`error` delimiters are rejected, and covers todo/legacy modes.
- [expectations.test](../tests/language/expectations.test) holds passing
  `contains` examples; the whole `tests/` corpus uses `is`/`fails`.
- Untyped `is` uses the subject's type, covered by
  [expected-types.test](../tests/language/expected-types.test).

Exact `contains` diagnostics chosen by the implementation: `E_TEST_OPERAND_TYPE`
for a non-String subject or needle, and an uncoded comparison message for a
failed substring. Future predicates such as `isApprox` remain unimplemented.
