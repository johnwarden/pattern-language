# Rational literals and exact text

Every numeric value must have a source spelling that round-trips to the
same exact value. Include a type annotation when needed to recover the
concrete numeric format. A value such as one third has no terminating
decimal or binary expansion, so exact numeric text needs a fraction
spelling. The typed reader must be able to recover that value directly
from its spelling.

## Source spelling

A fraction literal is one numeric atom, such as `(1/3)` or `(-1/3)`.
The parentheses and slash belong to the literal. Both components are ASCII
decimal integers. Only the numerator may have a sign, and that sign is `-`.
The denominator must be positive. Bare `1/3`, `(1/-3)`, and `(0x1/3)` are
invalid fraction spellings.

In fraction components and plain decimal literals, the integer part is `0`
or starts with a nonzero digit. A single `_` may separate two digits in either
fraction component or in a decimal digit run. For example, `(1_000/3_001)`
and `1_000.0_5` are valid. `(01/3)`, `01.5`, and `(1_/3)` are invalid.
A touching `-` is part of the numeric literal. For a plain decimal, hexadecimal,
binary or `0f` spelling, it goes first, as in `-0.5` or `-0x1p-20`.

An optional `e` or `E` immediately after the closing parenthesis scales the
entire fraction by a power of ten. It takes a decimal integer exponent with
an optional `+` or `-` and the same digit rules. For example, `(1/3)e10`
scales `1/3` by ten billion. Whitespace is forbidden throughout the literal,
including between the closing parenthesis and the exponent.

Hexadecimal and binary literals may take a binary `p` or `P` exponent with the
same signed decimal-integer digit rules as `e`, including the ban on leading
zeros. `0x1p5` and `0x1p-5` are valid; `0x1p05`, `0x1p-05`, and `0b1p05` are
rejected with `E_SYNTAX`, the same diagnostic as `1e05` and `(1/3)e05`.

The magnitude of a written decimal `e` or binary `p` exponent must be at most
`10000`. That bound is far above Float64's decimal (~308) and binary (~1023)
ranges, keeps exact `10^n` / `2^n` expansion cheap to compute, and is checked
from the exponent's digit text before any bigint powering so forms such as
`1e999999999` and `(1/3)e999999999` fail immediately. An exponent past the cap
is a source error with code `E_SYNTAX` and message
`numeric exponent exceeds 10000`. The same cap applies to `0f` decimal
exponents. Canonical printing never emits an `e` or `p` exponent outside this
bound: values whose shortest uncapped spelling would need a larger exponent
use coefficient padding, a max-cap exponent, or full integer/fraction text
instead, so every printed numeric atom remains readable and formatting
terminates.

`(1 / 3)` is grouped division. It yields the same Rational as `(1/3)` under
exact Rational division. Formatting safety permits the different Code trees
because the value is the same. Partial infix spacing is invalid. Reading or
quoting `(1 / 0)` succeeds, and evaluating the division fails. Reading `(1/0)`
fails immediately. The Code printer keeps the spaces in grouped division.

