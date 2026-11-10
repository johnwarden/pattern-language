# Parenthesized Rational literals — draft

Latest proposal from the 10 November 2026 discussion of
[PR #76](https://github.com/johnwarden/pattern-language/pull/76):
`(n/d)` is one exact Rational atom, optionally followed by a touching decimal
exponent. The slash touches both integer components. The parentheses belong to
the literal. This replaces the PR's proposed bare `n/d` spelling.

[Agreed spacing clarification](../approved/rational-literal-spacing.md): `(1 / 3)` is ordinary
grouped division, not a literal. `(1/3)` and `(1 / 3)` yield the same Rational
under ordinary exact division, but their Code trees differ. Formatting safety
allows this value-preserving distinction; it no longer requires identical Code
trees for these two spellings. A zero denominator in the spaced expression is
an evaluation error, not a source-reading error. Ordinary Code printing can keep
using spaced division and grouping parentheses.

[Arithmetic precedence](arithmetic-precedence.md) is a separate decision.
These tests propose syntax; they do not approve the remaining lexical/printing
choices or claim current implementation support.

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

  assert (2/6) == (1/3)
end

test "A decimal exponent scales the entire fraction exactly"
  expect (1/3)e20 is (100000000000000000000/3) :: Rational
  expect (1/3)e-2 is (1/300) :: Rational
  expect (3/4)e2 is 75 :: Rational
  expect (1/3)e0 is (1/3) :: Rational
  expect (1/3)e+2 is (100/3) :: Rational
end

test "Reading a fraction exponent produces the same exact Code atom"
  assert parse(Code)("(1/3)e20") == parse(Code)("(100000000000000000000/3)")
  assert parse(Code)("(3/4)e2") == Code` 75
end

test "Negative fractions use ordinary prefix negation"
  expect -(1/3) is
    -(1/3) :: Rational
  end
  expect -(1/3)e2 is
    -(100/3) :: Rational
  end
  assert parse(Code)("-(1/3)") == Code` -((1/3))
end
```

## Reading and formatting

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

Only integer components form this literal; arbitrary expressions are not evaluated
by its reader. Signed components, leading zeros, underscores and exponent
whitespace need an explicit lexical decision before approval.

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

The following candidate keeps the PR's existing decimal/hex preferences and uses
parenthesized reduced fractions for the remaining values. The 16-place cutoff
and binary64 hexadecimal preference still need approval.

The candidate selection order is:

1. Print an exact terminating decimal if it needs at most 16 digits after the
   decimal point. This is not a significant-digit limit and performs no rounding;
   the integer part can contain any number of digits.
2. Otherwise, print hexadecimal if the Rational is exactly representable as a
   finite binary64 value. Approximation to binary64 is not permitted here.
3. Otherwise, print the reduced parenthesized fraction with a positive denominator.

For a reduced denominator `2^a * 5^b`, the terminating decimal needs `max(a, b)`
fractional places. Any other prime factor makes it nonterminating. Thus `1/10^16`
uses decimal, `1/10^17` uses a fraction, and `1/2^20` uses hexadecimal despite
having a terminating decimal expansion. This is a printing preference, not a
limit on literal precision or arithmetic.

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

  scaled = (1/3)e20
  expanded = (100000000000000000000/3)
  assert toString(Rational)(scaled) == toString(Rational)(expanded)
end

test "Code printing reconstructs numeric atoms and prefix negation"
  atom = Code` (1/3)
  assert parse(Code)(toString(Code)(atom)) == atom

  negative = Code` -(1/3)
  assert parse(Code)(toString(Code)(negative)) == negative
end

test "Code printing preserves ordinary grouped division"
  source = Code` (1 / 3)(2)
  text = toString(Code)(source)

  assert parse(Code)(text) == source
end
```

## Remaining review decisions

- Specify the remaining component grammar: signs, leading zeros, underscores and
  whitespace next to the delimiters, including whether either component may use a
  nondecimal spelling. The slash touching both components is settled; ordinary
  division requires spaces on both sides. State the exponent marker, sign, digit
  and adjacency rules explicitly.
- Ratify the canonical text selection order and its limits. The examples propose
  short decimal, then exact binary64 hexadecimal, then reduced fraction; spell out
  the 16-place cutoff and hexadecimal normalization if retained.
- State the typed Rational reader's sign grammar. It must accept the chosen
  negative canonical text without evaluating arbitrary Code, while source Code
  continues to represent negation as an ordinary prefix application.

After approval, revise the PR's literal cases and the old serialization-failure
case in [exact-values.test](../../tests/numeric/exact-values.test).
Keep native syntax/transport checks in host tests. Other numeric families and
general function/type serialization retain their existing boundaries.
