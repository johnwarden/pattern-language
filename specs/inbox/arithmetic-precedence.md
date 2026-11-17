# Arithmetic and infix precedence — draft

Two alternatives to the four-tier draft are proposed below. Each applies
to ordinary Code, Code quotations, and text read as Code. A typed grammar
uses the selected rules in positions it reads as Code. Tight prefix,
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

```pattern
test "Power is a regular call and caret is ordinary infix syntax"
  assert (Code` pow(2, 3) * 4) == Code` *(pow(2, 3))(4)
  assert (Code` a ^ b) == Code` ^(a)(b)
end
```

## Option A — additive and default share a tier

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

```pattern
test "Same-tier operators with different associativity ask for grouping"
  expect parse(Code)("a - b .and c") fails "Cannot mix `-` (left-associative) and `.and` (right-associative) at the same precedence. Write `(a - b) .and c` or `a - (b .and c)`."
  expect parse(Code)("a .and b - c") fails "Cannot mix `.and` (right-associative) and `-` (left-associative) at the same precedence. Write `(a .and b) - c` or `a .and (b - c)`."
  expect parse(Code)("a - b * c .and d") fails "Cannot mix `-` (left-associative) and `.and` (right-associative) at the same precedence."
  expect parse(Code)("x + 1 :: Int") fails "Cannot mix `+` (left-associative) and `::` (right-associative) at the same precedence. Write `(x + 1) :: Int` or `x + (1 :: Int)`."

  assert (Code` (a - b) .and c) == Code` and(-(a)(b))(c)
  assert (Code` a - (b .and c)) == Code` -(a)(and(b)(c))
  assert (Code` (x + 1) :: Int) == Code` ::(+(x)(1))(Int)
  assert (Code` x + (1 :: Int)) == Code` +(x)(::(1)(Int))
end

test "Unambiguous chains keep the associativity of their operators"
  assert (Code` a - b - c) == Code` -(-(a)(b))(c)
  assert (Code` a .and b .or c) == Code` and(a)(or(b)(c))
  assert (Code` a .and b * c) == Code` and(a)(*(b)(c))
  assert (Code` a + b == c + d) == Code` ==(+(a)(b))(+(c)(d))
end

test "Code printing keeps a mixed-associativity tree readable"
  code = Code` a - (b :: T)
  text = toString(Code)(code)
  assert parse(Code)(text) == code
end
```

When the printer emits both operators in infix form, it groups an infix
child of different associativity at the same tier on either side.
For same-associativity children, the [usual tiered printing rules](#printing-the-tiered-form)
apply using Option A's tiers.

## Option B — one right-associative tier with an arithmetic grouping check

Every binary infix operator has equal precedence and associates right.
The reader checks each unparenthesized chain containing a binary `+`, `-`,
`*`, or `/` before committing to its tree.

1. Arithmetic operators must form a suffix of the chain. The prefix may
   contain binding `=`, arrow `->`, or comparison operators `==`, `!=`,
   `<`, `<=`, `>`, `>=`, `=#=`, and `!#=`. Group arithmetic when
   mixing it with other operators such as `::` and `.and`.
2. Within the arithmetic suffix, operators must rise strictly in
   conventional precedence from left to right. For this check `+ -` are
   one family and `* /` are the tighter family. Thus `a + b * c` is
   allowed, while `a * b + c` and any same-family repetition require
   parentheses. The same-family rule applies to `+` and `*` too, since
   grouping can change rounding or overflow.

