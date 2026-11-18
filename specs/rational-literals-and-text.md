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
bound, so every printed numeric atom remains readable.

`(1 / 3)` is grouped division. It yields the same Rational as `(1/3)` under
exact Rational division. Formatting safety permits the different Code trees
because the value is the same. Partial infix spacing is invalid. Reading or
quoting `(1 / 0)` succeeds, and evaluating the division fails. Reading `(1/0)`
fails immediately. The Code printer keeps the spaces in grouped division.

The earlier prototype in [#76](https://github.com/johnwarden/pattern-language/pull/76)
used bare fractions. The active contracts below use the parenthesized spelling.

## Values

Use direct source literals for value examples. Explicit `parse` calls below test
string reading, Code structure, rejected source or text round trips.

```pattern
test "Fraction literals denote exact reduced Rationals"
  expect (1/3) is (1/3) :: Rational
  expect (2/4) is 0.5 :: Rational
  expect (3/1) is 3 :: Rational
  expect (0/5) is 0 :: Rational
  expect (9007199254740993/1) is 9007199254740993 :: Rational
  expect (1_000/3_000) is (1/3) :: Rational

  assert (2/6) == (1/3)
end

test "A decimal exponent scales the entire fraction exactly"
  expect (1/3)e20 is (100000000000000000000/3) :: Rational
  expect (1/3)e-2 is (1/300) :: Rational
  expect (3/4)e2 is 75 :: Rational
  expect (1/3)e0 is (1/3) :: Rational
  expect (1/3)e+2 is (100/3) :: Rational
end

test "Written e and p exponents share digit rules and a magnitude cap"
  assert parse(Rational)("1e10000") == 1e10000
  assert parse(Rational)("1e-10000") == 1e-10000
  assert parse(Rational)("0x1p10000") == 0x1p10000
  assert parse(Rational)("0x1p-10000") == 0x1p-10000
  assert parse(Rational)("0x1p5") == 0x1p5
  assert parse(Rational)("(1/3)e10000") == (1/3)e10000

  expect parse(Code)("1e10001") fails "E_SYNTAX"
  expect parse(Code)("1e-10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p-10001") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e10001") fails "E_SYNTAX"
  expect parse(Code)("1e999999999") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e999999999") fails "E_SYNTAX"
  expect parse(Code)("0x1p05") fails "E_SYNTAX"
  expect parse(Code)("0x1p-05") fails "E_SYNTAX"
  expect parse(Code)("0b1p05") fails "E_SYNTAX"
end

test "Reading a fraction exponent produces the same exact Code atom"
  assert parse(Code)("(1/3)e20") == parse(Code)("(100000000000000000000/3)")
  assert parse(Code)("(3/4)e2") == Code` 75
end

test "The minus in a negative literal belongs to the numeric atom"
  expect (-1/2) is -0.5 :: Rational
  expect (-1/3)e2 is (-100/3) :: Rational
  assert parse(Code)("(-1/2)") == parse(Code)("-0.5")
  assert parse(Code)("-(1/2)") != parse(Code)("(-1/2)")
  assert parse(Code)("-(0.5)") != parse(Code)("-0.5")
  expect -(1/2) is -0.5 :: Rational
end
```

## Reading and formatting

The minus operator still works in prefix applications such as `-(0.5)` and
`-(1/3)`, and in infix subtraction with spaces on both sides.

```pattern
test "Spaced division preserves its application tree"
  atom = Code` (1/3)
  division = Code` /(1)(3)

  assert parse(Code)("(1/3)") == atom
  assert parse(Code)("(1 / 3)") == division
  assert parse(Code)("( 1 / 3 )") == division
  assert atom != division

  expect (1 / 3) is (1/3) :: Rational
  expect (2 / 4) is 0.5 :: Rational
end

test "Partial infix spacing remains invalid"
  expect parse(Code)("(1/ 3)") fails "infix operators require spaces"
  expect parse(Code)("(1 /3)") fails "infix operators require spaces"
end

test "Equivalent numeric spellings give equal Code atoms"
  assert parse(Code)("(2/6)") == parse(Code)("(1/3)")
  assert parse(Code)("(2/4)") == Code` 0.5
  assert parse(Code)("(3/1)") == Code` 3
end

test "Ordinary division remains a distinct application"
  assert parse(Code)("1 / 3") != parse(Code)("(1/3)")
  assert parse(Code)("a / b") == Code` /(a)(b)
  expect parse(Code)("1/3") fails "infix operators require spaces"
  expect parse(Code)("1/3e20") fails "infix operators require spaces"
end

test "A zero denominator in a literal is a source-reading error"
  expect parse(Code)("(1/0)") fails "malformed numeric source literal"
  expect parse(Code)("(1/0)e20") fails "malformed numeric source literal"
end

test "Spaced division by zero is inert while reading and in unused defaults"
  assert parse(Code)("(1 / 0)") == Code` /(1)(0)

  def choose(value: Rational = (1 / 0)) value
  expect choose(value: 8) is 8 :: Rational
end
```

## Packs and calls

```pattern
test "A literal has its own parentheses inside an argument pack"
  assert parse(Code)("f((1/3))") == Code` f((1/3))
  assert parse(Code)("f((1 / 3))") == Code` f(1 / 3)
  assert parse(Code)("f((1/3)e20)") == parse(Code)("f((100000000000000000000/3))")
  assert parse(Code)("f(1 / 3)") != parse(Code)("f((1/3))")
  expect parse(Code)("f(1/3)") fails "infix operators require spaces"
end

test "Numeric canonical text preserves successive packs and labels"
  source = Code` f((1/3))(scale: (3/4))
  text = toString(Code)(source)
  assert parse(Code)(text) == source
end
```

## Typed text

[Shortest exact Rational text](rational-canonical-text.md) is now
approved. It replaces the 16-place cutoff and the preference for exact binary64
hexadecimal output with shortest exact spelling across decimal, `0f`, hexadecimal,
binary and reduced fraction forms, including exponent forms. That record defines the
deterministic tie-breaks and owns the canonical spelling examples.

`parse(Rational)` reads a numeric literal with the same spelling rules as
source, including `(-1/3)` and `-0.5`. Expression evaluation is outside this
reader's grammar. Use `parse(Code)` to read prefix negation or grouped division
as Code.

```pattern
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

test "Code printing reconstructs numeric atoms and prefix negation"
  atom = Code` (-1/3)
  assert parse(Code)(toString(Code)(atom)) == atom

  negation = Code` -(1/3)
  assert parse(Code)(toString(Code)(negation)) == negation
  decimalNegation = Code` -(0.5)
  assert parse(Code)(toString(Code)(decimalNegation)) == decimalNegation
end

test "Code printing preserves ordinary grouped division"
  source = Code` (1 / 3)(2)
  text = toString(Code)(source)

  assert parse(Code)(text) == source
end
```

## Executable contracts

[fractions.test](../tests/numeric/fractions.test) covers literal values and
rejected spellings. [code-text.test](../tests/numeric/code-text.test) covers
Code structure and printing, and [exact-values.test](../tests/numeric/exact-values.test)
covers printing and reading a computed exact fraction. Reader tests exercise
both source expressions and typed text.
