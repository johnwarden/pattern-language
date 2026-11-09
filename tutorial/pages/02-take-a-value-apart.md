---
title: "Take a value apart"
slug: take-a-value-apart
section: Patterns in practice
summary: "Use the same shape to capture the pieces of a value."
---

# Take a value apart

A pattern can describe a type. It can also give names to parts of a value.

Here, `Rect(width, height)` matches the shape of `r`. Its lowercase names capture the two fields.

```pattern
def Rectangle type :Rect(Int, Int)
r = Rect(3, 4) :: Rectangle

Rect(width, height) = r
(width, height)
```

This binding does not change the rectangle. It makes its two components available as `width` and `height`. The final parenthesized pack returns both results.

The type pattern uses `Int` to recognize each field. The binding pattern uses names to capture them. Both follow the same structure.

## Try it

Replace the last line with `width + height`. Run it to use the captured values in a calculation.
