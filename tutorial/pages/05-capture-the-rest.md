---
title: "Capture the rest"
slug: capture-the-rest
section: Patterns in practice
summary: "Match the front of a collection and retain what follows."
---

# Capture the rest

A collection pattern can capture a first item and a remainder.

`Int*` is the prototype's source-defined list convention for zero or more `Int` values. In the binding, `rest...` captures the remaining positional items.

```pattern
numbers = [1, 2, 3] :: Int*

[first, rest...] = numbers
(first, rest)
```

The result contains the first integer and the remaining list. Matching does not remove items from `numbers`; it binds new names to the captured parts.

The whole list may be empty, but this particular binding needs a first item. Its remainder may be empty.

## Try it

Change the list to `[9]`. The first capture becomes `9`, and `rest` becomes an empty list.
