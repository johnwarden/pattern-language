# Parentheses when mixing arithmetic operators

Approved on 10 November 2026. This records the earlier equal-precedence choice.
A [traditional-precedence replacement](../inbox/arithmetic-precedence.md) is now
under discussion; it has not been approved. Fraction syntax is specified
[separately](../inbox/rational-literals-and-text.md).

```pattern
test "Repeated arithmetic operators retain right associativity"
  expect 1 / 2 is 0.5 :: Rational
  expect 10 - 3 - 2 is 9 :: Rational
  expect 8 / 4 / 2 is 4 :: Rational

  assert parse(Code)("a + b + c") == Code` a + (b + c)
  assert parse(Code)("a / b / c") == Code` a / (b / c)
end

test "Explicit groups allow different arithmetic operators"
  expect (1 / 2) + (3 / 4) is 1.25 :: Rational

  assert parse(Code)("a + (b * c)") == Code` a + (b * c)
  assert parse(Code)("(a + b) * c") == Code` (a + b) * c
end

test "Ungrouped mixtures of different arithmetic operators reject"
  expect parse(Code)("a + b * c") fails "mixed arithmetic operators require parentheses"
  expect parse(Code)("a - b + c") fails "mixed arithmetic operators require parentheses"
  expect parse(Code)("a * b / c") fails "mixed arithmetic operators require parentheses"
end

test "Each argument is a separate expression level"
  assert parse(Code)("f(a + b, c * d)") == Code` f(a + b, c * d)
end

test "Prefix negation is not binary subtraction"
  assert parse(Code)("a + -b") == Code` a + (-b)
end

test "Canonical Code keeps grouping required by the syntax"
  source = Code` a + (b * c)
  text = toString(Code)(source)

  expect text contains "(b * c)"
  assert parse(Code)(text) == source
end
```

Apply the rule to binary `+ - * /` in Code expressions before evaluation.
Strings, comments and nonarithmetic DSL fields keep their own grammar.
