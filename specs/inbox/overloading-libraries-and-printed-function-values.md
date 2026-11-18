# Overloading, libraries and printed function values

The [closed immutable value and exact local-printing principles](../approved/library-closure-and-local-printing.md)
are approved. An overloaded function name evaluates to a `PolymorphicValue`
that contains the complete visible group of definitions.

```pattern
type PolymorphicValue concrete
  (definitions :: Definition*)
  ...
end
```

Binding `saved = f` captures that group as an immutable value. A call
through `saved` uses the same overload rules as a call through the
name. The declaration fixes the `definitions` field. The public
`Definition` schema and any further fields remain open.

Local text may use a visible name only if it denotes the exact, complete
value, including referenced definitions. Global text must reconstruct
the group and its captured definitions in a fresh scope.
See the [test plan](named-function-value-tests.md).

```pattern
test "A stored overload group retains its definitions"
  def f(x :: String) "string"
  def f(x :: Float64) "float"
  saved = f

  expect saved("x") is "string"
  expect saved(1.5 :: Float64) is "float"
end
```

The representation and printed grammar of a `Definition` remain open,
including whether text supplies explicit parameter and result annotations.
An inline predicate in type text must parenthesize its lambda, as in
`T .where (value -> predicate(value))`. Decide how the global form spells
the closed predicate and the type it captures before fixing expected text.

Overloaded constants are a separate proposal. With two definitions of
`zero`, one returning a string and one returning a number, what does
bare `zero` produce? An expected-type selection rule would need to cover
both `(s :: String) = zero` and `saved = zero` without changing ordinary
operator dispatch.
