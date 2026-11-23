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
| Fixed reduced fraction format | draft `Fraction64` / Ratio / RationalM | `RatioW` (total width; `Ratio64` = two `Int32` limbs) |

## NumericValue literal format

Grammar for a single numeric atom:

```text
REAL_PART ::= SCALAR | SCALED_INTEGER / UNSIGNED_INTEGER
IMAGINARY_PART ::= SCALAR i | SCALED_INTEGER i / UNSIGNED_INTEGER
NUMERIC_CONSTANT ::= -? REAL_PART | -? IMAGINARY_PART
                   | -? REAL_PART (+ | -) IMAGINARY_PART
```

`SCALAR` is an unsigned decimal, `0f` decimal, hexadecimal or binary
coefficient, with an optional radix point and an optional exponent. The
imaginary coefficient can have a radix point too, as in `0.5i` and
`-1.25+0.5i`. In a mixed atom, a leading `-` signs the real part, and the
separator signs the imaginary part. `SCALED_INTEGER` is an unsigned integer
coefficient with an optional exponent. `UNSIGNED_INTEGER` is an integer
coefficient without an exponent and must be positive as a denominator.
Integer coefficients may be decimal, hexadecimal or binary.

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

### Decisions

- A fraction numerator is integer text only. Forms such as `1.1/3` fail with
  `E_SYNTAX`.
- `0f` does not combine with a fraction slash in one atom. Forms such as
  `0f1/3` fail with `E_SYNTAX`.
- A denominator has no sign. `1/-3` fails with `E_SYNTAX`. Write `-1/3` to
  put the sign on the fraction, or `1 / -3` for an explicit division.
- An exponent belongs inside the numeric atom. An exponent attached after a
  parenthesized atom fails with `E_SYNTAX`, including nested groups such as
  `((1/3))e20`. For a fraction, put it on the numerator, as in `1e20/3`.
- Parentheses are ordinary grouping: `(1/3)` relates to `1/3` exactly as
  `("a")` relates to `"a"`.

Further examples:

    expect 1 / 3 is 1/3 :: NumericValue
    expect 10000 / 3 is 1e4/3 :: NumericValue
    expect 10 / 11 is 0xa/0xb :: NumericValue
    expect 3 / 10 is 0b11/10 :: NumericValue
    expect 1i / 3 is 1i/3 :: NumericValue
    expect (1i * 10000) / 3 is 1e4i/3 :: NumericValue
    expect 10 * 1i is 0xai :: NumericValue
    expect (10 / 3) * 1i is 0xai/3 :: NumericValue
    expect (40 / 3) * 1i is 0xap2i/3 :: NumericValue
    expect -1 * 1i is -1i :: NumericValue
    expect 1 + (3i) is 1+3i :: NumericValue
    expect 1 - (1000i) is 1-1e3i :: NumericValue
    assert (10 + 10i) == (0xa + 0xai)
    assert (3 + 3i) == (0b11 + 3i)
    expect (10/3) + (1i / 3) is 10/0b11+1i/3 :: NumericValue
    expect 1000 + (10000i) is 0xap3+0xap4i :: NumericValue

