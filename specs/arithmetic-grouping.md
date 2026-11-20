# Explicit grouping for infix operators

Pattern reads accepted infix chains with equal precedence and right
association. A chain may omit parentheses only when it repeats one
associative operator. Every other adjacent pair of infix operators requires
explicit grouping. Every accepted expression keeps its current tree.
[Surface grammar](../GRAMMAR.md#one-surface-tree)

## Why this rule

Readers should never need a precedence or associativity table to know how a
chain groups. Only repetition of one associative operator may omit parentheses:
`a + b + c`, `a * b * c`, `a && b && c`, `a || b || c`, and `A | B | C`. Accepted
chains still have one defined reading — right association — so `a + b + c`
means `a + (b + c)`. For Rationals that reading matches left association; for
fixed-precision floats such as Float64 ([#86](https://github.com/johnwarden/pattern-language/pull/86))
it is the defined evaluation order, not merely a convention. Subtraction,
division, remainder, comparisons, mixed operators, and comparison chains like
`a < b < c` do not share that property, so they need parentheses.
[PR #91](https://github.com/johnwarden/pattern-language/pull/91) ·
[Pony's infix operators](https://tutorial.ponylang.io/expressions/ops.html)

## Surface rule

The associative operators are `+`, `*`, `&&` (and word `and`), `||` (and word
`or`), and `|` (union). At each expression level, check adjacent infix operators
in source order. Require parentheses unless both operators are the same
associative operator.

Binding is separate. The right-hand side of `=` stays free, so `n = x + 1` and
`ok = a && b` need no extra parentheses around the right operand's operator.
An arithmetic, comparison, or logical operator directly left of `=` still
requires grouping: write `(a + b) = c` or `a + (b = c)` instead of `a + b = c`.

Check each parenthesized expression and each argument field independently.
Parentheses around a single operand in a chain, as in `a - (b) - c`, leave both
operators at the same level. Prefix signs, postfix operators, and tight dots
are part of their operands. Accepted chains associate right. These rules apply
wherever the surface reader builds an expression tree, including quoted Code
and domain-specific expressions.

| Source | Reading |
| --- | --- |
| `a + b + c` | `a + (b + c)`. |
| `a * b * c` | `a * (b * c)`. |
| `a && b && c` | `a && (b && c)`. |
| `a + b * c` | Syntax error. Write `(a + b) * c` or `a + (b * c)`. Mixing + and * requires parentheses. |
| `a - b - c` | Syntax error. Write `(a - b) - c` or `a - (b - c)`. Repeating - requires parentheses. |
| `a + b - c` | Syntax error. Write `(a + b) - c` or `a + (b - c)`. Mixing + and - requires parentheses. |
| `a < b < c` | Syntax error. Write `(a < b) < c` or `a < (b < c)`. Repeating < requires parentheses. |
| `a == b == c` | Syntax error. Write `(a == b) == c` or `a == (b == c)`. Repeating == requires parentheses. |
| `n = x + 1` | `n = (x + 1)`. |
| `a + b = c` | Syntax error. Write `(a + b) = c` or `a + (b = c)`. Mixing + and = requires parentheses. |
| `f(a * b, c + d)` | Each argument field is checked independently. |

## Grouping diagnostics

Report `E_INFIX_GROUPING` at the second operator of the first rejected pair in
source order. Present the two groupings as equal choices. Show the left
grouping first and the right grouping second, using the operands and operator
spellings from the source. Keep calls, tight dots, prefix signs, and existing
parentheses intact inside those operands. Lead every grouping error with
`Syntax error.` and the Write suggestion on the first line, with each option in
backticks. Give the rule on the next line after the Write suggestion.

```text
Syntax error. Write `(a + b) * c` or `a + (b * c)`.
Mixing + and * requires parentheses.
```

For a repeated non-associative operator, use its source spelling:

```text
Syntax error. Write `(10 - 3) - 2` or `10 - (3 - 2)`.
Repeating - requires parentheses.
```

Write suggestions cover only the offending infix expression, starting at the
left operand of the first rejected pair. They never reprint a surrounding call,
binding target, earlier chain prefix, statement, or buffer. Prefer source
slices of each operand; if an operand has no span, use its printed form.

## Ascriptions in infix chains

`::` is not associative, so an ascription next to another infix operator needs
parentheses. Binding still leaves its right side free after `=`.

| Source | Reading |
| --- | --- |
| `x :: Int = 5` | `x :: (Int = 5)`. |
| `(x :: Int) = 5` | `=(::(x)(Int))(5)`. |
| `(x :: Int) -> 5` | `->(::(x)(Int))(5)`. |
| `x + y :: Int` | Syntax error. Mixing + and :: requires parentheses. |

## Printing

Keep parentheses around left infix children when printing infix syntax. Wrap a
right infix child if printing its operator next to its parent's would make a
rejected pair. Use the spellings the printer emits. Call notation such as
`div(a)(b * c)` already delimits its arguments.

For example, print `+(a)(*(b)(c))` as `a + (b * c)`, `*(+(a)(b))(c)` as
`(a + b) * c`, and `+(a)(=(b)(c))` as `a + (b = c)`. Each form reads back to its
original application tree.

## Test cases

```pattern
test "Associative repetition needs no parentheses"
  assert parse(Code)("a + b + c") == parse(Code)("a + (b + c)")
  assert parse(Code)("a * b * c") == parse(Code)("a * (b * c)")
  assert parse(Code)("a && b && c") == parse(Code)("a && (b && c)")
  assert parse(Code)("a || b || c") == parse(Code)("a || (b || c)")
  assert parse(Code)("a .and b .and c") == parse(Code)("a .and (b .and c)")
  assert parse(Code)("a .or b .or c") == parse(Code)("a .or (b .or c)")
  assert parse(Code)("A | B | C") == parse(Code)("A | (B | C)")
end

test "Mixed operators show both groupings"
  expect parse(Code)("a + b * c") fails "
    Syntax error. Write `(a + b) * c` or `a + (b * c)`.
    Mixing + and * requires parentheses.
  end
  expect parse(Code)("price + tax * count") fails "
    Syntax error. Write `(price + tax) * count` or `price + (tax * count)`.
    Mixing + and * requires parentheses.
  end
  expect parse(Code)("a * b + c") fails "
    Syntax error. Write `(a * b) + c` or `a * (b + c)`.
    Mixing * and + requires parentheses.
  end
  expect parse(Code)("a + b - c") fails "
    Syntax error. Write `(a + b) - c` or `a + (b - c)`.
    Mixing + and - requires parentheses.
  end
  expect parse(Code)("a .div b * c") fails "
    Syntax error. Write `(a .div b) * c` or `a .div (b * c)`.
    Mixing .div and * requires parentheses.
  end
  expect parse(Code)("a * b ^ c") fails "
    Syntax error. Write `(a * b) ^ c` or `a * (b ^ c)`.
    Mixing * and ^ requires parentheses.
  end
  expect parse(Code)("a .and b .or c") fails "
    Syntax error. Write `(a .and b) .or c` or `a .and (b .or c)`.
    Mixing .and and .or requires parentheses.
  end
  expect parse(Code)("f(a * b + c, d)") fails "
    Syntax error. Write `(a * b) + c` or `a * (b + c)`.
    Mixing * and + requires parentheses.
  end
  src = "
    x = 1
    y = a + b * c
  end
  expect parse(Code)(src) fails "
    Syntax error. Write `(a + b) * c` or `a + (b * c)`.
    Mixing + and * requires parentheses.
  end
end

test "Non-associative repetition needs grouping"
  expect parse(Code)("10 - 3 - 2") fails "
    Syntax error. Write `(10 - 3) - 2` or `10 - (3 - 2)`.
    Repeating - requires parentheses.
  end
  expect parse(Code)("a - (b) - c") fails "
    Syntax error. Write `(a - (b)) - c` or `a - ((b) - c)`.
    Repeating - requires parentheses.
  end
  expect parse(Code)("a / b / c") fails "
    Syntax error. Write `(a / b) / c` or `a / (b / c)`.
    Repeating / requires parentheses.
  end
  expect parse(Code)("a % b % c") fails "
    Syntax error. Write `(a % b) % c` or `a % (b % c)`.
    Repeating % requires parentheses.
  end
  expect parse(Code)("a < b < c") fails "
    Syntax error. Write `(a < b) < c` or `a < (b < c)`.
    Repeating < requires parentheses.
  end
  expect parse(Code)("a == b == c") fails "
    Syntax error. Write `(a == b) == c` or `a == (b == c)`.
    Repeating == requires parentheses.
  end
end

test "Arithmetic, comparison and logical mixes identify the operands to group"
  expect parse(Code)("a - b .div c") fails "
    Syntax error. Write `(a - b) .div c` or `a - (b .div c)`.
    Mixing - and .div requires parentheses.
  end
  expect parse(Code)("a * b == c") fails "
    Syntax error. Write `(a * b) == c` or `a * (b == c)`.
    Mixing * and == requires parentheses.
  end
  expect parse(Code)("a == b + c") fails "
    Syntax error. Write `(a == b) + c` or `a == (b + c)`.
    Mixing == and + requires parentheses.
  end
  expect parse(Code)("a && b || c") fails "
    Syntax error. Write `(a && b) || c` or `a && (b || c)`.
    Mixing && and || requires parentheses.
  end
  expect parse(Code)("a == b && c == d") fails "
    Syntax error. Write `(a == b) && c` or `a == (b && c)`.
    Mixing == and && requires parentheses.
  end
  expect parse(Code)("x - y :: Int") fails "
    Syntax error. Write `(x - y) :: Int` or `x - (y :: Int)`.
    Mixing - and :: requires parentheses.
  end
  expect parse(Code)("x + y :: Int") fails "
    Syntax error. Write `(x + y) :: Int` or `x + (y :: Int)`.
    Mixing + and :: requires parentheses.
  end
  expect parse(Code)("a * b == c + d") fails "
    Syntax error. Write `(a * b) == c` or `a * (b == c)`.
    Mixing * and == requires parentheses.
  end
end

test "A binding after arithmetic, comparison or logic shows both groupings"
  expect parse(Code)("a + b = c") fails "
    Syntax error. Write `(a + b) = c` or `a + (b = c)`.
    Mixing + and = requires parentheses.
  end
  expect parse(Code)("a == b = c") fails "
    Syntax error. Write `(a == b) = c` or `a == (b = c)`.
    Mixing == and = requires parentheses.
  end
  expect parse(Code)("a && b = c") fails "
    Syntax error. Write `(a && b) = c` or `a && (b = c)`.
    Mixing && and = requires parentheses.
  end
end

test "Choosing a grouping changes the subtraction result"
  expect (10 - 3) - 2 is 5 :: Rational
  expect 10 - (3 - 2) is 9 :: Rational
end

test "Independent fields and free binding rights stay accepted"
  assert parse(Code)("f(a * b, c + d)") == parse(Code)("f((a * b), (c + d))")
  assert parse(Code)("n = x + 1") == parse(Code)("=(n)(+(x)(1))")
  assert parse(Code)("ok = a && b") == parse(Code)("=(ok)(&&(a)(b))")
  assert parse(Code)("q = a .div b") == parse(Code)("=(q)(div(a)(b))")
  assert parse(Code)("f = x -> (x + 1)") == parse(Code)("f = (x -> (x + 1))")
  assert parse(Code)("x :: Int = 5") == parse(Code)("x :: (Int = 5)")
end

test "A typed left operand retains its ascription"
  assert parse(Code)("(x :: Int) = 5") == parse(Code)("=(::(x)(Int))(5)")
  assert parse(Code)("(x :: Int) -> 5") == parse(Code)("->(::(x)(Int))(5)")
  assert parse(Code)("(f :: (Int => Int)) = x -> (x ^ 2)") == parse(Code)("=(::(f)(Int => Int))(->(x)(^(x)(2)))")
end

test "Printed infix Code shows grouping and reads back to the same tree"
  right = parse(Code)("+(a)(*(b)(c))")
  left = parse(Code)("*(+(a)(b))(c)")
  sameGroup = parse(Code)("-(a)(+(b)(c))")
  repeatedDivision = parse(Code)("/(a)(/(b)(c))")
  comparison = parse(Code)("==(a)(+(b)(c))")
  wordOperator = parse(Code)("div(a)(*(b)(c))")
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
  bindingUnderAdd = parse(Code)("+(a)(=(b)(c))")
  expect toString(Code)(bindingUnderAdd) is "a + (b = c)"
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
  assert parse(Code)(toString(Code)(bindingUnderAdd)) == bindingUnderAdd
end
```

The single associative-repetition rule, rewrite diagnostics, and printer
parentheses are implemented.
[Language suite](../tests/language/infix-grouping.test) ·
[C25 case](../tests/specification/language.test) ·
[Same-precedence conformance case](../tests/conformance/expressions.test)
