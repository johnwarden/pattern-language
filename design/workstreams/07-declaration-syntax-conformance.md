# Concrete and abstract declaration syntax

Status: active implementation, claimed by session `/root/declaration_syntax_48`
on branch `codex/spec-type-declaration-syntax-2026-11-09`. Latest rebase uses
master `a885dfa33945b00ba82d6cb65275ed8206a583dd`, including the other agent's #54,
#55 and #56 migrations verbatim. This work implements contracts
already executable under `tests/specification/`; the generic, facet and evidence
extensions remain following slices.

## Target the existing tests first

Read AGENTS.md, ROADMAP.md and `design/TESTING-WORKFLOW.md`. The specification-first
corrections in #46 are integrated: C05 opens a concrete Box through explicit match,
C12 distinguishes outer/inner None, and C13 covers a plain abstract type expression.
Do not rewrite the specified syntax to bootstrap spelling to remove its todos.

| First slice                                                                                          | Existing contract                                                                                                                       |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `type Rectangle concrete Rect(w :: Rational, h :: Rational)` and `concrete Rect(Rational, Rational)` | First C05 assertion in `tests/specification/type-values.test`: equal type values; declaration products are separate                     |
| Two named concrete alternative sets with shared symbol spellings                                     | C06 in the same file: values from distinct concrete spaces report `E_INCOMPARABLE_TYPES`                                                |
| `abstract Float32 \| Float64`                                                                        | First C13 assertion in `tests/specification/interpretations.test`: ordinary construction agrees with the existing abstract union domain |
| `type EitherFloat abstract Float32 \| Float64`                                                       | Remaining C13 assertions: retain each member's concrete identity and reconstruct supported typed text                                   |
| A named concrete declaration versus capture-free plain construction                                  | C16 in `tests/specification/declarations.test`: named accessors work, plain captures reject; integrate #32's implementation             |

Before implementation, trials with todo disabled observed E_LANGUAGE for the
non-generic targets. The generic C05 siblings failed separately at the tight-angle
parser rule. Focused grammar, layout/end, transport and outline regressions were
added before their corresponding fixes.

## Implementation boundary

Recognize these forms through the shared grammar and ordinary elaboration paths.
Reuse the concrete and abstract constructors, descriptor identity and named
declaration/product registration. Plain concrete/abstract expressions produce type
values without installing accessors. Physical labels remain structural; captures
belong to named declarations. These grammar keywords do not add primitive reserved
symbols or a public descriptor/metatype taxonomy.

Keep complete pack boundaries, inert quotations and expected-result data,
canonical text, source spans and explicit layout termination. Do not use textual
search/replace or a separate evaluator to make the new spelling appear to work.
Preserve supported bootstrap spelling until its replacement is deliberate.

Own the narrow grammar recognition/form-dispatch changes and corresponding tests.
The delivered source changes are in `src/grammar.ts` and the ordinary `type`
setup boundary in `src/test-suite.ts`. Explicit source grammar rules elaborate
structurally into the existing Definition/TypeExpression/UnionTypeExpression
operations, reusing runtime declaration groups, products and constructors.
`default.pattern` exposes the same forms. #31 and #32 are integrated; #39 is closed and its accepted concrete
boundary contracts are on master. Do not change the other agent's migration
branch. Check master before each publish and at meaningful checkpoints; rebase
and rerun affected checks whenever it advances. Record the base SHA with results.
The specification queue lives on master rather than an implementation branch.

## Completion and following obligations

The first C05 assertion, C06, all C13 assertions and both future C16 assertions
are ordinary checks. Existing C04 construction, C17's factory positive control,
C19/C20/C21 controls and C23's supported round trip also pass once declaration
recognition is available; only those exact fulfilled assertions are promoted.
There are 15 promotions from master, plus retirement of the fulfilled legacy/todo
setup alternative. New [source regressions](../../tests/specification/declaration-syntax.test)
cover recursive groups and retained duplicate/collision errors. The
[host checks](../../test/declaration-syntax.test.ts) cover recognition ambiguity,
grammar transport, source spelling, declaration tails, aligned ends and inert
Code. [LSP checks](../../test/lsp-analysis.test.ts) retain complete declaration
and name ranges through the same grammar. Validation and its exact head are in
the PR description; a full local `just check` is unavailable because just is not
installed. Each merge requires Jonathan's authorization.

Parameterized `type Box<T> ...` / `Box<String>` (remaining C05 and C12/C18),
refinement declarations/evidence (C07-C10), facets and later projection/coverage
obligations remain explicit following conformance slices. Do not claim a whole
case family fulfilled merely because its declaration now parses. If a particular
round-trip case reaches the deferred inspection/decoding boundary, keep that
specific obligation pending and document the smallest example rather than
inventing a representation.

Equivalent declarations and accessor collisions remain errors. The unambiguous
qualifier, T+ syntax, numeric families, implicit rounding, first-class overload
sets and public inspection/decoding remain outside this slice. Inbox stays
optional by default. No declaration keyword or generic proposal beyond the
specific executable targets is ratified by this handoff.
