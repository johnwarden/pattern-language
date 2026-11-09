# Workstream 3: plain type values and declaration products

Status: implementation rebased by the coordinator after #31; local Node checks pass.
Original implementation was claimed by session
bc-7204d047-b24b-5bf8-b29e-d6a2f331f378
(https://cursor.com/agents/bc-7204d047-b24b-5bf8-b29e-d6a2f331f378) on branch
`codex/workstream-declaration-products-2026-11-09`. The updated candidate passes typecheck/build, 696 host tests and 255 source cases.
Full `just check` is unavailable locally because just is not installed; current-head
CI supplies the shell/recipe gate before merge.

The executable contract is [declarations.test](../../tests/specification/declarations.test).
This file tracks implementation ownership and validation, not a separate language
specification. The [adjacent note](../../tests/specification/declarations.md)
explains the supported controls and remaining syntax todos.

## Accepted behavior

Ordinary type construction is capture-free and has no accessor-installation
effect. Named declarations register their own scoped captures/accessors and local
printing metadata separately from the structural type value. Physical field
labels and nested concrete boundaries still participate in type identity;
positional capture names do not.

The author has deferred equivalent-declaration/accessor collision policy. Keep
both as errors for now. That does not prohibit repeated capture-free construction
of an equal type value or equivalent types in independent lexical scopes.

## Scope and boundaries

- Separate ordinary construction from declaration products in the existing
  compiler/registration machinery; preserve the common pattern matcher.
- A plain construction that attempts to declare capture/accessor names must fail.
  A named declaration may install its permitted accessors. Plain construction
  must not install, replace or leak methods, including when equal descriptors
  are cached or reused across scopes.
- Keep field-label structure distinct from accessor metadata. Do not reject
  physical labels merely because capture metadata is forbidden in plain values.
- Preserve factories, recursive declarations, structural equality, source-defined
  optional types, local names and fresh-context typed text within their supported
  subset. Cache/interning identity must not become public type identity.
- Maintain current duplicate-declaration and accessor-collision diagnostics and
  rollback behavior, including valid accessor overloads on disjoint domains.
  Add no alias priority, multiple-name policy, implicit bundle
  import, preferred-name selection or first-match resolution.
- Test C05/C16/C18 semantics using supported bootstrap notation where possible.
  Declaration/angle-parameter syntax remains an existing todo target in #48; do
  not invent grammar or remove a todo solely because another spelling works.
- The public Expression/Code/Type inspection and decoding boundary remains open
  for the author's examples. Do not introduce coercions or a metatype redesign.

## Ownership and coordination

Own plain type construction, definition/factory products and accessor registration
in `src/runtime.ts`, and relevant pattern compiler/type-product code. Own the
associated declaration tests. Announce additional shared methods before editing.
The String workstream owns literal evaluation and text-returning native paths;
the baseline audit does not edit implementation or declaration-related promotions.

Keep this branch independent from the String and baseline branches during
implementation. Review String alignment first, then rebase this branch against
the updated trunk and rerun checks. Let the coordinator reconcile shared roadmap
and status prose. Avoid whole-file formatting or unrelated fixture rewrites.

## Acceptance criteria

- Plain construction has no accessor side effects; explicit declarations install
  the expected scoped accessors. Negative capture/collision cases report errors.
- Equal capture-free descriptors interoperate across independent scopes without
  importing a common nominal definition or leaking another scope's metadata.
- Equivalent declarations visible in the same scope still fail. Repeated pure
  type-value construction remains valid; collision policy is not broadened.
- Definition rollback, recursive factories, ordinary matching, optional convention
  and fresh-context transport remain correct. Relevant source/host regressions
  and the final PR's full `just check` gate pass.

Use `just test-language tests/specification/declarations.test` plus focused host
tests while working. Merge requires the author's explicit authorization for this
PR. Report the commit, validation and minimal unresolved examples when ready.
