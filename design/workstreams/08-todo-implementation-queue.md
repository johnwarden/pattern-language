# Proposed implementation queue from executable todos

Proposed scopes, not new language decisions or implementation claims. The survey
inspected master `9888c3d3d2495012c8f18b6c6c81d89326b3581d`: 67 todo assertions
across 36 cases in 12 files, with no whole-test todos or todo setup steps.
The final named-function test expansion adds four more assertions. The original
58 todos and the expanded named-function cases were trialled as ordinary checks
to distinguish their actual blockers from their titles.

Use current master and the linked `.test` cases before claiming work; other
agents are actively migrating tests. This queue must not become a parallel prose
specification. [#61](https://github.com/johnwarden/pattern-language/pull/61)
implements scope 1 against the current application-head contracts.
[#62](https://github.com/johnwarden/pattern-language/pull/62) implements scope 2.
The mirrored-row-spreading work landed as ordinary C20 coverage plus focused
[source contracts](../../tests/spreading/vertical-values.test). These are
implementation statuses, not merge authorizations.

| Proposed PR | Target contracts and observed blocker | Scope and dependencies |
| --- | --- | --- |
| 1. Reject non-callable application heads during evaluation | Ordinary checks in [application-heads.test](../../tests/specification/application-heads.test): Bool, ReservedSymbol, evaluated Symbol and typed constructed-data heads report `E_NOT_CALLABLE` during evaluation. Unquoted `Tag(1)` still constructs; a raw Expression term may occupy a later head. | Implemented on [#61](https://github.com/johnwarden/pattern-language/pull/61): `invoke` classifies the concrete head before unwrapping; actual `Type`/`String` functions still dispatch. Host checks keep the evaluation phase. Not a merge authorization. |
| 2. Simple angle-parameter type declarations/applications | Remaining C05/C18 and the C12 absence-designation assertion: seven generic-dependent trials stop at tight-angle parsing; five appear independent of extraction coverage. | Shared parser/grammar and existing type factories. Implement the accepted Box<T>/Box<String> slice without variadics, constraints, family recovery or runtime-pack flattening. Validate comparison spacing, canonical/inert Code and independent structural interop. |
| 3. Refinement declaration surface | Eight C07–C10 todos in [refinements.test](../../tests/specification/refinements.test) stop at declaration recognition first. | Follow #48's structural elaboration into existing refinement construction. Add focused base-identity/no-accessor controls. Coordinate with PR 2's grammar owner; do not claim evidence checking or introduce predicate-based overload fallback. |
| 4. Mirrored vertical spreading | C20 reconstruction in [spreading.test](../../tests/specification/spreading.test) is ordinary coverage. The three remaining scenarios require evaluated-Code assert. | The single-row-template slice and focused [source cases](../../tests/spreading/vertical-values.test) preserve dimensions, ragged rows, empty matrices and empty rows. Broader row templates remain work. |
| 5. Concrete boundary in ordinary constructor bindings | [raw-expressions.test](../../tests/specification/raw-expressions.test), “Ordinary constructor bindings do not project a concrete value,” currently succeeds. | Audit existing ordinary fixtures first, especially interpreted Rect destructuring in `tests/bindings/defaults.test`. Preserve their default/capture observations through explicit match; separately enforce binding rejection. Retain raw Expression destructuring, whole-value binding and one-boundary match. |
| 6. Closed single-definition function values | All 17 todos in [named-function-values.test](../../tests/specification/named-function-values.test) currently stop at E_FUNCTION_NOT_VALUE. | Representation preflight first: complete immutable definition/dependency values, captures, recursive groups, labels/rest/packs/defaults and structural identity. A name handle or hidden ambient closure is insufficient. Overloaded constants, group selection and public Function/Library text remain pending. |

PRs 1 and 2 can start in parallel. Give 2 and 3 one grammar owner or serialize
them. PR 4 owns collection evaluation; PR 5 owns binding/pattern policy and its
fixture audit. Stage PR 6 after callability and the representation preflight.
Keep ownership explicit around the shared runtime file, refresh master before
publishing, and do not race the coordinated expectation-DSL migration.

For PR 6, deliberately reconcile the superseded ordinary “Defined functions are
not values / cannot be passed / cannot be returned” cases in
`tests/language/namespaces.test`, plus the E_FUNCTION_NOT_VALUE checks in
`test/declaration-boundaries.test.ts` and `test/type-operations.test.ts`. Nearby
accessor, native and overloaded-name cases have distinct policies; do not remove
them indiscriminately. The [complete test proposal](../../specs/inbox/named-function-value-tests.md)
separates agreed obligations from undecided representation and selection cases.

## Small cleanup and work not yet ready

C17's two negative subjects already reject (E_PATTERN_MISMATCH and E_TYPE_DEFAULT),
and C24's two-result binding already rejects (E_PATTERN_MISMATCH). Their authored
phrases differ. Choose diagnostic alignment or deliberate contract revision;
do not silently substitute observed output or advertise missing enforcement.

- C11 stops at the single-arm extraction statement syntax; existing arrow-match
  one-boundary controls already work.
- C14's public unambiguous qualifier/certification remains pending; #43 stays parked.
- C15's separate record facets work, while `&` currently constructs raw data.
  A bounded facet-composition proposal needs explicit compatibility rules.
- C22 stops at absent Int8/Int64 before keyword remainder behavior.
- PrimitiveType, numeric-width and QuotedSymbol cases need their specified
  representation/vocabulary contracts, not generic evaluation patches.
- Lifting stops at absent sqrt before demonstrating lifting behavior.
- C23's remaining case reaches evaluated-Code assert, not a round-trip failure.
- C26's three todos are intentional harness fixtures, not language backlog.
- C27's two lexical candidates are explicitly unapproved.

The [approved type-syntax retirement](../../specs/approved/retire-legacy-type-definition-syntax.md)
is a separate breaking-change scope. New declaration/factory support and corpus/
prelude migration are prerequisites; the ordinary Type-valued-function boundary
still needs clarification. Do not bundle removal into the expectation rename or
the small syntax slices above without explicit coordination.