```pattern
test "Paren-free and complex NumericValue atoms round-trip through Code text"
  assert parse(NumericValue)("1/3") == (1 / 3)
  assert parse(NumericValue)("1e4/3") == (10000 / 3)
  assert parse(NumericValue)("0xa/0xb") == (10 / 11)
  assert parse(NumericValue)("0b11/10") == (3 / 10)
  assert parse(NumericValue)("1i/3") == (parse(NumericValue)("1i") / 3)
  assert parse(NumericValue)("1+3i") == (1 + parse(NumericValue)("3i"))
  assert parse(NumericValue)("0xap2i/3") == (parse(NumericValue)("0xai/3") * 4)
end

test "Parentheses group a fraction atom like any other atom"
  assert parse(Code)("1/3") == parse(Code)("(1/3)")
  assert parse(Code)("(1/3)") == parse(Code)("( 1/3 )")
  assert parse(NumericValue)("(1/3)") == parse(NumericValue)("1/3")
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

test "Bare i is an ordinary symbol"
  expect i fails "E_UNBOUND_NAME"
end

test "A bound imaginary value adds at run time"
  i = parse(NumericValue)("1i")
  assert (3 + i) == parse(NumericValue)("3+1i")
end

test "Exact complex arithmetic stores both coefficients and rejects ordering"
  value = 1+2i
  assert value .matches NumericValue
  assert (value * (1-2i)) == 5
  assert (5 / value) == (1-2i)
  assert (value - value) == 0
  expect value < 2 fails "E_INCOMPARABLE_TYPES"
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
| Fraction | Reduced `n/d` with positive integer components. Either component can use any allowed integer radix. The numerator may have the exponent for its radix. |

Lexical normalization before compare: ASCII digits; lowercase `0f`, `0x`,
`0b`, `e`, `p`, and `i`; uppercase hexadecimal digits; no spaces,
underscores, redundant leading zeros, exponent `+`, or zero exponents;
no trailing fractional zeros; exponent magnitude at most `10000`.
If a shorter spelling would exceed that cap, consider moving powers into
coefficient digits or using full integer or reduced fraction text.

Tie-breaks, in order: source length; family order as in the table;
within a family prefer no exponent; ASCII lexicographic order.

Zero prints as `0`. A negative real selects the magnitude spelling and
adds a leading `-`.

For a complex value, consider only spellings admitted by the complete atom
grammar. The real and imaginary coefficients use the same shortest-exact
rule, including decimal points. In a fraction spelling of the imaginary
part, insert `i` before `/`. Omit a part whose value is zero. If both parts are
zero, print `0`.
Join a nonzero imaginary part to a nonzero real part with `+` or `-` as
required, with no spaces, as in `1+3i` or `1-1e3i`. A pure imaginary value
prints without a real part, as in `-1i`.

When both parts are present, choose radices and spellings that minimize
total atom length under the same tie-breaks applied to the whole atom
string. Mixed-radix atoms are allowed when they win.

```pattern
test "Canonical NumericValue text omits zero imaginary parts"
  expect toString(NumericValue)(parse(NumericValue)("0f0.1")) is "0f0.1" :: String
  expect toString(NumericValue)(parse(NumericValue)("1+0i")) is "1" :: String
  expect toString(NumericValue)(parse(NumericValue)("0-1i")) is "-1i" :: String
  expect toString(NumericValue)(parse(NumericValue)("0-0i")) is "0" :: String
end

test "Canonical complex text picks one shortest atom"
  # 10+10i: "10+10i" length 6 beats "0xa+0xai" (8) and "0xa+10i" (7).
  expect toString(NumericValue)(parse(NumericValue)("10+10i")) is "10+10i" :: String
  expect toString(NumericValue)(parse(NumericValue)("0xa+0xai")) is "10+10i" :: String
  expect toString(NumericValue)(parse(NumericValue)("3+3i")) is "3+3i" :: String
end

test "Complex atoms round-trip decimal coefficients and independent signs"
  imag = parse(NumericValue)("1i/2")
  mixed = parse(NumericValue)("-1.25+0.5i")
  expect toString(NumericValue)(imag) is "0.5i" :: String
  expect toString(NumericValue)(mixed) is "-5/4+0.5i" :: String
  assert mixed == (parse(NumericValue)("-1.25") + imag)
  assert parse(NumericValue)(toString(NumericValue)(mixed)) == mixed
  code = parse(Code)("-1.25+0.5i")
  assert parse(Code)(toString(Code)(code)) == code
end

test "Canonical fraction text is paren-free"
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

In binary and hexadecimal digit runs, `_` may appear only between complete
bytes (`0xff_aa_bb`, `0b10101010_11110000`). Arbitrary mid-byte groups are
`E_SYNTAX`.

