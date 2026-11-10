# Tests inside Markdown

The source runner also reads `.md` files. The content of each fenced block whose
info string starts with `pattern` is a test source, read exactly like a `.test`
file. Fences are independent files: nothing is shared between them. A fence with
no `test` declaration is an illustration and is not run; other fences and prose
are ignored.

An illustration, not run:

```pattern
1 + 2
```

A fence with a test is run, and failures report this file's own line numbers:

```pattern
test "A fenced test passes"
  expect 1 + 2 is 3 :: Rational
  expect "pattern language" contains "language"
  assert "a" != "b"
end
```

Each test case gets a fresh interpreter, and modifiers work as in `.test` files:

```pattern
test "Setup is local to its case"
  (x :: Rational) = 5
  expect x + 1 is 6 :: Rational
end

test "Another case sees no setup from the previous one"
  expect 1 is 1 :: Rational
  todo expect 1 is 2 :: Rational
end
```

A fence in another language is ignored, even when its content looks like a test:

```text
test "Not run"
  assert False
end
```
