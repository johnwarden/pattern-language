# Fixed-precision numbers in the prelude

Draft for review. The [fixed-precision notes](https://chatgpt.com/library?file_id=libfile_ea21b8d12df48191b831e95829ad1dbc) propose concrete carveouts of the exact rational type. [D04 and D09](../../design/LANGUAGE-DECISIONS.md) establish exact literals, exact designation and explicit projection. This draft defines the numeric union and proposes operator signatures and arithmetic policies.

## Types and representation

Define the public types, aliases, operators and explicit conversions in the source prelude. Each fixed format is a concrete `ExactRational` carveout. Its membership predicate checks whether the exact value fits the format. For example:

```pattern
type Int64 concrete ExactRational .where fitsInt64
type Float64 concrete ExactRational .where fitsFloat64
```

The initial aliases are `Int = Int64` and `Float = Float64`, with identical type identity under either name. The equations describe aliases. Their declaration spelling follows the language's type binding rules.

| Family | Proposed domain | Initial scope |
| --- | --- | --- |
| Signed and unsigned integers | `IntW` holds integers from −2^(W−1) through 2^(W−1)−1. `UIntW` holds integers from 0 through 2^W−1. | The initial formats are `Int32`, `Int64` and `UInt64`. The same rule can instantiate other widths. |
| Binary floats | `Float32` and `Float64` hold the exact Rationals representable by their finite binary formats, including subnormals and zero. | Reuse the existing exact-fit predicates and explicit conversions. |
| Decimal floats | A format specifies decimal coefficient precision and exponent bounds. Its domain consists of the Rationals expressible within those bounds. | Select the formats and short alias separately. |
| Fixed-size ratios | A reduced fraction with a positive denominator must fit the chosen numerator and denominator limits. | Decide what the width counts before defining `Ratio64` or an alias. |

All floats are finite and zero has one exact value. Operations and
conversions return that same zero for an exact zero result of either sign.
Additional float widths remain open. The prototype currently reserves some numeric names. Moving them to the prelude requires migrating the primitive-name assertions and reconciling the numeric `Int` example in the [approved type-values spec](../approved/type-values.md).

## Number and numeric equality

`Number` is the abstract union of the fixed-precision numeric types defined
in the prelude. An initial union for the formats listed above is:

```pattern
type Number pattern Int32 | Int64 | UInt64 | Float32 | Float64
```

`ExactRational` is outside `Number`. Numeric equality (`==`) accepts operands
of type `Number | ExactRational` and compares their exact mathematical values.
Numeric inequality (`!=`) is its complement. Ordering (`<`, `<=`, `>`, `>=`)
uses the same operand domain and exact magnitudes. Neither operand needs
to fit the other's format.

Exact equality (`===`) and inequality (`!==`) require overlapping static
domains and compare values including their concrete types.
[Functional equality](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#strong-functional-equality)

```pattern
test "Numeric equality compares a Number with an exact literal"
  (x :: Number) = 0 :: Int
  expect x === 0 fails "E_INCOMPARABLE_TYPES"
  expect x !== 0 fails "E_INCOMPARABLE_TYPES"
  assert x == 0
  assert not(x != 0)
end
```

## Operator calls and exact literals

Binary arithmetic takes two successive argument packs. A numeric literal
and the same exact value stored in a variable both have type
`ExactRational`. An operator that supports mixed operands admits that type
in its signature and performs any exact-fit check within its definition.
These rules apply to infix calls, successive-pack calls and saved partials.
A result annotation supplies no backward overload selection.

## Proposed checked conversion

`checkedConvert(T)(x)` takes a fixed numeric format `T` and an
`ExactRational`. It returns a value of type `T` if the rational fits
exactly. Otherwise it panics with the target type and failed fit check.
Stored rationals and results of exact arithmetic use the same operation.

An ascription or binding alone follows the
[refinement evidence rules](refinement-evidence.md) for a stored argument.
The conversion supplies evidence by checking the target's representation
predicate and constructing the value under the target type.

The existing format-specific functions such as `float64(x)` explicitly
round an `ExactRational` to the requested format and use the floating
failure rules. To convert between fixed types explicitly, first project
the source's exact payload. Integer conversion always checks exact fit.

```pattern
test "Checked conversion validates stored and computed exact values"
  half = 1 / 2
  tenth = 1 / 10
  integer = 20 + 22

  expect checkedConvert(Float32)(half) is 0.5 :: Float32
  expect checkedConvert(Int32)(integer) is 42 :: Int32
  expect checkedConvert(Int32)(half) fails "not exactly representable as Int32"
  expect checkedConvert(Float64)(tenth) fails "not exactly representable as Float64"
  expect float64(tenth) is 0f0.1 :: Float64
end
```

## Proposed mixed arithmetic

Choose the result format from the operator and the concrete operand
types. A variable of type `Number` carries its concrete member.
Operand order does not change the result format. It does change the
calculation for subtraction and division.

| Operands | Result of `+`, `-`, `*` | Result of `/` |
| --- | --- | --- |
| Two fixed integers | Smallest supported integer format containing both operand ranges | `Float64` |
| Two fixed binary floats | Wider of the two formats | Wider of the two formats |
| One fixed integer and one fixed binary float | `Float64` | `Float64` |
| One fixed format and one `ExactRational` | Check that the rational fits the fixed format exactly, then use the fixed format | Check the same fit. Use `Float64` if the fixed format is integer, otherwise use the fixed float format |
| Two `ExactRational`s | `ExactRational` | `ExactRational` |

An equal-format integer pair keeps its format. For example, `Int32 + Int64`
returns `Int64`. No initial integer format contains both `Int64`'s and
`UInt64`'s ranges. Such a pair needs explicit conversion for integer-valued
arithmetic. Its `/` result is still `Float64`. Decimal and fixed-ratio
promotion can be specified when those formats are introduced.

For each supported pair, project fixed operands to their exact rational
payloads. Check an exact operand's fit when the table requires it.
Compute the exact operation on the two payloads in source order.
Check the integer result for overflow or round once to the selected float
format. In particular, never round integer operands to float before
computing the result. A failed operand fit is a conversion error. A fixed
integer result outside its range is an arithmetic overflow.

### Prelude definitions for addition

The table below describes how to generate the definition bodies. In this
pseudocode, `payload` projects a fixed number or returns an
`ExactRational` unchanged. `addExact` is the internal exact addition
primitive. The same construction works for subtraction, multiplication
and division with their own operations and result rules.

```text
+(left of type L)(right of type R):
  F = result format for (+, L, R)
  check the exact operand's fit when exactly one operand is fixed
  sum = addExact(payload(left), payload(right))
  ExactRational result: return sum
  fixed integer result: check the range and construct F
  fixed float result: round sum once and construct F
```

For each left operand type, use one definition with a named abstract
pattern for the supported right operand types. Dispatch within it on the
right operand's concrete type. When an exact arm follows a fixed arm,
test the fixed arm first or explicitly test the concrete member so an
inner payload does not intercept that arm. Use the same table for a statically abstract argument by inspecting its
active concrete member. A saved partial application accepts the same
supported right operands as the direct call. Unary minus and the spelling of partial application of
binary subtraction are governed by the operator-call rules.

This uses direct membership of an exact operand in an abstract union
with an explicit `ExactRational` member. A literal such as `1` supplies
that member and reaches the arithmetic definition's fit check. See the
[designation proposal](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#designation-and-ambiguity)
and the [partial-application contract](../../tests/inbox/mixed-addition-partial-application.test).

```pattern
test "Mixed arithmetic chooses a format without rounding input operands"
  narrow = 1 :: Int32
  wide = 2 :: Int64
  single = 0.5 :: Float32
  double = 0.25 :: Float64
  large = 9007199254740993 :: Int64
  exactlyPowerOfTwo = 9007199254740992 :: Float64

  expect narrow + wide is 3 :: Int64
  expect single + double is 0.75 :: Float64
  expect wide + single is 2.5 :: Float64
  expect double - narrow is
    -0.75 :: Float64
  end
  expect large - exactlyPowerOfTwo is 1 :: Float64
end
```

## Exponentiation

The Code prelude exposes exponentiation as `pow(base, exponent)`. Supply
both positional arguments in one pack, for example `pow(2, 3)`. The prelude
leaves `^` available for language-specific operator definitions. See the [infix precedence draft](arithmetic-precedence.md).

```pattern
test "Exponentiation uses one complete argument pack"
  expect pow(2, 3) is 8 :: ExactRational
end
```

## Arithmetic policy

An out-of-range fixed integer result panics. This includes unsigned
underflow and negating the signed minimum. For integer operators with
a fixed integer result, apply the proposed common-format rule above.

Floating overflow and underflow panic. Underflow occurs when a nonzero
exact result rounds to zero. Nonzero subnormal results are representable.
An exact zero result returns the single zero of the result format. For
example, dividing zero by a negative finite float returns zero. An
operation outside its real domain panics.

Each floating operation rounds its own result before it feeds the next
operation. Round to nearest with ties to even is proposed. A successful
floating division with a nonzero numerator returns a nonzero float. A
zero numerator and nonzero divisor give zero.

## Proposed integer division and remainder

`/` on two fixed integers computes their exact quotient and rounds once
to `Float64`. A zero divisor panics. Two `ExactRational` operands still
give an exact quotient.

| Operator | Definition |
| --- | --- |
| `.div` | Integer quotient rounded toward zero |
| `.flDiv` | Integer quotient rounded toward negative infinity |
| `%` | Truncated remainder `a - q * b`, with `q` the mathematical quotient truncated toward zero as an unbounded integer |

All three require integer operands and panic on a zero divisor. A
nonzero truncated remainder has the dividend's sign and magnitude less
than the divisor's magnitude. Check the range of the returned result.
The minimum signed integer divided by −1 overflows for `.div` and
`.flDiv`. The remainder is zero and fits its format.

Integral `ExactRational` operands can also use these three operators.
When both operands are exact rationals, the result is an
`ExactRational` integer. With one fixed integer and one exact rational,
check that the rational fits the fixed integer format. Fixed floats and
fractional rationals fail the integer operand check.

## Future operations that can produce irrational results

Operations such as `sqrt`, `exp`, `log` and trigonometric functions
can return real values outside the `ExactRational` domain. Define each
on fixed floating formats. A unary operation returns the input's
format, rounded from the mathematical result. It uses the same
overflow, underflow, zero and domain rules. This includes inputs for
which the mathematical result happens to be rational.

A bare exact argument that could designate several supported formats
is ambiguous. An explicit float ascription selects one, for example
`sqrt(2 :: Float64)`. These functions are deferred from the initial
prelude implementation.

## Mixed comparison contracts

These cases build on [#79](https://github.com/johnwarden/pattern-language/pull/79).
Support mixed `Int` and `ExactRational` ordering in both operand positions
through the prelude signatures. The same signature and checks apply to a literal,
a bound value, and an arithmetic result with the same exact value.

```pattern
test "Mixed ordering accepts the same exact value in every form"
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

test "An Int refinement can order its input against an exact zero"
  type PositiveInt pattern Int .where (n -> n > 0)

  assert (2 :: Int) .matches PositiveInt
  assert not((0 :: Int) .matches PositiveInt)
end

test "Numeric equality applies to literal and bound ExactRationals"
  n = 2 :: Int
  two = 2
  expect n === 2 fails "E_INCOMPARABLE_TYPES"
  expect n === two fails "E_INCOMPARABLE_TYPES"
  assert n === (2 :: Int)
  assert n == 2
  assert two == n
end
```

```pattern
test "Numeric ordering compares magnitudes across formats"
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

## Candidate contracts

```pattern
test "Exact equality compares Number with a concrete member"
  (n :: Number) = 0 :: Float64
  (i :: Number) = 0 :: Int
  f = 0 :: Float64

  assert n === f
  assert i !== f
end

test "Float64 operands designate exactly and results round"
  x = 1 :: Float64
  expect x + 0.1 fails "not exactly representable as Float64"
  expect x + 0f0.1 is 0f1.1 :: Float64
end

test "Checked integers reject unrepresentable results"
  maxInt = 9223372036854775807 :: Int
  expect maxInt + 1 fails "overflow"
  minInt = -9223372036854775808 :: Int
  expect minInt .div -1 fails "overflow"
end

test "Integer division returns a rounded Float64 quotient"
  a = 1 :: Int32
  b = 10 :: Int32

  expect a / b is 0f0.1 :: Float64
  expect a / 0 fails "division by zero"
end

test "Truncated and floored quotients differ for a negative dividend"
  minInt32 = -2147483648 :: Int32

  expect (-5) .div 2 is
    -2
  end
  expect 1 .div 2 is 0
  expect (-5) .flDiv 2 is
    -3
  end
  expect (-5 :: Float) .div 2 fails ".div only defined for Integer types"
  expect (-5 :: Float) .flDiv 2 fails ".flDiv only defined for Integer types"
  expect minInt32 .div -1 fails "overflow"
  expect minInt32 .flDiv -1 fails "overflow"
end

test "Truncated remainder checks only the returned result"
  minInt32 = -2147483648 :: Int32

  expect (-5) % 2 is
    -1
  end
  expect minInt32 % -1 is 0 :: Int32
  expect minInt32 % 0 fails "division by zero"
  expect (-5 :: Float) % 2 fails "% only defined for Integer types"
end

test "Floating division checks zero and underflow"
  zero = 0 :: Float64
  smallest = 0x1p-1074 :: Float64

  expect zero / -2 is 0 :: Float64
  expect smallest / 1 is 0x1p-1074 :: Float64
  expect smallest / 2 fails "underflow"
  expect smallest / 0 fails "division by zero"
end
```

## Remaining decisions

- Confirm nearest-even rounding, the proposed mixed-format rules and
  checked conversion spelling.
- Confirm the integer division and remainder draft. Decide separately
  whether to expose paired quotient-and-remainder operators.
- Choose decimal formats and fixed-size ratio widths and rules.
- Specify partial application of binary subtraction alongside unary
  negation. The numeric definitions assume the selected arity is known.
