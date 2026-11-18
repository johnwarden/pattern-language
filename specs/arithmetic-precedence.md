# Arithmetic and infix precedence

Infix grouping belongs to the surface syntax of expression trees and
applies to every expression, regardless of its type. The surface reader
groups the operators to form a tree. Domain-specific grammars, including
Code, recognize and interpret those trees. See [the two interpretation
stages](../GRAMMAR-BOOTSTRAP.md#two-interpretation-stages).

Tight prefix, postfix, dot and call syntax bind before infix grouping.
Explicit parentheses, argument fields and grammar-delimited operands
start independent expressions. A [tight fraction literal](rational-literal-spacing.md)
is read as an atom.

Each infix operator still applies to two successive argument packs.
The Code grammar reads `(-(x))(y)`, the application tree for `x - y`,
as subtraction. The one-pack form `-(x)` is negation. Binary subtraction
cannot be partially applied. Use `y -> x - y` to save a function that
subtracts from `x`.

Exponentiation is the named prelude function `pow(base, exponent)` with
two positional arguments in one pack. Infix `^` is available as an
ordinary operator for individual languages built on the surface syntax.
The surface reader groups `a * b ^ c` as `(a * b) ^ c`. A language that
uses `^` for exponentiation needs `a * (b ^ c)` for the usual math grouping.
See the [surface expression and pack rules](../GRAMMAR.md#one-surface-tree)
and the [numeric prelude proposal in PR #86](https://github.com/johnwarden/pattern-language/pull/86).

## Precedence and associativity

| Tier, tightest first | Operators | Associativity |
| --- | --- | --- |
| Multiplicative | `*`, `/`, `%` | Left |
| Shared | `+`, `-` | Left |
| Shared | All remaining operators, including dot-infix names and `::` | Right |
| Ordering | `<`, `<=`, `>`, `>=` | Right |
| Equality | `==`, `!=`, `===`, `!==` | Right |
| Binding and arrow | `=`, `->` | Right |

The special tiers list individual operators. Operators such as `=>`,
`<-`, `<<`, `|>`, `>>` and `+=` use the shared tier. Arithmetic binds before
ordering, and ordering binds before equality. `->` binds as loosely as
`=` so ordinary lambda bodies such as `x + 1` and `x == y` can follow the
arrow directly, including in `f = x -> x + 1`.

Tighter expressions form operands first. Within each unparenthesized
chain at one tier, operators must have the same associativity. If two
neighbors in that chain disagree, report a syntax error at the second
operator. Show the conflicting operators in the suggested grouping. When
the chain has two operators at that tier, show both parenthesized spellings.
A tighter expression between the operators still counts as a single operand.
For example, `a - b * c .and d` has the conflicting shared-tier operators
`-` and `.and`.
Dot-infix names such as `.div` and `.flDiv` follow the shared right-associative
rule. The expression `a .div b * c` groups as `a .div (b * c)`.
The expression `a / b * c` groups as `(a / b) * c`. Caret `^` also follows
the shared rule.

Use `(a == b) .and (c == d)` to combine the results of two comparisons.
Dedicated logical operators are an open design choice. A possible extension
would give `&&` and `||` tiers below equality and above `=` and `->`, with
`&&` tighter than `||`. For example, `a == b && c == d || ready` would
group as `((a == b) && (c == d)) || ready`. A future proposal would also
specify whether and how those operators short-circuit.

Success cases compare direct Code quotations. Parentheses around the first
quote delimit it before the assertion's `===`. Cases with multi-character
operators that start with `<` or `>` read strings through `parse(Code)` to
exercise the ordinary Code reader. Rejection cases also read strings inside
the assertion so malformed Code can produce the expected diagnostic.

## Printing expression trees

The expression printer groups an infix child in a weaker tier than its parent.
At the same tier, group a child of different associativity on either side.
For operators of the same associativity, group a right child under a
left-associative parent and a left child under a right-associative parent.
The printed text reads back to the same application tree. The
bootstrap currently prints `Expression` nodes as `Node(...)`; the
infix-printing example below requires infix output for those nodes.

## Test cases

```pattern
test "A DSL field reads the same expression tree"
  type Rule concrete Check(expr :: Expression)
  tree = Expression` 1 * 2 + 3
  rule = Rule` Check(1 * 2 + 3)

  assert tree === Expression` +(*(1)(2))(3)
  assert rule.expr === tree
  expect parse(Rule)("Check(a - b .and c)") fails "Parentheses required. Write `(a - b) .and c` or `a - (b .and c)` (mixed associativity)."
end

test "Expression printing preserves infix grouping"
  tree = Expression` 10 - (3 - 2)
  text = toString(Expression)(tree)
  expect text contains "(3 - 2)"
  assert parse(Expression)(text) === tree
end

test "Multiplication and division bind more tightly than addition and subtraction"
  expect 1 + 2 * 3 is 7 :: Rational
  expect 2 * 3 + 4 is 10 :: Rational
  expect 20 / 5 + 2 is 6 :: Rational
  expect 10 - 6 / 3 is 8 :: Rational

  assert (Code` a + b * c) === Code` +(a)(*(b)(c))
  assert (Code` a * b + c) === Code` +(*(a)(b))(c)
  assert (Code` a - b / c) === Code` -(a)(/(b)(c))
end

test "Operators within one arithmetic tier associate left"
  expect 10 - 3 - 2 is 5 :: Rational
  expect 8 / 4 / 2 is 1 :: Rational
  expect 24 / 3 * 2 is 16 :: Rational

  assert (Code` a - b - c) === Code` (a - b) - c
  assert (Code` a / b / c) === Code` (a / b) / c
  assert (Code` a / b * c) === Code` (a / b) * c
  assert (Code` a - b + c) === Code` (a - b) + c
end

test "Default operators associate right and take multiplicative operands"
  assert (Code` a .and b .or c) === Code` and(a)(or(b)(c))
  assert (Code` a .and b * c) === Code` and(a)(*(b)(c))
  assert (Code` a * b .and c) === Code` and(*(a)(b))(c)
  assert (Code` a .div b * c) === Code` a .div (b * c)
  assert (Code` a .flDiv b / c) === Code` a .flDiv (b / c)
  assert (Code` a .div b .div c) === Code` a .div (b .div c)
end

test "Other punctuation uses the shared tier"
  assert (Code` a => b => c) === Code` a => (b => c)
  assert parse(Code)("a <- b * c") === parse(Code)("a <- (b * c)")
  assert parse(Code)("a << b > c") === parse(Code)("(a << b) > c")
  assert (Code` a |> b == c) === Code` (a |> b) == c
  assert parse(Code)("a >> b >= c") === parse(Code)("(a >> b) >= c")
  assert (Code` a += b == c) === Code` (a += b) == c
end

test "Same-tier operators with different associativity ask for grouping"
  expect parse(Code)("a - b .and c") fails "Parentheses required. Write `(a - b) .and c` or `a - (b .and c)` (mixed associativity)."
  expect parse(Code)("a .and b - c") fails "Parentheses required. Write `(a .and b) - c` or `a .and (b - c)` (mixed associativity)."
  expect parse(Code)("a - b .and c - d") fails "Parentheses required (mixed associativity)."
  expect parse(Code)("a - b * c .and d") fails "Parentheses required. Write `(a - b * c) .and d` or `a - (b * c .and d)` (mixed associativity)."
  expect parse(Code)("x + 1 :: Int") fails "Parentheses required. Write `(x + 1) :: Int` or `x + (1 :: Int)` (mixed associativity)."
  expect parse(Code)("a .div b + c") fails "Parentheses required"

  assert (Code` (a - b) .and c) === Code` and(-(a)(b))(c)
  assert (Code` a - (b .and c)) === Code` -(a)(and(b)(c))
  assert (Code` (a .and b) - c) === Code` -(and(a)(b))(c)
  assert (Code` a .and (b - c)) === Code` and(a)(-(b)(c))
  assert (Code` (x + 1) :: Int) === Code` ::(+(x)(1))(Int)
  assert (Code` x + (1 :: Int)) === Code` +(x)(::(1)(Int))
end

test "Annotation binds tighter than default, binding or arrow"
  assert (Code` c :: String = "black") === Code` =(::(c)(String))("black")
  assert (Code` x :: Int = 5) === Code` =(::(x)(Int))(5)
  assert (Code` x :: Int -> x) === Code` ->(::(x)(Int))(x)
  assert (Code` p | q -> r) === Code` ->(|(p)(q))(r)
end

test "An inline refinement predicate groups its arrow"
  assert (Code` T .where (p -> q)) === Code` where(T)(->(p)(q))
  assert (Code` T .where p -> q) === Code` ->(where(T)(p))(q)
end

test "Arithmetic binds before ordering and ordering binds before equality"
  assert (Code` a + b == c + d) === Code` ==(+(a)(b))(+(c)(d))
  assert (Code` a - b == c .and d) === Code` ==(-(a)(b))(and(c)(d))
  assert (Code` a == b != c) === Code` ==(a)(!=(b)(c))
  assert (Code` a + b === c * d) === Code` ===(+(a)(b))(*(c)(d))
  assert (Code` a === b !== c) === Code` ===(a)(!==(b)(c))
  assert (Code` a + b < c * d) === Code` <(+(a)(b))(*(c)(d))
  assert parse(Code)("a + b <= c * d") === parse(Code)("(a + b) <= (c * d)")
  assert (Code` a + b > c * d) === Code` >(+(a)(b))(*(c)(d))
  assert parse(Code)("a + b >= c * d") === parse(Code)("(a + b) >= (c * d)")
  assert (Code` a + b < c == d) === Code` ==(<(+(a)(b))(c))(d)
  assert parse(Code)("a == b >= c * d") === parse(Code)("a == (b >= (c * d))")
end

test "A dot-infix connective takes grouped comparisons"
  assert (Code` a == b .and c == d) === Code` ==(a)(==(and(b)(c))(d))
  assert (Code` (a == b) .and (c == d)) === Code` and(==(a)(b))(==(c)(d))
end

test "Bindings and arrows take complete arithmetic and comparison expressions"
  assert (Code` r = a + b == c * d) === Code` =(r)(==(+(a)(b))(*(c)(d)))
  assert (Code` f = x -> x + 1) === Code` =(f)(->(x)(+(x)(1)))
  assert (Code` x -> x == y) === Code` ->(x)(==(x)(y))
  assert (Code` x -> y -> x + y) === Code` ->(x)(->(y)(+(x)(y)))
end

test "Parentheses override precedence and associativity"
  expect (1 + 2) * 3 is 9 :: Rational
  expect 18 / (3 + 3) is 3 :: Rational
  expect 10 - (6 - 2) is 6 :: Rational

  assert (Code` a + (b + c)) !== Code` (a + b) + c
  assert (Code` a / (b / c)) !== Code` (a / b) / c
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

  assert (Code` -a * b) === Code` (-a) * b
  assert (Code` f(a)(b) + g(c) * h(d)) === Code` f(a)(b) + (g(c) * h(d))
  assert (Code` f(a + b * c, label: d - (e .and u))(v)) === Code` f(+(a)(*(b)(c)), label: -(d)(and(e)(u)))(v)
  assert (Code` f(a - b, label: c .and d)) === Code` f(-(a)(b), label: and(c)(d))
end

test "One minus pack negates and two packs subtract"
  x = 7 :: Rational
  y = 2 :: Rational
  expect (-(x))(y) is 5 :: Rational

  negative = -(x)
  expect negative is
    -7 :: Rational
  end

  subtractFromX = n -> x - n
  expect subtractFromX(y) is 5 :: Rational
  assert (Code` x - y) === Code` (-(x))(y)
end

test "Power is a regular call and caret is ordinary infix syntax"
  assert (Code` pow(2, 3) * 4) === Code` *(pow(2, 3))(4)
  assert (Code` a ^ b) === Code` ^(a)(b)
  assert (Code` a * b ^ c) === Code` ^(*(a)(b))(c)
  assert (Code` a ^ b .where p) === Code` ^(a)(where(b)(p))
end

test "Remainder shares the multiplicative tier"
  assert (Code` a % b * c) === Code` *(%(a)(b))(c)
  assert (Code` a + b % c) === Code` +(a)(%(b)(c))
end

test "Formatting preserves grouping or rejects malformed infix spacing"
  assert (Code` a + b * c) === Code` a  +  b  *  c
  assert (Code` a / b / c) === Code` a  /  b  /  c

  expect parse(Code)("a+b") fails "infix operators require spaces"
  expect parse(Code)("a +b") fails "infix operators require spaces"
  expect parse(Code)("a+ b") fails "infix operators require spaces"
end

test "A comment after a binding can start with an equals sign"
  withComment = Code`
    x = #= note
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
  assert withComment === withoutComment
