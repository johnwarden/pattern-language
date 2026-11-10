# Exact Rational fraction literals and a text form for every Rational

Proposed on 10 November 2026 from [PR #76](https://github.com/johnwarden/pattern-language/pull/76),
reviewed at `5539bc2bc6901dbad6557ed4c70e75abbc761019`. This record is
**awaiting design approval**. The mixed-arithmetic grouping rule is now approved
separately. The fraction spelling, remaining fraction-grouping restriction and
canonical printing choices below remain proposals, even where the PR implements
them.

## Existing contract and intended change

Numeric literals denote unique exact Rational values. Decimal, binary and
hexadecimal spellings do not choose an arithmetic family; `0f` selects a
Float64-rounded Rational. Those rules, exact designation and explicit lossy
conversion remain as described in [VALUE-SPACES.md](../../VALUE-SPACES.md#numeric-values).

Currently an exact non-dyadic result such as `1 / 3` can exist internally but
cannot be serialized. The proposal supplies every finite Rational with an exact
source spelling and makes Rational text round trips available for those values.
It does not introduce a Ratio type or a second numeric family.

## Proposed fraction spelling

A fraction token is one or more ASCII decimal digits, immediately followed by
`/`, immediately followed by one or more ASCII decimal digits. There are no
spaces or separators inside the token. The denominator must denote a positive
integer; an all-zero denominator is a malformed numeric source literal.

Read the numerator and denominator exactly, with no Float64 conversion, then
reduce their ratio. Equivalent fractions denote the same Rational. A denominator
of one gives an integer value; zero has its ordinary Rational identity.

Negative fractions use the existing touching prefix minus: `-1/3` has the same
Code structure as `-(1/3)`. The sign is outside the numeric token. A signed
denominator such as `1/-3` or `1/+3` is not a fraction literal.

The PR's scanner also accepts leading zeros, for example `01/003`. This proposal
records that behavior for review; canonical output drops the leading zeros.
Underscores, decimal points, exponents and base prefixes inside either component
are outside this fraction spelling.

```pattern
test "Fraction literals denote exact reduced Rational values"
  expect 1/3 is 1/3 :: Rational
  expect 2/4 is 0.5 :: Rational
  expect 3/1 is 3 :: Rational
  expect 0/5 is 0 :: Rational
  expect 01/003 is 1/3 :: Rational
  expect 9007199254740993/1 is 9007199254740993 :: Rational
  assert 2/6 == 1/3
  assert ((1/3) * 3) == 1
  assert ((-1/3) * 3) == -1
end

test "A zero denominator is rejected while reading source"
  expect parse(Code)("1/0") fails "malformed numeric source literal"
  expect parse(Code)("2/00") fails "malformed numeric source literal"
end
```

These source-reading errors are distinct from evaluating the infix division
expression `1 / 0`; this proposal does not redefine arithmetic division errors.

## Slash syntax and the agreed arithmetic grouping

Spaced slash remains the existing infix operator. One-sided spacing such as
`1 /3` or `1/ 3` remains invalid. Names still require infix spaces: `a/b`
is not a fraction or an implicit division expression. The existing prefix
application `/3` retains the same Code structure as `/(3)`. Slash is not a
postfix suffix.

```pattern
test "Fraction syntax preserves the existing slash boundaries"
  assert (1 / 3) == 1/3
  assert parse(Code)("/3") == Code` /(3)
  expect parse(Code)("a/b") fails "infix operators require spaces"
  expect parse(Code)("1 /3") fails "infix operators require spaces"
  expect parse(Code)("1/ 3") fails "infix operators require spaces"
  expect parse(Code)("1/-3") fails "infix operators require spaces"
  expect parse(Code)("1/+3") fails "infix operators require spaces"
end
```

Jonathan has now approved [parentheses when mixing arithmetic
operators](../approved/arithmetic-operator-grouping.md): preserve equal precedence
and right associativity; reject an unparenthesized arithmetic chain that mixes
different operators. Thus `a + (b * c)` is valid and `a + b * c` rejects.

**Fraction-literal integration still needs one boundary decision.** A validator
that sees `1/3` only as a numeric atom would not count its slash when checking
`1/3 + 1`. Even counting that slash does not settle repeated division:

| Source under the original PR | Grouped interpretation | Exact result |
| --- | --- | --- |
| `1/2 / 3` | `(1/2) / 3` | `1/6` |
| `1 / 2 / 3` | `1 / (2 / 3)` | `3/2` |

Both forms use only division. The newly agreed mixed-operator restriction alone
does not distinguish them. These consequences follow the existing
[infix contract](../../tests/specification/language.test) and still need to meet
the [formatting-safety contract](../../design/WHITESPACE.md).

Proposed completion: require parentheses around an atomic fraction literal used
as an operand of a larger arithmetic expression, even if that expression also
uses division. Write `(1/2) / 3` or `1 / (2/3)`. This additional restriction
awaits Jonathan's decision; it is not silently included in the approved rule.

The same decision must be applied by the Code reader and canonical printer.
Preserve a standalone `1/3` atom, and print whatever grouping its enclosing
arithmetic context requires after that boundary is settled.

Inputs such as `1/3/2`, `1.0/3`, `1/3e2`, `1/3.5`, `1_0/3` and
`1/3_0` are rejected by the proposed implementation. Focused contracts should
fix any desired lexical-boundary diagnostic before relying on its current wording.

## Proposed canonical Rational text

The PR uses this ordered selection rule, verified in `formatRational`:

1. If the exact reduced value has a terminating decimal with at most **16
   fractional places**, print that decimal. Integers use ordinary decimal
   integer text, including integers larger than Float64 can represent.
2. Otherwise, if the exact value is representable as a finite binary64 value,
   print its exact hexadecimal spelling using the existing formatter.
3. Otherwise print the reduced numerator and positive denominator as `n/d`,
   with a prefix minus for a negative value.

All branches print the same exact Rational. The 16-place limit is a fractional
scale limit, not a significant-digit limit. The hexadecimal branch requires
exact equality after binary64 conversion; it must not round another Rational
merely to obtain a spelling.

| Value or source | Proposed canonical text |
| --- | --- |
| `2/4` | `0.5` |
| `3/1` | `3` |
| `0/5` | `0` |
| `1/3` | `1/3` |
| `-2/6` | `-1/3` |
| `1/10000000000000000` | `0.0000000000000001` |
| `1/100000000000000000` | `1/100000000000000000` |
| `1/1048576` | `0x1p-20` |
| `0f0.1` | `0x1.999999999999Ap-4` |

Thus a fraction input need not print as a fraction. The hexadecimal preference
preserves existing exact binary64 goldens; `0f0.1` is an input example whose
canonical output is hexadecimal, not another printed fraction or `0f` spelling.

```pattern
test "Canonical Rational text follows the proposed selection rule"
  expect toString(Rational)(2/4) is "0.5" :: String
  expect toString(Rational)(3/1) is "3" :: String
  expect toString(Rational)(0/5) is "0" :: String
  expect toString(Rational)(1/3) is "1/3" :: String
  expect toString(Rational)(-2/6) is "-1/3" :: String
  expect toString(Rational)(1/10000000000000000) is "0.0000000000000001" :: String
  expect toString(Rational)(1/100000000000000000) is "1/100000000000000000" :: String
  expect toString(Rational)(1/1048576) is "0x1p-20" :: String
  expect toString(Rational)(0f0.1) is "0x1.999999999999Ap-4" :: String
end

test "Rational text reconstructs the same exact value"
  assert parse(Rational)(toString(Rational)(1/3)) == 1/3
  assert parse(Rational)(toString(Rational)(-2/6)) == -2/6
  assert parse(Rational)(toString(Rational)(1/100000000000000000)) == 1/100000000000000000
  assert parse(Rational)(toString(Rational)(9007199254740993/1)) == 9007199254740993/1
end
```

The exact 16-place cutoff and preference for binary64 hexadecimal text are
separate printing choices requiring approval. Supplying a fraction spelling
does not by itself settle those choices or the canonical format of every
other numeric family.

## Code and typed-text boundaries

A fraction token reads as one exact numeric literal in Code. Prefix negation
retains its application structure. Reading Code is inert; an infix division
expression remains an application rather than becoming a fraction literal.

Different fraction spellings for the same numeric literal may normalize to the
same Code value. Canonical Code text must still reconstruct that Code value,
including the distinction between a numeric atom and infix division.

```pattern
test "Code preserves fraction atoms and division applications"
  assert parse(Code)("1/3") == Code` 1/3
  assert parse(Code)("2/4") == Code` 0.5
  assert parse(Code)("-1/3") == Code` -(1/3)
  assert parse(Code)("1/3") != parse(Code)("1 / 3")
  assert parse(Code)(toString(Code)(Code` 1/3)) == Code` 1/3
  assert parse(Code)(toString(Code)(Code` -1/3)) == Code` -1/3
  assert parse(Code)(toString(Code)(Code` 1 / 3)) == Code` 1 / 3
end
```

