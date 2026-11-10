# Source test contract cleanup

Source `.test` files specify language behavior. Keep native adapters, internal
descriptor layouts, transport encodings and undecided implicit decoding in host
tests. Preserve original regressions and authored expectations when moving them;
do not invent replacement APIs or turn prototype encodings into `legacy`/`todo`
language contracts.

## Representation backout: #68

The five representation/decoding cases migrated by #60 are removed from
[types/value-trees.test](../tests/types/value-trees.test). Their original host
blocks are restored in `test/type-atoms.test.ts` and
`test/value-representation.test.ts`, including portable subassertions in mixed
blocks. [The coverage map](TEST-MIGRATION.md#type-identity-and-value-tree-migration)
records their homes. Identity tests, the other semantic value-tree cases and the
Boolean-assertion cleanup remain.

## Remaining cleanup

- Keep numeric cleanup in [#66](https://github.com/johnwarden/pattern-language/pull/66):
  numeric/Code cases stay in source; native adapter goldens and quoted
  `syntaxTree` round trips stay on host. Reconcile shared docs in the second PR.
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
