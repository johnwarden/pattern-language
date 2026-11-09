# Source test contract audit and cleanup plan

Audited master `2b4292d847142ac0ccae05b348920c354a3efd8b` (including #60).
This is an audit and work queue, not a completed cleanup or a new public
inspection specification. The audit inspected all 63 `tests/**/*.test` files
and both fixture `.test` files. No tests were executed for this inventory.

## Boundary

Source `.test` files describe the destination language. A passing prototype API
does not make its representation an approved language contract. Keep bootstrap
parser trees, schema adapters, transport encodings and internal descriptor layout
in TypeScript tests while they remain necessary implementation regressions.

D03 already sets Expression as the parser destination and identifies host Syntax,
runtime Value and public SyntaxNode as transitional layers. Exact Rational
literals do not require a public `NumberLiteral(...)` wrapper. D04 leaves
canonical numeric spelling partly unsettled. Raw runtime Expressions remain
allowed for now; that does not decide descriptor/value equality, implicit type
decoding or the public inspection/decoding boundary.

Use supported destination behavior for ordinary source assertions and accepted
unimplemented behavior for todos. Leave unresolved semantics explicitly pending.
Neither `legacy` nor `todo` is a way to preserve an implementation encoding as a
language requirement.

## Findings

Counts below are textual mentions, including case titles and strings; they are
not assertion counts or measures of semantic coverage.

| Identifier       | Mentions | Files | Cases |
| ---------------- | -------: | ----: | ----: |
| NumberLiteral    |       21 |     3 |     6 |
| syntaxTree       |       28 |     4 |     7 |
| syntaxSchema     |        3 |     1 |     3 |
| syntaxExpression |        7 |     3 |     3 |
| parseSyntax      |        1 |     1 |     1 |
| SyntaxNode       |        6 |     1 |     2 |
| language(...)    |        4 |     2 |     2 |
| languageSchema   |        5 |     2 |     2 |
| Language         |        2 |     1 |     1 |

The requested NumberLiteral/syntaxTree/syntaxSchema group occupies 35 distinct
lines in eight cases across four files. The broader adapter group occupies 48
distinct lines in ten cases across five files. Neither fixture contains these
identifiers. Descriptor and implicit-decoding observations below add a separate
cleanup scope; their extent is not captured by this identifier census.

## Cleanup queue

Each batch must map every removed observation to a retained semantic source
assertion, a host check, or an explicitly pending decision. Restore or confirm
host coverage before removing source assertions. No batch needs runtime API
removal.

### 1. Correct the representation migration in #60

In [value-trees.test](../tests/types/value-trees.test):

| Case                                                                | Source contract to retain                                           | Implementation observation to keep on host or defer                                              |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Type construction sees Int through abstract storage                 | A stored Type value remains usable for matching and typed bindings. | `Type(t) == Type(Int)` as a descriptor equation.                                                 |
| Canonical alternatives put symbols before literals and applications | Union normalization and equality independent of declaration order.  | Exact compiled descriptor layout and ordering unless separately approved as public text.         |
| Compiled type trees equal quoted trees                              | Any independently approved type identity assertions.                | Compiled/quoted equality, Expression serialization of descriptors, and descriptor wire ordering. |
| A quoted type tree can be installed as a named type                 | None until the public boundary is settled.                          | Implicit decoding through `def factory() :(Type(Rect(Int)))` and `def R factory()`.              |
| Invalid type-shaped data is not a Type                              | Ordinary Type membership.                                           | Malformed Primitive/UnionType encodings and their transport.                                     |

Restore the corresponding checks removed from
[test/value-representation.test.ts](../test/value-representation.test.ts) and
[test/type-atoms.test.ts](../test/type-atoms.test.ts), or map them to equivalent
retained host checks. Correct the migration coverage records at the same time.
The current claim that all representation/transport checks stayed on host is too
broad.

Keep separate argument packs, specialization checks, accessor visibility,
substituted patterns, bound matchers, postfix/prefix distinction, reserved-name
errors and binding-default rejection. Most of
[identity.test](../tests/types/identity.test) is valid language semantics:
structural identity, capture-name erasure, recursive alpha invariance and physical
labels. It should not be discarded with the descriptor encodings.

### 2. Express numeric tests through values and established Code operations

Rewrite or consolidate [syntax-tree.test](../tests/numeric/syntax-tree.test);
rename the retained file and cases for their numeric behavior.

| Existing case                                              | Retain in source                                                                 | Host-only part                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| NumberLiteral payload is the denoted Rational              | Exact `0.1`, multiplication by ten, distinction from `0f0.1`, and zero.          | Schema lookup, node extraction and NumberLiteral goldens.                         |
| syntaxTree distinguishes 0.1 from 0f0.1 and round-trips    | Numeric inequality and established Code round trips.                             | Syntax adapters, schema transport and the exact hexadecimal NumberLiteral string. |
| NumberLiteral keeps integers beyond 2^53 and signed values | Distinct neighboring large integers and signed arithmetic.                       | Apply/Name/Field/NumberLiteral AST decomposition.                                 |
| Unspellable 1/3 stays exact as a NumberLiteral payload     | Exact arithmetic; an explicit serialization failure for an unspellable Rational. | The NumberLiteral carrier tag.                                                    |

For the last case, bind `n = (1 / 3) * 1` directly and invoke
`toString(Rational)(1 / 3)` explicitly for the serialization check. Evaluating
`1 / 3` is not itself the serialization failure. Do not invent a fraction
spelling or replace an internal golden with an unapproved public numeric golden.

Reuse existing controls in [primitives.test](../tests/specification/primitives.test),
[code-text.test](../tests/numeric/code-text.test),
[minus.test](../tests/specification/minus.test),
[test/rational-primitives.test.ts](../test/rational-primitives.test.ts) and
[test/syntax-inspection.test.ts](../test/syntax-inspection.test.ts). Confirm the
same observation before deleting duplicates.

### 3. Test layout through calls and Code behavior

In [call-label-spacing.test](../tests/layout/call-label-spacing.test), preserve
ordinary calls, real empty argument packs, accepted label spellings, distinct Code
and rejected spellings. Move precise Apply/Field/Sequence/Quote trees to the
parser/layout or syntax-inspection host tests.

Do not newly reject `Rect(w :(1))` to simplify this cleanup: its distinction from
a labeled field is part of the current observation. This audit does not choose
new whitespace or grammar rules.

### 4. Remove native adapter demonstrations from source examples

| File and case                                                                                                            | Disposition                                                                               |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [examples/expressions.test](../tests/examples/expressions.test): Language as data                                        | Native language/schema/parser transport and fixed rule/node counts stay on host.          |
| Same file: Inspect and rebuild syntax                                                                                    | Bridge reconstruction stays on host; direct public Expression inspection remains pending. |
| [examples/types.test](../tests/examples/types.test): Inspect a typed code binding without evaluating it                  | Move native tree matching/conversion to host; preserve inert Code behavior separately.    |
| [types/descriptions.test](../tests/types/descriptions.test): The language schema round-trips as a type and as Expression | Retain native-schema transport on host and remove duplicate coverage only after mapping.  |

The existing syntax-inspection host suite covers shared schema, computed heads,
complete packs, empty versus successive calls, canonical fields, malformed
reconstruction, fresh-context quotes and text transport. Reuse it.

Source-defined grammar examples such as
[examples/grammars.test](../tests/examples/grammars.test) remain valuable: an
authored grammar and its values are different from the compiler's native
SyntaxNode bridge. Changes to extracted examples also require playground checks.

### 5. Review descriptor goldens and legacy assertions by intent

Review these clusters in small follow-ups:

- [types/descriptions.test](../tests/types/descriptions.test): explicit Apply
  descriptors and the prototype refinement-equality limitation.
- [specification/primitives.test](../tests/specification/primitives.test):
  the quoted primitive Type/Apply/Literal/Fields equation.
- [specification/overlapping-unions.test](../tests/specification/overlapping-unions.test):
  UnionType text goldens and Facet/OpenFields metadata.
- [examples/types.test](../tests/examples/types.test): recursive indexes,
  descriptor expectations and descriptor destructuring.
- [examples/expressions.test](../tests/examples/expressions.test),
  [examples/patterns.test](../tests/examples/patterns.test),
  [language/types.test](../tests/language/types.test),
  [setup/alternatives.test](../tests/setup/alternatives.test) and
  [postfix/values.test](../tests/postfix/values.test): type-description expectations.

The audit reviewed all 23 legacy assertions across 16 cases in six files; eleven
relate directly to descriptor/adapter clusters. The remaining authored grammar
and quote cases need their own reconciliation, not blanket removal.

Preserve type-valued factory and matcher behavior through destination syntax,
type equality or approved type-text round trips. Keep prototype limitations on
host. Public predicate representation and decoding remain pending; do not turn
them into invented rejection contracts or replacement APIs.

## Exceptions and prevention

Do not ban constructor spellings globally. `Type(...)` appears in approved D19
concrete-union reconstruction annotations. `Postfix(:@, 1)` can be ordinary
decoy data tested against a genuine postfix value. A user-defined grammar named
Syntax is not the compiler's Syntax. Apply, Language and Expression can also be
legitimate authored data.

Add the destination-contract boundary to the migration checklist and agent
guidance now. A later focused guard may flag native adapter use for review, with
explicit host fixtures and authored-name exceptions. It must not reserve general
constructor names. This audit does not add that guard or remove runtime APIs.

## Coordination and completion

Coordinate batches 1–3 with the migration owner; do not race another migration
touching the same source and host files. Batch 4 includes extracted examples.
Batch 5 depends on the approved meaning of each case and may expose questions for
the project chat rather than implementation tasks.

For each cleanup, update [TEST-MIGRATION.md](TEST-MIGRATION.md),
[TEST-MIGRATION-AUDIT.md](TEST-MIGRATION-AUDIT.md) and, where affected,
[LEGACY-ASSERTIONS.md](LEGACY-ASSERTIONS.md). Record source-to-host coverage,
retained language assertions and pending decisions explicitly.

Run affected source cases, mapped host checks, extraction/playground checks when
examples move, then `just check` on the final implementation head. Distinguish
observed results from environment-limited checks. Passing existing tests alone
does not show that their contracts describe the intended language.