```pattern
test "Decimal underscores use thousands grouping"
  assert 1000 == 1_000
  expect parse(Code)("10_00") fails "E_SYNTAX"
end

test "Hex and binary underscores sit only between bytes"
  assert parse(NumericValue)("0xff_aa") == 0xffaa
  assert parse(NumericValue)("0b10101010_11110000") == 0xaaf0
  expect parse(Code)("0xfff_aaa") fails "E_SYNTAX"
  expect parse(Code)("0b101_010") fails "E_SYNTAX"
end
```

## Tight atoms and arithmetic grouping

A tight numeric atom such as `1/3` or `3+4i` is one literal. Spaced
operators build applications. If an infix chain would be rejected by the
[grouping rules](arithmetic-grouping.md) when written with spaces, the same
operator pair is rejected when a tight atom sits beside a spaced operator
without parentheses.

```pattern
test "Grouping rules apply beside tight numeric atoms"
  expect parse(Code)("1/3 / 3") fails "E_INFIX_GROUPING"
  expect parse(Code)("1 / 3/3") fails "E_INFIX_GROUPING"
  expect parse(Code)("1i/3 + 3") fails "E_INFIX_GROUPING"
  expect parse(Code)("3+4i / 3") fails "E_INFIX_GROUPING"
end

test "Code printing groups a decimal that canonicalizes to a fraction"
  division = parse(Code)("0.75 / 3")
  expect toString(Code)(division) is "(3/4) / 3" :: String
  assert parse(Code)(toString(Code)(division)) == division
end
```

## Values

Use direct source literals to check the exact values, including when a
fraction appears inside an argument pack. The following binding is used in
later tests in this spec.

```pattern
oneThird = (1/3)
assert oneThird .matches NumericValue
assert oneThird == (1 / 3)
```

```pattern
test "Fraction literals denote exact reduced NumericValues"
  assert oneThird == (1 / 3)
  expect 2/4 is 0.5 :: NumericValue
  expect 3/1 is 3 :: NumericValue
  expect 0/5 is 0 :: NumericValue
  expect 9007199254740993/1 is 9007199254740993 :: NumericValue
  assert (1_000/3_000) == oneThird

  assert (2/6) == (1/3)

  def addOne(n :: NumericValue) n + 1
  expect addOne(1/2) is 1.5 :: NumericValue
end

test "A numerator-side decimal exponent scales the fraction exactly"
  assert parse(NumericValue)("1e20/3") == (100000000000000000000 / 3)
  assert parse(NumericValue)("1e-2/3") == (1 / 300)
  assert parse(NumericValue)("3e2/4") == 75
  assert parse(NumericValue)("1e0/3") == (1 / 3)
  assert parse(NumericValue)("1e+2/3") == (100 / 3)
end

test "The minus in a negative literal belongs to the numeric atom"
  assert (-1/2) == (-0.5)
  assert parse(Code)("(-1/2)") == parse(Code)("-0.5")
  assert parse(Code)("-(1/2)") != parse(Code)("(-1/2)")
  assert parse(Code)("-(0.5)") != parse(Code)("-0.5")
  assert (-(1/2)) == (-0.5)

  assert parse(Code)("-(0x1p-20)") != parse(Code)("-0x1p-20")
  expect toString(Code)(parse(Code)("-0.5")) is "-0.5" :: String
  expect toString(Code)(parse(Code)("-0x1p-20")) is "-0x1p-20" :: String

  negation = Code` -(0.5)
  assert parse(Code)(toString(Code)(negation)) == negation

  assert parse(NumericValue)("-0x1") == -1
  assert parse(Code)("-0x1") == parse(Code)("-1")
  assert parse(NumericValue)("-0b10") == -2
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
end

test "Numerator-side exponents equal the expanded fraction atom"
  assert parse(Code)("1e20/3") == parse(Code)("100000000000000000000/3")
  assert parse(Code)("3e2/4") == parse(Code)("75")
