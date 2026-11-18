# Shortest exact Rational text

Approved by Jonathan in the project chat on 10 November 2026. Replaces the
16-fractional-place cutoff and binary64-specific printing preference in
[the Rational literals spec](rational-literals-and-text.md), which defines the
accepted input spellings.

## Selection

For a nonnegative Rational, choose the shortest exact spelling among these
families. Count all source characters, including prefixes, decimal points,
parentheses, slash and exponent.

| Family | Candidates |
| --- | --- |
| Decimal | Integer and terminating decimal forms, with or without a decimal `e` exponent |
| Float64-selected decimal | `0f` followed by a decimal spelling whose prescribed Float64 rounding denotes this exact Rational |
| Hexadecimal | Exact `0x` forms, with or without a binary `p` exponent |
| Binary | Exact `0b` forms, with or without a binary `p` exponent |
| Fraction | Reduced `(n/d)` with positive decimal integer components, optionally followed by a decimal `e` exponent |

All candidates must denote exactly the same Rational. Printing must not
approximate that value. In particular, a `0f` candidate is admissible only when
applying its prescribed rounding produces exactly the Rational being printed.
`0f0.1` therefore names the Float64-rounded Rational exactly, while `0.1` names
the different Rational 1/10. The shortest-round-trip decimal payload of a `0f`
spelling need not itself be the exact decimal expansion of the target Rational.

There is no decimal-place limit, significant-digit limit, or overall binary64
representability restriction. Exact hexadecimal candidates exist for dyadic
Rationals of any size; `0f` candidates exist only for Rational values obtained
as finite Float64 values under the already defined `0f` interpretation.

Exponent placement participates in the comparison. Do not require one digit
before the point: an integer coefficient such as `12e20` may be shorter than
`1.2e21`. For fraction exponent candidates, reduce the coefficient after scaling;
for example `(1/3)e20` competes with `(100000000000000000000/3)`.

Use these canonical lexical choices before comparing:

- ASCII digits; lowercase `0f`, `0x`, `0b`, `e` and `p`; uppercase hexadecimal digits.
- No spaces, underscores, redundant leading zeros, exponent `+`, or zero
  exponent. Keep the required integer digit before a decimal or hexadecimal
  point (`0.5`, not `.5`). No trailing fractional zeros. Do not emit an `e` or
  `p` exponent whose magnitude exceeds the reader cap of `10000` from
  [Rational literals](rational-literals-and-text.md); prefer another exact
  candidate so printed text always round-trips.
- Fractions have coprime components and denominator greater than one. Their
  parentheses are part of the spelling. Each component uses plain decimal
  integer digits. The sign rule below applies to negative values.

Break ties by this tuple, in order:

1. Source length.
2. Family: decimal, then `0f` decimal, hexadecimal, binary, fraction.
3. Within that family, prefer a spelling without an exponent.
4. ASCII lexicographic order.

Zero prints as `0`. For a negative Rational, select the spelling of its magnitude
and add `-` as part of the literal. Put the sign after the opening parenthesis
for a fraction, as in `(-1/3)` or `(-1/3)e20`. Put it before the magnitude in
the other families, as in `-0.5` or `-0x1p-20`. The sign adds one character in
every family, so the same selection rules apply.

Canonical output depends on the mathematical value, not its input spelling or
construction history. A value need not originate from `0f` syntax to print in
that form. Binary spellings participate for completeness; an equal-length
hexadecimal spelling wins the family tie.

This is shortest exact Rational value text, not shortest executable Code.
An ordinary division application remains an application when printing Code;
do not evaluate or fold it into a literal. The Code printer uses canonical
numeric text for numeric atoms and retains the surrounding tree and packs.
Print prefix negation of a numeric atom as an application, as in `-(0.5)`,
to preserve its tree when read back.

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

[rational-text.test](../tests/numeric/rational-text.test) covers the candidate
families, tie-breaks, exponent placement, and typed round trips.
[code-text.test](../tests/numeric/code-text.test) covers Code round trips.
Compare candidate lengths without materializing needlessly long losing expansions.

