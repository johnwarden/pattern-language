# Arithmetic precedence — draft

Proposed replacement for the earlier
[approved mixed-operator restriction](../approved/arithmetic-operator-grouping.md).

This draft gives precedence to infix operators in the following order:
  - `* /` (left-associative)
  - other infix operators (right-associative)
  - `+ -` (left-associative)
  -  `=`, `==`, and any other operator ending in `=` (right associative)

[Fraction literals](rational-literals-and-text.md) are separate.

TOOD: examples with arithmetic operators mixed with non-arithmetic infix operators
  expect
    assert (Code` a + b == c + d) == Code` (a + b) == (c + d)
    assert (Code` a .and b * c) == Code` a .and (b - c)
    assert (Code` a * b .and c) == Code` (a * b) .and c

    assert (Code` a .and b - c) == Code` a .and (b - c)

    # This one is tricky. is - higher precedence or equal precedence
    assert (Code` a - b .and c) == Code` a - (b .and c)
    assert (Code` a - b .and c - d) == Code` (a - (b .and (c - d))


```pattern
test "Multiplication and division bind more tightly than addition and subtraction"
  expect 1 + 2 * 3 is 7 :: Rational
  expect 2 * 3 + 4 is 10 :: Rational
  expect 20 / 5 + 2 is 6 :: Rational
  expect 10 - 6 / 3 is 8 :: Rational

  assert parse(Code)("a + b * c") == Code` a + (b * c)
  assert parse(Code)("a * b + c") == Code` (a * b) + c
  assert parse(Code)("a - b / c") == Code` a - (b / c)
end

test "Operators within one arithmetic tier associate left"
  expect 10 - 3 - 2 is 5 :: Rational
  expect 8 / 4 / 2 is 1 :: Rational
  expect 24 / 3 * 2 is 16 :: Rational

  assert parse(Code)("a - b - c") == Code` (a - b) - c
  assert parse(Code)("a / b / c") == Code` (a / b) / c
  assert parse(Code)("a / b * c") == Code` (a / b) * c
end

test "Parentheses override precedence and associativity"
  expect (1 + 2) * 3 is 9 :: Rational
  expect 18 / (3 + 3) is 3 :: Rational
  expect 10 - (6 - 2) is 6 :: Rational

  assert parse(Code)("a + (b + c)") != parse(Code)("(a + b) + c")
  assert parse(Code)("a / (b / c)") != parse(Code)("(a / b) / c")
end

test "Prefix negation and complete application packs keep their existing grouping"
  leftNegative = -2 * 3
  expect leftNegative is
    -6 :: Rational
  end
  rightNegative = 2 * -3
  expect rightNegative is
    -6 :: Rational
  end
  groupedNegative = -(2 + 3)
  expect groupedNegative is
    -5 :: Rational
  end

  assert parse(Code)("-a * b") == Code` (-a) * b
  assert parse(Code)("f(a)(b) + g(c) * h(d)") == Code` f(a)(b) + (g(c) * h(d))
end

test "Arithmetic sugar still builds ordinary application trees"
  assert parse(Code)("a + b * c") == Code` +(a)(*(b)(c))
  assert parse(Code)("a * b + c") == Code` +(*(a)(b))(c)
end

test "Formatting preserves grouping or rejects malformed infix spacing"
  assert parse(Code)("a + b * c") == parse(Code)("a  +  b  *  c")
  assert parse(Code)("a / b / c") == parse(Code)("a  /  b  /  c")

  expect parse(Code)("a+b") fails "infix operators require spaces"
  expect parse(Code)("a +b") fails "infix operators require spaces"
  expect parse(Code)("a+ b") fails "infix operators require spaces"
end

test "Reading arithmetic Code does not evaluate it"
  assert parse(Code)("missing() + other() * last()") == Code` missing() + (other() * last())
  assert parse(Code)("1 / 0") == Code` 1 / 0
end

test "Canonical Code retains parentheses needed to reconstruct its tree"
  source = Code` (a + b) * c
  text = toString(Code)(source)
  expect text contains "(a + b)"
  assert parse(Code)(text) == source

  rightGrouped = Code` a - (b - c)
  rightText = toString(Code)(rightGrouped)
  expect rightText contains "(b - c)"
  assert parse(Code)(rightText) == rightGrouped
end
```


