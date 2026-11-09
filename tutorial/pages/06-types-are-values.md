---
title: "Types are values"
slug: types-are-values
section: Patterns in practice
summary: "Pass a type into an ordinary function that builds a pattern."
---

# Types are values

A type can be an ordinary argument and an ordinary result.

`PairOf` takes a type `T` and returns a type pattern for a pair of `T` values. Its `T :: Type` input says that `T` itself must be a type.

```pattern
def PairOf(T :: Type) type :Pair(T, T)
pair = Pair(2, 3) :: PairOf(Int)

Pair(left, right) = pair
left + right
```

`PairOf(Int)` supplies `Int` for both fields. We then use the familiar binding pattern to capture the pair's components.

This is an ordinary function call with a type value. The example needs no additional angle-bracket application syntax.

## Try it

Change `Pair(2, 3)` to `Pair(8, 13)` and run again. The parameterized pattern stays the same; its data changes.
