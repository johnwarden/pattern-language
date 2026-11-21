# Concrete and abstract declaration syntax

Status: **landed** in [#48](https://github.com/johnwarden/pattern-language/pull/48).
Historical note: implemented on `codex/spec-type-declaration-syntax-2026-11-09`.
Non-generic `concrete` / `abstract` recognition is on master. [#88](https://github.com/johnwarden/pattern-language/pull/88)
retargets the destination spelling to `struct` / `pattern`. Generic, facet and
evidence extensions remain following slices.

## Target the existing tests first

Read AGENTS.md, ROADMAP.md and `design/TESTING-WORKFLOW.md`. The specification-first
corrections in #46 are integrated: C05 opens a concrete Box through explicit match,
C12 distinguishes outer/inner None, and C13 covers a plain abstract type expression.
Do not rewrite the specified syntax to bootstrap spelling to remove its todos.

| Landed bootstrap spelling (live checks) | Contract |
| --- | --- |
| `type Rectangle concrete Rect(w :: Rational, h :: Rational)` and `concrete Rect(Rational, Rational)` | First C05 assertion in `tests/specification/type-values.test` |
| Two named concrete alternative sets with shared symbol spellings | C06 in the same file: `E_INCOMPARABLE_TYPES` |
| `abstract Float32 \| Float64` / `type EitherFloat abstract …` | C13 in `tests/specification/interpretations.test` |
| Named declaration versus capture-free plain construction | C16 in `tests/specification/declarations.test` |

Destination spelling under #88 uses `struct` / `pattern` for the same semantics.

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

The first C05 assertion, C06, C13 and the non-generic C16 checks are ordinary
under the landed bootstrap spelling. New
[source regressions](../../tests/specification/declaration-syntax.test) cover
recursive groups and retained duplicate/collision errors. Host and LSP checks
cover recognition, transport and ranges. Remaining parameterized and evidence
obligations stay todo.

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