end

test "A zero denominator fails during literal reading"
  expect parse(Code)("(1/0)") fails "E_SYNTAX"
  expect parse(Code)("(1/0)e20") fails "E_SYNTAX"
  assert parse(Code)("(1 / 0)") == Code` /(1)(0)
  legacy expect 1 / 0 fails "result exceeds safe numeric range"
  todo expect 1 / 0 fails "isNonZero"
end

test "An overflowing conversion in a default runs only when selected"
  def choose(value: Float64 = float64(1e309)) value
  expect choose(value: 8) is 8 :: Float64
  legacy expect choose() fails "result exceeds safe numeric range"
  todo expect choose() fails "E_OVERFLOW"
end
```

## Literal grammar edge cases

Parentheses are ordinary grouping around a complete atom. The same sign,
separator and exponent rules apply inside a group.

```pattern
test "Paren-free fraction atoms are NumericValue literals"
  assert parse(NumericValue)("1/3") == (1 / 3)
  assert parse(NumericValue)("1e20/3") == ((1 / 3) * 1e20)
end

test "An exponent attached after a grouped numeric atom is E_SYNTAX"
  expect parse(Code)("(1/3)e20") fails "E_SYNTAX"
  expect parse(Code)("((1/3))e20") fails "E_SYNTAX"
  expect parse(Code)("(( -1/3 ))E+2") fails "E_SYNTAX"
  expect parse(Code)("((0x1/3))p-3") fails "E_SYNTAX"
  expect parse(Code)("((0.5i))e2") fails "E_SYNTAX"
  expect parse(Code)("(1.5)e-2") fails "E_SYNTAX"
  assert parse(Code)("(1/3) e20") == parse(Code)("1/3 e20")
  expect parse(Code)("(1/3)e0") fails "E_SYNTAX"
  expect parse(Code)("(-1/3)e2") fails "E_SYNTAX"
  expect parse(Code)("(1_0/5)e2") fails "E_SYNTAX"
  expect parse(NumericValue)("(1/3)e20") fails "E_SYNTAX"
  expect parse(NumericValue)("(1/3)e10000") fails "E_SYNTAX"
  expect parse(NumericValue)("(1/3)e-10000") fails "E_SYNTAX"
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

test "Mixed-radix fraction atoms are allowed"
  assert parse(NumericValue)("0x1/3") == (1 / 3)
  assert parse(NumericValue)("1/0b11") == (1 / 3)
  assert parse(NumericValue)("0xf/11") == (15 / 11)
  assert parse(NumericValue)("0xf/0x11") == (15 / 17)
end

test "Parenthesized fraction components keep digit rules"
  expect parse(Code)("(01/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/03)") fails "E_SYNTAX"
  expect parse(Code)("(+1/3)") fails "E_SYNTAX"
  expect parse(Code)("(1.0/3)") fails "E_SYNTAX"
  expect parse(Code)("(1_/3)") fails "E_SYNTAX"
  expect parse(Code)("(1/3_)") fails "E_SYNTAX"
  expect parse(Code)("(1__0/3)") fails "E_SYNTAX"
  expect parse(NumericValue)("(1/3) e10") fails "E_DATA_PARSE"
  expect parse(Code)("(1/3)e01") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e0xA") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e05") fails "E_SYNTAX"
end

test "Fraction components and exponents keep digit and sign rules"
  assert parse(NumericValue)("1_000e2/5") == 20000
  assert parse(NumericValue)("-1/3") == (1 / -3)
  expect parse(Code)("1_0e2/5") fails "E_SYNTAX"
  expect parse(Code)("1/-3") fails "E_SYNTAX"
  expect parse(Code)("01/3") fails "E_SYNTAX"
  expect parse(Code)("1/03") fails "E_SYNTAX"
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
  expect parse(NumericValue)("0.05") is 0.05 :: NumericValue
  assert parse(NumericValue)("-0.5") == (-0.5)
  assert parse(Code)("1_000.005_125") == Code` 1000.005125
  expect parse(Code)("01.5") fails "E_SYNTAX"
  expect parse(Code)("0_1") fails "E_SYNTAX"
  expect parse(Code)("1e01") fails "E_SYNTAX"
