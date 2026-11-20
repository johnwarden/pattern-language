---
title: "Choose a matching arm"
slug: choose-a-matching-arm
section: Patterns in practice
summary: "Give one calculation several possible shapes."
---

# Choose a matching arm

A type pattern can describe alternatives. This `Shape` admits either a rectangle or a square.

A `match` examines the value and uses the first arm whose pattern matches. Each arm captures just the parts it needs.

```pattern
def Shape type :Rect(Int, Int) | :Square(Int)
shape = Rect(3, 4) :: Shape

match shape
  Rect(width, height) -> (width * height)
  Square(side) -> (side * side)
end
```

The `|` separates alternatives in the type. The two match arms recognize the corresponding constructed shapes. The selected arm supplies the result of the whole `match`.

The annotation makes this a `Shape` value. Sharing a constructor spelling with an earlier example does not by itself give two types the same identity.

The indented match body ends with an explicit `end`.

## Try it

Replace `Rect(3, 4)` with `Square(5)`. Keep the `:: Shape` annotation and run again. The square arm now produces `25`.
