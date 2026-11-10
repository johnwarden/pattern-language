# Parenthesized Rational literals — draft

Latest proposal from the 10 November 2026 discussion of
[PR #76](https://github.com/johnwarden/pattern-language/pull/76):
`(n/d)` is one exact Rational atom, optionally followed by a touching decimal
exponent. Spaces inside the parentheses preserve that atom. The parentheses
belong to the literal. This replaces the PR's proposed bare `n/d` spelling.

[Arithmetic precedence](arithmetic-precedence.md) is a separate decision.
These tests propose syntax; they do not approve the remaining lexical/printing
choices or claim current implementation support.

## Values

```pattern
test "Fraction literals denote exact reduced Rationals"
  third = (1/3)
  expect third is (1 / 3) :: Rational
  half = (2/4)
  expect half is 0.5 :: Rational
  whole = (3/1)
  expect whole is 3 :: Rational
  zero = (0/5)
  expect zero is 0 :: Rational
  large = (9007199254740993/1)
  expect large is 9007199254740993 :: Rational
  assert (2/6) == (1/3)
end

test "A decimal exponent scales the entire fraction exactly"
  expect parse(Rational)("(1/3)e20") is (100000000000000000000 / 3) :: Rational
  expect parse(Rational)("(1/3)e-2") is (1 / 300) :: Rational
  expect parse(Rational)("(3/4)e2") is 75 :: Rational
  expect parse(Rational)("(1/3)e0") is (1 / 3) :: Rational
  expect parse(Rational)("(1/3)e+2") is (100 / 3) :: Rational

  assert parse(Code)("(1/3)e20") == parse(Code)("(100000000000000000000/3)")
  assert parse(Code)("(3/4)e2") == Code` 75
end

test "Negative fractions use ordinary prefix negation"
  negative = -(1/3)
  expect negative is
    -(1 / 3) :: Rational
  end
  expect parse(Rational)("-(1/3)e2") is
    -(100 / 3) :: Rational
  end
  assert parse(Code)("-(1/3)") == Code` -((1/3))
end
```

## Reading and formatting

```pattern
test "Interior spaces preserve the same Rational atom in Code"
  atom = Code` (1/3)

  assert parse(Code)("(1/3)") == atom
  assert parse(Code)("(1 / 3)") == atom
  assert parse(Code)("(1/ 3)") == atom
  assert parse(Code)("(1 /3)") == atom
  assert parse(Code)("( 1 / 3 )") == atom
  assert parse(Code)("(1 / 3)e20") == parse(Code)("(1/3)e20")
end

test "Equivalent numeric spellings give equal Code atoms"
  assert parse(Code)("(2/6)") == parse(Code)("(1/3)")
  assert parse(Code)("(2 / 4)") == Code` 0.5
  assert parse(Code)("(3 / 1)") == Code` 3
end

test "Ordinary division remains a distinct application"
  assert parse(Code)("1 / 3") != parse(Code)("(1/3)")
  assert parse(Code)("a / b") == Code` /(a)(b)
  expect parse(Code)("1/3") fails "infix operators require spaces"
  expect parse(Code)("1/3e20") fails "infix operators require spaces"
end

test "A zero denominator is a source-reading error"
  expect parse(Code)("(1/0)") fails "malformed numeric source literal"
  expect parse(Code)("(1 / 0)e20") fails "malformed numeric source literal"
end
```

Only integer components form this literal; arbitrary expressions are not evaluated
by its reader. Signed components, leading zeros, underscores and exponent
whitespace need an explicit lexical decision before approval.

## Packs and calls

```pattern
test "A literal has its own parentheses inside an argument pack"
  assert parse(Code)("f((1/3))") == Code` f((1/3))
  assert parse(Code)("f((1 / 3))") == Code` f((1/3))
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

The following candidate keeps the PR's existing decimal/hex preferences and uses
parenthesized reduced fractions for the remaining values. The 16-place cutoff
and binary64 hexadecimal preference still need approval.

```pattern
test "Candidate canonical Rational text covers every exact value"
  expect toString(Rational)((2/4)) is "0.5" :: String
  expect toString(Rational)((3/1)) is "3" :: String
  expect toString(Rational)((0/5)) is "0" :: String
  expect toString(Rational)((1/3)) is "(1/3)" :: String
  expect toString(Rational)(-(2/6)) is "-(1/3)" :: String
  expect toString(Rational)((1/10000000000000000)) is "0.0000000000000001" :: String
  expect toString(Rational)((1/100000000000000000)) is "(1/100000000000000000)" :: String
  expect toString(Rational)((1/1048576)) is "0x1p-20" :: String
  expect toString(Rational)(0f0.1) is "0x1.999999999999Ap-4" :: String
end

test "Typed Rational text reconstructs the same exact value"
  assert parse(Rational)(toString(Rational)((1/3))) == (1/3)
  assert parse(Rational)(toString(Rational)(-(2/6))) == -(2/6)
  assert parse(Rational)(toString(Rational)((9007199254740993/1))) == 9007199254740993

  scaled = parse(Rational)("(1/3)e20")
  expanded = (100000000000000000000/3)
  assert toString(Rational)(scaled) == toString(Rational)(expanded)
end

test "Code printing reconstructs numeric atoms and prefix negation"
  atom = Code` (1/3)
  assert parse(Code)(toString(Code)(atom)) == atom

  negative = Code` -(1/3)
  assert parse(Code)(toString(Code)(negative)) == negative
end
```

After approval, revise the PR's literal cases and the old serialization-failure
case in [exact-values.test](../../tests/numeric/exact-values.test).
Keep native syntax/transport checks in host tests. Other numeric families and
general function/type serialization retain their existing boundaries.
