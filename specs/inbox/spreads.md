# Positional and labeled spreads

This proposal was split out of the [refined type model](2026-11-17-refined-type-model.md).
It proposes revising the spread syntax in the
[approved anonymous repeated-patterns spec](../approved/anonymous-repeated-patterns.md).

## Spread syntax

Use `...` for positional and labeled spreads. An annotation on the
left of `...` describes what the spread accepts and how to collect it.
For instance, `(items :: String*)...` collects positional strings.
An anonymous spread such as `(Float32**)...` specifies a repeated
pattern without creating a binding. A standalone vertical `...`
still marks repetition of rows.

```pattern
test "An anonymous matrix pattern retains horizontal and vertical repetition"
  type Matrix concrete [
    (cells :: Float32**)...
    ...
  ]
  anonymous = concrete [
    (Float32**)...
    ...
  ]
  matrix = ([
    ()
    0.5
    1, 2
  ] :: Matrix)

  assert Matrix === anonymous
  assert matrix .matches anonymous
end
```

Spreading a struct with `r...` supplies its positional and labeled
arguments without its head. A pattern such as `(contents :: {...})...`
can collect the argument pack into a braced struct. For example, if
`r` is `Rect(3, 5, color: :Red) :: ColoredRectangle`, the collected
value has the form `{3, 5, color: :Red}` with its own concrete type.

## Catch-all fields

Capture residual labeled fields as a built-in `Dict`. The dictionary
contains the labels that the pattern did not consume and their typed
values. A match with no residual labels captures an empty dictionary.

```pattern
type Color concrete :Red | :Blue
type Rectangle concrete Rect(width :: Float, height :: Float)
type ColoredRectangle concrete Rect(width :: Float, height :: Float, color: Color)
type AugmentedRectangle pattern Rect(width :: Float, height :: Float, (properties :: Dict)...)

(x :: AugmentedRectangle) = Rect(3, 5, color: :Red) :: ColoredRectangle
(y :: AugmentedRectangle) = Rect(3, 5) :: Rectangle

expect x is Rect(3, 5, color: :Red) :: ColoredRectangle
expect y is Rect(3, 5) :: Rectangle
assert x !== y
```

Here `x.properties` holds one entry with label `color` and value
`:Red :: Color`, and `y.properties` is empty. Neither capture changes the
concrete type stored in the facet binding.

The same spread can define one concrete type with arbitrary residual
labels.

```pattern
type OpenRectangle concrete Rect(width :: Float, height :: Float, (properties :: Dict)...)
(z :: OpenRectangle) = Rect(3, 5, color: :Red :: Color)
```

`z.properties` is a `Dict` as well. `OpenRectangle` and
`ColoredRectangle` define disjoint concrete value spaces. The exact
implementation, construction syntax and public operations of `Dict`
are deferred. Catch-all field capture and concrete structs that wrap
arbitrary labeled spreads can be implemented later.

## Open choice for repeated captures

A two-row `Matrix` with rows `1, 2` and `3` matches the anonymous
matrix pattern above. Its named capture `matrix.cells` currently
materializes as an ordinary list of row lists, `[[1, 2], [3]]`, with
`Float32` elements. The alternative is for that capture itself to
produce a value of the concrete row-matrix type. Both preserve row
boundaries, but only the latter would make the capture itself match the
concrete matrix type. The existing [rebuild test](../../tests/spreading/vertical-values.test)
spreads the row lists into a new matrix and compares both the whole
matrices and their captures.
