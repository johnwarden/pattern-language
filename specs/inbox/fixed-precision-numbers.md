# Fixed-precision numbers in the prelude

Draft for review. The [fixed-precision notes](https://chatgpt.com/library?file_id=libfile_ea21b8d12df48191b831e95829ad1dbc) propose concrete carveouts of the exact rational type. [D04 and D09](../../design/LANGUAGE-DECISIONS.md) establish exact literals, exact designation and explicit projection. This draft defines the numeric union and proposes operator signatures and arithmetic policies.

## Types and representation

Define the public types, aliases, operators and explicit conversions in the source prelude. Each fixed format is a concrete `ExactRational` carveout. Its membership predicate checks whether the exact value fits the format. For example:

```pattern
type Int64 concrete ExactRational .where fitsInt64
type Float64 concrete ExactRational .where fitsFloat64
```

Proposed initial aliases are `Int = Int64` and `Float = Float64`, with identical type identity under either name. The equations describe aliases. Their declaration spelling follows the language's type binding rules.

| Family | Proposed domain | Initial scope |
| --- | --- | --- |
| Signed and unsigned integers | `IntW` holds integers from −2^(W−1) through 2^(W−1)−1. `UIntW` holds integers from 0 through 2^W−1. | Specify `Int64` and `UInt64` first. The same rule can instantiate other widths. |
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
type Number pattern Int64 | UInt64 | Float32 | Float64
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
  expect x == 0 is True
  expect x != 0 is False
end
```

## Operator calls and exact literals

Binary arithmetic takes two successive argument packs. A numeric literal
and the same exact value stored in a variable both have type
`ExactRational`. An operator that supports mixed operands admits that type
in its signature and performs any exact-fit check within its definition.
These rules apply to infix calls, successive-pack calls and saved partials.
A result annotation supplies no backward overload selection.

## Prelude definitions for addition

Draft for `ExactRational`, `Int` (the Int64 alias), and `Float64`.
The result of mixing one fixed-precision operand with an `ExactRational`
has the fixed operand's type, in either order. Check exact representability
of the ExactRational operand before adding. Integer results are checked for
overflow. Float64 results are rounded once. Different fixed formats need
an explicit conversion for these overloads.

Each first pack selects one definition. A union in the second pack keeps
both supported operand types available after saving a partial application.
When the first pack is an `ExactRational`, its definition can return an
`ExactRational`, `Int`, or `Float64` according to the second operand.

```pattern
def (+)(a :: Int)(b :: Int | ExactRational)
  right = b :: Int
  leftValue = match a
    (value :: ExactRational) -> value
  end
  rightValue = match right
    (value :: ExactRational) -> value
  end
  addExact(leftValue, rightValue) :: Int
end

def (+)(a :: Float64)(b :: Float64 | ExactRational)
  right = b :: Float64
  leftValue = match a
    (value :: ExactRational) -> value
  end
  rightValue = match right
    (value :: ExactRational) -> value
  end
  float64(addExact(leftValue, rightValue))
end

def (+)(a :: ExactRational)(b :: ExactRational | Int | Float64)
  match b
    (q :: ExactRational) -> addExact(a, q)
    (i :: Int) -> (+(i)(a))
    (f :: Float64) -> (+(f)(a))
  end
end
```

`addExact` denotes the prelude's internal exact addition primitive
(the bootstrap already implements this operation as `addRationals`). The
delegating arms use the same checked conversions as the fixed-left
definitions. Match recognizes the concrete member held by `b`.
The `:: Int` and `:: Float64` checks on `right` explicitly designate
the operand, independent of whether it originated as a literal or a variable.
For example, the Int arm rejects a rational `0.5` during operand
designation.

The [partial-application contract](../../tests/inbox/mixed-addition-partial-application.test)
checks the infix, successive-pack, and saved-partial forms, including a stored
ExactRational operand and an ExactRational first pack called with two different types.

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

| Operations | Integers | Binary and decimal floats | Fixed-size ratios |
| --- | --- | --- | --- |
| `+`, `-`, `*`, unary `-` | Compute the exact integer result and panic if it is out of range. This includes unsigned underflow and negating the signed minimum. | Compute the exact result, then round once to the result format. Apply the floating failure rules below. | Compute exactly, reduce, then check the component bounds. |
| `/` | A zero divisor or out-of-range quotient panics. The proposed quotient truncates toward zero. | A zero divisor panics. Round the exact quotient once and apply the floating failure rules. | Compute the exact quotient and reduce before checking bounds. |
| Remainder | Proposed operation with `a = q * b + r` and any nonzero remainder having the dividend's sign. The spelling remains open. | Deferred. | Deferred. |

Integer remainder by zero panics. Under the proposed integer quotient,
`(1 :: Int) / 2` returns `0 :: Int`. That zero is the truncation result.

Floating overflow and underflow panic. The proposed underflow boundary
is a nonzero exact result that rounds to zero. Nonzero subnormal results
are representable. An exact zero result always returns the single zero of
the result format. For example, dividing zero by a negative finite float
returns zero. An invalid operation that would otherwise produce NaN, such
as taking the square root of a negative float, panics.

A successful floating division with a nonzero numerator returns a
nonzero float. With a zero numerator and a nonzero divisor it returns
zero. The refined result follows from the numerator's static evidence
and can be specified for a single division definition.

Each floating operator rounds its result before it feeds the next
operator. Round to nearest with ties to even is proposed. An explicit
floating conversion may round under the same failure rules. Operand
designation requires an exact fit.

The [square root proposal](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#decision-fixed-precision-number-types-are-wrapped-exactrationals)
defines the operation for fixed-precision floating types. If more than
one format accepts an exact designator, the call is ambiguous. An
explicit float ascription selects the format.

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

  expect n > 0 is True
  expect n < 10 is True
  expect n >= 2 is True
  expect 0 < n is True
  expect n > -1 is True

  expect n > 1 is True
  expect n > one is True
  expect n > (1 + 0) is True
  expect n > sum is True
  expect one < n is True
end

test "An Int refinement can order its input against an exact zero"
  type PositiveInt pattern Int .where (n -> n > 0)

  expect (2 :: Int) .matches PositiveInt is True
  expect (0 :: Int) .matches PositiveInt is False
end

test "Numeric equality applies to literal and bound ExactRationals"
  n = 2 :: Int
  two = 2
  expect n === 2 fails "E_INCOMPARABLE_TYPES"
  expect n === two fails "E_INCOMPARABLE_TYPES"
  expect n === (2 :: Int) is True
  expect n == 2 is True
  expect two == n is True
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

test "Square root requires disambiguation between floating formats"
  expect sqrt(2) fails "ambiguous"
  expect sqrt(4 :: Float64) is 2 :: Float64
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
  expect minInt / -1 fails "overflow"
  expect maxInt / 0 fails "division by zero"
end

test "Integer division truncates toward zero"
  expect (7 :: Int) / 2 is 3 :: Int
  negativeThree = -3 :: Int
  expect (-7 :: Int) / 2 is negativeThree
  expect (1 :: Int) / 2 is 0 :: Int
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

- Confirm the rounding mode, the underflow boundary for subnormals and
  the integer quotient rule. Choose the remainder operator's name.
- Confirm the initial widths and aliases. Choose decimal formats and
  fixed-size ratio widths separately.
- Define mixed arithmetic between fixed formats, including whether to
  require conversion or promote, and what type each result has.
- Define checked conversion of stored exact rationals and computed exact
  results into fixed formats. Use that contract in the prelude addition
  definitions.