end

test "Reading arithmetic Code does not evaluate it"
  assert (Code` missing() + other() * last()) === Code` missing() + (other() * last())
  assert (Code` 1 / 0) === Code` /(1)(0)
end

test "Canonical Code retains parentheses needed to reconstruct its tree"
  source = Code` (a + b) * c
  text = toString(Code)(source)
  expect text contains "(a + b)"
  assert parse(Code)(text) === source

  rightGrouped = Code` a - (b - c)
  rightText = toString(Code)(rightGrouped)
  expect rightText contains "(b - c)"
  assert parse(Code)(rightText) === rightGrouped

  leftGrouped = Code` (a == b) == c
  leftText = toString(Code)(leftGrouped)
  expect leftText contains "(a == b)"
  assert parse(Code)(leftText) === leftGrouped
end

test "Canonical Code groups mixed associativity on either side"
  leftGrouped = Code` (a - b) :: T
  leftText = toString(Code)(leftGrouped)
  expect leftText contains "(a - b)"
  assert parse(Code)(leftText) === leftGrouped

  rightGrouped = Code` a - (b :: T)
  rightText = toString(Code)(rightGrouped)
  expect rightText contains "(b :: T)"
  assert parse(Code)(rightText) === rightGrouped
end
```

## Implementation and migration

The new tree shape for `c :: String = "black"` requires the Code grammar
to recognize a default applied to an annotated pattern. Update that
recognizer and keep the existing default and labeled-argument behavior.
Parenthesize inline predicate lambdas, for example
`T .where (x -> p(x))`. Parenthesize comparisons used as operands of dot
operators, for example `(a == b) .and (c == d)`.

When implementing this proposal, migrate the equal-precedence C25
contract, host formatter and CLI cases, and reader documentation.
Replace evaluated caret exponentiation examples with `pow`.
[Bootstrap grammar](../GRAMMAR-BOOTSTRAP.md)