This is a syntax check. Every accepted chain still groups right.
Parenthesized subexpressions and explicit calls supply operands to the
enclosing chain. The check classifies the four prelude infix operators
listed above. The [remainder spelling](fixed-precision-numbers.md#proposed-arithmetic-policy)
is a separate decision.

| Code | Outcome |
| --- | --- |
| `a .and b .or c` | `a .and (b .or c)` |
| `x = a + b * c` | `x = (a + (b * c))` |
| `a < b + c` | `a < (b + c)` |
| `a * b + c` | Group either multiplication or addition |
| `10 - 3 - 2` | Group one of the subtractions |
| `a + b < c` | Group the arithmetic, as in `(a + b) < c` |
| `a .and b - c` | Group one of the two operations |

Report a syntax error at the operator that violates the rule. When two
operators form the chain, show the relevant parenthesized spellings.

```pattern
test "Right-associated arithmetic is accepted when the grouping is conventional"
  expect 1 + 2 * 3 is 7 :: Rational
  assert (Code` a .and b .or c) == Code` and(a)(or(b)(c))
  assert (Code` x = a + b * c) == Code` =(x)(+(a)(*(b)(c)))
  assert (Code` a < b + c) == Code` <(a)(+(b)(c))
  assert (Code` f = x -> x + 1) == Code` =(f)(->(x)(+(x)(1)))
end

test "Surprising arithmetic chains require parentheses"
  expect parse(Code)("a * b + c") fails "Arithmetic needs explicit grouping. Write `(a * b) + c` or `a * (b + c)`."
  expect parse(Code)("10 - 3 - 2") fails "Arithmetic needs explicit grouping. Write `(10 - 3) - 2` or `10 - (3 - 2)`."
  expect parse(Code)("8 / 4 / 2") fails "Arithmetic needs explicit grouping. Write `(8 / 4) / 2` or `8 / (4 / 2)`."
  expect parse(Code)("a + b + c") fails "Arithmetic needs explicit grouping."
  expect parse(Code)("a * b * c") fails "Arithmetic needs explicit grouping."
  expect parse(Code)("a + b < c") fails "Group the arithmetic before `<`. Write `(a + b) < c`."
  expect parse(Code)("a .and b - c") fails "Arithmetic and `.and` need explicit grouping. Write `(a .and b) - c` or `a .and (b - c)`."
  expect parse(Code)("x :: Int + 1") fails "Arithmetic and `::` need explicit grouping."

  expect (10 - 3) - 2 is 5 :: Rational
  expect 10 - (3 - 2) is 9 :: Rational
  expect (2 * 3) + 4 is 10 :: Rational
  expect 2 * (3 + 4) is 14 :: Rational
  assert (Code` (a + b) < c) == Code` <(+(a)(b))(c)
  assert (Code` (x :: Int) + 1) == Code` +(::(x)(Int))(1)
end

test "Code printing retains parentheses required by the arithmetic check"
  code = Code` a * (b + c)
  text = toString(Code)(code)
  expect text contains "(b + c)"
  assert parse(Code)(text) == code
end
```

The printer may elide parentheses only when the emitted chain passes the
check and reads back to the same application tree.

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

## Four-tier draft for comparison

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

### Printing the tiered form

The Code printer uses the same tiers. When emitting a nested infix
application in infix form, parenthesize a child in a weaker tier. At the
same tier, group an infix right child under a left-associative operator and an
infix left child under a right-associative operator. These rules preserve the
application tree through a print/read round trip, including when operators
within one tier differ.

### Four-tier candidate contracts

```pattern
test "Multiplication and division bind more tightly than addition and subtraction"
  expect 1 + 2 * 3 is 7 :: Rational
  expect 2 * 3 + 4 is 10 :: Rational
  expect 20 / 5 + 2 is 6 :: Rational
  expect 10 - 6 / 3 is 8 :: Rational

  assert (Code` a + b * c) == Code` a + (b * c)
  assert (Code` a * b + c) == Code` (a * b) + c
  assert (Code` a - b / c) == Code` a - (b / c)
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

test "Default operators bind between multiplication and subtraction"
  assert (Code` a .and b * c) == Code` and(a)(*(b)(c))
  assert (Code` a * b .and c) == Code` and(*(a)(b))(c)
  assert (Code` a .and b - c) == Code` -(and(a)(b))(c)
  assert (Code` a - b .and c) == Code` -(a)(and(b)(c))
  assert (Code` a - b .and c - d) == Code` -(-(a)(and(b)(c)))(d)
  assert (Code` a .and b .or c) == Code` and(a)(or(b)(c))
end

test "Bindings, arrows and comparisons take arithmetic operands"
  assert (Code` a + b == c + d) == Code` ==(+(a)(b))(+(c)(d))
  assert (Code` a + b < c * d) == Code` <(+(a)(b))(*(c)(d))
  assert (Code` a + b <= c * d) == Code` <=(+(a)(b))(*(c)(d))
  assert (Code` a + b > c * d) == Code` >(+(a)(b))(*(c)(d))
  assert (Code` a + b >= c * d) == Code` >=(+(a)(b))(*(c)(d))
  assert (Code` r = a + b == c * d) == Code` =(r)(==(+(a)(b))(*(c)(d)))
  assert (Code` f = x -> x + 1) == Code` =(f)(->(x)(+(x)(1)))
  assert (Code` x -> x == y) == Code` ->(x)(==(x)(y))
end

test "Ascription binds before addition"
  assert (Code` x + 1 :: T) == Code` +(x)(::(1)(T))
  assert (Code` (x + 1) :: T) == Code` ::(+(x)(1))(T)
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
  assert (Code` f(a + b * c, label: d - e .and u)(v)) == Code` f(a + (b * c), label: d - (e .and u))(v)
end

test "Arithmetic sugar still builds ordinary application trees"
  assert (Code` a + b * c) == Code` +(a)(*(b)(c))
  assert (Code` a * b + c) == Code` +(*(a)(b))(c)
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
```

Select one option before replacing the executable C25 contract. Audit
Code text expectations against the selected rules. The current reader is
described in [GRAMMAR-BOOTSTRAP.md](../../GRAMMAR-BOOTSTRAP.md).
