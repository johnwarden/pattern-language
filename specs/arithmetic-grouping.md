# Explicit grouping for mixed arithmetic

Pattern currently reads infix chains with equal precedence and right
association. This proposal adds a syntax check for familiar arithmetic
operators. Every accepted expression keeps its current tree.
[Surface grammar](../GRAMMAR.md#one-surface-tree)

## Why this rule

The earlier proposal gave multiplication, addition, ordering, equality
and bindings familiar relative precedence. The discussion also considered
separate tiers for `&&` and `||`. Each decision addressed a specific
case and added a rule. `.div` shares the default tier and `/` binds
tighter. Mixing `+` and `.and` needs a diagnostic because they share a tier
with different associativity. `->` binds loosely so `f = x -> x + 1` stays
readable. The printer has to preserve each of those distinctions.
[PR #87](https://github.com/johnwarden/pattern-language/pull/87)

Familiar arithmetic can silently produce a different result from what
readers expect. For example, `2 * 3 + 4` currently means `2 * (3 + 4)`.
Pony requires parentheses whenever different infix operators are mixed.
This proposal requires explicit grouping at the boundary between additive
and multiplicative operators.
[Pony's infix operators](https://tutorial.ponylang.io/expressions/ops.html)

## Surface rule

The check uses two operator groups.

- Additive operators are `+` and `-`.
- Multiplicative operators are `*`, `/` and `%`.

At each expression level, inspect consecutive infix operators in source
order. An operator outside those groups ends the current arithmetic run.
Reject a run when the first operator from the other group appears. Report
`Parentheses required when mixing additive and multiplicative infix operators`
at that operator. Inspect each parenthesized expression and each argument
field independently. Prefix signs, postfix operators, and calls participate
as parts of operands.

The groups determine when parentheses are required. All accepted chains
still associate right. This surface rule applies wherever the reader builds
an expression tree, including quoted Code and domain-specific expressions.

| Source | Reading |
| --- | --- |
| `a + b * c` | Syntax error. Write `a + (b * c)` or `(a + b) * c`. |
| `a * b + c` | Syntax error. Write `(a * b) + c` or `a * (b + c)`. |
| `a .div b * c + d` | Syntax error at `+`. The run after `.div` mixes `*` and `+`. |
| `a * b == c + d` | `a * (b == (c + d))`. Use `(a * b) == (c + d)` to compare the two results. |
| `a - b + c` | `a - (b + c)`. Use `(a - b) + c` for left grouping. |
| `10 - 3 - 2` | `10 - (3 - 2)`, which is `9`. |
| `12 / 3 * 2` | `12 / (3 * 2)`, which is `2`. Use `(12 / 3) * 2` for `8`. |
| `f = x -> x + 1` | `f = (x -> (x + 1))`. |
| `f(a * b, c + d)` | The argument fields have independent runs. |

`.div`, `.flDiv`, `^`, comparisons, and user-defined operators are outside
the two arithmetic groups. A domain-specific grammar can still interpret
`^` however it chooses. If `&&` and `||` are added, spelling and evaluation
are separate decisions. Use `(a == b) && (c == d)` to compare both pairs
before applying `&&` under this grouping rule.

## Reader options for review

- Requiring grouping for an infix right operand of `-`, `/`, or `%`
  would catch `a - b + c`, `10 - 3 - 2`, and `12 / 3 * 2`.
- Requiring grouping for any mix of different infix operators would
  also catch cases such as `a .div b * c`. Repeated uses of one operator
  would still need an associativity rule.
- Requiring grouping where arithmetic and comparison operators meet
  would catch `a * b == c + d`. Write `(a * b) == (c + d)` to compare
  the two arithmetic results.

## Printing

Keep parentheses around left infix children when printing infix syntax.
When an arithmetic operator has a right infix child with an arithmetic
operator at its root, wrap that child if the two operators differ or if
the parent is `-`, `/`, or `%`. This makes the right grouping visible
even in cases that the reader accepts without parentheses.

For example, print `+(a)(*(b)(c))` as `a + (b * c)`, `*(+(a)(b))(c)`
as `(a + b) * c`, and `-(a)(+(b)(c))` as `a - (b + c)`. Each form
reads back to its original application tree.

## Test cases

```pattern
test "Mixed arithmetic requires parentheses in either order"
  expect parse(Code)("a + b * c") fails "Parentheses required when mixing additive and multiplicative infix operators"
  expect parse(Code)("a * b + c") fails "Parentheses required when mixing additive and multiplicative infix operators"
  expect parse(Code)("a .div b * c + d") fails "Parentheses required when mixing additive and multiplicative infix operators"
  expect parse(Code)("a % b - c") fails "Parentheses required when mixing additive and multiplicative infix operators"
  expect parse(Code)("f(a * b + c, d)") fails "Parentheses required when mixing additive and multiplicative infix operators"
end

test "Parentheses select the arithmetic tree"
  expect 2 * (3 + 4) is 14 :: Rational
  expect (2 * 3) + 4 is 10 :: Rational
  expect 2 + (3 * 4) is 14 :: Rational
  expect 2 * -3 is
    -6 :: Rational
  end
end

test "Accepted infix chains still associate right"
  expect 10 - 3 - 2 is 9 :: Rational
  expect (10 - 3) - 2 is 5 :: Rational
  expect 12 / 3 * 2 is 2 :: Rational
  expect (12 / 3) * 2 is 8 :: Rational
  assert parse(Code)("a - b + c") == parse(Code)("a - (b + c)")
  assert parse(Code)("a * b / c") == parse(Code)("a * (b / c)")
  assert parse(Code)("a * b == c + d") == parse(Code)("a * (b == (c + d))")
  assert parse(Code)("a .div b * c") == parse(Code)("a .div (b * c)")
  assert parse(Code)("a * b ^ c") == parse(Code)("a * (b ^ c)")
  assert parse(Code)("f = x -> x + 1") == parse(Code)("f = (x -> (x + 1))")
  assert parse(Code)("f(a * b, c + d)") == parse(Code)("f(*(a)(b), +(c)(d))")
end

test "Printed infix Code shows the grouping of arithmetic operands"
  right = parse(Code)("+(a)(*(b)(c))")
  left = parse(Code)("*(+(a)(b))(c)")
  sameGroup = parse(Code)("-(a)(+(b)(c))")
  repeatedDivision = parse(Code)("/(a)(/(b)(c))")
  expect toString(Code)(right) is "a + (b * c)"
  expect toString(Code)(left) is "(a + b) * c"
  expect toString(Code)(sameGroup) is "a - (b + c)"
  expect toString(Code)(repeatedDivision) is "a / (b / c)"
  assert parse(Code)(toString(Code)(right)) == right
  assert parse(Code)(toString(Code)(left)) == left
  assert parse(Code)(toString(Code)(sameGroup)) == sameGroup
  assert parse(Code)(toString(Code)(repeatedDivision)) == repeatedDivision
end
```

When implementing, give the two existing cases explicit grouping to keep
their intended value. Update the reader and formatter together so printed
Code reads back to the same tree.
[C25 case](../tests/specification/language.test) ·
[Same-precedence conformance case](../tests/conformance/expressions.test)
