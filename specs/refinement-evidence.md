# Refinement evidence

A **refinement** such as `Float .where isNonZero` describes the `Float`
values for which the predicate `isNonZero` returns `True`. A type or a
successful check can establish that a particular value satisfies the
predicate. That guarantee is **refinement evidence**.

```pattern
test "A refined binding carries its guarantee into the next binding"
  type NonZeroFloat pattern Float .where isNonZero

  (x :: NonZeroFloat) = 2 :: Float
  (z :: NonZeroFloat) = x
  expect z is 2 :: Float

  expect
    def unchecked(y :: Float) y :: NonZeroFloat
    "defined"
  fails "E_NO_METHOD"
end
```

Binding `x` checks `isNonZero` on the literal `2 :: Float`. Binding `z`
reuses the guarantee in the type of `x`. The type of the parameter `y`
guarantees only `Float`. Because `y` could be zero, the checker rejects
`y :: NonZeroFloat` in the function body with `E_NO_METHOD` (missing
evidence for a runtime value).

A function whose parameter domain is an abstract refinement — for example
`pattern Float .where isNonZero` — is a `PolymorphicValue`, because that
domain is abstract. Functions over ordinary concrete aliases such as
`Int` (`Int = Int64`) or `Float` (`Float = Float64`) are ordinary concrete
functions, not `PolymorphicValue`s. See
[fixed-precision numbers](fixed-precision-numbers.md#types-and-representation).

## Checking a constant expression

A **constant expression** can be evaluated during checking without runtime
input. Its result is **statically known**. Constant evaluation is ordinary
evaluation of that expression: there is no separate step budget, fuel limit,
or special diagnostic for nontermination. A literal is the simplest case. A
name bound to a constant expression can be used in another constant
expression. A function call qualifies when its arguments and the values it
refers to are constant, so evaluating its body is constant evaluation.

**Designation** is the process of interpreting an expression at the type
its context expects. A binding annotation, a parameter, a field type, or
an expression ascription can supply that expected type. If it requires a
refinement and the expression has one statically known value that fits
the base type, checking evaluates the predicate to establish the evidence.
The same rule applies to literals, names bound to constants, and computations.

For example, `two` below has the declared type `Float`. The checker also
knows its value and can test `isNonZero` wherever `NonZeroFloat` is expected.
The binding annotation requests that check directly. A separate expression
ascription can request it too.

```pattern
test "A base-typed constant can be checked against a refinement"
  type NonZeroFloat pattern Float .where isNonZero
  def twice(n :: Float) n + n
  def keep(n :: NonZeroFloat) n

  (two :: Float) = twice(1 :: Float)
  (nonzero :: NonZeroFloat) = two
  expect nonzero is 2 :: Float
  expect two :: NonZeroFloat is 2 :: Float
  expect keep(two) is 2 :: Float
  expect keep(twice(1 :: Float)) is 2 :: Float
  expect (6 :: Float) / two is 3 :: Float
  # Mixed Float / bare NumericValue fit waits on fixed-precision promotion (#121).
  todo expect (6 :: Float) / 2 is 3 :: Float

  (zero :: Float) = twice(0 :: Float)
  expect
    (invalid :: NonZeroFloat) = zero
    invalid
  fails "E_REFINEMENT_FAILED"
  expect keep(zero) fails "E_REFINEMENT_FAILED"
end
```

The type `Float` supplies no nonzero guarantee by itself. Evidence for
`nonzero` comes from checking the statically known value of `two` against
the requested refinement. A parameter with the same declared type still
needs evidence when its value is unknown.

When checking the body of `twice`, the parameter `n` can be any `Float`.
When evaluating the constant call `twice(1 :: Float)`, `n` has the value
`1 :: Float`. An interpreter can make this distinction during checking.
Whether an optimizer later inlines a call has no effect on which programs
pass checking.

The same rule applies to the fit predicate of a concrete numeric type.
`Int32` is a concrete carveout of `NumericValue` using `fitsInt32`. In
`f(a)` below, the parameter type supplies the expected `Int32`, and
checking evaluates `fitsInt32` on the bound constant `a`.

```pattern
# Fixed-width Int32 designation depends on #121 (cursor/feat-fixed-width-integers-6b49).
todo test "A bound constant can designate into a fixed-width parameter"
  def f(x :: Int32) x
  a = 1
  expect f(a) is 1 :: Int32
end

todo test "A fixed-width parameter rejects a constant that does not fit"
  def f(x :: Int32) x
  a = 2147483648
  expect f(a) fails "E_NOT_EXACTLY_REPRESENTABLE"
end

todo test "A runtime value needs fit evidence for a fixed-width parameter"
  def f(x :: Int32) x
  expect
    def unchecked(a :: NumericValue) f(a)
    "defined"
  fails "E_NO_METHOD"
end
```

A field or element can establish its own refinement this way even when a
different field is supplied at runtime.

```pattern
test "A constant field can establish a refinement beside a runtime field"
  type NonZeroFloat pattern Float .where isNonZero
  type PairOfFloats struct Pair(NonZeroFloat, Float)
  (two :: Float) = (1 :: Float) + (1 :: Float)
  def pairWith(other :: Float) Pair(two, other) :: PairOfFloats

  expect pairWith(0 :: Float) is Pair(2, 0) :: PairOfFloats
end
```

To establish a predicate on a whole compound value by constant evaluation,
the whole value must be statically known. If a required predicate returns
`False`, report `E_REFINEMENT_FAILED` (the message names which predicate
failed). Numeric fit predicates that fail exact representation report
`E_NOT_EXACTLY_REPRESENTABLE` instead; see
[fixed-precision numbers](fixed-precision-numbers.md#mixed-signatures-and-fit-evidence).
If evaluation raises an error, preserve its diagnostic.

```pattern
# Number / NonZeroNumber wait on the Real|Complex Number union from fixed-precision work.
todo test "A literal can establish a refinement"
  type NonZeroFloat pattern Float .where isNonZero
  type NonZeroNumber pattern Number .where isNonZero
  def safeDivide(x :: Float, y :: NonZeroFloat) x / y
  def copy(x :: NonZeroFloat)
    (z :: NonZeroFloat) = x
    z
  end

  expect copy(2 :: Float) is 2 :: Float
  (x :: NonZeroNumber) = 2 :: Float
  expect x is 2 :: Float
  expect safeDivide(1 :: Float, 2 :: Float) is 0.5 :: Float

  expect
    (z :: NonZeroNumber) = 0 :: Float
    z
  fails "E_REFINEMENT_FAILED"
end
```

## Explicit checks on a runtime value

For a parameter whose value is unknown, `y .matches NonZeroFloat`
explicitly checks the predicate at runtime. In the true branch, the
checker knows that this particular `y` passed. An assignment, a type
annotation, or a call can use that evidence.

```pattern
# Return-type annotations on def and the Number union are not in this slice;
# evidence for .matches / missing evidence is covered by the Float-only cases above.
todo test "A Float parameter can be used as nonzero in the checked branch"
  type NonZeroFloat pattern Float .where isNonZero
  type NonZeroNumber pattern Number .where isNonZero
  def safeDivide(x :: Float, y :: NonZeroFloat) x / y

  def reciprocal(y :: Float) :: Float?
    if y .matches NonZeroFloat
      (z :: NonZeroNumber) = y
      safeDivide(1 :: Float, y)
    else
      :None
    end
  end
  expect reciprocal(2 :: Float) is 0.5 :: Float?
  expect reciprocal(0 :: Float) is None :: Float?

  expect
    def unchecked(y :: Float) safeDivide(1 :: Float, y)
    "defined"
  fails "E_NO_METHOD"
  expect
    def afterBranch(y :: Float)
      if y .matches NonZeroFloat
        safeDivide(1 :: Float, y)
      else
        0 :: Float
      end
      safeDivide(1 :: Float, y)
    end
    "defined"
  fails "E_NO_METHOD"
end
```

`NonZeroFloat` and `NonZeroNumber` both use the same `Predicate` enum
member, `:isNonZero`. The successful check establishes that predicate for
`y`, so either binding can use it if `y` also fits the base type. A Boolean
function with the same spelling supplies no such evidence. The predicate
enum and the meaning of a bare name after `.where` are defined in
[refinement predicates](refinement-predicates.md).

The false branch has no nonzero guarantee. After the branches rejoin, a
use of `y` can rely on the guarantee only if every path reaching that use
established it. A checked assertion such as `assert y .matches NonZeroFloat`
establishes evidence for the following statements because failure stops
execution. An unchecked or disabled assert establishes no evidence. A match
arm's **guard** is a condition that must succeed before its body runs. If
the arm binds `n :: Float` and its guard checks `n .matches NonZeroFloat`,
the body can use `n` as nonzero.

```pattern
test "Statements after an if do not keep branch-only evidence"
  type NonZeroFloat pattern Float .where isNonZero
  def keep(n :: NonZeroFloat) n
  expect
    def bad(n :: Float)
      if n .matches NonZeroFloat
        0
      end
      keep(n)
    end
    "defined"
  fails "E_NO_METHOD"
end

test "A local alias keeps the runtime parameter's missing evidence"
  type NonZeroFloat pattern Float .where isNonZero
  def keep(n :: NonZeroFloat) n
  expect
    def bad(n :: Float)
      alias = n
      keep(alias)
    end
    "defined"
  fails "E_NO_METHOD"
end

test "Evidence does not transfer to a computed value"
  type NonZeroFloat pattern Float .where isNonZero
  def keep(n :: NonZeroFloat) n
  expect
    def bad(n :: NonZeroFloat) keep(n - n)
    "defined"
  fails "E_NO_METHOD"
end
```

### Ordering explicit checks

Use explicit checks to give predicates a priority within one base-type
function. The overload-domain rule is specified in
[type values](type-values.md#overload-domains-and-projection-dispatch).

```pattern
test "One Int overload can give its predicates an explicit priority"
  type Positive pattern Int .where isPositive
  type NonZero pattern Int .where isNonZero
  def classify(n :: Int)
    if n .matches Positive
      "positive"
    else
      if n .matches NonZero "other nonzero" else "zero"
    end
  end
  expect classify(2 :: Int) is "positive"
  expect classify(-2 :: Int) is "other nonzero"
  expect classify(0 :: Int) is "zero"
end
```

### Typed parsing

`parse(T)(text)` checks the text against the expected type `T`, including
predicates on nested fields. A successful parse returns a value with the
guarantees of `T`.

```pattern
test "Typed parsing establishes nested field refinements"
  type PositiveInt pattern Int .where isPositive
  type Rectangle struct Rect(PositiveInt, PositiveInt)

  expect parse(Rectangle)("Rect(2, 3)") is Rect(2, 3) :: Rectangle
  expect parse(Rectangle)("Rect(-2, 3)") fails "E_REFINEMENT_FAILED"
  expect parse(Rectangle)("Rect(\"a\", 3)") fails "E_PATTERN_MISMATCH"
end
```

The first call establishes `isPositive` for both fields. In the second,
`-2` fails that predicate (`E_REFINEMENT_FAILED`). In the third, the string
`"a"` fails the base type `Int` (`E_PATTERN_MISMATCH`).

## Return types

Every return path must meet the declared result type. In `zeroAsNone`,
the true branch returns the value that passed the check. The other branch
returns the absence case of `NonZeroNumber?`.

```pattern
# Number and def return-type annotations are outside this slice.
todo test "Every return path meets a refined optional result"
  type NonZeroNumber pattern Number .where isNonZero
  def zeroAsNone(x :: Number) :: NonZeroNumber?
    if x .matches NonZeroNumber
      x
    else
      :None
    end
  end
  expect zeroAsNone(2) is 2 :: NonZeroNumber?
  expect zeroAsNone(0) is None :: NonZeroNumber?
end
```

A caller can rely on a built-in operation's specified result guarantee.
For example, the absolute value of a finite nonzero float is nonzero.
Fixed-precision float division also returns a nonzero result if the
numerator is known to be nonzero and the operation succeeds. `E_UNDERFLOW`
fires only when a nonzero exact result underflows to zero; see
[arithmetic policy](fixed-precision-numbers.md#arithmetic-policy). Integer
quotient operations can return zero for a nonzero numerator. One overload
can therefore specify a stronger result for inputs with a known refinement
when all its successful results on those inputs satisfy the predicate.

Division requires evidence for `isNonZero` on the divisor before evaluation.
A constant zero fails the predicate with `E_REFINEMENT_FAILED`. A divisor
known only through a `Float` parameter lacks the required evidence, so an
unchecked call fails with `E_NO_METHOD`. See
[division and remainder signatures](fixed-precision-numbers.md#division-and-remainder-signatures).

```pattern
test "A literal zero fails the divisor refinement"
  expect (1 :: Float) / (0 :: Float) fails "E_REFINEMENT_FAILED"
end

test "A runtime Float divisor needs nonzero evidence"
  expect
    def unchecked(d :: Float)
      (1 :: Float) / d
    end
    "defined"
  fails "E_NO_METHOD"
end

test "Successive packs check each refined parameter"
  type NonZeroFloat pattern Float .where isNonZero
  def divide(n :: Float)(d :: NonZeroFloat) n / d
  expect
    def bad(d :: Float) divide(1 :: Float)(d)
    "defined"
  fails "E_NO_METHOD"
end
```

A checked conversion can also establish a predicate for a runtime value.
For example, `checkedConvert(Int)(n)` checks `fitsInt64`, which tests whether
the exact value fits the integer format. On success it returns an `Int`.
See [checked conversion](fixed-precision-numbers.md#checked-conversion).

## Union bindings and overloaded calls

A binding to an abstract union and a call to disjoint overloads use the
same designation rule. For overloads the expected domain is the union of
their complete argument-pack domains. Check the definition-time disjointness
rule first. Then interpret the supplied arguments against that union,
including constant evaluation of the predicates required by each interpretation.
The resulting typed arguments select one clause. Overload validity follows
[the overload-domain rules](type-values.md#overload-domains-and-projection-dispatch).

For `PositiveInt | Float64`, `-3` designates `Float64` because `isPositive`
fails for the integer interpretation. Bare `3` has two valid interpretations
and raises `E_AMBIGUOUS_VALUE_DESIGNATOR`. An expression already typed as
`Float64` selects that member. This applies whether the expected union comes
from a variable, one function definition, or an overload group.

```pattern
test "Int and Float64 overloads accept typed arguments and compete for a literal"
  def pick(n :: Int) "integer"
  def pick(n :: Float64) "float"
  expect pick(3 :: Int) is "integer"
  expect pick(3 :: Float64) is "float"
  expect pick(3) fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end

test "Union bindings and overloads use the same constant designation"
  type PositiveInt pattern Int .where isPositive
  type Choice pattern PositiveInt | Float64
  def pick(n :: PositiveInt) "integer"
  def pick(n :: Float64) "float"
  def pickUnion(n :: Choice)
    match n
      (i :: PositiveInt) -> "integer"
      (f :: Float64) -> "float"
    end
  end

  (x :: Choice) = -3
  expect x is (-3) :: Float64
  (y :: Choice) = 3 :: Float64
  expect y is 3 :: Float64
  expect
    (z :: Choice) = 3
    z
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"

  (positive :: PositiveInt) = 3
  expect pick(positive) is "integer"
  expect pickUnion(positive) is "integer"
  expect pick(-3) is "float"
  expect pickUnion(-3) is "float"
  expect pick(3 :: Float64) is "float"
  expect pickUnion(3 :: Float64) is "float"
  expect pick(3) fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
  expect pickUnion(3) fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end
```

A failed predicate excludes one constant interpretation. A predicate error
retains its diagnostic. After one interpretation is selected, reuse its
predicate checks when binding parameters. Runtime arguments require evidence
from their types or earlier explicit checks. See [ambiguous value designators](ambiguous-values.md).

```pattern
test "A Float64 argument selects the Float64 overload without Int evidence"
  type PositiveInt pattern Int .where isPositive
  def pick(n :: PositiveInt) "integer"
  def pick(n :: Float64) "float"
  def relay(n :: Float64) pick(n)
  expect relay(3 :: Float64) is "float"
end

test "A predicate error during designation retains its diagnostic"
  def onlyStrings(s :: String) True
  p = Int .where (n -> onlyStrings(n))
  def pick(n :: p) "integer"
  def pick(n :: Float64) "float"
  expect pick(3) fails "E_NO_METHOD"
end
```

Host tests cover reuse of a successful predicate check when binding a sole
refined parameter and when designation selects among disjoint overloads
(`test/ambiguous-values.test.ts`).

## Diagnostics and test migration

Designation checks the argument against the expected union before dispatch
selects a clause. Reuse successful checks, and preserve errors raised by a
predicate. The disjointness check compares erased structural domains without
evaluating predicates.
See the [#80 review](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6953945601).

Failed constant predicate checks report `E_REFINEMENT_FAILED`. Missing
evidence for a runtime value required at a refined binding, argument, field,
or call reports `E_NO_METHOD`. Structural shape mismatch remains
`E_PATTERN_MISMATCH`. Failed numeric fit reports
`E_NOT_EXACTLY_REPRESENTABLE`.

For an ambiguous designator, suggest an ascription (an expression such as
`3 :: Float`) for each interpretation reported in the diagnostic. Use the
member's [canonical type expression](type-values.md#canonical-expressions-and-typed-text)
so the suggestion selects that interpretation when pasted into source. If
an interpretation has no selectable spelling, report the count instead.

The existing #80 diagnostic tests use bootstrap predicates. Migrate them
to enum members as the corresponding cases become available. Preserve the
missing-evidence tests for runtime parameters and fields drawn from them.
Normalization of repeated type alternatives and the `E_REDUNDANT_QUOTE`
diagnostic are specified in
[type values](type-values.md#declarations-normalization-and-identity).
