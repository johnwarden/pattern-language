# Explicit grouping for infix operators

Pattern reads accepted infix chains with equal precedence and right
association, except that binding `=` has the lowest precedence. Among the
grouping-sensitive operators, a chain may omit parentheses only when it
repeats one associative operator. Every other adjacent pair of those
operators requires explicit grouping. Operators outside that set keep their
previous unconstrained reading. Every accepted expression keeps its current
tree.
[Surface grammar](../GRAMMAR.md#one-surface-tree)

## Why this rule

Readers should never need a precedence or associativity table for the
operators that silently change arithmetic, comparison, and logical meaning.
Only repetition of one associative operator among that set may omit
parentheses: `a + b + c`, `a * b * c`, `a && b && c`, `a || b || c`, and
`A | B | C`. Accepted chains still have one defined reading — right
association — so `a + b + c` means `a + (b + c)`. For Rationals that reading
matches left association; for fixed-precision floats such as Float64
([#86](https://github.com/johnwarden/pattern-language/pull/86)) it is the
defined evaluation order, not merely a convention. Subtraction, division,
remainder, exponentiation, comparisons, mixed operators in the set, and
comparison chains like `a < b < c` do not share that property, so they need
parentheses.
[PR #91](https://github.com/johnwarden/pattern-language/pull/91) ·
[Pony's infix operators](https://tutorial.ponylang.io/expressions/ops.html)

## Surface rule

The grouping-sensitive operators are:

- arithmetic: `+`, `-`, `*`, `/`, `%`, and `^`
- comparison: `<`, `<=`, `>`, `>=`, `==`, `!=`, `===`, `!==`
- logical: `&&`, `||`, and the word forms `and`, `or`
- union: `|`
- ascription: `::`

The associative operators in that set are `+`, `*`, `&&` / `and`, `||` / `or`,
and `|`. `^` and `::` are grouping-sensitive and non-associative. At each
expression level, check adjacent infix operators in source order. When both
operators are grouping-sensitive, require parentheses unless they are the same
associative operator. In particular, a grouping-sensitive operator directly
adjacent to `::` needs parentheses.

Operators outside that set — including arrow `->` and dotted word operators
such as `.plus`, `.div`, `.times`, and `.where` — keep their previous master
reading. A dotted word chain such as `a .plus b .times c` needs no extra
parentheses. Mixing a grouping-sensitive operator with an outside operator also
keeps the previous reading, so `a .div b * c` is `a .div (b * c)`.

Binding `=` is the only precedence exception: it is lower than every other
infix operator, so `x :: Int = 5` reads as `(x :: Int) = 5` and `a + b = c`
reads as `(a + b) = c`. That is simpler than a special left-of-`=` grouping
rule and matches the typed-binding reading people expect. The right-hand side
of `=` stays free, so `n = x + 1` needs no parentheses. When the left-hand
side is not a valid pattern, evaluation fails with a pattern error such as
`E_PATTERN_MISMATCH`, not `E_INFIX_GROUPING`. Arrow `->` is unchanged and keeps
a free right-hand side (`f = x -> x + 1`, `x :: Int -> 5`). Plain `x :: Int`
stays fine.

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
| `a .and b .or c` | Syntax error. Write `(a .and b) .or c` or `a .and (b .or c)`. Mixing .and and .or requires parentheses. |
| `a .plus b .times c` | `a .plus (b .times c)`. Dotted word operators stay outside the rule. |
| `a .div b * c` | `a .div (b * c)`. |
| `a * b ^ c` | Syntax error. Write `(a * b) ^ c` or `a * (b ^ c)`. Mixing * and ^ requires parentheses. |
| `2 ^ 3 + 1` | Syntax error. Write `(2 ^ 3) + 1` or `2 ^ (3 + 1)`. Mixing ^ and + requires parentheses. |
| `a ^ b ^ c` | Syntax error. Write `(a ^ b) ^ c` or `a ^ (b ^ c)`. Repeating ^ requires parentheses. |
| `x - y :: Int` | Syntax error. Write `(x - y) :: Int` or `x - (y :: Int)`. Mixing - and :: requires parentheses. |
| `x + y :: Int` | Syntax error. Write `(x + y) :: Int` or `x + (y :: Int)`. Mixing + and :: requires parentheses. |
| `x :: Int` | `::(x)(Int)`. |
| `n = x + 1` | `n = (x + 1)`. |
| `f = x -> x + 1` | `f = (x -> (x + 1))`. |
| `f = x -> x .plus 1` | `f = (x -> (x .plus 1))`. |
| `x :: Int = 5` | `(x :: Int) = 5`. |
| `x :: Int -> 5` | `x :: (Int -> 5)`. |
| `a + b = c` | `(a + b) = c`, then a pattern error such as `E_PATTERN_MISMATCH`. |
| `a ^ b = c` | `(a ^ b) = c`, then a pattern error such as `E_PATTERN_MISMATCH`. |
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

`::` is grouping-sensitive and non-associative, so a sensitive operator next to
`::` needs parentheses. Because `=` is lowest precedence, a typed binding does
not need parentheses around the ascription. Arrow `->` still leaves its right
side free.

| Source | Reading |
| --- | --- |
| `x :: Int = 5` | `(x :: Int) = 5`. |
| `(x :: Int) = 5` | `=(::(x)(Int))(5)`. |
| `x :: Int -> 5` | `x :: (Int -> 5)`. |
| `(x :: Int) -> 5` | `->(::(x)(Int))(5)`. |
| `x + y :: Int` | Syntax error. Mixing + and :: requires parentheses. |
| `x - y :: Int` | Syntax error. Mixing - and :: requires parentheses. |
| `x - (y :: Int)` | `-(x)(::(y)(Int))`. |
| `(x - y) :: Int` | `::(-(x)(y))(Int)`. |

## Printing

Keep parentheses around left infix children when printing infix syntax. Wrap a
right infix child if printing its operator next to its parent's would make a
rejected pair under the rule above. Use the spellings the printer emits. Call
notation such as `div(a)(b * c)` already delimits its arguments.

For example, print `+(a)(*(b)(c))` as `a + (b * c)`, `*(+(a)(b))(c)` as
`(a + b) * c`, `+(a)(=(b)(c))` as `a + (b = c)`, and `=(+(a)(b))(c)` as
`(a + b) = c`. Each form reads back to its original application tree.

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
  expect parse(Code)("a .and b .or c") fails "
    Syntax error. Write `(a .and b) .or c` or `a .and (b .or c)`.
    Mixing .and and .or requires parentheses.
  end
  expect parse(Code)("a * b ^ c") fails "
    Syntax error. Write `(a * b) ^ c` or `a * (b ^ c)`.
    Mixing * and ^ requires parentheses.
  end
  expect parse(Code)("2 ^ 3 + 1") fails "
    Syntax error. Write `(2 ^ 3) + 1` or `2 ^ (3 + 1)`.
    Mixing ^ and + requires parentheses.
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
  expect parse(Code)("a ^ b ^ c") fails "
    Syntax error. Write `(a ^ b) ^ c` or `a ^ (b ^ c)`.
    Repeating ^ requires parentheses.
  end
end

test "Arithmetic, comparison and logical mixes identify the operands to group"
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
  expect parse(Code)("a * b == c + d") fails "
    Syntax error. Write `(a * b) == c` or `a * (b == c)`.
    Mixing * and == requires parentheses.
  end
end

test "Operators outside the rule keep their previous reading"
  assert parse(Code)("a .div b * c") == parse(Code)("a .div (b * c)")
  assert parse(Code)("a - b .div c") == parse(Code)("a - (b .div c)")
  assert parse(Code)("a .plus b .times c") == parse(Code)("a .plus (b .times c)")
end

test "Ascription next to a sensitive operator needs grouping"
  expect parse(Code)("x - y :: Int") fails "
    Syntax error. Write `(x - y) :: Int` or `x - (y :: Int)`.
    Mixing - and :: requires parentheses.
  end
  expect parse(Code)("x + y :: Int") fails "
    Syntax error. Write `(x + y) :: Int` or `x + (y :: Int)`.
    Mixing + and :: requires parentheses.
  end
  assert parse(Code)("x - (y :: Int)") == parse(Code)("-(x)(::(y)(Int))")
  assert parse(Code)("(x - y) :: Int") == parse(Code)("::(-(x)(y))(Int)")
  assert parse(Code)("x :: Int") == parse(Code)("::(x)(Int)")
  assert parse(Code)("x :: Int = 5") == parse(Code)("=(::(x)(Int))(5)")
  assert parse(Code)("x :: Int -> 5") == parse(Code)("x :: (Int -> 5)")
end

test "Lowest-precedence = binds typed names and rejects invalid pattern left-hand sides"
  assert parse(Code)("x :: Int = 5") == parse(Code)("=(::(x)(Int))(5)")
  assert parse(Code)("a + b = c") == parse(Code)("=(+(a)(b))(c)")
  assert parse(Code)("a ^ b = c") == parse(Code)("=(^(a)(b))(c)")
  expect
    x :: Int = 5
    x
  is 5 :: Int
  expect
    c = 1
    a + b = c
    0
  fails "E_PATTERN_MISMATCH"
  expect
    c = 1
    a ^ b = c
    0
  fails "E_PATTERN_MISMATCH"
end

test "Choosing a grouping changes the subtraction result"
  expect (10 - 3) - 2 is 5 :: Rational
  expect 10 - (3 - 2) is 9 :: Rational
end

test "Independent fields and free binding and arrow rights stay accepted"
  assert parse(Code)("f(a * b, c + d)") == parse(Code)("f((a * b), (c + d))")
  assert parse(Code)("n = x + 1") == parse(Code)("=(n)(+(x)(1))")
  assert parse(Code)("ok = a && b") == parse(Code)("=(ok)(&&(a)(b))")
  assert parse(Code)("q = a .div b") == parse(Code)("=(q)(div(a)(b))")
  assert parse(Code)("f = x -> x + 1") == parse(Code)("f = (x -> (x + 1))")
  assert parse(Code)("f = x -> x .plus 1") == parse(Code)("f = (x -> (x .plus 1))")
  assert parse(Code)("x :: Int = 5") == parse(Code)("=(::(x)(Int))(5)")
end

test "A typed left operand retains its ascription"
  assert parse(Code)("(x :: Int) = 5") == parse(Code)("=(::(x)(Int))(5)")
  assert parse(Code)("x :: Int = 5") == parse(Code)("(x :: Int) = 5")
  assert parse(Code)("(x :: Int) -> 5") == parse(Code)("->(::(x)(Int))(5)")
  assert parse(Code)("x :: Int -> 5") == parse(Code)("x :: (Int -> 5)")
  assert parse(Code)("(f :: (Int => Int)) = x -> x ^ 2") == parse(Code)("=(::(f)(Int => Int))(->(x)(^(x)(2)))")
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
  powerUnderMul = parse(Code)("*(a)(^(b)(c))")
  repeatedPower = parse(Code)("^(a)(^(b)(c))")
  expect toString(Code)(powerUnderMul) is "a * (b ^ c)"
  expect toString(Code)(repeatedPower) is "a ^ (b ^ c)"
  bindingUnderAdd = parse(Code)("+(a)(=(b)(c))")
  addUnderBinding = parse(Code)("=(+(a)(b))(c)")
  expect toString(Code)(bindingUnderAdd) is "a + (b = c)"
  expect toString(Code)(addUnderBinding) is "(a + b) = c"
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
  assert parse(Code)(toString(Code)(powerUnderMul)) == powerUnderMul
  assert parse(Code)(toString(Code)(repeatedPower)) == repeatedPower
  assert parse(Code)(toString(Code)(bindingUnderAdd)) == bindingUnderAdd
  assert parse(Code)(toString(Code)(addUnderBinding)) == addUnderBinding
end
```

The associative-repetition rule over the grouping-sensitive set, rewrite
diagnostics, and printer parentheses are implemented.
[Language suite](../tests/language/infix-grouping.test) ·
[C25 case](../tests/specification/language.test) ·
[Same-precedence conformance case](../tests/conformance/expressions.test)
