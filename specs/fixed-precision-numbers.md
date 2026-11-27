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
[refinement evidence](refinement-evidence.md); this numeric spec
does not redefine them.

## Rename map

| Role | Earlier name | Destination |
| --- | --- | --- |
| Exact primitive | `Rational` / `ExactRational` | `NumericValue` |
| Fixed non-complex union | draft tip `Rational`; earlier draft `Number` of ints/floats | `Real` |
| Fixed complex union | (none) | `Complex` |
| All fixed-width numbers | `Number` (L9: removed for now) | `Number` = `Real \| Complex` |
| Fixed fraction format | `FractionM` / `RatioM` / `RationalM` | `RatioW` (total width; see below) |

## Types and representation

Define the public types, aliases, operators and explicit conversions in the
source prelude. Each fixed format is a prelude struct over `NumericValue`: a
concrete carveout with its own boundary. Its `Predicate` enum member checks
whether the exact value fits the format. The predicate prints as an unquoted
case name under the
[initial predicate contract](refinement-predicates.md).
For example:

    type Int64 struct NumericValue .where fitsInt64
    type Float64 struct NumericValue .where fitsFloat64

Short names are ordinary bindings of those type values (no `type` keyword, no
separate alias syntax):

    Int = Int64
    Float = Float64

A plain alias is not a written single-member abstract union. Forms such as
`type X pattern Int64` or `abstract Int64` remain allowed and still count as
abstract ([#113](https://github.com/johnwarden/pattern-language/pull/113));
they are a different construct from `Int = Int64`. `Int` and `Int64` are the
same type descriptor; likewise `Float` and `Float64`. Functions over `Int`
are ordinary concrete functions, not `PolymorphicValue`s. There is no
preferred display name: values of type `Int` may print as `Int64`. This
document does not decide how a one-member abstract union compares to its
member.

```pattern
todo test "Int and Int64 are the same type descriptor"
  assert Int === Int64
end

todo test "Float and Float64 are the same type descriptor"
  assert Float === Float64
end

todo test "A function over Int is not a PolymorphicValue"
  f = (x :: Int) -> x
  assert not(f .matches PolymorphicValue)
end
```

| Family | Proposed domain | Initial scope |
| --- | --- | --- |
| Signed and unsigned integers | `IntW` holds integers from −2^(W−1) through 2^(W−1)−1. `UIntW` holds integers from 0 through 2^W−1. | Initial formats: `Int32`, `Int64`, `UInt64`. |
| Binary floats | `Float32` and `Float64` hold the exact real `NumericValue`s representable by their finite binary formats, including subnormals and zero. | Reuse exact-fit predicates and explicit conversions. |
| Fixed-size ratios | A reduced real fraction whose numerator and denominator are signed limbs that together use `W` bits. | `Ratio64`, `Ratio128`, … |
| Complex | `Complex(T)` for a fixed real format `T` holds a complex `NumericValue` whose real and imaginary parts fit `T`. | Designated by a single numeric literal when both parts fit. |

All floats are finite and zero has one exact value. Operations and conversions
return that same zero for an exact zero result of either sign. IEEE specials
remain deferred (**D17**). Decimal float formats remain deferred; when added
they join the `Real` union.

### Ratio width naming

The width suffix on `RatioW` is the **total** encoded width, matching `Int64`
and `Float64`. Each ratio stores two equal signed limbs (numerator and
denominator) in reduced form with a positive denominator:

- `Ratio64` — two `Int32` halves
- `Ratio128` — two `Int64` halves

## Real, Complex and Number

    type Real pattern Int32 | Int64 | UInt64 | Float32 | Float64 | Ratio64 | Ratio128 | ...
    type Complex pattern Complex(Float32) | Complex(Float64) | Complex(Ratio64) | Complex(Ratio128) | ...
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
the result whenever both expressions are valid there. An expected refinement
can be checked on any constant expression, including a name bound to a constant.
A runtime parameter needs evidence for its value. See
[refinement evidence](refinement-evidence.md#checking-a-constant-expression).

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

Binary arithmetic takes two successive argument packs. A mixed signature
supplies the required fit refinement for its exact operand. The checker can
establish fit by evaluating a constant expression, including a name bound to a
constant or a computation. A runtime operand needs evidence from its type or
an earlier explicit check. These rules apply to infix calls, successive-pack
calls and saved partials. A result annotation supplies no backward overload
selection.

Unary negation is `-(X)`. The complete binary subtraction application is
`(-(X))(Y)`, corresponding to `X - Y`. Binary subtraction has no one-pack
partial application.

## Checked conversion

`checkedConvert(T)(x)` takes a fixed numeric format `T` and a `NumericValue`.
It returns a value of type `T` if the value fits exactly. Otherwise it fails
with `E_NOT_EXACTLY_REPRESENTABLE`. Stored values and results of exact
arithmetic use the same operation.

An ascription or binding alone follows the
[refinement evidence](refinement-evidence.md) rules. Explicit converters such
as `float64(x)` may round and use the floating failure rules. Integer
conversion always checks exact fit. A bound constant such as `a = 1` can
establish fit for a call to `def f(x :: Int32) x`; a runtime `NumericValue`
without evidence cannot. See
[refinement evidence](refinement-evidence.md#checking-a-constant-expression).

```pattern
test "Checked conversion validates stored and computed exact values"
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
| Two fixed integers | Smallest supported integer format containing both operand ranges | Ratio with twice the wider operand's width |
| Two fixed binary floats | Wider of the two formats | Wider of the two formats |
| One fixed integer and one fixed binary float | `Float64` | `Float64` |
| One fixed integer `I` and one refined `NumericValue` | `I`, with the fit refinement for `I` on the exact operand | Ratio with twice the width of `I`, with the same fit refinement |
| One fixed binary float `F` and one `NumericValue` | `F`, with the fit refinement for `F` on the exact operand | `F`, with the same fit refinement |
| Two fixed ratios | Wider of the two ratios | Wider of the two ratios |
| One fixed ratio `RatioW` and one fixed integer of width `V` | Wider of `RatioW` and the ratio with width `2V` | Same format as the other operations |
| One fixed ratio and one fixed binary float | `Float64` | `Float64` |
| One fixed ratio `RatioW` and one refined `NumericValue` | `RatioW`, with the fit refinement for `RatioW` on the exact operand | `RatioW`, with the same fit refinement |
| Two `NumericValue`s | `NumericValue` | `NumericValue` |

An equal-format integer pair keeps its format for `+`, `-` and `*`. For
example, `Int32 + Int64` returns `Int64`. No initial integer format contains
both `Int64`'s and `UInt64`'s ranges, so that pair needs an explicit
conversion for integer-valued arithmetic. Its division has an exact
`Ratio128` result when the reduced quotient fits. Complex promotion is
deferred.

Project fixed operands to their exact `NumericValue` payloads and perform
the operation in source order. For a ratio result, reduce the exact fraction
and make its denominator positive before checking both limbs. For an
integer result, check its range. For a float result, round once after the
exact operation. In particular, an integer or ratio operand can take part
in a floating operation even when it has no exact representation as a float.
An exact result outside its selected integer or ratio format fails with
`E_OVERFLOW`.

The fit cases for mixed ratio signatures are `fitsRatio64`, `fitsRatio128`,
and their counterparts for any additional supported widths. A real
`NumericValue` fits when its reduced numerator and positive denominator
fit the two signed limbs. Mixed float signatures use the corresponding
float fit refinement. The rules below for checking constant expressions and
using evidence for runtime inputs apply to mixed integer, ratio and float
signatures.

### Mixed signatures and fit evidence

Each fixed integer format has a fit predicate that requires a real integral
value within that format's range. Use it on the exact operand in either order.
For example, the signatures for `Int64` addition are:

    def +(left :: Int64)(right :: (NumericValue .where fitsInt64)) :: Int64
    def +(left :: (NumericValue .where fitsInt64))(right :: Int64) :: Int64

Use the same pair of base operand patterns for `-`, `*`, `/`, `.div`,
`.flDiv`, and `%`, with each operator's own result format. Division and
remainder also require the divisor's nonzero refinement. For `Int32` use
`fitsInt32`. For `UInt64` use `fitsUInt64`. The refined operand still has
concrete type `NumericValue`. Numeric equality and ordering compare
magnitudes across type boundaries regardless of fit.

The concrete operand determines which fit refinement the exact operand
needs. Compare complete operand packs to establish overload
disjointness. Several definitions can continue after the same first pack when
their complete domains are disjoint. When both operands directly belong to
`NumericValue`, use the exact operation. Once the concrete operand selects a
mixed signature, a constant expression can establish the required predicate
by designation. A failed constant fit reports `E_NOT_EXACTLY_REPRESENTABLE`.
A runtime operand that lacks evidence reports `E_NO_METHOD`. An explicit
`.matches` check or a checked conversion can establish fit for a runtime value.

A saved partial retains constant arguments for checking when the complete
signature is known, together with any existing evidence for captured runtime
arguments. Overload disjointness is checked on complete domains with predicates
erased. Calls designate their arguments against the union of those domains
under [the refinement evidence rules](refinement-evidence.md#union-bindings-and-overloaded-calls).

```pattern
todo test "A saved addition partial accepts direct and mixed second operands"
  type Fits64 pattern NumericValue .where fitsInt64
  n = 41 :: Int
  (one :: Fits64) = 1
  add = +
  addToN = add(n)
  addToOne = add(one)
  addToLiteral = add(1)

  expect n + one is 42 :: Int64
  expect add(n)(one) is 42 :: Int64
  expect addToN(one) is 42 :: Int64
  expect addToN(1 :: Int) is 42 :: Int64
  expect one + n is 42 :: Int64
  expect 1 + n is 42 :: Int64
  expect addToOne(n) is 42 :: Int64
  expect addToLiteral(n) is 42 :: Int64
  expect addToOne(2) is 3 :: NumericValue
  expect addToN(0.5) fails "E_NOT_EXACTLY_REPRESENTABLE"
end

todo test "A computed NumericValue constant can establish mixed integer fit"
  n = 41 :: Int64
  raw = 0 + 1
  expect n + raw is 42 :: Int64
  expect raw + n is 42 :: Int64
  add = +
  saved = add(raw)
  expect saved(n) is 42 :: Int64
end

todo test "A runtime NumericValue needs fit evidence for a mixed integer call"
  type Fits64 pattern NumericValue .where fitsInt64
  n = 41 :: Int64
  def checked(raw :: NumericValue)
    if raw .matches Fits64
      n + raw
    else
      0 :: Int64
    end
  end
  def checkedReverse(raw :: NumericValue)
    if raw .matches Fits64
      raw + n
    else
      0 :: Int64
    end
  end
  expect checked(1) is 42 :: Int64
  expect checkedReverse(1) is 42 :: Int64
  expect
    def unchecked(raw :: NumericValue) n + raw
    "defined"
  fails "E_NO_METHOD"
  expect
    def uncheckedReverse(raw :: NumericValue) raw + n
    "defined"
  fails "E_NO_METHOD"
end

todo test "Mixed integer literal fit requires both integrality and range"
  n = 1 :: Int32
  u = 1 :: UInt64
  expect n + 2147483648 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect 0.5 + n fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect u + (-1) fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect (2147483647 :: Int32) + 1 fails "E_OVERFLOW"
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
  assert (double - narrow) == (0 - 0.75)
  expect large - exactlyPowerOfTwo is 1 :: Float64
end
```

## Exponentiation

The prelude exposes exponentiation as `pow(base, exponent)` with both
positional arguments in one pack. The token `^` remains available for
language-specific operator definitions. See [infix grouping](arithmetic-grouping.md).

The bootstrap `^` raises a real or complex `NumericValue` to a nonnegative
integer exponent. It computes the result exactly and returns `1` at exponent
zero.

```pattern
test "Bootstrap powers keep exact real and complex results"
  expect 1/3 ^ 2 is 1/9 :: NumericValue
  expect 2i ^ 2 is (-4) :: NumericValue
  assert (1+2i ^ 2) == (-3+4i)
  assert (2i ^ 3) == (-8i)
  expect 2i ^ 0 is 1 :: NumericValue
  expect 2i ^ -1 fails "result exceeds safe numeric range"
  expect 2i ^ 0.5 fails "result exceeds safe numeric range"
  expect 2i ^ 1i fails "expected a real exponent for ^"
end

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

## Division and remainder signatures

Every `/`, `.div`, `.flDiv` and `%` signature requires `isNonZero` on its
right operand in addition to the operand's type and any fit refinement.
For complex values, the predicate is true when either coefficient is
nonzero. For example:

    type NonZeroInt32 pattern Int32 .where isNonZero
    type FitsInt32 pattern NumericValue .where fitsInt32
    type NonZeroInt32Literal pattern FitsInt32 .where isNonZero

    def /(left :: Int32)(right :: NonZeroInt32) :: Ratio64
    def /(left :: Int32)(right :: NonZeroInt32Literal) :: Ratio64
    def /(left :: FitsInt32)(right :: NonZeroInt32) :: Ratio64

Every valid call has evidence that its divisor is nonzero under
[the refinement evidence rules](refinement-evidence.md).
An expected nonzero divisor type triggers checking for any constant expression.
A constant zero, including a name bound to zero, fails with
`E_REFINEMENT_FAILED`. A runtime divisor without evidence fails with
`E_NO_METHOD`. An explicit `.matches` check can supply the evidence in its
true branch. These rules apply before evaluation, including calls through
successive packs or saved partials. A fraction atom with a zero denominator
fails during reading with `E_SYNTAX`.

Fixed-width arithmetic depends on the implementation of refinement
predicates, evidence, and refined signatures. Its executable contracts
remain todo until those facilities are available.

## Integer division and remainder

`/` on two fixed integers returns an exact reduced ratio. Two `Int32`s
return `Ratio64`. A pair involving `Int64` or `UInt64` returns
`Ratio128`. With a fixed integer and an exact operand satisfying that
integer's fit refinement, use the ratio corresponding to the fixed
integer's width. The result format depends on the operand formats, so a
whole-number quotient also retains its ratio type. Reduce and normalize the
quotient before checking the limbs. This lets large operands cancel while
still detecting an unrepresentable result, for example a positive
denominator of `2147483648` in `Ratio64`. Two `NumericValue` operands
give an exact `NumericValue` quotient.

| Operator | Definition |
| --- | --- |
| `.div` | Integer quotient rounded toward zero |
| `.flDiv` | Integer quotient rounded toward negative infinity |
| `%` | Truncated remainder `a - q * b`, with `q` the mathematical quotient truncated toward zero as an unbounded integer |

All three require integers and use the nonzero divisor refinement.
With two fixed integers, use the same result format as `+`. `Int32` with `Int64` yields `Int64`. If no initial format contains
both ranges, as with `UInt64` and `Int64`, the call requires an explicit
conversion. With one fixed integer and one `NumericValue`, use the fixed
integer's result format and require its fit refinement on the exact operand.
With two `NumericValue` operands, the result is `NumericValue` and both
operands must have real integral magnitudes. Non-integer operands in an
integer-only operation fail with `E_NOT_INTEGER_OPERAND`; a literal rejected
by a mixed integer signature uses the fit diagnostic above.
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

test "Checked integers reject unrepresentable results"
  maxInt = 9223372036854775807 :: Int
  expect maxInt + (1 :: Int) fails "E_OVERFLOW"
  minInt = -9223372036854775808 :: Int
  expect
    -(minInt)
  fails "E_OVERFLOW"
  expect (2147483647 :: Int32) + (1 :: Int32) fails "E_OVERFLOW"
  expect (0 :: UInt64) - (1 :: UInt64) fails "E_OVERFLOW"
end

todo test "Signed minimum divided by -1 overflows for .div"
  minInt = -9223372036854775808 :: Int
  expect minInt .div (-1) fails "E_OVERFLOW"
end

test "Fixed-width integer types designate exact integers in range"
  expect 2147483647 :: Int32 is 2147483647 :: Int32
  expect 0.5 :: Int32 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect (-1) :: UInt64 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect 18446744073709551615 :: UInt64 is 0xFFFFFFFFFFFFFFFF :: UInt64
  expect (20 :: Int32) + (22 :: Int32) is 42 :: Int32
  expect (1 :: Int64) + (2 :: Int64) is 3 :: Int
end

todo test "Integer division returns an exact ratio selected by operand width"
  type NonZeroInt32 pattern Int32 .where isNonZero
  n = 1 :: Int32
  (ten :: NonZeroInt32) = 10
  wide = 1 :: Int64
  unsigned = 18446744073709551615 :: UInt64

  expect n / ten is 1/10 :: Ratio64
  expect wide / ten is 1/10 :: Ratio128
  expect n / (-2) is (-1/2) :: Ratio64
  expect 20 / ten is 2 :: Ratio64
  expect unsigned / (18446744073709551615 :: UInt64) is 1 :: Ratio128
  expect unsigned / (1 :: UInt64) fails "E_OVERFLOW"
  expect n / (-2147483648) fails "E_OVERFLOW"
  expect (2 :: Int32) / (-2147483648) is (-1/1073741824) :: Ratio64
end

todo test "Division and remainder reject literal zero during designation"
  n = 1 :: Int32
  expect n / 0 fails "E_REFINEMENT_FAILED"
  expect n / (0 :: Int32) fails "E_REFINEMENT_FAILED"
  expect n .div 0 fails "E_REFINEMENT_FAILED"
  expect n .flDiv 0 fails "E_REFINEMENT_FAILED"
  expect n % 0 fails "E_REFINEMENT_FAILED"
  expect (1/3 :: Ratio64) / (0 :: Ratio64) fails "E_REFINEMENT_FAILED"
  expect 1i / 0i fails "E_REFINEMENT_FAILED"
end

todo test "A constant divisor can establish nonzero evidence at the call"
  n = 1 :: Int32
  d = 3 :: Int32
  z = 0 :: Int32
  expect n / d is 1/3 :: Ratio64
  expect n .div d is 0 :: Int32
  expect n .flDiv d is 0 :: Int32
  expect n % d is 1 :: Int32
  expect n / z fails "E_REFINEMENT_FAILED"
end

todo test "A runtime divisor needs nonzero evidence in the call scope"
  type NonZeroInt32 pattern Int32 .where isNonZero
  n = 1 :: Int32
  def checked(d :: Int32)
    if d .matches NonZeroInt32
      n / d
    else
      0 :: Ratio64
    end
  end
  expect checked(3 :: Int32) is 1/3 :: Ratio64
  expect checked(0 :: Int32) is 0 :: Ratio64
  expect
    def unchecked(d :: Int32) n / d
    "defined"
  fails "E_NO_METHOD"
end

todo test "Truncated and floored quotients differ for a negative dividend"
  minInt32 = -2147483648 :: Int32
  negFive = 0 - 5
  assert (negFive .div 2) == (0 - 2)
  assert (1 .div 2) == 0
  assert (negFive .flDiv 2) == (0 - 3)
  expect (-5 :: Float) .div 2 fails "E_NOT_INTEGER_OPERAND"
  expect minInt32 .div (-1) fails "E_OVERFLOW"
  expect minInt32 .flDiv (-1) fails "E_OVERFLOW"
end

todo test "Truncated remainder checks only the returned result"
  minInt32 = -2147483648 :: Int32
  negFive = 0 - 5
  assert (negFive % 2) == (0 - 1)
  expect minInt32 % (-1) is 0 :: Int32
  expect minInt32 % 0 fails "E_REFINEMENT_FAILED"
  expect (-5 :: Float) % 2 fails "E_NOT_INTEGER_OPERAND"
end

todo test "Integer quotient and remainder use the supported result format"
  a = 7 :: Int32
  type NonZeroInt64 pattern Int64 .where isNonZero
  (b :: NonZeroInt64) = 2
  u = 7 :: UInt64
  expect a .div b is 3 :: Int64
  expect a .flDiv 2 is 3 :: Int32
  expect a % 2 is 1 :: Int32
  expect a % 2147483648 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect u .div b fails "E_NO_METHOD"
end

todo test "Floating division checks zero and underflow"
  zero = 0 :: Float64
  smallest = 0x1p-1074 :: Float64
  expect zero / (-2) is 0 :: Float64
  expect smallest / 1 is 0x1p-1074 :: Float64
  expect smallest / 2 fails "E_UNDERFLOW"
  expect smallest / 0 fails "E_REFINEMENT_FAILED"
end
```

## Fixed ratios and complexes from literals

One `NumericValue` literal can designate a fixed ratio or complex format
when it fits.

```pattern
todo test "Ratio and complex formats designate from NumericValue literals"
  x = parse(Ratio64)("1/3")
  assert (x * 2) === parse(Ratio64)("2/3")
  y = parse(Complex(Ratio64))("1+1i")
  assert pow(y, 2) === parse(Complex(Ratio64))("2i")
end

todo test "Mixed ratio arithmetic selects a format and keeps the exact quotient"
  narrow = 1/3 :: Ratio64
  wide = 1/6 :: Ratio128
  integer = 2 :: Int64
  binary = 0.5 :: Float32
  expect narrow + wide is 0.5 :: Ratio128
  expect narrow - integer is (-5/3) :: Ratio128
  expect integer - narrow is 5/3 :: Ratio128
  expect narrow + binary is 0f0.8333333333333334 :: Float64
  expect (1/5) + narrow is 8/15 :: Ratio64
  expect narrow / (2/5) is 5/6 :: Ratio64
  expect narrow / (2 :: Int64) is 1/6 :: Ratio128
  expect (2 :: Int32) / (1/3 :: Ratio64) is 6 :: Ratio64
end

todo test "Ratio arithmetic needs fit evidence and checks the reduced result"
  type FitsRatio64 pattern NumericValue .where fitsRatio64
  narrow = 1/3 :: Ratio64
  raw = 1/5
  (checked :: FitsRatio64) = 1/5
  large = 2147483647 :: Ratio64
  expect narrow + raw is 8/15 :: Ratio64
  expect narrow + checked is 8/15 :: Ratio64
  expect
    def unchecked(value :: NumericValue) narrow + value
    "defined"
  fails "E_NO_METHOD"
  expect narrow + (1/2147483648) fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect large * 2 fails "E_OVERFLOW"
  expect large * (1/2147483647) is 1 :: Ratio64
end
```

## Operations that can produce non-real or irrational results

Operations such as `sqrt`, `exp`, `log` and trigonometric functions can leave
the exact real domain. Define them on fixed floating and complex formats.
Prelude signatures that require refinements such as `nonNegative` or `isNonZero`
follow [refinement evidence](refinement-evidence.md); this spec does not
redefine missing-evidence diagnostics.

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


## Bootstrap arithmetic and conversion contracts

```pattern
test "Bootstrap Int addition preserves its operand format"
  a = 1 :: Int
  b = 2 :: Int

  expect a + b is 3 :: Int
end

test "An exact literal can be added to Int"
  legacy expect (3 :: Int) + 1 fails "same concrete numeric type"
  todo expect (3 :: Int) + 1 is 4 :: Int64
end

test "Inexact Float designation"
  expect 0.1 :: Float fails "E_NOT_EXACTLY_REPRESENTABLE"
end

test "A literal with several fixed formats is ambiguous in Number"
  legacy expect 0.1 :: Number fails "unbound"
  todo expect 0.1 :: Number fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end

test "An exact literal can be added to Float32"
  legacy expect float32(0.5) + 0.5 fails "same concrete numeric type"
  todo expect float32(0.5) + 0.5 is 1 :: Float32
end

test "Float32 equality compares magnitudes with an exact literal"
  legacy expect float32(0.5) == 0.5 fails "different concrete types cannot be compared"
  todo expect float32(0.5) == 0.5 is True :: Bool
end

test "Numeric conversions preserve format and equality compares magnitudes"
  expect float64(0.5) is 0.5 :: Float64
  expect float32(0.5) is 0.5 :: Float32
  observed = type Float64
  expect observed is Float64 :: Type
  expect
    type Num
  fails "E_UNBOUND_TYPE"
  expect
    type Int64
  is Int :: Type
  assert (type Int) === (type Int64)
  expect
    type Int32
  is Int32 :: Type
  expect
    type UInt64
  is UInt64 :: Type

  legacy expect float32(0.5) == float64(0.5) fails "E_INCOMPARABLE_TYPES"
  todo expect float32(0.5) == float64(0.5) is True :: Bool
end

test "C03 exact designation differs from rounding"
  expect 0.5 :: Float32 is 0.5 :: Float32
  expect float32(0.5) is 0.5 :: Float32
  todo expect 0f0.5 :: Decimal32 is 0.5 :: Decimal32
  expect 0f0.1 :: Float64 is 0f0.1 :: Float64
  assert (0f0.1 :: Float64) == (0x1.999999999999Ap-4 :: Float64)
  expect 0.1 :: Float64 fails "E_NOT_EXACTLY_REPRESENTABLE"
  expect 0.1 :: Float32 fails "E_NOT_EXACTLY_REPRESENTABLE"
  assert 0.5 .matches Float32
  assert not(0.1 .matches Float32)
  assert 0.5 .matches Float
  assert not(0.1 .matches Float)
  assert 0f0.1 .matches Float
  expect 0.5 :: Float is 0.5 :: Float

  todo expect
    (0.5 :: Int16)
  fails "not an integer"
end

test "smallest subnormal round-trips through Float and text"
  minSub = 0f5e-324
  assert minSub .matches Float
  assert toFloat(minSub) == (minSub :: Float)
  assert parse(Float)(toString(Float)(minSub :: Float)) == (minSub :: Float)
  assert minSub == 0x1p-1074
  expect 0x1p-1074 is 0f3e-324 :: NumericValue
end

test "very-small normal round-trips through Float and text"
  smallNormal = 0x1p-1022
  assert smallNormal .matches Float
  assert toFloat(smallNormal) == (smallNormal :: Float)
  assert parse(Float)(toString(Float)(smallNormal :: Float)) == (smallNormal :: Float)
  expect 0x1p-1022 is 0x1p-1022 :: NumericValue
end

test "Prefix minus preserves concrete numeric types and finite float ranges"
  integer = -(1 :: Int)
  singlePrecision = -(1 :: Float32)
  doublePrecision = -(1 :: Float64)

  expect integer is
    -1 :: Int
  end
  expect singlePrecision is
    -1 :: Float32
  end
  expect doublePrecision is
    -1 :: Float64
  end

  large64 = 0x1p1023 :: Float64
  negative64 = -large64
  assert negative64 < (0 :: Float64)
  assert (-negative64) == large64
  assert parse(Float64)(toString(Float64)(negative64)) == negative64

  large32 = 0x1p100 :: Float32
  negative32 = -large32
  assert negative32 < (0 :: Float32)
  assert (-negative32) == large32

  subnormal = 0x1p-1074 :: Float64
  negativeSubnormal = -subnormal
  assert negativeSubnormal < (0 :: Float64)
  assert (-negativeSubnormal) == subnormal
end
```
