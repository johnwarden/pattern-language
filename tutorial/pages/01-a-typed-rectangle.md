---
title: "Struct Types: A Typed Rectangle"
slug: a-typed-rectangle
section: Patterns in practice
summary: "Start with a shape, give it a type, and calculate its area."
---

# A Typed Rectangle

This example declares a `Rectangle` type with integer `width` and `height`, then calculates it's area.

```pattern

type Rectangle concrete Rect(width :: Int, height :: Int)
r = Rect(3, 4) :: Rectangle
r.width * r.height

```

## Types, Grammars, and Patterns

In the above definition, `Rectangle` is the **type name**, and `struct` is the **kind** of type (we'll learn about other kinds of types later).

The part after the `struct` keyword is the **grammar** for expressing values of that type. All values in the language have one concrete type defined using a grammar.


## Tree Grammars

Unlike a common BNF grammar, which matches against a sequence of tokens, grammars in this language match against the language's *abstract syntax tree*. 

Abstract syntax trees are made up of atoms including strings, numbers, word symbols like `Rect`, and punctuation symbols like `*`. These atoms are combined into trees using a few basic syntactic forms.

The grammar for `Rectangle` uses the **application** syntactic form: a head followed directy by one or more argument in parentheses. This syntax is also used for function calls (`f(x)`).

But grammars can also use **infix syntax**. For example:

```pattern

def Sum struct (x :: Float) + (y :: Float)
x = 3
s = (x :+ 1) :: Sum
s
```

`Sum` is a struct type just like `Rectangles`, but `Sum` can be expressed using infix syntax `x + y`.

In the expression `x :+ 1`, the `:` in front of the `+` quotes the symbol `x`. Otherwise `x + 1` would be interpreted as a function call and evaluate to `4`. 

Symbols starting with upper-case letters don't need to be quoted because they can't be bound to functions: they always represent type names or plain symbols. Only lower-case symbols and punctuation symbols can be bound to functions.

## Quoting

We can also quote an entire expression.

```pattern
Sum` x + 1
```

The *type name* followed directly by the backtick (`) quote operator indicates the grammar/type of the following expression.

Note how the `x` was *not* replaced with `3` in the resulting value. That's because the `x` itself was also quoted.

## Substitution

But you can also "unquote" an expression using the `$` operator to substitute a value into an expression:

```pattern
x = 3
Sum$` $x + 1
```

Adding the `$` before the quote operator indicates turns on `$` interpolation in the quoted expression.

## String Quoting

You can also enable interpolation in quoted strings. Here is a pair of examples of string quotes with and without interpolation

	x = 1
	($"$x + 1", "$x + 1")


## Type Annotations and Bindings

Whenever a new name is **bound** to a value, the `::` operator indicates its type. 

Names are bound in multiple places: 
Defining local variables (`r :: Rectangle`), 

This is used in multiple places: type definitions, local bindings (like r :: Rect)

is used after a bound name to indicate it's expected type. 

The `=` operator **binds** a local name to a value. 

## DSLs



`:: Rectangle` checks and interprets the constructed value using that pattern. The last expression is the program's result: the area, `12`.
