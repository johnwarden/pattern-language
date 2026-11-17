# Arithmetic and infix precedence

These rules apply to ordinary Code, Code quotations, and text read as Code.
A typed grammar uses these rules in positions it reads as Code. Tight prefix,
postfix, dot and call syntax bind before infix grouping. Explicit
parentheses, argument fields and grammar-delimited operands start
independent expressions. A [fraction literal](rational-literals-and-text.md)
is read as an atom.

Each infix operator still applies to two successive argument packs.
Exponentiation is the named prelude function `pow(base, exponent)` with
two positional arguments in one pack. Infix `^` is available as an
ordinary operator for individual languages built on the surface syntax.
See the [Code expression and pack rules](../../GRAMMAR.md#one-surface-tree)
and the [numeric prelude draft](fixed-precision-numbers.md#exponentiation).

## Precedence and associativity

| Tier, tightest first | Operators | Associativity |
| --- | --- | --- |
| Multiplicative | `*`, `/` | Left |
| Shared | `+`, `-` | Left |
| Shared | Other operators, including dot-infix names and `::` | Right |
| Weakest | `=`, `<`, `>`, `->`, and punctuation ending in `=` | Right |

Tighter expressions form operands first. Within each unparenthesized
chain at one tier, operators must have the same associativity. If two
neighbors in that chain disagree, report a syntax error at the second
operator and identify the first one. For a chain with two operators, show
both ways to add parentheses. A tighter expression between the operators
still counts as a single operand. For example, `a - b * c .and d` has
the conflicting shared-tier operators `-` and `.and`.

Success cases compare direct Code quotations. Parentheses around the first
quote delimit it before the assertion's `==`. Rejection cases read strings
inside the assertion so malformed Code can produce the expected diagnostic.

## Printing Code

The Code printer groups an infix child in a weaker tier than its parent.
At the same tier, group a child of different associativity on either side.
For operators of the same associativity, group a right child under a
left-associative parent and a left child under a right-associative parent.
The printed text reads back to the same application tree.

## Numeric equality tokens and comments

The proposed numeric equality operators `=#=` and `!#=` count as
comparisons. In code, the reader recognizes those complete tokens before
treating `#` as a comment opener. As with other infix operators, whitespace is
required on both sides of the token.

Reserve comment openers `#=` and `# =`. A `#` followed by optional
horizontal whitespace and then `=` on the same line is a syntax error
outside a complete numeric equality token, a literal or an existing
comment. This also rejects `x = #= note` and `x =# = note` when an
indented value follows. Ordinary comments may still contain `=` later
in their text. See [numeric equality](fixed-precision-numbers.md#number-and-numeric-equality)
and [formatting safety](../../GRAMMAR.md#formatting-safety).

## Test cases

```pattern
test "Multiplication and division bind more tightly than addition and subtraction"
  expect 1 + 2 * 3 is 7 :: Rational
  expect 2 * 3 + 4 is 10 :: Rational
  expect 20 / 5 + 2 is 6 :: Rational
  expect 10 - 6 / 3 is 8 :: Rational

  assert (Code` a + b * c) == Code` +(a)(*(b)(c))
  assert (Code` a * b + c) == Code` +(*(a)(b))(c)
  assert (Code` a - b / c) == Code` -(a)(/(b)(c))
end

test "Operators within one arithmetic tier associate left"
  expect 10 - 3 - 2 is 5 :: Rational
  expect 8 / 4 / 2 is 1 :: Rational
  expect 24 / 3 * 2 is 16 :: Rational

  assert (Code` a - b - c) == Code` (a - b) - c
  assert (Code` a / b / c) == Code` (a / b) / c
  assert (Code` a / b * c) == Code` (a / b) * c
  assert (Code` a - b + c) == Code` (a - b) + c
end

test "Default operators associate right and take multiplicative operands"
  assert (Code` a .and b .or c) == Code` and(a)(or(b)(c))
  assert (Code` a .and b * c) == Code` and(a)(*(b)(c))
  assert (Code` a * b .and c) == Code` and(*(a)(b))(c)
end

test "Same-tier operators with different associativity ask for grouping"
  expect parse(Code)("a - b .and c") fails "Cannot mix `-` (left-associative) and `.and` (right-associative) at the same precedence. Write `(a - b) .and c` or `a - (b .and c)`."
  expect parse(Code)("a .and b - c") fails "Cannot mix `.and` (right-associative) and `-` (left-associative) at the same precedence. Write `(a .and b) - c` or `a .and (b - c)`."
  expect parse(Code)("a - b .and c - d") fails "Cannot mix `-` (left-associative) and `.and` (right-associative) at the same precedence."
  expect parse(Code)("a - b * c .and d") fails "Cannot mix `-` (left-associative) and `.and` (right-associative) at the same precedence."
  expect parse(Code)("x + 1 :: Int") fails "Cannot mix `+` (left-associative) and `::` (right-associative) at the same precedence. Write `(x + 1) :: Int` or `x + (1 :: Int)`."

  assert (Code` (a - b) .and c) == Code` and(-(a)(b))(c)
  assert (Code` a - (b .and c)) == Code` -(a)(and(b)(c))
  assert (Code` (a .and b) - c) == Code` -(and(a)(b))(c)
  assert (Code` a .and (b - c)) == Code` and(a)(-(b)(c))
  assert (Code` (x + 1) :: Int) == Code` ::(+(x)(1))(Int)
  assert (Code` x + (1 :: Int)) == Code` +(x)(::(1)(Int))
end

test "Bindings, arrows and comparisons take arithmetic operands"
  assert (Code` a + b == c + d) == Code` ==(+(a)(b))(+(c)(d))
  assert (Code` a - b == c .and d) == Code` ==(-(a)(b))(and(c)(d))
  assert (Code` a == b != c) == Code` ==(a)(!=(b)(c))
  assert (Code` a + b < c * d) == Code` <(+(a)(b))(*(c)(d))
  assert (Code` a + b <= c * d) == Code` <=(+(a)(b))(*(c)(d))
  assert (Code` a + b > c * d) == Code` >(+(a)(b))(*(c)(d))
  assert (Code` a + b >= c * d) == Code` >=(+(a)(b))(*(c)(d))
  assert (Code` r = a + b == c * d) == Code` =(r)(==(+(a)(b))(*(c)(d)))
  assert (Code` f = x -> x + 1) == Code` =(f)(->(x)(+(x)(1)))
  assert (Code` x -> x == y) == Code` ->(x)(==(x)(y))
end

test "Parentheses override precedence and associativity"
  expect (1 + 2) * 3 is 9 :: Rational
  expect 18 / (3 + 3) is 3 :: Rational
  expect 10 - (6 - 2) is 6 :: Rational

  assert (Code` a + (b + c)) != Code` (a + b) + c
  assert (Code` a / (b / c)) != Code` (a / b) / c
end

test "Prefix negation and complete application packs keep their existing grouping"
  leftNegative = -2 * 3
  expect leftNegative is
    -6 :: Rational
  end
  rightNegative = 2 * -3
  expect rightNegative is
    -6 :: Rational
  end
  groupedNegative = -(2 + 3)
  expect groupedNegative is
    -5 :: Rational
  end

  assert (Code` -a * b) == Code` (-a) * b
  assert (Code` f(a)(b) + g(c) * h(d)) == Code` f(a)(b) + (g(c) * h(d))
  assert (Code` f(a + b * c, label: d - (e .and u))(v)) == Code` f(+(a)(*(b)(c)), label: -(d)(and(e)(u)))(v)
  assert (Code` f(a - b, label: c .and d)) == Code` f(-(a)(b), label: and(c)(d))
end

test "Power is a regular call and caret is ordinary infix syntax"
  assert (Code` pow(2, 3) * 4) == Code` *(pow(2, 3))(4)
  assert (Code` a ^ b) == Code` ^(a)(b)
end

test "Formatting preserves grouping or rejects malformed infix spacing"
  assert (Code` a + b * c) == Code` a  +  b  *  c
  assert (Code` a / b / c) == Code` a  /  b  /  c

  expect parse(Code)("a+b") fails "infix operators require spaces"
  expect parse(Code)("a +b") fails "infix operators require spaces"
  expect parse(Code)("a+ b") fails "infix operators require spaces"
end

test "Numeric equality tokens cannot become comments through spacing"
  assert parse(Code)("a + b =#= c") == parse(Code)("(a + b) =#= c")
  assert parse(Code)("a + b !#= c") == parse(Code)("(a + b) !#= c")
  withComment = Code`
    x = # note = value
      5
    end
    x
  end
  withoutComment = Code`
    x =
      5
    end
    x
  end
  assert withComment == withoutComment

  expect parse(Code)("x = #= note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x =# = note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x = # = note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x ! # = note") fails "comment cannot start with ="
end

test "Reading arithmetic Code does not evaluate it"
  assert (Code` missing() + other() * last()) == Code` missing() + (other() * last())
  assert (Code` 1 / 0) == Code` /(1)(0)
end

test "Canonical Code retains parentheses needed to reconstruct its tree"
  source = Code` (a + b) * c
  text = toString(Code)(source)
  expect text contains "(a + b)"
  assert parse(Code)(text) == source

  rightGrouped = Code` a - (b - c)
  rightText = toString(Code)(rightGrouped)
  expect rightText contains "(b - c)"
  assert parse(Code)(rightText) == rightGrouped

  leftGrouped = Code` (a == b) == c
  leftText = toString(Code)(leftGrouped)
  expect leftText contains "(a == b)"
  assert parse(Code)(leftText) == leftGrouped
end

test "Canonical Code groups mixed associativity on either side"
  leftGrouped = Code` (a - b) :: T
  leftText = toString(Code)(leftGrouped)
  expect leftText contains "(a - b)"
  assert parse(Code)(leftText) == leftGrouped

  rightGrouped = Code` a - (b :: T)
  rightText = toString(Code)(rightGrouped)
  expect rightText contains "(b :: T)"
  assert parse(Code)(rightText) == rightGrouped
end
```

The executable cases replace the equal-precedence C25 expectation when
these rules are implemented. The current reader is described in
[GRAMMAR-BOOTSTRAP.md](../../GRAMMAR-BOOTSTRAP.md).
