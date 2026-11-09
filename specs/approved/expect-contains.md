# Contains expectations: String substrings

Approved by Jonathan in the project chat on 9 November 2026: initially support
substring matching, and require the subject value to be a String.

```pattern
expect subject contains "needle"
```

The subject must produce one String value. The expected needle is authored String
data, following the Test DSL's existing inert expected-data rule. The check passes
when the needle occurs as exact contiguous text in the subject. Numbers, lists
and other values are not implicitly converted to text. Matching is literal;
regular expressions, collection membership and structural matching are outside
this first scope.

The [draft fixtures](../../test/fixtures/expect-contains.test) illustrate matching
at the beginning, middle and end, computed String subjects, absent/noncontiguous
text, literal punctuation, and rejection of non-String subjects/needles. Their
[expected outcomes](../../test/fixtures/expect-contains.md) distinguish passing
checks, failed substring comparisons and operand type errors.

These are pending parser-input fixtures outside default `tests/` discovery. The
current runner does not recognize `contains`, so they are not passing executable
coverage yet. The intentionally failing fixtures test the assertion runner; do
not turn them into language-feature todos or count their failure as implementation.

Convert these examples into actual harness checks of the expected reports during
the coordinated [expectation migration](expect-predicates.md), preserving the
String-only contract. Exact diagnostic codes/text are not selected here. Empty
needle and special Unicode edge cases are not illustrated by this initial batch.
Keep this record approved until real tests exercise the predicate and its failure
reports, then move it to `../implemented/` with links.

Origin: `specs/inbox/contains-predicate.md`, now superseded by this decision.
