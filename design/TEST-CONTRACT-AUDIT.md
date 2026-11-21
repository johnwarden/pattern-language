# Source test contract cleanup

Source `.test` files specify language behavior. Keep native adapters, internal
descriptor layouts, transport encodings and undecided implicit decoding in host
tests. Preserve original regressions and authored expectations when moving them;
do not invent replacement APIs or turn prototype encodings into `legacy`/`todo`
language contracts.

## Representation backout: #68

The five representation/decoding cases migrated by #60 are removed from
[types/value-trees.test](../tests/types/value-trees.test). #68 restored the
original host blocks in `test/type-atoms.test.ts` and
`test/value-representation.test.ts`. Print→parse transport from those restored
blocks now lives in `test/round-trip-parsing.test.ts`.
[The coverage map](TEST-MIGRATION.md#type-identity-and-value-tree-migration)
records their homes. Identity tests, the other semantic value-tree cases and the
Boolean-assertion cleanup remain.

## Numeric correction: #66

[Exact numeric values and Code text](../specs/numeric-literals-and-text.md#exact-magnitudes-and-code-identity) now
replace source tests of bootstrap `syntaxTree` and `NumberLiteral` encodings.
Host checks in `test/rational-primitives.test.ts` retain native helpers and
display goldens. Quoted- and value-tree print→parse transport lives in
`test/round-trip-parsing.test.ts`. The [coverage map](TEST-MIGRATION.md#numeric-destination-contract-correction)
records the split.

## Remaining cleanup

- Move remaining native layout/example/schema and descriptor observations in
  bounded batches, reusing equivalent host coverage.
- Before each backout, inspect the original migration and current master;
  preserve intervening changes. Restore affected blocks intact, verify host
  coverage, then remove matching source cases and update the migration inventory.
- Run affected host/source checks and normal `just check`; build and validate
  extraction/playground behavior when examples move.

Public inspection/decoding, canonical predicate descriptions and unsettled
semantics remain pending. Source-defined grammars and ordinary data named
`Type`, `Apply`, `Postfix`, `Language` or `Syntax` remain valid.
