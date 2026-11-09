# Draft contains predicate fixtures

These cases specify the assertion runner's behavior for the
[approved String-substring predicate](../../specs/approved/expect-contains.md).
They are future runner input, not a default source suite. Some must report failed
checks; running this file is not expected to produce an all-green test report.

| Case | Expected outcome after implementation |
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

The file has ten cases and fourteen checks. Once the new clauses are supported,
a harness test should run these inputs and assert each report's outcome. Keep the
failure reasons authored as above; do not derive them from observed output or
use todo to hide intentional assertion failures. Exact diagnostic codes and
wording remain unspecified.

The current parser rejects `contains` before these checks execute. Until the
coordinated migration, keep this file outside `tests/` and do not describe it as
executed conformance coverage. It complements
[expect-predicates.test](expect-predicates.test), which records the `is`/`fails`
surface migration. Empty-needle and special Unicode cases can be added separately.
