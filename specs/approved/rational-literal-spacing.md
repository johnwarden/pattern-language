# Spaced Rational division remains an expression

Approved by Jonathan in the project chat on 10 November 2026. This settles the
spacing distinction within the
[archived parenthesized Rational proposal](../archive/rational-literals-and-text.md), without
approving its remaining lexical details or canonical printing policy.

`(1 / 3)` is ordinary grouped division, equivalent in Code to `/(1)(3)`. It is
not a Rational literal. The proposed tight `(1/3)` literal and the spaced division
expression produce the same exact Rational under ordinary Rational division,
but their Code trees differ. This value-preserving distinction is permitted by
formatting safety; identical Code trees are not required for these two spellings.
The existing infix rule still rejects partial spacing such as `(1/ 3)` or `(1 /3)`.

Ordinary Code printing may use spaced division inside grouping parentheses.
It does not need a special escape to prevent `(1 / 3)` becoming a literal.

`(1 / 0)` is also an ordinary expression: reading or quoting it does not execute
division, and an unused default containing it does not fail. Evaluating the
division fails. The proposed tight `(1/0)` literal instead has an invalid
denominator and fails during reading.

The linked draft records the source examples, Code distinctions, lazy-default
case and printing round trip. Convert these into actual `.test` contracts before
implementing the tight literal syntax. This record does not claim that syntax
is already implemented or relax unrelated whitespace rules.
