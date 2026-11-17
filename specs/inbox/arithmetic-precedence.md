# Arithmetic and infix precedence — draft

This draft replaces the earlier requirement to parenthesize mixtures of
different arithmetic operators. It changes how Code groups an infix chain.
Each binary operation still produces one application per operand pack.
See [the Code expression and pack rules](../../GRAMMAR.md#one-surface-tree).

## Precedence and associativity

Read tiers from tightest to weakest. Classify an operator by its spelling.

| Tier | Infix operators | Associativity |
| --- | --- | --- |
| Multiplicative | `*`, `/` | Left |
| Default | Other punctuation operators and dot-infix names such as `.and` | Right |
| Additive | `+`, `-` | Left |
| Weakest | `=`, `<`, `>`, `->`, and punctuation operators ending in `=` | Right |

The weakest tier groups the built-in comparisons `==`, `!=`, `<`,
`<=`, `>`, and `>=`. Putting all six together makes `a + b < c` and
`a + b <= c` group alike. With `->` in that tier, `f = x -> x + 1`
binds a function whose body is `x + 1`, and `x -> x == y` keeps the
comparison inside the body. A comparison chain groups as an ordinary
right-associative binary chain.

Under this table `^`, `%`, `::`, and a custom `.and` are in the default
tier. In particular, `x + 1 :: T` ascribes `1`. Write `(x + 1) :: T`
to ascribe the result.

| Code | Grouping |
| --- | --- |
| `a .and b * c` | `a .and (b * c)` |
| `a * b .and c` | `(a * b) .and c` |
| `a .and b - c` | `(a .and b) - c` |
| `a - b .and c` | `a - (b .and c)` |
| `a - b .and c - d` | `(a - (b .and c)) - d` |
| `a .and b .or c` | `a .and (b .or c)` |
| `a + b == c + d` | `(a + b) == (c + d)` |
| `r = a + b < c * d` | `r = ((a + b) < (c * d))` |

## Reading and printing Code

Apply the tiers to ordinary Code, Code quotations, and text read as Code.
Group each argument pack field and each operand delimited by its grammar
independently. A typed grammar applies these rules in positions it reads
as Code. Tight prefix, postfix, dot and call syntax bind before infix
grouping. Explicit parentheses select the grouped tree. A [fraction
literal](rational-literals-and-text.md) is read as one atom before infix
grouping.

The Code printer uses the same tiers. When emitting a nested infix
application in infix form, parenthesize a child in a weaker tier. At the
same tier, group an infix right child under a left-associative operator and an
infix left child under a right-associative operator. These rules preserve the
application tree through a print/read round trip, including when operators
within one tier differ.

## Numeric equality tokens and comments

The proposed numeric equality operators `=#=` and `!#=` occupy the weakest
tier. In code, the reader recognizes those complete tokens before treating
`#` as a comment opener. As with other infix operators, whitespace is
required on both sides of the token.

Reserve comment openers `#=` and `# =`. A `#` followed by optional
horizontal whitespace and then `=` on the same line is a syntax error
outside a complete numeric equality token, a literal or an existing
comment. This also rejects `x = #= note` and `x =# = note` when an
indented value follows. Ordinary comments may still contain `=` later
in their text. See [numeric equality](fixed-precision-numbers.md#number-and-numeric-equality)
and [formatting safety](../../GRAMMAR.md#formatting-safety).

## Candidate contracts

```pattern
test "Multiplication and division bind more tightly than addition and subtraction"
  expect 1 + 2 * 3 is 7 :: Rational
  expect 2 * 3 + 4 is 10 :: Rational
  expect 20 / 5 + 2 is 6 :: Rational
  expect 10 - 6 / 3 is 8 :: Rational

  assert parse(Code)("a + b * c") == Code` a + (b * c)
  assert parse(Code)("a * b + c") == Code` (a * b) + c
  assert parse(Code)("a - b / c") == Code` a - (b / c)
end

test "Operators within one arithmetic tier associate left"
  expect 10 - 3 - 2 is 5 :: Rational
  expect 8 / 4 / 2 is 1 :: Rational
  expect 24 / 3 * 2 is 16 :: Rational

  assert parse(Code)("a - b - c") == Code` (a - b) - c
  assert parse(Code)("a / b / c") == Code` (a / b) / c
  assert parse(Code)("a / b * c") == Code` (a / b) * c
  assert parse(Code)("a - b + c") == Code` (a - b) + c
end

test "Default operators bind between multiplication and subtraction"
  assert parse(Code)("a .and b * c") == Code` and(a)(*(b)(c))
  assert parse(Code)("a * b .and c") == Code` and(*(a)(b))(c)
  assert parse(Code)("a .and b - c") == Code` -(and(a)(b))(c)
  assert parse(Code)("a - b .and c") == Code` -(a)(and(b)(c))
  assert parse(Code)("a - b .and c - d") == Code` -(-(a)(and(b)(c)))(d)
  assert parse(Code)("a .and b .or c") == Code` and(a)(or(b)(c))
end

test "Bindings, arrows and comparisons take arithmetic operands"
  assert parse(Code)("a + b == c + d") == Code` ==(+(a)(b))(+(c)(d))
  assert parse(Code)("a + b < c * d") == Code` <(+(a)(b))(*(c)(d))
  assert parse(Code)("a + b <= c * d") == Code` <=(+(a)(b))(*(c)(d))
  assert parse(Code)("a + b > c * d") == Code` >(+(a)(b))(*(c)(d))
  assert parse(Code)("a + b >= c * d") == Code` >=(+(a)(b))(*(c)(d))
  assert parse(Code)("r = a + b == c * d") == Code` =(r)(==(+(a)(b))(*(c)(d)))
  assert parse(Code)("f = x -> x + 1") == Code` =(f)(->(x)(+(x)(1)))
  assert parse(Code)("x -> x == y") == Code` ->(x)(==(x)(y))
end

test "Ascription binds before addition"
  assert parse(Code)("x + 1 :: T") == Code` +(x)(::(1)(T))
  assert parse(Code)("(x + 1) :: T") == Code` ::(+(x)(1))(T)
end

test "Parentheses override precedence and associativity"
  expect (1 + 2) * 3 is 9 :: Rational
  expect 18 / (3 + 3) is 3 :: Rational
  expect 10 - (6 - 2) is 6 :: Rational

  assert parse(Code)("a + (b + c)") != parse(Code)("(a + b) + c")
  assert parse(Code)("a / (b / c)") != parse(Code)("(a / b) / c")
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

  assert parse(Code)("-a * b") == Code` (-a) * b
  assert parse(Code)("f(a)(b) + g(c) * h(d)") == Code` f(a)(b) + (g(c) * h(d))
  assert parse(Code)("f(a + b * c, label: d - e .and u)(v)") == Code` f(a + (b * c), label: d - (e .and u))(v)
end

test "Arithmetic sugar still builds ordinary application trees"
  assert parse(Code)("a + b * c") == Code` +(a)(*(b)(c))
  assert parse(Code)("a * b + c") == Code` +(*(a)(b))(c)
end

test "Formatting preserves grouping or rejects malformed infix spacing"
  assert parse(Code)("a + b * c") == parse(Code)("a  +  b  *  c")
  assert parse(Code)("a / b / c") == parse(Code)("a  /  b  /  c")

  expect parse(Code)("a+b") fails "infix operators require spaces"
  expect parse(Code)("a +b") fails "infix operators require spaces"
  expect parse(Code)("a+ b") fails "infix operators require spaces"
end

test "Numeric equality tokens cannot become comments through spacing"
  assert parse(Code)("a + b =#= c") == parse(Code)("(a + b) =#= c")
  assert parse(Code)("a + b !#= c") == parse(Code)("(a + b) !#= c")
  assert parse(Code)("x = # note = value\n  5\nend\nx") == parse(Code)("x =\n  5\nend\nx")

  expect parse(Code)("x = #= note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x =# = note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x = # = note\n  5\nend\nx") fails "comment cannot start with ="
  expect parse(Code)("x ! # = note") fails "comment cannot start with ="
end

test "Reading arithmetic Code does not evaluate it"
  assert parse(Code)("missing() + other() * last()") == Code` missing() + (other() * last())
  assert parse(Code)("1 / 0") == Code` 1 / 0
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
```

The executable counterpart should replace the equal-precedence C25
contract and audit existing Code text expectations when this draft is
approved. The current bootstrap uses the rules described in
[GRAMMAR-BOOTSTRAP.md](../../GRAMMAR-BOOTSTRAP.md).