The earlier prototype in [#76](https://github.com/johnwarden/pattern-language/pull/76)
used bare fractions. The active contracts below use the parenthesized spelling.

## Values

Use direct source literals to check the exact values, including when a
fraction appears inside an argument pack.

```pattern test
test "Fraction literals denote exact reduced Rationals"
  assert (1/3) == (1 / 3)
  expect (2/4) is 0.5 :: Rational
  expect (3/1) is 3 :: Rational
  expect (0/5) is 0 :: Rational
  expect (9007199254740993/1) is 9007199254740993 :: Rational
  expect (1_000/3_000) is (1/3) :: Rational

  assert (2/6) == (1/3)

  def addOne(n :: Rational) n + 1
  expect addOne((1/2)) is 1.5 :: Rational
end

test "A decimal exponent scales the entire fraction exactly"
  assert (1/3)e20 == (100000000000000000000 / 3)
  expect (1/3)e-2 is (1/300) :: Rational
  expect (3/4)e2 is 75 :: Rational
  expect (1/3)e0 is (1/3) :: Rational
  expect (1/3)e+2 is (100/3) :: Rational
end

test "The minus in a negative literal belongs to the numeric atom"
  assert (-1/2) == (-0.5)
  assert (-1/3)e2 == (-100 / 3)
  assert parse(Code)("(-1/2)") == parse(Code)("-0.5")
  assert parse(Code)("-(1/2)") != parse(Code)("(-1/2)")
  assert parse(Code)("-(0.5)") != parse(Code)("-0.5")
  assert (-(1/2)) == (-0.5)

  assert parse(Code)("-(0x1p-20)") != parse(Code)("-0x1p-20")
  expect toString(Code)(parse(Code)("-0.5")) is "-0.5" :: String
  expect toString(Code)(parse(Code)("-0x1p-20")) is "-0x1p-20" :: String

  negation = Code` -(0.5)
  assert parse(Code)(toString(Code)(negation)) == negation

  assert parse(Rational)("-0x1") == -1
  assert parse(Code)("-0x1") == parse(Code)("-1")
  assert parse(Rational)("-0b10") == -2
  assert parse(Code)("-0x1") != parse(Code)("-(0x1)")
  expect toString(Code)(parse(Code)("-0x1")) is "-1" :: String
end
```

## Reading and formatting

The minus operator still works in prefix applications such as `-(0.5)` and
`-(1/3)`, and in infix subtraction with spaces on both sides. `parse(Code)`
exposes the distinction between numeric atoms and applications.

```pattern test
test "Fraction atoms and spaced division have distinct Code trees"
  atom = Code` (1/3)
  division = Code` /(1)(3)

  assert parse(Code)("(1/3)") == atom
  assert parse(Code)("(1 / 3)") == division
  assert parse(Code)("( 1 / 3 )") == division
  assert parse(Code)("(1/3)") != division

  assert (1 / 3) == (1/3)
  assert (2 / 4) == 0.5

  assert parse(Code)("1 / 3") != parse(Code)("(1/3)")
  assert parse(Code)("a / b") == Code` /(a)(b)
end

test "Equivalent numeric spellings give equal Code atoms"
  assert parse(Code)("(2/6)") == parse(Code)("(1/3)")
  assert parse(Code)("(2/4)") == Code` 0.5
  assert parse(Code)("(3/1)") == Code` 3

  assert parse(Code)("(1/3)e20") == parse(Code)("(100000000000000000000/3)")
  assert parse(Code)("(3/4)e2") == Code` 75
end

test "A zero denominator fails during literal reading"
  expect parse(Code)("(1/0)") fails "malformed numeric source literal"
  expect parse(Code)("(1/0)e20") fails "malformed numeric source literal"
  assert parse(Code)("(1 / 0)") == Code` /(1)(0)
  expect 1 / 0 fails "result exceeds safe numeric range"
end

test "Reading division by zero in a default leaves it unevaluated"
  def choose(value: Rational = (1 / 0)) value
  expect choose(value: 8) is 8 :: Rational
  expect choose() fails "result exceeds safe numeric range"
end
```

## Literal grammar edge cases

These cases cover signs, whitespace, digit separators, and exponent bounds.

```pattern test
test "Bare slash and partly spaced division remain syntax errors"
  expect parse(Code)("1/3") fails "infix operators require spaces"
  expect parse(Code)("1/3e20") fails "infix operators require spaces"
  expect parse(Code)("a/b") fails "infix operators require spaces"
  expect parse(Code)("(1/ 3)") fails "infix operators require spaces"
  expect parse(Code)("(1 /3)") fails "infix operators require spaces"
end

test "Fraction components and exponent obey the decimal literal grammar"
  # First establish that the reader recognizes the parenthesized spelling.
  assert parse(Code)("(1_0/5)e2") == Code` 200
  expect parse(Code)("(01/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/03)") fails "E_SYNTAX"
  expect parse(Code)("(1/-3)") fails "E_SYNTAX"
  expect parse(Code)("(+1/3)") fails "E_SYNTAX"
  expect parse(Code)("(0x1/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/0b11)") fails "E_SYNTAX"
  expect parse(Code)("(1.0/3)") fails "E_SYNTAX"
  expect parse(Code)("(1_/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/3_)") fails "E_SYNTAX"
  expect parse(Code)("(1__0/3)") fails "E_SYNTAX"
  expect parse(Code)("( 1/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/3 )") fails "E_SYNTAX"
  expect parse(Rational)("(1/3) e10") fails "E_DATA_PARSE"
  expect parse(Code)("(1/3)e01") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e0xA") fails "E_SYNTAX"
end

test "Plain decimal spellings use the same digit rules"
  expect parse(Rational)("0.05") is 0.05 :: Rational
  assert parse(Rational)("-0.5") == (-0.5)
  assert parse(Code)("1_000.0_5") == Code` 1000.05
  expect parse(Code)("01.5") fails "E_SYNTAX"
  expect parse(Code)("0_1") fails "E_SYNTAX"
  expect parse(Code)("1e01") fails "E_SYNTAX"
end

test "Binary p exponents reject leading zeros like decimal e"
  assert parse(Rational)("0x1p5") == 32
  assert parse(Rational)("0b1p5") == 32
  assert parse(Rational)("0x1p-5") == 0x1p-5
  expect parse(Code)("0x1p05") fails "E_SYNTAX"
  expect parse(Code)("0x1p-05") fails "E_SYNTAX"
  expect parse(Code)("0b1p05") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e05") fails "E_SYNTAX"
end

test "Written e and p exponents accept the magnitude cap and reject past it"
  assert parse(Rational)("1e10000") == 1e10000
  assert parse(Rational)("1e-10000") == 1e-10000
  assert parse(Rational)("0x1p10000") == 0x1p10000
  assert parse(Rational)("0x1p-10000") == 0x1p-10000
  assert parse(Rational)("(1/3)e10000") == (1/3)e10000
  assert parse(Rational)("(1/3)e-10000") == (1/3)e-10000
  assert parse(Code)(toString(Code)(parse(Code)("1e10000"))) == parse(Code)("1e10000")
  assert parse(Code)(toString(Code)(parse(Code)("0x1p10000"))) == parse(Code)("0x1p10000")

  expect parse(Code)("1e10001") fails "E_SYNTAX"
  expect parse(Code)("1e-10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p-10001") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e10001") fails "E_SYNTAX"
  expect parse(Rational)("1e10001") fails "E_SYNTAX"
  expect parse(Code)("1e999999999") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e999999999") fails "E_SYNTAX"
  expect parse(Code)("0x1p999999999") fails "E_SYNTAX"
end
```

## Packs and calls

A fraction keeps its parentheses even inside a pack. Code text also
preserves pack boundaries, labels, and grouping.

```pattern test
test "A literal has its own parentheses inside an argument pack"
  atom = Code` f((1/3))
  assert parse(Code)("f((1/3))") == atom
  assert parse(Code)("f((1 / 3))") == Code` f(1 / 3)
  assert parse(Code)("f((1/3)e20)") == parse(Code)("f((100000000000000000000/3))")
  expect parse(Code)("f(1/3)") fails "infix operators require spaces"
  assert parse(Code)("f((1/3))") != parse(Code)("f(1 / 3)")
  assert parse(Code)("f((2/4))(scale: (3/4))") == Code` f(0.5)(scale: 0.75)
end

test "Numeric Code text preserves successive packs, labels and grouping"
  division = Code` (1 / 3)(2)
  expect toString(Code)(division) is "(1 / 3)(2)" :: String
  assert parse(Code)(toString(Code)(division)) == division

  def roundTrips(source :: String)
    code = parse(Code)(source)
    parse(Code)(toString(Code)(code)) == code
  end

  assert roundTrips("f((1/3))(scale: (3/4))")
  assert roundTrips("f((-1/3))(scale: (3/4))")
  assert roundTrips("-(1/3)")
  assert roundTrips("-(0.5)")
  assert roundTrips("def third() (1/3)")
  expect toString(Code)(parse(Code)("(-1/3)")) is "(-1/3)" :: String
end
```

## Typed text

`parse(Rational)` reads the same numeric literal grammar as source, including
`(-1/3)` and `-0.5`. Use `parse(Code)` to read prefix negation or grouped
division as Code. [Shortest exact Rational text](rational-canonical-text.md)
defines the canonical spelling rules and tie-breaks.

```pattern test
test "The typed Rational reader accepts literals without evaluating Code"
  assert parse(Rational)("-0x1p-20") == -(0x1p-20)
  expect parse(Rational)("1 + 2") fails "expected Rational"
  expect parse(Rational)("(1 / 3)") fails "expected Rational"
  expect parse(Rational)("-(1/3)") fails "expected Rational"
  expect parse(Rational)("-(0.5)") fails "expected Rational"
end

test "Typed reading reduces fractions without losing precision"
  assert parse(Rational)("(1/3)") == (1 / 3)
  assert parse(Rational)("(2/6)") == (1 / 3)
  expect parse(Rational)("(2/4)") is 0.5 :: Rational
  expect parse(Rational)("(3/1)") is 3 :: Rational
  expect parse(Rational)("(0/5)") is 0 :: Rational
  expect parse(Rational)("(9007199254740993/1)") is 9007199254740993 :: Rational
  assert parse(Rational)("(1_000/3_001)") == (1000 / 3001)
  assert parse(Rational)("(-1/2)") == (-0.5)
end

test "A touching decimal exponent scales the whole fraction in typed text"
  assert parse(Rational)("(1/3)e20") == (100000000000000000000 / 3)
  assert parse(Rational)("(1/3)e-2") == (1 / 300)
  expect parse(Rational)("(3/4)e2") is 75 :: Rational
  assert parse(Rational)("(1/3)e0") == (1 / 3)
  assert parse(Rational)("(-1/3)E+2") == (-100 / 3)
  assert parse(Rational)("(1/3)e-1_0") == (1 / 30000000000)
end

test "Typed Rational text reconstructs the same exact value"
  assert parse(Rational)(toString(Rational)((1/3))) == (1/3)
  assert parse(Rational)(toString(Rational)((-2/6))) == (-1/3)
  assert parse(Rational)("(-1/3)") == (-1/3)
  assert parse(Rational)("-0.5") == (-1/2)
  assert parse(Rational)(toString(Rational)((9007199254740993/1))) == 9007199254740993

  scaled = (1/3)e20
  expanded = (100000000000000000000/3)
  assert toString(Rational)(scaled) == toString(Rational)(expanded)
end

test "A computed Rational round-trips as a reduced fraction"
  n = (1 / 3) * 1

  assert (n * 3) == 1
  assert ((1 / 3) * 3) == 1
  expect toString(Rational)(n) is "(1/3)" :: String
  assert parse(Rational)(toString(Rational)(n)) == n
end
```
