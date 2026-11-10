# Parentheses when mixing arithmetic operators

Approved by Jonathan in the project chat on 10 November 2026. Preserve equal
operator precedence and require explicit parentheses when mixing arithmetic
operators. This records the agreed Code-expression rule separately from the
remaining fraction-literal and canonical-text proposals.

## Rule

At one unparenthesized arithmetic-expression level, binary arithmetic operators
may repeat the same operator but must not mix different operators. Parentheses
delimit a separately checked expression level.

The required cases cover `+`, `-`, `*` and `/`. Existing right associativity
remains: `a - b - c` means `a - (b - c)`, and `a / b / c` means
`a / (b / c)`. No traditional precedence tiers are introduced.

| Source | Status |
| --- | --- |
| `1 / 2` | Accepted |
| `(1 / 2) + (3 / 4)` | Accepted |
| `a + b + c` | Accepted |
| `a + (b * c)` | Accepted |
| `(a + b) * c` | Accepted |
| `a + b * c` | Rejected |
| `a - b + c` | Rejected |
| `a * b / c` | Rejected |

Prefix negation is not another binary operator: `a + -b` does not mix addition
and binary subtraction. Postfix punctuation and constructor syntax are checked
according to their grammatical roles. This decision does not assign arithmetic
meaning to arbitrary custom operators or change comparison/logical precedence.

Each argument, field and parenthesized subexpression is checked independently:
`f(a + b, c * d)` is valid. Text inside strings, comments and literal DSL fields
is not scanned for arithmetic punctuation. Apply the rule within an arithmetic
Code-expression form selected by the active grammar.

## Failure phase and printing

Reject an unparenthesized mixture while reading/checking the Code expression,
before evaluation or any effects. The diagnostic should identify the conflicting
operators and require parentheses. A suitable stable reason substring is
`mixed arithmetic operators require parentheses`.

Canonical Code text must include the parentheses this rule requires even when
the old equal-precedence/right-associative parser could reconstruct the same tree
without them. For example, `a + (b * c)` must not print as `a + b * c`.
Preserve parse/print identity and complete argument-pack boundaries.

## Source contracts

```pattern
test "Arithmetic keeps equal precedence and repeated-operator associativity"
  expect 1 / 2 is 0.5 :: Rational
  expect (1 / 2) + (3 / 4) is 1.25 :: Rational
  expect 10 - 3 - 2 is 9 :: Rational
  expect 8 / 4 / 2 is 4 :: Rational
  assert parse(Code)("a + b + c") == Code` a + (b + c)
end

test "Different arithmetic operators require explicit grouping"
  expect parse(Code)("a + b * c") fails "mixed arithmetic operators require parentheses"
  expect parse(Code)("a - b + c") fails "mixed arithmetic operators require parentheses"
  expect parse(Code)("a * b / c") fails "mixed arithmetic operators require parentheses"

  assert parse(Code)("a + (b * c)") == Code` a + (b * c)
  assert parse(Code)("(a + b) * c") == Code` (a + b) * c
  assert parse(Code)("f(a + b, c * d)") == Code` f(a + b, c * d)
end

test "Canonical Code preserves the required arithmetic grouping"
  source = Code` a + (b * c)
  text = toString(Code)(source)

  expect text contains "(b * c)"
  assert parse(Code)(text) == source
end
```

These cases need executable contracts before runtime/parser changes. Update the
Code reader, canonical printer and relevant quotation/grammar consumers together.

## Fraction-literal integration still needs a boundary decision

The arithmetic rule above is agreed. With `1/2` as an atomic literal, checking
only explicit binary operators would still miss mixtures involving that token.

Even counting a literal's slash as arithmetic does not settle repeated division:

| Source under the original fraction-literal proposal | Grouping | Value |
| --- | --- | --- |
| `1/2 / 3` | `(1/2) / 3` | `1/6` |
| `1 / 2 / 3` | `1 / (2 / 3)` | `3/2` |

Both use only division, so the mixed-operator rule alone cannot reject the first
form. This record does not declare the whole fraction formatting issue resolved.

A proposed completion is to require parentheses around a fraction literal used
as an operand in a larger arithmetic expression, including another division:
`(1/2) / 3` and `1 / (2/3)`. That additional restriction awaits Jonathan's
decision. See [the fraction proposal](../inbox/rational-literals-and-text.md).

The 16-place decimal cutoff, hexadecimal printing preference, leading-zero input
policy and other choices in that proposal remain pending independently.
