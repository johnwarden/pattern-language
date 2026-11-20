# Contains expectations: String substrings

Approved by Jonathan in the project chat on 9 November 2026: initially support
substring matching, and require the subject value to be a String.

```pattern
test "Contains matches contiguous String text"
  expect "hello world" contains "hello"
  expect "hello world" contains "lo w"
  expect "hello world" contains "world"
  expect "a,b" contains ","
end
```

The subject must produce one String value. The expected needle is authored String
data, following the Test DSL's existing inert expected-data rule. The check passes
when the needle occurs as exact contiguous text in the subject. Numbers, lists
and other values are not implicitly converted to text. Matching is literal;
regular expressions, collection membership and structural matching are outside
this first scope.

The [draft fixtures](../test/fixtures/expect-contains.test) illustrate matching
at the beginning, middle and end, computed String subjects, absent/noncontiguous
text, literal punctuation, and rejection of non-String subjects/needles. Their
[expected outcomes](../test/fixtures/expect-contains.md) distinguish passing
checks, failed substring comparisons and operand type errors.

## Captured as tests

Implemented with the [coordinated migration](expect-predicates.md) in
[#70](https://github.com/johnwarden/pattern-language/pull/70), squash commit
`40645dd`. The [fixtures](../test/fixtures/expect-contains.test) are consumed by
[expect-predicates.test.ts](../test/expect-predicates.test.ts), which asserts
every authored outcome (passing checks, failed substring comparisons and operand
type errors, the latter as `E_TEST_OPERAND_TYPE`) and the todo/legacy modes. Passing
language examples are in [expectations.test](../tests/language/expectations.test).
The String-only contract is preserved: no regular expressions, membership or
structural matching. Empty needle and special Unicode edge cases remain
unillustrated.

Origin: `specs/inbox/contains-predicate.md`, now superseded by this decision.