end

test "Binary p exponents reject leading zeros like decimal e"
  assert parse(NumericValue)("0x1p5") == 32
  assert parse(NumericValue)("0b1p5") == 32
  assert parse(NumericValue)("0x1p-5") == 0x1p-5
  expect parse(Code)("0x1p05") fails "E_SYNTAX"
  expect parse(Code)("0x1p-05") fails "E_SYNTAX"
  expect parse(Code)("0b1p05") fails "E_SYNTAX"
end

test "Decimal coefficients reject a binary p exponent"
  # Hex `e` is a digit (`0x1e2` is 482), so hex/binary exponents use `p` only.
  # Use plain decimals here; `0f…p…` can fail for unrelated 0f reasons.
  expect parse(Code)("10p2") fails "E_SYNTAX"
  expect parse(Code)("1.5p2") fails "E_SYNTAX"
  expect parse(Code)("100p2") fails "E_SYNTAX"
end

test "Written e and p exponents accept the magnitude cap and reject past it"
  assert parse(NumericValue)("1e10000") == 1e10000
  assert parse(NumericValue)("1e-10000") == 1e-10000
  assert parse(NumericValue)("0x1p10000") == 0x1p10000
  assert parse(NumericValue)("0x1p-10000") == 0x1p-10000
  assert parse(Code)(toString(Code)(parse(Code)("1e10000"))) == parse(Code)("1e10000")
  assert parse(Code)(toString(Code)(parse(Code)("0x1p10000"))) == parse(Code)("0x1p10000")

  expect parse(Code)("1e10001") fails "E_SYNTAX"
  expect parse(Code)("1e-10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p10001") fails "E_SYNTAX"
  expect parse(Code)("0x1p-10001") fails "E_SYNTAX"
  expect parse(NumericValue)("1e10001") fails "E_SYNTAX"
  expect parse(Code)("1e999999999") fails "E_SYNTAX"
  expect parse(Code)("0x1p999999999") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e10001") fails "E_SYNTAX"
  expect parse(Code)("(1/3)e999999999") fails "E_SYNTAX"
end

test "Numerator-side exponents respect the same magnitude cap"
  assert parse(NumericValue)("1e10000/3") == (parse(NumericValue)("1e10000") / 3)
  assert parse(NumericValue)("1e-10000/3") == (parse(NumericValue)("1e-10000") / 3)
  expect parse(Code)("1e10001/3") fails "E_SYNTAX"
end
```

## Packs and calls

A tight numeric atom such as `1/3` is one argument. Spaced division inside a
pack is still an application. Code text preserves pack boundaries, labels, and
grouping. Parentheses remain ordinary grouping around the atom.

```pattern
test "Grouped fraction atoms work inside argument packs"
  atom = Code` f((1/3))
  assert parse(Code)("f((1/3))") == atom
  assert parse(Code)("f((1 / 3))") == Code` f(1 / 3)
  assert parse(Code)("f((1/3))") != parse(Code)("f(1 / 3)")
  assert parse(Code)("f((2/4))(scale: (3/4))") == Code` f(0.5)(scale: 0.75)
end

test "Numeric Code text preserves successive packs and prefix negation"
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
  expect toString(Code)(parse(Code)("(-1/3)")) is "-1/3" :: String
end

test "A paren-free fraction atom is one pack argument"
  assert parse(Code)("f(1/3)") != parse(Code)("f(1 / 3)")
  assert parse(Code)("f(1/3)") == parse(Code)("f((1/3))")
  assert parse(Code)("f(1e20/3)") == parse(Code)("f(100000000000000000000/3)")
  assert parse(Code)("f(2/4)(scale: 3/4)") == parse(Code)("f(0.5)(scale: 0.75)")
end

test "Paren-free packs round-trip through Code text"
  def roundTrips(source :: String)
    code = parse(Code)(source)
    parse(Code)(toString(Code)(code)) == code
  end

  assert roundTrips("f(1/3)(scale: 3/4)")
  assert roundTrips("f(-1/3)(scale: 3/4)")
  assert roundTrips("def third() 1/3")
  expect toString(Code)(parse(Code)("-1/3")) is "-1/3" :: String
end
```

