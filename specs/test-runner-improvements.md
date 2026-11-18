# Test-runner diagnostics and optional expected types

Approved by Jonathan in the project chat on 2026-11-10.

## Identify failed assertions

Every failed assertion reports its file, line and column and the original
assertion source, including multiline subjects. This also applies when a todo
unexpectedly succeeds; the message must identify which todo needs removal.
Expected todo failures remain quiet.

For a direct `assert a == b`, `assert a != b` or `assert a .matches b`, include
both operand expressions and their actual values, with types where needed to
distinguish them. Use the existing local value printer. Capture
operands during the original evaluation: preserve evaluation order and ordinary
operator dispatch, and never rerun either operand for reporting. If evaluation
throws, retain the original language diagnostic and location.

These deliberately failing fixtures must produce distinct, identifiable reports:

```pattern
test "Failed equality"
  left = 1
  right = 2
  assert left == right
end

test "Failed inequality"
  left = 1
  right = 1
  assert left != right
end

test "Failed pattern match"
  candidate = "hello"
  assert candidate .matches Rational
end

test "Fulfilled todo"
  todo assert 1 == 1
end
```

The equality report identifies `assert left == right`, `left: 1 :: Rational`
and `right: 2 :: Rational`. The inequality report identifies `assert left != right`
and both `1 :: Rational` operands. The match report identifies
`assert candidate .matches Rational`, the actual String `"hello"`, and the
actual RHS pattern value. The todo report identifies
`todo assert 1 == 1` and asks for todo removal. Exact layout is not prescribed.

Host acceptance tests cover all three predicates, operand evaluation counts/order, thrown operands,
multiline source ranges, repeated runs and all failing assertions in a file.
Harness behavior belongs in host tests; the snippets above are input fixtures.

Rewrite direct `assert not(a == b)` forms as `assert a != b`, preserving
grouping, comments and todo/legacy modifiers. Do not rewrite unrelated negations.

## Optional expected type

In `expect lhs is rhs`, the subject is the LHS. Without a RHS `:: Type`,
interpret the expected data using the actual LHS value's type. Equality still
requires the same type; omitting the annotation does not erase type identity,
coerce the LHS, evaluate the RHS as code, or infer a different type from its text.
An explicit RHS annotation continues to assert that exact type.

```pattern
test "Expected data uses the subject type"
  expect 1 is 1
  expect 3 :: Int is 3
  expect "hello" is "hello"
  expect :Ready is Ready

  type Rectangle concrete Rect(width :: Rational, height :: Rational)
  rectangle = Rect(2, 3) :: Rectangle
  expect rectangle is Rect(2, 3)
  expect rectangle is Rect(2, 3) :: Rectangle
end
```

Acceptance fixtures that must fail:

```pattern
test "A value mismatch is a comparison failure"
  expect 1 is 2
end

test "An explicit type mismatch remains a failure"
  expect 3 :: Int is 3 :: Rational
end

test "Expected data is never executed"
  expect 2
  is
    (1 + 1)
  end
end
```

The first fixture is valid DSL and reports expected `2`, actual `1`, and its
assertion location. The second reports the Int/Rational type mismatch. The third
cannot succeed by evaluating the expected expression. Preserve canonical,
inert expected-data rules, one-positional-result checks, explicit-annotation
behavior, and ordinary/todo/legacy modes. Cover both inline and indented forms.

Implement this together with the [expectation predicates](expect-predicates.md)
and [String-substring contains](expect-contains.md). Successful language cases
belong in `tests/`; malformed or deliberately failing runner inputs may remain
in `test/fixtures` when host tests consume them.

## Captured as tests

Implemented in [#71](https://github.com/johnwarden/pattern-language/pull/71),
squash commit `92791e4`, on the current `result`/`error` spelling:

- [test-runner-diagnostics.test.ts](../test/test-runner-diagnostics.test.ts)
  consumes the deliberately failing inputs in
  [test-runner-diagnostics.test](../test/fixtures/test-runner-diagnostics.test)
  and covers all three predicates (`==`, `!=`, `.matches`), operand evaluation
  counts/order, thrown operands, multiline ranges, repeated runs, quiet expected
  todos and every failing assertion in a file.
- [expected-types.test](../tests/language/expected-types.test) holds the
  passing optional-type examples; the failing type/value mismatch and inert
  expected-data cases are host fixtures.
- Direct `assert not(a == b)` forms were rewritten as `assert a != b`; the `not`
  prelude test is deliberately unchanged.

Remaining: none for the `is` spelling; the coordinated
[expectation-predicates](expect-predicates.md) migration landed in
[#70](https://github.com/johnwarden/pattern-language/pull/70) and converted these tests. Implemented here means captured as
tests, not a statement about unrelated runtime work.
