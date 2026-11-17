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
| Binary floats | `Float32` and `Float64` hold the exact Rationals representable by their finite binary formats, including subnormals and zero. | Reuse the existing exact-fit predicates and explicit conversions. Special values remain a separate design decision. |
| Decimal floats | A format specifies decimal coefficient precision and exponent bounds. Its domain consists of the Rationals expressible within those bounds. | Select the formats and short alias separately. |
| Fixed-size ratios | A reduced fraction with a positive denominator must fit the chosen numerator and denominator limits. | Decide what the width counts before defining `Ratio64` or an alias. |

Finite zero has one exact value. Signed zero, infinities, NaN and additional float widths remain open. The prototype currently reserves some numeric names. Moving them to the prelude requires migrating the primitive-name assertions and reconciling the numeric `Int` example in the [approved type-values spec](../approved/type-values.md).

## Number and numeric equality

`Number` is the abstract union of the fixed-precision numeric types defined
in the prelude. An initial union for the formats listed above is:

```pattern
type Number pattern Int64 | UInt64 | Float32 | Float64
```

`ExactRational` is outside `Number`. The distinction matters for
equality. If `Number` included `ExactRational`, comparing an Int zero
and an ExactRational zero within that domain would yield `False`. Their
concrete member types differ even though their magnitudes are equal.
Keeping the types disjoint lets the comparison below report an error.

```pattern
test "Numeric equality compares a Number with an exact literal"
  (x :: Number) = 0 :: Int
  expect (x == 0) fails "E_INCOMPARABLE_TYPES"
  expect (x != 0) fails "E_INCOMPARABLE_TYPES"
  expect (x =#= 0) is True
  expect (x !#= 0) is False
end
```

Numeric equality accepts `Number | ExactRational` operands and compares
their exact mathematical values in the finite numeric model. Numeric
inequality is its Boolean complement. `==` and `!=` keep their
[functional equality contract](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#strong-functional-equality).

The spellings `=#=` and `!#=` are proposed. A spaced `= #=` could
currently be a binding followed by a comment and an indented value, so
the lexer policy still needs a decision under the [formatting safety
rule](../../GRAMMAR.md#formatting-safety).

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
  addExact(unwrap(a), unwrap(right)) :: Int
end

def (+)(a :: Float64)(b :: Float64 | ExactRational)
  right = b :: Float64
  float64(addExact(unwrap(a), unwrap(right)))
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

## Proposed arithmetic policy

| Operations | Integers | Binary and decimal floats | Fixed-size ratios |
| --- | --- | --- | --- |
| `+`, `-`, `*`, unary `-` | Compute the exact integer result, then check its range. Overflow, including unsigned underflow or negating the signed minimum, fails. | Compute the exact result, then round once to the operand format. Propose nearest, ties to even, with finite overflow failure and gradual underflow where the format supports subnormals. | Compute exactly, reduce, then check the component bounds. |
| `/` | Integer quotient truncates toward zero. Check the quotient for overflow, including signed minimum divided by −1. | Exact quotient followed by the same rounding policy. | Exact quotient, reduced before checking bounds. |
| Remainder | Propose a separate operation satisfying `a = q*b + r`, with nonzero remainder having the dividend's sign. Its spelling remains open. | Deferred. | Deferred. |
| Ordering | Compare the exact mathematical values within the selected concrete format and return `Bool`. | Same. | Same. |

Division and integer remainder by zero fail when evaluated. Existing typed equality governs `==` and `!=`. Each floating operator rounds its own result before that result feeds a subsequent operator. An explicit floating conversion may round, while operand designation checks exact fit.

The arithmetic policies and alias defaults are proposals for review. In
particular, checked integer arithmetic, truncating integer division, finite
floating overflow and which formats to support initially remain choices
to ratify. Mixed ordering still needs operator signatures. The current [`sqrt` proposal](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#decision-fixed-precision-number-types-are-wrapped-exactrationals)
defines the operation only for floating types. Its argument rule still needs
to address designation from `ExactRational`.

## Candidate contracts

```pattern
test "Ordering accepts an exact literal beside an Int"
  n = 41 :: Int
  expect n < 42 is True
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
