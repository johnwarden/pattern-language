---
title: "A typed Rectangle"
slug: a-typed-rectangle
section: Patterns in practice
summary: "Start with a shape, give it a type, and calculate its area."
---

# A typed Rectangle

A rectangle is a useful place to begin: it has a recognizable shape and two pieces of data.

This declaration describes a `Rect` with two `Int` fields. The capture names `width` and `height` provide accessors for values interpreted as `Rectangle`.

```pattern
def Rectangle type :Rect(width :: Int, height :: Int)
r = Rect(3, 4) :: Rectangle

r.width * r.height
```

`:: Rectangle` checks and interprets the constructed value using that pattern. The last expression is the program's result: the area, `12`.

## Try it

Change `Rect(3, 4)` to `Rect(5, 4)`, then run the program again. Its area is now `20`.

The tour uses the executable prototype's current `def … type` spelling. We will build up the ideas before introducing more notation.
