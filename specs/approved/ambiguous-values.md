# Ambiguous values report `E_AMBIGUOUS_VALUE`

Approved by Jonathan in the project chat on 10 November 2026. This renames
`E_AMBIGUOUS_PATTERN` and changes what its message says.

When more than one member of an expected type can designate a value, the value
is ambiguous. The error is the same however the expected type reaches the value,
and it blames the value, not the pattern:

```pattern
b = abstract Int | Float

3 .matches b
(x :: b) = 3

type Foo concrete String? | Float?
(x :: Foo) = :None
```

Each of these fails with `E_AMBIGUOUS_VALUE`. The message lists the possible
interpretations so the author can choose one, for example "please specify
`3 :: Int` or `3 :: Float`". Each interpretation is written as `value :: Type`
for a member that would accept the value. The exact surrounding wording is not
pinned; every candidate interpretation must appear in it.

`E_AMBIGUOUS_PATTERN` is retired: existing assertions that expect it are renamed
to `E_AMBIGUOUS_VALUE`, preserving their subjects. This does not change which
programs are ambiguous. It also does not change designation or literal typing:
`3` stays ambiguous between `Int` and `Float` here because both designate it.

## Contracts

The legacy/todo pairs in `tests/specification/expected-type-context.test`
(PR #77) express this decision: each keeps the old code as a legacy assertion
and adds the new code and the `3 :: Int` / `3 :: Float` message check as todos.
The implementation PR renames the remaining `E_AMBIGUOUS_PATTERN` assertions in
the corpus, removes the legacy lines once the todos pass, and moves this record
to `../implemented/` with links.