## Typed text

`parse(NumericValue)` reads the same numeric literal grammar as source, including
`(-1/3)` and `-0.5`. Use `parse(Code)` to read prefix negation or grouped
division as Code. Canonical spelling is defined above.

```pattern
test "The typed NumericValue reader accepts literals without evaluating Code"
  assert parse(NumericValue)("-0x1p-20") == -(0x1p-20)
  expect parse(NumericValue)("1 + 2") fails "E_PATTERN_MISMATCH"
  expect parse(NumericValue)("(1 / 3)") fails "E_PATTERN_MISMATCH"
  expect parse(NumericValue)("-(1/3)") fails "E_PATTERN_MISMATCH"
  expect parse(NumericValue)("-(0.5)") fails "E_PATTERN_MISMATCH"
end

test "Typed reading reduces fractions without losing precision"
  assert parse(NumericValue)("(1/3)") == (1 / 3)
  assert parse(NumericValue)("(2/6)") == (1 / 3)
  expect parse(NumericValue)("(2/4)") is 0.5 :: NumericValue
  expect parse(NumericValue)("(3/1)") is 3 :: NumericValue
  expect parse(NumericValue)("(0/5)") is 0 :: NumericValue
  expect parse(NumericValue)("(9007199254740993/1)") is 9007199254740993 :: NumericValue
  assert parse(NumericValue)("(1_000/3_001)") == (1000 / 3001)
  assert parse(NumericValue)("(-1/2)") == (-0.5)
end

test "Typed NumericValue text scales with a numerator-side exponent"
  assert parse(NumericValue)("1e20/3") == (100000000000000000000 / 3)
  assert parse(NumericValue)("1e-2/3") == (1 / 300)
  assert parse(NumericValue)("3e2/4") == 75
  assert parse(NumericValue)("1e0/3") == (1 / 3)
  assert parse(NumericValue)("-1e+2/3") == (-100 / 3)
  assert parse(NumericValue)("1e-1_000/3") == (parse(NumericValue)("1e-1000") / 3)
end

test "Typed NumericValue text reconstructs the same exact value"
  assert parse(NumericValue)(toString(NumericValue)(oneThird)) == oneThird
  assert parse(NumericValue)(toString(NumericValue)((-2/6))) == (-1/3)
  assert parse(NumericValue)("(-1/3)") == (-1/3)
  assert parse(NumericValue)("-0.5") == (-1/2)
  assert parse(NumericValue)(toString(NumericValue)((9007199254740993/1))) == 9007199254740993

  expanded = (100000000000000000000/3)
  assert parse(NumericValue)(toString(NumericValue)(expanded)) == expanded
end

test "A computed NumericValue round-trips as a reduced fraction"
  n = (1 / 3) * 1

  assert (n * 3) == 1
  assert ((1 / 3) * 3) == 1
  expect toString(NumericValue)(n) is "1/3" :: String
  assert parse(NumericValue)(toString(NumericValue)(n)) == n
end
```

## Exact magnitudes and Code identity

