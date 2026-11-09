---
title: "Patterns in function inputs"
slug: patterns-in-functions
section: Patterns in practice
summary: "Recognize and unpack an argument at the function boundary."
---

# Patterns in function inputs

We can move the rectangle pattern into a function's input.

`area` accepts a `Rect` with two `Int` fields. Its input pattern captures those fields, and the body multiplies them.

```pattern
def Rectangle type :Rect(Int, Int)
def area(Rect(width :: Int, height :: Int)) width * height

r = Rect(3, 4) :: Rectangle
area(r)
```

The same recognition and capture idea now appears in a function signature. There is no separate field-extraction step inside `area`.

`area(r)` is a call with one argument pack containing `r`. Later, we will distinguish one pack with several arguments from successive packs.

## Try it

Change the function body to `width + height`. The input pattern still captures the same fields; only the calculation changes.
