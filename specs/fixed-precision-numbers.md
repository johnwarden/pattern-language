# Fixed-width numbers in the prelude

Source of truth for fixed-width numeric types, aliases, unions, operators and
conversions. Literals and canonical atom text live in
[numeric literals and exact text](numeric-literals-and-text.md). This document
follows the NumericValue model from PR
[#86](https://github.com/johnwarden/pattern-language/pull/86) and supersedes the
earlier ExactRational-only draft on that branch.

[D04 and D09](../design/LANGUAGE-DECISIONS.md) establish exact literals, exact
designation and explicit projection. Refinement evidence and missing-evidence
outcomes for refined parameters are specified in
[#89](https://github.com/johnwarden/pattern-language/pull/89); this numeric spec
does not redefine them.

## Rename map

| Role | Earlier name | Destination |
| --- | --- | --- |
| Exact primitive | `Rational` / `ExactRational` | `NumericValue` |
| Fixed non-complex union | draft tip `Rational`; earlier draft `Number` of ints/floats | `Real` |
| Fixed complex union | (none) | `Complex` |
| All fixed-width numbers | `Number` (L9: removed for now) | `Number` = `Real \| Complex` |
| Fixed fraction format | `FractionM` / `RatioM` / `RationalM` | `RatioW` (see open question) |

## Types and representation

Define the public types, aliases, operators and explicit conversions in the
source prelude. Each fixed format is a prelude struct over `NumericValue`: a
concrete carveout with its own boundary. Its `Predicate` enum member checks
whether the exact value fits the format. The predicate prints as an unquoted
case name under the
[initial predicate contract](https://github.com/johnwarden/pattern-language/blob/spec/type-expressions-and-kinds/specs/refinement-predicates.md).
For example:

    type Int64 struct NumericValue .where fitsInt64
    type Float64 struct NumericValue .where fitsFloat64

Short names use abstract single-member aliases:

    type Int abstract Int64
    type Float abstract Float64

Values keep the concrete member's identity. `Int` and `Int64` as type
descriptors need not compare `===`; see open questions in `#88` on singleton
abstract policy.

| Family | Proposed domain | Initial scope |
| --- | --- | --- |
| Signed and unsigned integers | `IntW` holds integers from −2^(W−1) through 2^(W−1)−1. `UIntW` holds integers from 0 through 2^W−1. | Initial formats: `Int32`, `Int64`, `UInt64`. |
| Binary floats | `Float32` and `Float64` hold the exact real `NumericValue`s representable by their finite binary formats, including subnormals and zero. | Reuse exact-fit predicates and explicit conversions. |
| Fixed-size ratios | A reduced real fraction whose numerator and denominator fit the chosen limb limits. | See open question on `Ratio64` width. |
| Complex | `Complex(T)` for a fixed real format `T` holds a complex `NumericValue` whose real and imaginary parts fit `T`. | Designated by a single numeric literal when both parts fit. |

All floats are finite and zero has one exact value. Operations and conversions
return that same zero for an exact zero result of either sign. IEEE specials
remain deferred (**D17**). Decimal float formats remain deferred; when added
they join the `Real` union.

### Open question

- **Name and limb width for fixed ratios.** Recommendation: call the format
  `Ratio64` and store two signed 64-bit limbs (numerator and denominator) in
  reduced form with positive denominator. Reason: avoids overloading `Rational`
  / `NumericValue`, and makes the bit budget explicit.

## Real, Complex and Number

    type Real pattern Int32 | Int64 | UInt64 | Float32 | Float64 | Ratio64 | ...
    type Complex pattern Complex(Float32) | Complex(Float64) | Complex(Ratio64) | ...
    type Number pattern Real | Complex

`NumericValue` is outside these unions: a bare literal has type `NumericValue`
until designated or ascribed into a fixed format.

Numeric equality (`==`) accepts operands of type
`Number | NumericValue` and compares exact mathematical values (including
complexes). Numeric inequality (`!=`) is its complement.

Ordering (`<`, `<=`, `>`, `>=`) is defined only on real magnitudes: operands of
type `Real | NumericValue` whose values are real (imaginary part zero). Complex
non-reals are outside the ordering domain.

Exact equality (`===`) and inequality (`!==`) require overlapping static domains
and compare values including their concrete types.

If two expressions have the same static type and compare exactly equal with
`===`, substituting one for the other in an evaluated value position preserves
the result whenever both expressions are valid there. Literal designation can
make one expression valid where a binding with the same value lacks evidence;
see [#89](https://github.com/johnwarden/pattern-language/pull/89).

```pattern
todo test "Numeric equality compares a Real with an exact literal"
  (x :: Real) = 0 :: Int
  expect x === 0 fails "E_INCOMPARABLE_TYPES"
  expect x !== 0 fails "E_INCOMPARABLE_TYPES"
  assert x == 0
  assert not(x != 0)
end

todo test "Ordering is not defined on non-real complexes"
  z = parse(Complex(Float64))("1+1i")
  expect z < 2 fails "E_INCOMPARABLE_TYPES"
end
```

## Operator calls and exact literals

Binary arithmetic takes two successive argument packs. A numeric literal and
the same exact value stored in a variable both have type `NumericValue`. An
operator that supports mixed operands admits that type in its signature and
performs any exact-fit check within its definition. These rules apply to infix
calls, successive-pack calls and saved partials. A result annotation supplies
no backward overload selection.

Unary negation is `-(X)`. Binary subtraction is not partially applicable:
write `(-(X))(Y)` for a partial subtraction; `-(X)` is always negation.
Reason: Jonathan's ruling on PR #86.

## Checked conversion

`checkedConvert(T)(x)` takes a fixed numeric format `T` and a `NumericValue`.
It returns a value of type `T` if the value fits exactly. Otherwise it fails
with `E_NOT_EXACTLY_REPRESENTABLE`. Stored values and results of exact
arithmetic use the same operation.

An ascription or binding alone follows the refinement evidence rules in
[#89](https://github.com/johnwarden/pattern-language/pull/89). Explicit
converters such as `float64(x)` may round and use the floating failure rules.
Integer conversion always checks exact fit.

```pattern
todo test "Checked conversion validates stored and computed exact values"
  half = 1 / 2
  tenth = 1 / 10
  integer = 20 + 22

  expect checkedConvert(Float32)(half) is 0.5 :: Float32
  expect checkedConvert(Int32)(integer) is 42 :: Int32
  expect checkedConvert(Int32)(half) fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect checkedConvert(Float64)(tenth) fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect float64(tenth) is 0f0.1 :: Float64
end
```

## Mixed arithmetic

Choose the result format from the operator and the concrete operand types. A
variable of type `Real` or `Number` carries its concrete member. Operand order
does not change the result format. It does change the calculation for
subtraction and division.

| Operands | Result of `+`, `-`, `*` | Result of `/` |
| --- | --- | --- |
| Two fixed integers | Smallest supported integer format containing both operand ranges | `Float64` |
| Two fixed binary floats | Wider of the two formats | Wider of the two formats |
| One fixed integer and one fixed binary float | `Float64` | `Float64` |
| One fixed format and one `NumericValue` | Check that the exact value fits the fixed format, then use that format | Check the same fit. Use `Float64` if the fixed format is integer, otherwise the fixed float format |
| Two `NumericValue`s | `NumericValue` | `NumericValue` |

An equal-format integer pair keeps its format. For example, `Int32 + Int64`
returns `Int64`. No initial integer format contains both `Int64`'s and
`UInt64`'s ranges; that pair needs explicit conversion for integer-valued
arithmetic. Its `/` result is still `Float64`. Ratio and complex promotion can
be specified when those formats are introduced.

For each supported pair, project fixed operands to their exact `NumericValue`
payloads. Check an exact operand's fit when the table requires it. Compute the
exact operation on the two payloads in source order. Check the integer result
for overflow or round once to the selected float format. Never round integer
operands to float before computing the result. A failed operand fit is
`E_NOT_EXACTLY_REPRESENTABLE`. A fixed integer result outside its range is
`E_OVERFLOW`.

### Prelude definitions for addition

```text
+(left of type L)(right of type R):
  F = result format for (+, L, R)
  check the exact operand's fit when exactly one operand is fixed
  sum = addExact(payload(left), payload(right))
  NumericValue result: return sum
  fixed integer result: check the range and construct F
  fixed float result: round sum once and construct F
```

For each left operand type, use one definition with a named abstract pattern for
the supported right operand types. Dispatch within it on the right operand's
concrete type. When an exact arm follows a fixed arm, test the fixed arm first
or explicitly test the concrete member so an inner payload does not intercept
that arm. A saved partial application accepts the same supported right operands
as the direct call.

```pattern
todo test "A saved addition partial accepts direct and mixed second operands"
  n = 41 :: Int
  one = 1
  add = +
  addToN = add(n)
  addToOne = add(one)

  expect n + one is 42 :: Int
  expect add(n)(one) is 42 :: Int
  expect addToN(one) is 42 :: Int
  expect addToN(1 :: Int) is 42 :: Int
  expect one + n is 42 :: Int
  expect addToOne(n) is 42 :: Int
  expect addToOne(2) is 3 :: NumericValue
  expect addToN(0.5) fails "E_NOT_EXACTLY_REPRESENTABLE"
end

todo test "Mixed arithmetic chooses a format without rounding input operands"
  narrow = 1 :: Int32
  wide = 2 :: Int64
  single = 0.5 :: Float32
  double = 0.25 :: Float64
  large = 9007199254740993 :: Int64
  exactlyPowerOfTwo = 9007199254740992 :: Float64

  expect narrow + wide is 3 :: Int64
  expect single + double is 0.75 :: Float64
  expect wide + single is 2.5 :: Float64
  assert double - narrow == 0 - 0.75
  expect large - exactlyPowerOfTwo is 1 :: Float64
end
```

## Exponentiation

The prelude exposes exponentiation as `pow(base, exponent)` with both
positional arguments in one pack. The token `^` remains available for
language-specific operator definitions. See the
[infix precedence draft](https://github.com/johnwarden/pattern-language/blob/spec/arithmetic-precedence/specs/arithmetic-precedence.md).

```pattern
todo test "Exponentiation uses one complete argument pack"
  expect pow(2, 3) is 8 :: NumericValue
end
```

## Arithmetic policy

An out-of-range fixed integer result fails with `E_OVERFLOW`. This includes
unsigned underflow and negating the signed minimum. Wraparound and
environment-configurable overflow are deferred as a separate later decision.

Floating overflow and underflow fail with `E_OVERFLOW` and `E_UNDERFLOW`.
Underflow occurs when a nonzero exact result rounds to zero. Nonzero subnormal
results are representable. An exact zero result returns the single zero of the
result format. An operation outside its real domain fails with a specific
`E_…` code for that domain error.

Each floating operation rounds its own result before it feeds the next
operation. Round to nearest, ties to even. A successful floating division with
a nonzero numerator returns a nonzero float. A zero numerator and nonzero
divisor give zero.

## Integer division and remainder

`/` on two fixed integers computes their exact quotient and rounds once to
`Float64`. A zero divisor fails with `E_DIVISION_BY_ZERO`. Two `NumericValue`
operands still give an exact quotient.

| Operator | Definition |
| --- | --- |
| `.div` | Integer quotient rounded toward zero |
| `.flDiv` | Integer quotient rounded toward negative infinity |
| `%` | Truncated remainder `a - q * b`, with `q` the mathematical quotient truncated toward zero as an unbounded integer |

All three require integer operands and fail on a zero divisor with
`E_DIVISION_BY_ZERO`. Non-integer operands fail with `E_NOT_INTEGER_OPERAND`.
A nonzero truncated remainder has the dividend's sign and magnitude less than
the divisor's magnitude. Check the range of the returned result. The minimum
signed integer divided by −1 overflows for `.div` and `.flDiv` (`E_OVERFLOW`).
The remainder is zero and fits its format.

Paired quotient-and-remainder operators are not in the initial prelude.

```pattern
todo test "Float64 operands designate exactly and results round"
  x = 1 :: Float64
  expect x + 0.1 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect x + 0f0.1 is 0f1.1 :: Float64
end

todo test "Checked integers reject unrepresentable results"
  maxInt = 9223372036854775807 :: Int
  expect maxInt + 1 fails "E_OVERFLOW"
  minInt = -9223372036854775808 :: Int
  expect minInt .div (-1) fails "E_OVERFLOW"
end

todo test "Integer division returns a rounded Float64 quotient"
  a = 1 :: Int32
  b = 10 :: Int32
  expect a / b is 0f0.1 :: Float64
  expect a / 0 fails "E_DIVISION_BY_ZERO"
end

todo test "Truncated and floored quotients differ for a negative dividend"
  minInt32 = -2147483648 :: Int32
  negFive = 0 - 5
  assert negFive .div 2 == 0 - 2
  assert 1 .div 2 == 0
  assert negFive .flDiv 2 == 0 - 3
  expect (0 - 5 :: Float) .div 2 fails "E_NOT_INTEGER_OPERAND"
  expect minInt32 .div (0 - 1) fails "E_OVERFLOW"
  expect minInt32 .flDiv (0 - 1) fails "E_OVERFLOW"
end

todo test "Truncated remainder checks only the returned result"
  minInt32 = -2147483648 :: Int32
  negFive = 0 - 5
  assert negFive % 2 == 0 - 1
  expect minInt32 % (0 - 1) is 0 :: Int32
  expect minInt32 % 0 fails "E_DIVISION_BY_ZERO"
  expect (0 - 5 :: Float) % 2 fails "E_NOT_INTEGER_OPERAND"
end

todo test "Floating division checks zero and underflow"
  zero = 0 :: Float64
  smallest = 0x1p-1074 :: Float64
  expect zero / (0 - 2) is 0 :: Float64
  expect smallest / 1 is 0x1p-1074 :: Float64
  expect smallest / 2 fails "E_UNDERFLOW"
  expect smallest / 0 fails "E_DIVISION_BY_ZERO"
end
```

## Fixed ratios and complexes from literals

A single `NumericValue` literal can designate a fixed ratio or complex format
when it fits.

Destination sketches (executable once paren-free complex atoms land):

    x = 1/3 :: Ratio64
    expect x * 2 is 2/3 :: Ratio64
    y = 1+1i :: Complex(Ratio64)
    expect pow(y, 2) is 2i :: Complex(Ratio64)

```pattern
todo test "Ratio and complex formats designate from NumericValue literals"
  x = parse(Ratio64)("1/3")
  expect x * 2 is parse(Ratio64)("2/3")
  y = parse(Complex(Ratio64))("1+1i")
  expect pow(y, 2) is parse(Complex(Ratio64))("2i")
end
```

## Operations that can produce non-real or irrational results

Operations such as `sqrt`, `exp`, `log` and trigonometric functions can leave
the exact real domain. Define them on fixed floating and complex formats.
Prelude signatures that require refinements such as `nonNegative` or `nonZero`
follow [#89](https://github.com/johnwarden/pattern-language/pull/89); this spec
does not decide missing-evidence diagnostics.

    def sqrt(n :: Float64 .where nonNegative)
    def sqrt(n :: Complex(N))

A bare exact argument that could designate several supported formats is
ambiguous. An explicit ascription selects one, for example
`sqrt(2 :: Float64)`. Full implementation of these functions may trail the
initial prelude.

## Mixed comparison contracts

```pattern
todo test "Mixed ordering accepts the same exact value in every form"
  n = 2 :: Int
  one = 1
  sum = 1 + 0
  assert n > 0
  assert n < 10
  assert n >= 2
  assert 0 < n
  assert n > -1
  assert n > 1
  assert n > one
  assert n > (1 + 0)
  assert n > sum
  assert one < n
end

todo test "An Int refinement can order its input against an exact zero"
  type PositiveInt pattern Int .where isPositive

  assert (2 :: Int) .matches PositiveInt
  assert not((0 :: Int) .matches PositiveInt)
end

todo test "Numeric equality applies to literal and bound NumericValues"
  n = 2 :: Int
  two = 2
  expect n === 2 fails "E_INCOMPARABLE_TYPES"
  expect n === two fails "E_INCOMPARABLE_TYPES"
  assert n === (2 :: Int)
  assert n == 2
  assert two == n
end

todo test "Numeric ordering compares magnitudes across formats"
  i = 1 :: Int
  half = 0.5 :: Float64
  aboveIntMax = 9223372036854775808
  assert i > half
  assert half < i
  assert i > 0.5
  assert i < aboveIntMax
  assert i >= (1 :: Float64)
  assert i <= (1 :: Float64)
end
```

## Exact equality across Number members

`Number` is `Real | Complex`. Exact equality compares concrete member identity
inside that union: a `Number` holding `Float64` zero is exactly equal to a
concrete `Float64` zero and exactly unequal to a `Number` holding `Int` zero.

```pattern
todo test "Exact equality compares Number with a concrete member"
  (n :: Number) = 0 :: Float64
  (i :: Number) = 0 :: Int
  f = 0 :: Float64

  assert n === f
  assert i !== f
end
```

