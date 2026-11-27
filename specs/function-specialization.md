# Function specialization (illustrative contracts)

Companion to the decision note
[FUNCTION-SPECIALIZATION.md](../design/FUNCTION-SPECIALIZATION.md).
These fences sketch the decided model; they are not a full test suite.
Unmet checks are `todo`. Do not treat volatile assertion counts as a contract.

## Abstract-domain and overloaded functions are polymorphic values

A single definition whose domain is abstract is a `PolymorphicValue`. Several
`def` clauses for one name are also a `PolymorphicValue`. Both use the ordinary
polymorphic / ambiguous-value designation rules. Distinct spellings of the same
effective behavior keep their own closed forms; equality between them is not
pinned here.

```pattern
todo test "Overload defs and a union-domain match are both polymorphic values"
  def describe(x :: Int) "int"
  def describe(x :: String) "string"

  def describeMatch(x :: (Int | String))
    match x
      Int -> "int"
      String -> "string"
    end
  end

  expect describe(2 :: Int) is "int"
  expect describe("x") is "string"
  expect describeMatch(2 :: Int) is "int"
  expect describeMatch("x") is "string"

  savedOverloads = describe
  savedMatch = describeMatch
  assert savedOverloads .matches PolymorphicValue
  assert savedMatch .matches PolymorphicValue
end
```

```pattern
todo test "A concrete-only function is not a polymorphic value"
  # Int is a plain alias of Int64 (concrete), not an abstract type.
  def incr(n :: Int) n + (1 :: Int)
  saved = incr
  assert not(saved .matches PolymorphicValue)
  expect saved(2 :: Int) is 3 :: Int
end
```

## Specialization applies polymorphic-value narrowing

Requesting a narrower arrow interprets the polymorphic value at that arrow and
checks that the narrowed result fits. Failure of the ascription / designation
is an ordinary type mismatch (`E_PATTERN_MISMATCH`). Calling outside the
resulting domain is `E_NO_METHOD` (no applicable callable). There is no silent
runtime fallback and no specialization-specific error code.

```pattern
todo test "An arrow ascription specializes a single abstract-domain definition"
  def f(x :: (Int | Float64))
    match x
      Int -> x + (1 :: Int)
      Float64 -> x
    end
  end

  (g :: (Int => Int)) = f
  expect g(2 :: Int) is 3 :: Int
  # Call outside the specialized domain: no applicable clause.
  expect g(0f0.5) fails "E_NO_METHOD"

  (h :: (Float64 => Float64)) = f
  expect h(0f0.5) is 0f0.5
end
```

```pattern
todo test "An arrow ascription specializes an overloaded polymorphic value"
  def f(x :: Int) x + (1 :: Int)
  def f(x :: Float64) x

  (g :: (Int => Int)) = f
  expect g(2 :: Int) is 3 :: Int
  expect g(0f0.5) fails "E_NO_METHOD"

  (h :: (Float64 => Float64)) = f
  expect h(0f0.5) is 0f0.5
end
```

```pattern
todo test "Specialization fails when the narrowed result does not fit the requested output"
  def widen(x :: (Int | String))
    match x
      Int -> x
      String -> x
    end
  end

  expect
    (bad :: (Int => String)) = widen
    bad
  fails "E_PATTERN_MISMATCH"
end
```

```pattern
todo test "Domain widening fails with E_PATTERN_MISMATCH"
  def describe(x :: Int) "int"
  def describe(x :: String) "string"

  expect
    (wide :: ((Int | String | Bool) => String)) = describe
    wide
  fails "E_PATTERN_MISMATCH"
end
```

```pattern
todo test "A concrete Int function designates into (Int => Int)"
  # Ordinary arrow compatibility (not polymorphic narrowing). Int is a plain
  # alias of Int64, so (Int => Int) and (Int64 => Int64) are the same concrete
  # arrow for this purpose.
  def incr(n :: Int) n + (1 :: Int)
  assert not(incr .matches PolymorphicValue)
  (g :: (Int => Int)) = incr
  expect g(2 :: Int) is 3 :: Int
  (h :: (Int64 => Int64)) = incr
  expect h(2 :: Int64) is 3 :: Int64
end
```

```pattern
todo test "A zero-parameter function has a concrete domain"
  def unit() 0 :: Int
  saved = unit
  assert not(saved .matches PolymorphicValue)
end
```

## Validity over the full declared domain

A definition is checked over its full declared domain when defined. Narrowing
must not rescue an invalid definition by ignoring unreachable arms. The failure
below is at definition time (the String arm is unbound); there is no later
ascription that could succeed.

```pattern
todo test "Narrowing does not rescue an invalid full-domain definition"
  expect
    def bad(x :: (Int | String))
      match x
        Int -> x + (1 :: Int)
        String -> missingName
      end
    end
    bad
  fails "E_UNBOUND_NAME"
end
```

## Abstract domains need not be enumerable

Open facets admit members that cannot be listed as a closed union. Specializing
to one concrete member must leave sibling concrete members available to the
original function and outside the narrower arrow.

```pattern
todo test "Specialize area from an open facet to a concrete member with an extra field"
  type OpenRect pattern Rect(w :: Int, h :: Int, ...)
  type ColoredRect struct Rect(w :: Int, h :: Int, color: String)
  type SizedRect struct Rect(w :: Int, h :: Int, units: String)

  def area(r :: OpenRect)
    match r
      Rect(w, h, ...) -> w * h
    end
  end

  colored = Rect(2, 3, color: "red") :: ColoredRect
  sized = Rect(2, 3, units: "cm") :: SizedRect

  (coloredArea :: (ColoredRect => Int)) = area
  expect coloredArea(colored) is 6
  expect area(sized) is 6
  expect coloredArea(sized) fails "E_NO_METHOD"
end
```

```pattern
todo test "Specialize area from a closed abstract Rectangle union"
  type Square struct Square(s :: NumericValue)
  type Rect struct Rect(w :: NumericValue, h :: NumericValue)
  type Rectangle pattern Square | Rect

  def area(r :: Rectangle)
    match r
      Square(s) -> s * s
      Rect(w, h) -> w * h
    end
  end

  (squareArea :: (Square => NumericValue)) = area
  expect squareArea(Square(3) :: Square) is 9

  (rectArea :: (Rect => NumericValue)) = area
  expect rectArea(Rect(2, 4) :: Rect) is 8
end
```
