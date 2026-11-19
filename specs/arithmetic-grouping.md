# Explicit grouping for infix operators

Pattern reads infix chains with equal precedence and right association.
This proposal requires explicit grouping for specific pairs of operators.
Every accepted expression keeps its current tree.
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
This proposal uses a smaller set of grouping rules for arithmetic,
comparisons, and logical operators.
[Pony's infix operators](https://tutorial.ponylang.io/expressions/ops.html)

## Surface rule

Additive operators are `+` and `-`. Multiplicative operators are `*`, `/`,
and `%`. Together these are the arithmetic operators. The comparison
operators are `<`, `<=`, `>`, `>=`, `==`, `!=`, `===`, and `!==`. Logical
operators are `&&` and `||`.

At each expression level, check adjacent infix operators in source order.
Require parentheses if any of the following hold.

1. One operator is additive and the other is multiplicative.
2. The first operator is `-`, `/`, or `%`. This makes an infix right
   operand of one of those operators explicit, including repetitions
   such as `a - b - c`.
3. One operator is arithmetic and the other is a comparison.
4. One operator is logical and the other is arithmetic, a comparison,
   or a different logical operator.

Point to the second operator in the first rejected pair and name both
operators in the message, for example `` Parentheses required between `+` and `*` ``.
Check each parenthesized expression and each argument field independently.
Parentheses around a single operand in a chain, as in `a - (b) - c`, leave
both operators at the same level. Prefix signs, postfix operators, and
tight dots are part of their operands.

Accepted chains associate right. These rules apply wherever the surface
reader builds an expression tree, including quoted Code and
domain-specific expressions.

| Source | Reading |
| --- | --- |
| `a + b * c` | Syntax error. Write `a + (b * c)` or `(a + b) * c`. |
| `a * b + c` | Syntax error. Write `(a * b) + c` or `a * (b + c)`. |
| `a - b + c` | Syntax error. Write `(a - b) + c` or `a - (b + c)`. |
| `10 - 3 - 2` | Syntax error. Write `(10 - 3) - 2` for `5` or `10 - (3 - 2)` for `9`. |
| `12 / 3 * 2` | Syntax error. Write `(12 / 3) * 2` for `8` or `12 / (3 * 2)` for `2`. |
| `a .div b * c` | `a .div (b * c)`. |
| `a - b .div c` | Syntax error. Write `(a - b) .div c` or `a - (b .div c)`. |
| `a * b == c + d` | Syntax error. Write `(a * b) == (c + d)` to compare the two results. |
| `a == b + c` | Syntax error. Write `a == (b + c)`. |
| `n = x + 1` | `n = (x + 1)`. |
| `q = a .div b` | `q = (a .div b)`. |
| `f = x -> x + 1` | `f = (x -> (x + 1))`. |
| `ok = a && b` | `ok = (a && b)`. |
| `a == b && c == d` | Syntax error. Write `(a == b) && (c == d)` to combine the comparison results. |
| `a && b \|\| c` | Syntax error. Write `(a && b) \|\| c` or `a && (b \|\| c)`. |
| `a .and b .or c` | `a .and (b .or c)`. Both operators are words. |
| `a * b ^ c` | `a * (b ^ c)`. `^` is a symbol operator outside the arithmetic and comparison sets. |
| `a + b - c` | `a + (b - c)`. The `-` has a single operand on its right. |
| `f(a * b, c + d)` | Each argument field is checked independently. |

Chains of `&&` alone or `||` alone associate right. These operators use
ordinary infix evaluation, which evaluates both operands.

## Ascriptions in infix chains

In an accepted chain starting with `x :: T`, right association puts any
following unparenthesized operator inside the type operand. Group the
whole ascription to use it as the left operand of `=` or `->`.

| Source | Right-associated reading | Spelling with a typed left operand |
| --- | --- | --- |
| `x :: Int = 5` | `x :: (Int = 5)` | `(x :: Int) = 5` |
| `x :: Int -> 5` | `x :: (Int -> 5)` | `(x :: Int) -> 5` |
| `f :: Int => Int = x -> x ^ 2` | `f :: (Int => (Int = (x -> (x ^ 2))))` | `(f :: Int => Int) = x -> x ^ 2` |

The last example assumes a future grammar interprets `Int => Int` as
a function type. Inside `(f :: Int => Int)`, right association already
groups `Int => Int` as the type operand. The binding's right operand
already groups as `x -> (x ^ 2)`.

With arithmetic, `x + y :: Int` ascribes `y`, and `(x + y) :: Int`
ascribes the sum. In `x - y :: Int`, the `-` rule requires a choice
between `x - (y :: Int)` and `(x - y) :: Int`.

## Printing

Keep parentheses around left infix children when printing infix syntax.
Wrap a right infix child if printing its operator next to its parent's
would make a rejected pair. Also wrap a right arithmetic child of an
arithmetic operator when their spellings differ, as in `a + (b - c)`.
Use the spellings the printer emits. Call notation such as `div(a)(b * c)`
already delimits its arguments.

For example, print `+(a)(*(b)(c))` as `a + (b * c)`, `*(+(a)(b))(c)`
as `(a + b) * c`, and `-(a)(+(b)(c))` as `a - (b + c)`. Print
`==(a)(+(b)(c))` as `a == (b + c)`. Each form reads back to its
original application tree.

## Test cases

```pattern
test "Mixed arithmetic requires parentheses in either order"
  expect parse(Code)("a + b * c") fails "Parentheses required between `+` and `*`"
  expect parse(Code)("a * b + c") fails "Parentheses required between `*` and `+`"
  expect parse(Code)("a .div b * c + d") fails "Parentheses required between `*` and `+`"
  expect parse(Code)("f(a * b + c, d)") fails "Parentheses required between `*` and `+`"
end

test "Subtraction, division, and remainder require explicit infix right operands"
  expect parse(Code)("a - b + c") fails "Parentheses required between `-` and `+`"
  expect parse(Code)("10 - 3 - 2") fails "Parentheses required between `-` and `-`"
  expect parse(Code)("a - (b) - c") fails "Parentheses required between `-` and `-`"
  expect parse(Code)("12 / 3 * 2") fails "Parentheses required between `/` and `*`"
  expect parse(Code)("a % b % c") fails "Parentheses required between `%` and `%`"
  expect parse(Code)("a - b ^ c") fails "Parentheses required between `-` and `^`"
  expect parse(Code)("a - b .div c") fails "Parentheses required between `-` and `.div`"
  expect parse(Code)("x - y :: Int") fails "Parentheses required between `-` and `::`"
end

test "Arithmetic and comparisons require grouping in either order"
  expect parse(Code)("a * b == c + d") fails "Parentheses required between `*` and `==`"
  expect parse(Code)("a == b + c") fails "Parentheses required between `==` and `+`"
  expect parse(Code)("a + b >= c") fails "Parentheses required between `+` and `>=`"
  expect parse(Code)("a !== b * c") fails "Parentheses required between `!==` and `*`"
end

test "Logical operators require grouping when mixed"
  expect parse(Code)("a == b && c == d") fails "Parentheses required between `==` and `&&`"
  expect parse(Code)("a || b < c") fails "Parentheses required between `||` and `<`"
  expect parse(Code)("a + b || c") fails "Parentheses required between `+` and `||`"
  expect parse(Code)("a && b * c") fails "Parentheses required between `&&` and `*`"
  expect parse(Code)("a && b || c") fails "Parentheses required between `&&` and `||`"
  expect parse(Code)("a || b && c") fails "Parentheses required between `||` and `&&`"
end

test "Parentheses select the arithmetic tree"
  expect 2 * (3 + 4) is 14 :: Rational
  expect (2 * 3) + 4 is 10 :: Rational
  expect 2 + (3 * 4) is 14 :: Rational
  expect (10 - 3) - 2 is 5 :: Rational
  expect 10 - (3 - 2) is 9 :: Rational
  expect (12 / 3) * 2 is 8 :: Rational
  expect 12 / (3 * 2) is 2 :: Rational
  expect 2 * -3 is
    -6 :: Rational
  end
  assert parse(Code)("1 + a.b") == parse(Code)("+(1)(b(a))")
end

test "Accepted infix chains still associate right"
  assert parse(Code)("a + b - c") == parse(Code)("a + (b - c)")
  assert parse(Code)("a * b / c") == parse(Code)("a * (b / c)")
  assert parse(Code)("a .and b .or c") == parse(Code)("a .and (b .or c)")
  assert parse(Code)("a * b ^ c") == parse(Code)("a * (b ^ c)")
  assert parse(Code)("f = x -> x + 1") == parse(Code)("f = (x -> (x + 1))")
  assert parse(Code)("f(a * b, c + d)") == parse(Code)("f(*(a)(b), +(c)(d))")
  assert parse(Code)("n = x + 1") == parse(Code)("=(n)(+(x)(1))")
  assert parse(Code)("a + b = c") == parse(Code)("+(a)(=(b)(c))")
  assert parse(Code)("q = a .div b") == parse(Code)("=(q)(div(a)(b))")
  assert parse(Code)("a .div b * c") == parse(Code)("div(a)(*(b)(c))")
  assert parse(Code)("(a .div b) * c") == parse(Code)("*(div(a)(b))(c)")
  assert parse(Code)("(a * b) == (c + d)") == parse(Code)("==(*(a)(b))(+(c)(d))")
  assert parse(Code)("a && b && c") == parse(Code)("&&(a)(&&(b)(c))")
  assert parse(Code)("a || b || c") == parse(Code)("||(a)(||(b)(c))")
  assert parse(Code)("(a == b) && (c == d)") == parse(Code)("&&(==(a)(b))(==(c)(d))")
  assert parse(Code)("(a && b) || c") == parse(Code)("||(&&(a)(b))(c)")
  assert parse(Code)("a && (b || c)") == parse(Code)("&&(a)(||(b)(c))")
  assert parse(Code)("ok = a && b") == parse(Code)("=(ok)(&&(a)(b))")
end

test "Ascriptions follow ordinary right association"
  assert parse(Code)("x :: Int = 5") == parse(Code)("::(x)(=(Int)(5))")
  assert parse(Code)("(x :: Int) = 5") == parse(Code)("=(::(x)(Int))(5)")
  assert parse(Code)("x :: Int -> 5") == parse(Code)("::(x)(->(Int)(5))")
  assert parse(Code)("(x :: Int) -> 5") == parse(Code)("->(::(x)(Int))(5)")
  assert parse(Code)("value = x :: Int") == parse(Code)("=(value)(::(x)(Int))")

  assert parse(Code)("f :: Int => Int = x -> x ^ 2") == parse(Code)("::(f)(=>(Int)(=(Int)(->(x)(^(x)(2)))))")
  assert parse(Code)("(f :: Int => Int) = x -> x ^ 2") == parse(Code)("=(::(f)(=>(Int)(Int)))(->(x)(^(x)(2)))")

  assert parse(Code)("x + y :: Int") == parse(Code)("+(x)(::(y)(Int))")
  assert parse(Code)("(x + y) :: Int") == parse(Code)("::(+(x)(y))(Int)")
  assert parse(Code)("x - (y :: Int)") == parse(Code)("-(x)(::(y)(Int))")
  assert parse(Code)("(x - y) :: Int") == parse(Code)("::(-(x)(y))(Int)")
end

test "Printed infix Code shows grouping and reads back to the same tree"
  right = parse(Code)("+(a)(*(b)(c))")
  left = parse(Code)("*(+(a)(b))(c)")
  sameGroup = parse(Code)("-(a)(+(b)(c))")
  repeatedDivision = parse(Code)("/(a)(/(b)(c))")
  comparison = parse(Code)("==(a)(+(b)(c))")
  wordOperator = parse(Code)("a .div b * c")
  typedBinding = parse(Code)("=(::(x)(Int))(5)")
  ascribedSubtrahend = parse(Code)("-(x)(::(y)(Int))")
  arithmeticBinding = parse(Code)("=(n)(+(x)(1))")
  logical = parse(Code)("&&(a)(||(b)(c))")
  compared = parse(Code)("&&(==(a)(b))(==(c)(d))")
  expect toString(Code)(right) is "a + (b * c)"
  expect toString(Code)(left) is "(a + b) * c"
  expect toString(Code)(sameGroup) is "a - (b + c)"
  expect toString(Code)(repeatedDivision) is "a / (b / c)"
  expect toString(Code)(comparison) is "a == (b + c)"
  expect toString(Code)(wordOperator) is "div(a)(b * c)"
  expect toString(Code)(typedBinding) is "(x :: Int) = 5"
  expect toString(Code)(ascribedSubtrahend) is "x - (y :: Int)"
  expect toString(Code)(arithmeticBinding) is "n = x + 1"
  expect toString(Code)(logical) is "a && (b || c)"
  expect toString(Code)(compared) is "(a == b) && (c == d)"
  assert parse(Code)(toString(Code)(right)) == right
  assert parse(Code)(toString(Code)(left)) == left
  assert parse(Code)(toString(Code)(sameGroup)) == sameGroup
  assert parse(Code)(toString(Code)(repeatedDivision)) == repeatedDivision
  assert parse(Code)(toString(Code)(comparison)) == comparison
  assert parse(Code)(toString(Code)(wordOperator)) == wordOperator
  assert parse(Code)(toString(Code)(typedBinding)) == typedBinding
  assert parse(Code)(toString(Code)(ascribedSubtrahend)) == ascribedSubtrahend
  assert parse(Code)(toString(Code)(arithmeticBinding)) == arithmeticBinding
  assert parse(Code)(toString(Code)(logical)) == logical
  assert parse(Code)(toString(Code)(compared)) == compared
end
```

When implementing, give existing cases explicit grouping to keep their
intended trees. Update the reader and formatter together so printed Code
reads back to the same tree.
[C25 case](../tests/specification/language.test) ·
[Same-precedence conformance case](../tests/conformance/expressions.test)