```pattern
test "Decimal literals denote exact NumericValue values"
  n = 0.1

  assert (n * 10) == 1
end

test "Zero is an exact NumericValue"
  expect 0 is 0 :: NumericValue
end

test "Exact and rounded literals remain distinct through Code text"
  exact = Code` 0.1
  rounded = Code` 0f0.1

  assert 0.1 != 0f0.1
  assert exact != rounded
  assert parse(Code)(toString(Code)(exact)) == exact
  assert parse(Code)(toString(Code)(rounded)) == rounded
end

test "Large integers and signed values retain exact meaning"
  n = 9007199254740993

  assert n != 9007199254740992
  expect n is 9007199254740993 :: NumericValue
  assert (0 - 0.1) == (-0.1)
  assert (0 - n) == (-9007199254740993)
end

test "C02 exact NumericValue literal meanings"
  expect 0.1 is 0.1 :: NumericValue
  expect 0f0.5 is 0.5 :: NumericValue
  expect 0x1.999999999999Ap-4 is 0f0.1 :: NumericValue
  assert 0f0.1 != 0.1
  assert 0xFp8 == 0b1111p8
end

test "equal Code values serialize as equal text"
  a = Code` 0.1
  b = Code` 0.10
  assert a == b
  assert toString(Code)(a) == toString(Code)(b)
  assert parse(Code)(toString(Code)(a)) == a
  one = Code` 1
  oneDot = Code` 1.0
  oneHex = Code` 0x1p0
  assert one == oneDot
  assert one == oneHex
  assert toString(Code)(one) == toString(Code)(oneDot)
  assert toString(Code)(one) == toString(Code)(oneHex)
  assert parse(Code)(toString(Code)(one)) == one
end

test "Code round-trips the 0 - 0.1 tree"
  c = Code` (0 - 0.1)
  assert parse(Code)(toString(Code)(c)) == c
end
```

## Signed values and prefix negation

```pattern
test "Prefix minus negates and infix minus subtracts"
  expect
    -1
  is
    -1 :: NumericValue
  end

  expect
    -(1)
  is
    -1 :: NumericValue
  end

  x = 3
  expect
    -x
  is
    -3 :: NumericValue
  end

  expect
    -(x)
  is
    -3 :: NumericValue
  end

  expect 1 - x
  is
    -2 :: NumericValue
  end
  expect 1 - -x is 4 :: NumericValue
  expect 1 - -2 is 3 :: NumericValue
end

test "Prefix and infix minus survive Code text round trips"
  negative = Code` -1
  assert parse(Code)(toString(Code)(negative)) == negative

  subtraction = Code` 1 - -x
  assert parse(Code)(toString(Code)(subtraction)) == subtraction
end

test "Prefix minus negates; infix minus subtracts"
  x = 3
  n = -1
  grouped = -(1)
  nx = -x
  groupedX = -(x)
  assert n == negate(1)
  assert grouped == n
  assert nx == negate(x)
  assert groupedX == nx
  assert (1 - x) == negate(2)
  expect 1 - -x is 4 :: NumericValue
  expect 1 - -2 is 3 :: NumericValue
  expect 5 - (2) is 3 :: NumericValue
  assert parse(Code)("-1") != parse(Code)("-(1)")
  assert parse(Code)("-x") == parse(Code)("-(x)")
  quotedPrefix = Code` -1
  quotedGrouped = Code` -(x)
  quotedInfix = Code` 1 - x
  quotedNested = Code` 1 - -x
  assert quotedPrefix == parse(Code)("-1")
  assert quotedGrouped == parse(Code)("-(x)")
  assert quotedInfix == parse(Code)("1 - x")
  assert quotedNested == parse(Code)("1 - -x")
  assert parse(Code)(toString(Code)(quotedPrefix)) == quotedPrefix
  assert parse(Code)(toString(Code)(quotedGrouped)) == quotedGrouped
  assert parse(Code)(toString(Code)(quotedInfix)) == quotedInfix
  assert parse(Code)(toString(Code)(quotedNested)) == quotedNested
end

```

## Canonical real values

