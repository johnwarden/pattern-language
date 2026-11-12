# Fixed-precision numbers in the prelude

Draft for review. The [fixed-precision notes](https://chatgpt.com/library?file_id=libfile_ea21b8d12df48191b831e95829ad1dbc) propose concrete Rational carveouts. [D04 and D09](../../design/LANGUAGE-DECISIONS.md) establish exact literals, exact designation and explicit projection. This draft supplies the missing operator signatures, operand designation rule and arithmetic policies.

## Types and representation

Define the public types, aliases, operators and explicit conversions in the source prelude. Each fixed format is a concrete Rational carveout. Its membership predicate checks whether the exact Rational fits the format. For example:

```pattern
type Int64 concrete Rational .where fitsInt64
type Float64 concrete Rational .where fitsFloat64
```

Proposed initial aliases are `Int = Int64` and `Float = Float64`, with identical type identity under either name. The equations describe aliases. Their declaration spelling follows the language's type binding rules.

| Family | Proposed domain | Initial scope |
| --- | --- | --- |
| Signed and unsigned integers | `IntW` holds integers from −2^(W−1) through 2^(W−1)−1. `UIntW` holds integers from 0 through 2^W−1. | Specify `Int64` and `UInt64` first. The same rule can instantiate other widths. |
| Binary floats | `Float32` and `Float64` hold the exact Rationals representable by their finite binary formats, including subnormals and zero. | Reuse the existing exact-fit predicates and explicit conversions. Special values remain a separate design decision. |
| Decimal floats | A format specifies decimal coefficient precision and exponent bounds. Its domain consists of the Rationals expressible within those bounds. | Select the formats and short alias separately. |
| Fixed-size ratios | A reduced fraction with a positive denominator must fit the chosen numerator and denominator limits. | Decide what the width counts before defining `Ratio64` or an alias. |

Finite zero has one Rational value. Signed zero, infinities, NaN, additional float widths and the membership of a future `Number` union remain open. The prototype currently reserves some numeric names. Moving them to the prelude requires migrating the primitive-name assertions and reconciling the numeric `Int` example in the [approved type-values spec](../approved/type-values.md).

## Operator calls and exact literals

Define homogeneous overloads in the prelude. A binary arithmetic arm takes two successive packs and returns its operand type. A comparison arm returns `Bool`. Thus `+` has an arm with signature `+(a :: Int64)(b :: Int64) :: Int64`.

Proposed overload rule: a concrete left operand selects the first pack by its existing identity. When this uniquely determines the next parameter type, the normal expected-type mechanism can designate a numeric literal into that type if its Rational value fits exactly. An explicitly typed operand retains its identity. The rule applies equally to infix sugar, `+(a)(b)`, and a separately saved partial application.

Consequently, with `n :: Int`, `(n :: Int) + 1` uses the Int64 arm and checks that the literal 1 fits its second parameter. The same rule accepts `(x :: Float64) + 0f0.1` and rejects `(x :: Float64) + 0.1` during operand designation. A bare Rational left literal supplies Rational identity. To put a literal on the left of a fixed-precision arm, write its type explicitly, as in `(1 :: Int) + n`. Mixed concrete types require a conversion. The result annotation supplies no backward overload selection in this proposal.

A possible prelude body projects both operands through explicit matching, computes the exact result and calls a checked result constructor or an explicit rounding conversion. Implementation primitives can supply exact arithmetic, representability checks and rounding at that boundary. The public overloads and type definitions live in the prelude. This design works even if exact Rational arithmetic is available only to those implementation primitives.

## Proposed arithmetic policy

| Operations | Integers | Binary and decimal floats | Fixed-size ratios |
| --- | --- | --- | --- |
| `+`, `-`, `*`, unary `-` | Compute the exact integer result, then check its range. Overflow, including unsigned underflow or negating the signed minimum, fails. | Compute the exact result, then round once to the operand format. Propose nearest, ties to even, with finite overflow failure and gradual underflow where the format supports subnormals. | Compute exactly, reduce, then check the component bounds. |
| `/` | Integer quotient truncates toward zero. Check the quotient for overflow, including signed minimum divided by −1. | Exact quotient followed by the same rounding policy. | Exact quotient, reduced before checking bounds. |
| Remainder | Propose a separate operation satisfying `a = q*b + r`, with nonzero remainder having the dividend's sign. Its spelling remains open. | Deferred. | Deferred. |
| Ordering | Compare the exact mathematical values within the selected concrete format and return `Bool`. | Same. | Same. |

Division and integer remainder by zero fail when evaluated. Existing typed equality governs `==` and `!=`. Each floating operator rounds its own result before that result feeds a subsequent operator. An explicit floating conversion may round, while operand designation checks exact fit.

The arithmetic policies, alias defaults and first-pack selection rule above are proposals for review. In particular, checked integer arithmetic, truncating integer division and finite floating overflow are choices to ratify.

## Candidate contracts

```pattern
test "A typed first operand supplies the right literal's exact expected type"
  n = 41 :: Int
  expect (n :: Int) + 1 is 42 :: Int
  expect +(n)(1) is 42 :: Int
  incrementFromN = +(n)
  expect incrementFromN(1) is 42 :: Int
  expect n < 42 is True :: Bool
  expect n + 0.5 fails "not an integer"
end

test "Float64 operands designate exactly and results round"
  x = 1 :: Float64
  expect x + 0.1 fails "not exactly representable as Float64"
  expect x + 0f0.1 is 0f1.1 :: Float64
end

test "Checked integers reject unrepresentable results"
  maxInt = 9223372036854775807 :: Int
  expect maxInt + 1 fails "overflow"
  expect (7 :: Int) / 2 is 3 :: Int
end
```

Before implementation, settle the proposed policies and capture the agreed cases in executable tests. Include the negative integer division case, unsigned underflow, mixed concrete operands, rounding at a halfway result and result identity under the aliases. Track Decimal and Ratio width choices separately from the initial Int and Float work.