Retain a host transfer test proving that canonical Rational text parses to the
same exact value in a fresh interpreter. Source contracts must express numeric
values directly; bootstrap `NumberLiteral` carriers and syntax-node transport
remain host observations rather than new destination-language concepts.

## Migration and approval checklist

- After the remaining fraction-grouping boundary is accepted, add or revise the focused
  executable contracts, starting with the PR's
  [fractions.test](https://github.com/johnwarden/pattern-language/blob/5539bc2bc6901dbad6557ed4c70e75abbc761019/tests/numeric/fractions.test).
  Preserve the infix and prefix controls above.
- Replace the explicit Rational serialization-failure expectation for `1 / 3`
  in [exact-values.test](../../tests/numeric/exact-values.test) with exact-value
  and canonical-text observations. Preserve the arithmetic observation that
  multiplying the explicitly grouped value by three yields one.
- Update [rational-primitives.test.ts](../../test/rational-primitives.test.ts) and
  [round-trip-parsing.test.ts](../../test/round-trip-parsing.test.ts) for the
  native syntax/transport boundary; preserve their distinct coverage.
- Review and accept the print selection rule, including the 16-place boundary,
  exact binary64 condition and leading-zero input policy. Add boundary cases,
  rather than inferring policy from the implementation alone.
- Reconcile the grammar and D04 notes after approval. The PR's reference to a
  "fraction-literal ruling" must not substitute for the pending decision recorded here.

General function, native, accessor, refinement-predicate and nonportable Code
serialization remain outside this proposal. Public descriptor inspection/decoding,
IEEE signed zero, NaN, infinities, rounding/overflow policy and other numeric
families remain at their existing deferred boundaries.
