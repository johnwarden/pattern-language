# Contains expectation

Pending semantic clarification in the project chat.

Requested surface:

```text
expect subject contains expected
```

Jonathan has requested this vocabulary. Its predicate meaning and expected-data
rules still need concrete positive and negative examples before implementation.
Do not infer membership, text inclusion or pattern behavior from the word alone.

The [approved is/fails migration](../approved/expect-predicates.md) can proceed
without making this decision. `isApprox` is a possible later predicate, not an
approved implementation in that migration.
