# Anonymous repeated patterns

Approved by Jonathan in the project chat on 2026-11-09.

A repeated pattern with no capture name uses a bare annotated ellipsis. An
underscore is not required:

```pattern
concrete [... :: Float32*]
```

An anonymous matrix pattern retains horizontal and vertical repetition:

```pattern
concrete [
  ... :: Float32**
  ...
]
```

The annotation describes the aggregate repetition dimensions; the pattern
structure specifies where those dimensions occur. The ellipsis is spelled with
ASCII `...` only; Unicode `…` is not supported syntax. There is no synthetic
underscore binding. Existing underscore syntax is not retired by this decision.

Updated by Jonathan in the project chat on 2026-11-10: the earlier wording that
made `...` and `…` interchangeable is withdrawn. The bootstrap lexer still maps
`…` to the same symbol as `...` and prints it as `…`; rejecting `…` and printing
`...` canonically is pending implementation in a separate change, so this record
stays approved until its contracts exist.

Write and validate executable contracts in
`tests/specification/anonymous-spreads.test` before implementation. Cover
element constraints, dimension validation, empty rows, labeled fields and the
absence of capture bindings. Keep necessary explanation beside those tests.

## Capture-result clarification still pending

The correction arose from #65's expected type for `rebuilt.cells`. The current
bootstrap returns a conventional list of row lists there, while the row-matrix
pattern above matches `rebuilt`. Clarify the intended capture-result shape and
assertion target in chat before changing materialization, identity or conversion.
This syntax decision does not approve an implicit conversion or a new public
inspection/decoding rule.
