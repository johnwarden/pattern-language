# Contains predicate fixtures

These cases specify the assertion runner's behavior for the
[approved String-substring predicate](../../specs/implemented/expect-contains.md).
They are runner input, not a default source suite. Some must report failed
checks; running this file is not expected to produce an all-green test report.

| Case | Expected outcome |
| --- | --- |
| contains finds exact contiguous text | Pass all four checks: prefix, middle, suffix and entire String |
| contains accepts a computed String | Pass; evaluate the subject normally |
| contains treats punctuation literally | Pass both checks |
| contains fails when the substring is absent | Failed substring check |
| contains does not match a noncontiguous subsequence | Failed substring check |
| contains requires exact letter case | Failed substring check |
| contains does not interpret a regular expression | Failed substring check |
| contains rejects a numeric subject instead of stringifying it | Operand type error: actual value is not String |
| contains rejects a numeric needle instead of stringifying it | Operand type error: expected needle is not String |
| contains rejects a collection subject | Operand type error: actual value is not String |

The file has ten cases and fourteen checks. `test/expect-predicates.test.ts`
runs these inputs and asserts each report's outcome. The failure reasons are
authored as above, not derived from observed output. Operand type errors report
`E_TEST_OPERAND_TYPE`; failed substring comparisons report
`expected "<subject>" to contain "<needle>"`. Empty-needle and special Unicode
cases can be added separately.

These fixtures stay outside `tests/` because the intentionally failing cases test
the assertion runner and must not appear in the default source suite. They
complement [expect-predicates.test](expect-predicates.test), which records the
`is`/`fails` surface.
