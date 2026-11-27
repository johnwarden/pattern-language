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
test "An ordinary pattern destructures the binding in stored Code"
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
[bounded Body grammar](../examples/body-grammar.pattern). The prelude supplies
`bindings` and `resultExpression` as ordinary functions over `Code`, using
that grammar to inspect the block. Their local type declarations keep the
helper types and capture accessors within each call. The same patterns work
after the text round trip. This first 5b slice retains the bootstrap `Body`
annotation while providing inspection of the bounded grammar; public category
membership for the full Code grammar remains later 5b work.

```pattern
test "Body inspection preserves result packs and exact numeric syntax"
  program = Code`
    original = 1/3
    (missing, "done")
  end
  printed = toString(Code)(program)
  restored = parse(Code)(printed)
  [binding] = restored.bindings
  ((name :: LowerCamelSymbol) := (literal :: NumericValue)) = binding
  [reference, text] = restored.resultExpression

  expect name is original :: LowerCamelSymbol
  expect literal is 1/3 :: NumericValue
  expect reference is missing :: LowerCamelSymbol
  expect text is "done" :: String
  assert toString(Code)(restored) == printed
  expect original fails "E_UNBOUND_NAME"
end

test "Body inspection preserves an explicitly empty final pack"
  program = Code`
    ()
  end
  expect program.bindings is []
  expect program.resultExpression is []
end

test "A statement cannot be the final result row during Body inspection"
  program = Code`
    localName = "kept"
  end
  expect program.bindings fails "E_PATTERN_MISMATCH"
  expect program.resultExpression fails "E_PATTERN_MISMATCH"
  expect localName fails "E_UNBOUND_NAME"
end
```
