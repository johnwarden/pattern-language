# Anonymous repeated patterns

[The source cases](anonymous-spreads.test) use a bare annotated ellipsis when
no capture name is needed. A single horizontal repetition uses one list layer:

    concrete [... :: Float32*]

A horizontal row repeated vertically keeps both repetitions explicit:

    concrete [
      ... :: Float32**
      ...
    ]

The annotation describes the aggregate repetition dimensions. There is no
required `_` capture and no synthetic capture binding.

These cases cover pattern spelling, element constraints, labels, empty rows and
dimension validation. They do not choose a conversion or structural identity
between a row matrix and an ordinary list of lists, or change the materialized
result of a named matrix capture. That boundary is being clarified for #65.
