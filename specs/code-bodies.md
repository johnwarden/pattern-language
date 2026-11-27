# Reading a Body as Code

A block with one binding and a final name is a `Body`. Reading it as `Code`
preserves both rows. In this example `localName` belongs to the stored program
and `missing` has no binding in the reader's scope.

```pattern
program = Code`
  localName = "kept"
  missing
end
printed = toString(Code)(program)
restored = parse(Code)(printed)

test "Reading and printing the Body leaves both names inert"
  assert restored == program
  assert toString(Code)(restored) == printed
  expect localName fails "E_UNBOUND_NAME"

  macro :runStored Args()
    restored
  end
  expect
    runStored Args()
  fails "unbound name: missing"
end
```

The macro above runs the restored program using the bootstrap evaluator. Name
lookup first matters at that point. For inspection, an ordinary `Body`
binding gives access to the binding rows and the final result pack. The
quoted `=` in the destructuring pattern (`:=`) matches the stored binding.

```pattern
todo test "An ordinary pattern destructures the binding in stored Code"
  (body :: Body) = restored
  [binding] = body.bindings
  ((name :: LowerCamelSymbol) := (literal :: String)) = binding
  [reference] = body.resultExpression

  expect name is localName :: LowerCamelSymbol
  expect literal is "kept" :: String
  expect reference is missing :: LowerCamelSymbol
end
```

The field names and binding pattern come from the
[bounded Body grammar](../examples/body-grammar.pattern). Milestone 5b makes
this inspection available on the value read as `Code` with the standard
prelude. The same pattern must work after the text round trip.