```pattern
test "Canonical text chooses short exact decimal spellings"
  expect toString(NumericValue)(2 / 4) is "0.5" :: String
  expect toString(NumericValue)(3 / 1) is "3" :: String
  expect toString(NumericValue)(0 / 5) is "0" :: String
  expect toString(NumericValue)(1000) is "1e3" :: String
  expect toString(NumericValue)(0.001) is "1e-3" :: String
  expect toString(NumericValue)(1 / 10000000000000000) is "1e-16" :: String
  expect toString(NumericValue)(1 / 100000000000000000) is "1e-17" :: String
end

test "Canonical text compares fractions, hexadecimal and binary spellings"
  expect toString(NumericValue)(1 / 16) is "1/16" :: String
  expect toString(NumericValue)(1 / 1048576) is "0x1p-20" :: String
  expect toString(NumericValue)(18446744073709551615) is "0xFFFFFFFFFFFFFFFF" :: String
  expect toString(NumericValue)(0b1p-2000) is "0x1p-2000" :: String
  assert parse(NumericValue)(toString(NumericValue)(0x1p-2000)) == 0x1p-2000
end

test "A Float64-selected spelling is canonical only for its exact value"
  expect toString(NumericValue)(0f0.1) is "0f0.1" :: String
  expect toString(NumericValue)(3602879701896397 / 36028797018963968) is "0f0.1" :: String
  expect toString(NumericValue)(0.1) is "0.1" :: String
  assert toString(NumericValue)(0f0.1) != toString(NumericValue)(0.1)
  assert parse(NumericValue)(toString(NumericValue)(0f0.1)) == 0f0.1
end

test "Canonical text breaks ties by family and then by omitting the exponent"
  # Compare fractions with positional forms, then break ties between decimals.
  expect toString(NumericValue)(0x0.2) is "1/8" :: String
  expect toString(NumericValue)(1 / 8) is "1/8" :: String
  expect toString(NumericValue)(1 / 2) is "0.5" :: String
  expect toString(NumericValue)(1e2) is "100" :: String
  expect toString(NumericValue)(1e-2) is "0.01" :: String
  expect toString(NumericValue)(1e1000) is "10e999" :: String
end

test "Reduced fraction text competes with decimal exponents and keeps its sign"
  negative = -2 / 6
  scaled = 100000000000000000000 / 3

  expect toString(NumericValue)(negative) is "-1/3" :: String
  expect toString(NumericValue)(1 / 300) is "1/300" :: String
  expect toString(NumericValue)(scaled) is "1e20/3" :: String
  expect toString(NumericValue)(-scaled) is "-1e20/3" :: String
  assert parse(NumericValue)(toString(NumericValue)(negative)) == negative
  assert parse(NumericValue)(toString(NumericValue)(scaled)) == scaled
  assert toString(NumericValue)(parse(NumericValue)("1e20/3")) == toString(NumericValue)(scaled)
end

test "Printing past the exponent cap absorbs overflow and still round-trips"
  # Uncapped shortest forms would be 1e10001 / 1e20000; the reader rejects those.
  product = 1e10000 * 10
  squared = 1e10000 * 1e10000
  third = (1e10000 * 10) / 3

  expect toString(NumericValue)(product) is "100e9999" :: String
  expect toString(NumericValue)(third) is "100e9999/3" :: String
  expect toString(Code)(product) is "100e9999" :: String
  expect toString(Code)(third) is "100e9999/3" :: String

  assert parse(NumericValue)(toString(NumericValue)(product)) == product
  assert parse(NumericValue)(toString(NumericValue)(squared)) == squared
  assert parse(NumericValue)(toString(NumericValue)(third)) == third
  assert parse(Code)(toString(Code)(product)) == parse(Code)("100e9999")
  assert parse(Code)(toString(Code)(squared)) == parse(Code)(toString(NumericValue)(squared))
  assert parse(Code)(toString(Code)(third)) == parse(Code)("100e9999/3")
end
```

Candidate equality uses exact coefficients. A host float can supply a `0f`
candidate after checking its exact denotation. Compare candidate lengths
without materializing needlessly long losing expansions.
