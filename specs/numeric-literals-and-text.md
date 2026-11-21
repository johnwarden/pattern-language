# Numeric literals and exact text

Every numeric value must have a source spelling that round-trips to the
same exact value. Include a type annotation when needed to recover the
concrete numeric format. The typed reader must recover that value directly
from its spelling.

This document is the source of truth for exact numeric atoms and their
canonical text. It absorbs the former Rational literals and shortest-text
specs and the NumericValue literal proposal from PR
[#86](https://github.com/johnwarden/pattern-language/pull/86).
Fixed-width formats, promotion and arithmetic policy live in
[fixed-precision numbers](fixed-precision-numbers.md).

## Rename map

| Role | Master / earlier draft | Destination |
| --- | --- | --- |
| Exact primitive for numeric literals (may be complex) | `Rational`, draft `ExactRational` | `NumericValue` |
| Abstract union of fixed-width non-complex formats | draft `Number` of ints/floats only; draft tip used `Rational` for this union | `Real` |
| Abstract union of fixed-width complex formats | (none) | `Complex` |
| Abstract union of all fixed-width numbers | `Number` (removed for now under L9) | `Number` = `Real \| Complex` |
| Fixed reduced fraction format | draft `Fraction64` / Ratio / RationalM | `Ratio64` (see open question) |

Bootstrap tests below still say `Rational` and use parenthesized fraction
atoms; that is the implemented spelling. Destination contracts use
`NumericValue` and paren-free atoms and are marked `todo` until migrated.

## NumericValue literal format

Destination grammar for a single numeric atom:

```text
RADIX ::= 0(x|b|f)
REAL_PART ::= {RADIX}?DIGITS(.DIGITS)?((e|p)EXPONENT)?(/{RADIX}?DIGITS)?
IMAGINARY_PART ::= {RADIX}?DIGITS((e|p)EXPONENT)?i(/{RADIX}?DIGITS)?
NUMERIC_CONSTANT ::= (-)?{REAL_PART} | (-)?{IMAGINARY_PART} | {REAL_PART}(+|-){IMAGINARY_PART}
```

Parentheses are no longer required for fraction constants. Reason: the
[arithmetic grouping rules](arithmetic-grouping.md) remove the formatting
safety issue that motivated required parentheses around `(1/3)`.

The denominator goes *after* any exponent and/or `i`.
Reason: otherwise parentheses would be necessary inside constants to
distinguish `1/3i` from `(1/3)i`.

Hexadecimal and binary coefficients use a binary `p` / `P` exponent.
Decimal coefficients (including `0f`) use a decimal `e` / `E` exponent.
Do not write `e` on a `0x` / `0b` coefficient or `p` on a plain decimal
coefficient. Exponent digit rules, the magnitude cap of `10000`, and the
ban on leading zeros in exponents keep the existing reader checks
(`E_SYNTAX`, including `numeric exponent exceeds 10000`).

Numerator, denominator, real and imaginary parts may use different radices.
Reason: forms such as `0xf+11i` and `0xf/11` must not silently read the
unprefixed part as hex. The unprefixed part is decimal, so `0xf/11` differs
from `0xf / 11` only in tree shape when the values coincide, and mixed
radix constants such as `0xf/0x11` are allowed.

`i` alone is not a numeric literal; it is an ordinary lower-camel symbol.

A touching `-` begins a numeric literal, as in `-0.5`, `-1i`, or `-0x1p-20`.

### Open questions

- **Decimal point in a fraction numerator** (for example `1.1/3`).
  Recommendation: reject with `E_SYNTAX`; require an integer numerator
  textually when a denominator is present.
- **`0f` combined with a fraction** (for example `0f1/3`).
  Recommendation: reject with `E_SYNTAX`; `0f` selects a Float64-rounded
  magnitude and does not mix with an exact fraction slash in one atom.

Destination examples (not executable until the reader accepts the atoms):

    expect 1 / 3 is 1/3 :: NumericValue
    expect 10000 / 3 is 1e4/3 :: NumericValue
    expect 10 / 11 is 0xa/0xb :: NumericValue
    expect 3 / 10 is 0b11/10 :: NumericValue
    expect 1i / 3 is 1i/3 :: NumericValue
    expect 1i * 10000 / 3 is 1e4i/3 :: NumericValue
    expect 10 * 1i is 0xai :: NumericValue
    expect (10 / 3) * 1i is 0xai/3 :: NumericValue
    expect (40 / 3) * 1i is 0xap2i/3 :: NumericValue
    expect -1 * 1i is -1i :: NumericValue
    expect 1 + (3i) is 1+3i :: NumericValue
    expect 1 - (1000i) is 1-1e3i :: NumericValue
    assert 10 + 10i == 0xa + 0xai
    assert 3 + 3i == 0b11 + 3i
    expect (10/3) + (1i / 3) is 10/0b11+1i/3 :: NumericValue
    expect 1000 + (10000i) is 0xap3+0xap4i :: NumericValue

```pattern
todo test "Paren-free and complex NumericValue atoms round-trip through Code text"
  assert parse(NumericValue)("1/3") == 1 / 3
  assert parse(NumericValue)("1e4/3") == 10000 / 3
  assert parse(NumericValue)("0xa/0xb") == 10 / 11
  assert parse(NumericValue)("0b11/10") == 3 / 10
  assert parse(NumericValue)("1i/3") == parse(NumericValue)("1i") / 3
  assert parse(NumericValue)("1+3i") == 1 + parse(NumericValue)("3i")
  assert parse(NumericValue)("0xap2i/3") == parse(NumericValue)("0xai/3") * 4
end

test "Invalid NumericValue atoms use E_SYNTAX"
  expect parse(Code)("0xa+3") fails "E_SYNTAX"
  expect parse(Code)("0xa+a") fails "E_SYNTAX"
  expect parse(Code)("5ie3") fails "E_SYNTAX"
  expect parse(Code)("1/3i") fails "E_SYNTAX"
  expect parse(Code)("0f1/3") fails "E_SYNTAX"
  expect parse(Code)("1.1/3") fails "E_SYNTAX"
  expect parse(Code)("1+i") fails "E_SYNTAX"
end

todo test "Bare i is a symbol; a bound imaginary adds at run time"
  expect i fails "E_UNBOUND_NAME"
  expect parse(Code)("i = 1i\n3 + i") is parse(Code)("3 + 1i")
end
```

## Canonical NumericValue text

Canonical text depends only on the mathematical value. Printing must not
approximate. Extend the shortest-exact selection across real and imaginary
parts.

For a nonnegative real `NumericValue` (imaginary part zero), choose the
shortest exact spelling among:

| Family | Candidates |
| --- | --- |
| Decimal | Integer and terminating decimal forms, with or without a decimal `e` exponent |
| Float64-selected decimal | `0f` followed by a decimal spelling whose prescribed Float64 rounding denotes this exact value |
| Hexadecimal | Exact `0x` forms, with or without a binary `p` exponent |
| Binary | Exact `0b` forms, with or without a binary `p` exponent |
| Fraction | Reduced `n/d` with positive integer components (paren-free), optionally with a decimal `e` on the numerator side per the atom grammar |

Lexical normalization before compare: ASCII digits; lowercase `0f`, `0x`,
`0b`, `e`, `p`, and `i`; uppercase hexadecimal digits; no spaces,
underscores, redundant leading zeros, exponent `+`, or zero exponents;
no trailing fractional zeros; exponent magnitude at most `10000`.

Tie-breaks, in order: source length; family order as in the table;
within a family prefer no exponent; ASCII lexicographic order.

Zero prints as `0`. A negative real selects the magnitude spelling and
adds a leading `-`.

For a complex value, print each nonzero part with the same shortest-exact
rule. Omit a part whose value is zero. If both parts are zero, print `0`.
Join a nonzero imaginary part to a nonzero real part with `+` or `-` as
required, with no spaces, as in `1+3i` or `1-1e3i`. A pure imaginary value
prints without a real part, as in `-1i`.

When both parts are present, choose radices and spellings that minimize
total atom length under the same tie-breaks applied to the whole atom
string. Mixed-radix atoms are allowed when they win.

```pattern
todo test "Canonical NumericValue text omits zero imaginary parts"
  expect toString(NumericValue)(parse(NumericValue)("0f0.1")) is "0f0.1" :: String
  expect toString(NumericValue)(parse(NumericValue)("1+0i")) is "1" :: String
  expect toString(NumericValue)(parse(NumericValue)("0-1i")) is "-1i" :: String
  expect toString(NumericValue)(parse(NumericValue)("0-0i")) is "0" :: String
end

todo test "Canonical complex text picks one shortest atom"
  # 10+10i: "10+10i" length 6 beats "0xa+0xai" (8) and "0xa+10i" (7).
  expect toString(NumericValue)(parse(NumericValue)("10+10i")) is "10+10i" :: String
  expect toString(NumericValue)(parse(NumericValue)("0xa+0xai")) is "10+10i" :: String
  expect toString(NumericValue)(parse(NumericValue)("3+3i")) is "3+3i" :: String
end

todo test "Canonical fraction text is paren-free"
  expect toString(NumericValue)(1 / 3) is "1/3" :: String
  expect toString(NumericValue)((-1) / 3) is "-1/3" :: String
  expect toString(NumericValue)((1 / 3) * 1e20) is "1e20/3" :: String
end
```

## Underscores

In decimal digit runs, `_` may appear only where a thousands separator
belongs: between groups that leave the leftmost group with one to three
digits and every other group with exactly three digits. `1_000` is valid;
`10_00` is not.

### Open question

- **`_` in binary or hexadecimal?** Recommendation: allow `_` only between
  complete bytes (`0xff_aa_bb`), not arbitrary digit groups.

```pattern
todo test "Decimal underscores use thousands grouping"
  assert 1000 == 1_000
  expect parse(Code)("10_00") fails "E_SYNTAX"
end
```

## Tight atoms and arithmetic grouping

A tight numeric atom such as `1/3` or `3+4i` is one literal. Spaced
operators build applications. If an infix chain would be rejected by the
[grouping rules](arithmetic-grouping.md) when written with spaces, the same
operator pair is rejected when a tight atom sits beside a spaced operator
without parentheses.

```pattern
todo test "Grouping rules apply beside tight numeric atoms"
  expect parse(Code)("1/3 / 3") fails "E_INFIX_GROUPING"
  expect parse(Code)("1 / 3/3") fails "E_INFIX_GROUPING"
  expect parse(Code)("1i/3 + 3") fails "E_INFIX_GROUPING"
  expect parse(Code)("3+4i / 3") fails "E_INFIX_GROUPING"
end
```

## Bootstrap implementation (live)

The contracts in this section run today. They still use the prelude name
`Rational` and parenthesized fraction atoms. Destination migration replaces
those names and spellings with the `NumericValue` rules above and marks
fulfilled todos.

## Values

Use direct source literals to check the exact values, including when a
fraction appears inside an argument pack. The following binding is used in
later tests in this spec.

```pattern
oneThird = (1/3)
expect oneThird is (1/3) :: Rational
```

```pattern
test "Fraction literals denote exact reduced Rationals"
  assert oneThird == (1 / 3)
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

```pattern
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
  expect parse(Code)("(1/0)") fails "E_SYNTAX"
  expect parse(Code)("(1/0)e20") fails "E_SYNTAX"
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

Signs, interior whitespace, digit separators, mixed radices, and exponent
bounds for destination atoms. Parentheses are optional grouping around a
complete atom; they are not part of the atom grammar. Cases the prototype
cannot read yet are `todo`.

```pattern
todo test "Paren-free fraction atoms are NumericValue literals"
  assert parse(NumericValue)("1/3") == 1 / 3
  assert parse(NumericValue)("1e20/3") == (1 / 3) * 1e20
  assert parse(NumericValue)("(1/3)") == parse(NumericValue)("1/3")
end

test "Interior whitespace inside a numeric atom is E_SYNTAX"
  expect parse(Code)("(1/ 3)") fails "E_SYNTAX"
  expect parse(Code)("(1 /3)") fails "E_SYNTAX"
  expect parse(Code)("1/ 3") fails "E_SYNTAX"
  expect parse(Code)("1 /3") fails "E_SYNTAX"
end

test "A bare identifier slash is not a numeric atom"
  expect parse(Code)("a/b") fails "E_SYNTAX"
end

todo test "Mixed-radix fraction atoms are allowed"
  assert parse(NumericValue)("0x1/3") == 1 / 3
  assert parse(NumericValue)("1/0b11") == 1 / 3
  assert parse(NumericValue)("0xf/11") == 15 / 11
  assert parse(NumericValue)("0xf/0x11") == 15 / 17
end

todo test "Fraction components and exponents keep digit and sign rules"
  assert parse(NumericValue)("1_0e2/5") == 200
  expect parse(Code)("01/3") fails "E_SYNTAX"
  expect parse(Code)("1/03") fails "E_SYNTAX"
  expect parse(Code)("1/-3") fails "E_SYNTAX"
  expect parse(Code)("+1/3") fails "E_SYNTAX"
  expect parse(Code)("1.0/3") fails "E_SYNTAX"
  expect parse(Code)("1_/3") fails "E_SYNTAX"
  expect parse(Code)("1/3_") fails "E_SYNTAX"
  expect parse(Code)("1__0/3") fails "E_SYNTAX"
  expect parse(Code)("1e2 /3") fails "E_SYNTAX"
  expect parse(Code)("1e01/3") fails "E_SYNTAX"
  expect parse(Code)("1e0xA/3") fails "E_SYNTAX"
  expect parse(Code)("1/3e20") fails "E_SYNTAX"
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

test "Decimal coefficients reject a binary p exponent"
  # Hex `e` is a digit (`0x1e2` is 482), so hex/binary exponents use `p` only.
  expect parse(Code)("10p2") fails "E_SYNTAX"
  expect parse(Code)("0f1p2") fails "E_SYNTAX"
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

A tight numeric atom such as `1/3` is one argument. Spaced division inside a
pack is still an application. Code text preserves pack boundaries, labels, and
grouping. Destination packs no longer require an extra pair of parentheses
around the fraction atom.

```pattern
todo test "A paren-free fraction atom is one pack argument"
  # Spaced division is a different Code tree; optional grouping around the atom
  # need not print identically.
  assert parse(Code)("f(1/3)") != parse(Code)("f(1 / 3)")
  assert parse(Code)("f(1e20/3)") == parse(Code)("f(100000000000000000000/3)")
  assert parse(Code)("f(2/4)(scale: 3/4)") == parse(Code)("f(0.5)(scale: 0.75)")
end

todo test "Numeric Code text preserves successive packs, labels and grouping"
  division = Code` (1 / 3)(2)
  expect toString(Code)(division) is "(1 / 3)(2)" :: String
  assert parse(Code)(toString(Code)(division)) == division

  def roundTrips(source :: String)
    code = parse(Code)(source)
    parse(Code)(toString(Code)(code)) == code
  end

  assert roundTrips("f(1/3)(scale: 3/4)")
  assert roundTrips("f(-1/3)(scale: 3/4)")
  assert roundTrips("-(1/3)")
  assert roundTrips("-(0.5)")
  assert roundTrips("def third() 1/3")
  expect toString(Code)(parse(Code)("-1/3")) is "-1/3" :: String
end
```

## Typed text

`parse(Rational)` reads the same numeric literal grammar as source, including
`(-1/3)` and `-0.5`. Use `parse(Code)` to read prefix negation or grouped
division as Code. Canonical spelling rules for the destination model are
above; the live bootstrap cases follow in the next section.

```pattern
test "The typed Rational reader accepts literals without evaluating Code"
  assert parse(Rational)("-0x1p-20") == -(0x1p-20)
  expect parse(Rational)("1 + 2") fails "E_PATTERN_MISMATCH"
  expect parse(Rational)("(1 / 3)") fails "E_PATTERN_MISMATCH"
  expect parse(Rational)("-(1/3)") fails "E_PATTERN_MISMATCH"
  expect parse(Rational)("-(0.5)") fails "E_PATTERN_MISMATCH"
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
  assert parse(Rational)(toString(Rational)(oneThird)) == oneThird
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


## Bootstrap canonical text (live)

## Examples

```pattern
test "Canonical decimal text has no fractional-place cutoff"
  expect toString(Rational)((2/4)) is "0.5" :: String
  expect toString(Rational)((3/1)) is "3" :: String
  expect toString(Rational)((0/5)) is "0" :: String
  expect toString(Rational)((1/10000000000000000)) is "1e-16" :: String
  expect toString(Rational)((1/100000000000000000)) is "1e-17" :: String
  expect toString(Rational)(1000) is "1e3" :: String
  expect toString(Rational)(0.001) is "1e-3" :: String
end

test "Shortest exact hexadecimal text is independent of binary64"
  expect toString(Rational)((1/16)) is "0x0.1" :: String
  expect toString(Rational)((1/1048576)) is "0x1p-20" :: String
  expect toString(Rational)(0x1p-2000) is "0x1p-2000" :: String
  expect toString(Rational)(18446744073709551615) is "0xFFFFFFFFFFFFFFFF" :: String
end

test "A Float64-selected spelling can be the shortest exact Rational text"
  expect toString(Rational)(0f0.1) is "0f0.1" :: String
  expect toString(Rational)((3602879701896397/36028797018963968)) is "0f0.1" :: String
  expect toString(Rational)(0.1) is "0.1" :: String
end

test "Equal-length spellings use the canonical tie-breaks"
  # 0.125, 0x0.2 and (1/8) each have five characters.
  expect toString(Rational)((1/8)) is "0.125" :: String

  # Within the decimal family, omit an exponent when lengths tie.
  expect toString(Rational)(100) is "100" :: String
  expect toString(Rational)(0.01) is "0.01" :: String
end

test "Reduced fraction text competes with exponent forms"
  expect toString(Rational)((1/3)) is "(1/3)" :: String
  expect toString(Rational)((-2/6)) is "(-1/3)" :: String
  expect toString(Rational)((1/300)) is "(1/300)" :: String
  expect toString(Rational)((1/3)e20) is "(1/3)e20" :: String
  expect toString(Rational)((-1/3)e20) is "(-1/3)e20" :: String
end

test "Canonical Rational text depends only on the exact value"
  assert toString(Rational)((2/4)) == toString(Rational)(0.5)
  assert toString(Rational)(0f0.1) == toString(Rational)((3602879701896397/36028797018963968))
  assert toString(Rational)(0.1) != toString(Rational)(0f0.1)
end
```

Preserve the Rational and numeric-Code round-trip contracts in the linked spec:
`parse(Rational)(toString(Rational)(v)) == v`, with equal values producing equal
text. Candidate equality must be established with exact integer/Rational
calculations. A host float may assist in finding a `0f` candidate, but its exact
Rational denotation must be checked; converting arbitrary Rationals to a host
float does not establish equality or justify printing an approximation.



## Implementation handoff

[rational-text.test](../tests/numeric/rational-text.test) covers the current
candidate families, tie-breaks, and typed round trips for `Rational`.
Destination `NumericValue` and paren-free atoms are the `todo` contracts above.
Compare candidate lengths without materializing needlessly long losing expansions.
