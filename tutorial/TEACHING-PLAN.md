# Teaching plan: Patterns as Types tour

Status: initial tutorial draft, 9 November 2026.

## What was recovered

The original chat’s full conversation was unavailable. The recovered outline below
is a reviewer proposal, not an accepted syllabus.

A teaching outline **was** found in an artifact left by the original session:
`independent-language-design-review-2026-11-03.md`,
section “A smaller-core teaching sketch” (lines 115–126). The recovered excerpt is
preserved in [research/teaching-sketch-2026-11-03.md](research/teaching-sketch-2026-11-03.md). This is an independent reviewer’s proposal,
not evidence that the author approved its precise order.

Its proposed progression was:

1. **Trees and packs:** atoms, application heads, fields and rows. Distinguish
   grouping, argument/result packs, lists and explicit tuple constructors early.
2. **Patterns:** structural recognition and captures; exact constructed shapes,
   open boundary packs, positional/labeled remainder axes, alternatives and repetition.
3. **Interpretations:** concrete descriptor-sensitive spaces; refinements preserve
   the space; abstract domains preserve member identity. Explain that identical
   printed forms in distinct spaces need not be the same value before teaching
   interoperability.
4. **Evaluation:** values, bindings, complete-pack calls, functions and ordered
   matching. Explain overload names and function values explicitly.
5. **Inert syntax and stages:** raw trees, typed grammar interpretation, explicit
   interpolation, then registered macro expansion.

The review advised presenting accessors as declaration products and avoiding
requirements that beginners understand `Recur` or `OpenFields` just to construct
one rectangle. Those are useful teaching constraints, even while the language
continues to change.

The current repository's [Vision](https://github.com/johnwarden/pattern-language/blob/de36017f014f795cf63cf40ead94fe791f58c213/VISION.md), [Roadmap](https://github.com/johnwarden/pattern-language/blob/de36017f014f795cf63cf40ead94fe791f58c213/ROADMAP.md),
[bootstrap guide](https://github.com/johnwarden/pattern-language/blob/de36017f014f795cf63cf40ead94fe791f58c213/BOOTSTRAP-GUIDE.md) and
[decision record](https://github.com/johnwarden/pattern-language/blob/de36017f014f795cf63cf40ead94fe791f58c213/design/LANGUAGE-DECISIONS.md) are semantic references. They do
not contain a separate agreed beginner-tour sequence in the inspected snapshot.
The README's Rectangle demonstrates the intended model, but its `type Rectangle
concrete …` spelling is future notation in this snapshot. It is not suitable as a
runnable first lesson.

## Current author direction

The author explicitly requested a runnable typed Rectangle as the first page,
a small and elegant Tour of Go-style UI, and one Markdown source per tutorial
page. Fenced `pattern` blocks are the runnable examples. The site should render
those same documents rather than maintaining separate prose inside components.

This direction determines the opening. The following page order is a **new
proposed adaptation**, not a recovered prior agreement. It starts with one useful
whole example, then explains the shared pattern idea through increasingly broad
contexts.

## Opening sequence

| Page | Main idea | Why here |
| --- | --- | --- |
| 1. A typed Rectangle | A concrete shape described by a type pattern; accessors and `::` | Gives the requested immediate, useful example. |
| 2. Take a value apart | The corresponding structural binding pattern captures fields | Makes recognition plus capture tangible. |
| 3. Patterns in function inputs | The same pattern belongs in a function signature | Demonstrates reuse without a new extraction mechanism. |
| 4. Choose a matching arm | Alternatives and ordered match arms | Expands one shape into a small family; names the interpretation boundary. |
| 5. Capture the rest | List convention and positional rest capture | Introduces repetition without vertical/labeled remainder rules yet. |
| 6. Types are values | An ordinary function parameterized by a type value | Bridges toward generic patterns and grammar interpretation. |

Keep every program standalone. Definitions stay close to their use, logical
sections have blank lines, and examples have no numbered `observed` captures.
Use current working syntax and authored results; never turn an implementation
output into a new language specification.

## Later chapters, still proposed

- **Read the surface carefully:** atoms/symbol classes, heads, grouping versus
  complete packs, labels, successive packs, dot/infix/postfix sugar. Teach equal
  precedence and right associativity explicitly rather than relying on familiar
  arithmetic precedence. Distinguish a name resolving to a function value from
  invocation, according to the accepted specification and available runtime.
- **Values and interpretations:** descriptor identity, exact numeric literals,
  explicit conversion, alternatives versus abstract unions, designation and
  one-boundary projection. State each current implementation boundary.
- **Compose patterns:** list/rest dimensions, labeled fields and explicit openness;
  then defaults, whose role differs from type definitions.
- **Code and grammars:** inert syntax, typed quotes and explicit interpolation;
  grammar-directed data; explicit registration, expansion and macro hygiene.
- **Beyond the running prototype:** checking evidence, modules, portable callable
  values and self-hosting only as their approved specs and implementations land.

Do not present unresolved or unimplemented behavior as a runnable lesson. Raw
runtime expressions, function-value closure rules and future `toString` changes
must follow the current approved specs; this tour does not settle them. The
historical review's statements can be superseded by later author decisions.

## Content contract

`manifest.json` is the ordered navigation list. Each listed Markdown document has
`title`, `slug`, `section` and `summary` frontmatter, then its human-readable page.
Every fenced `pattern` block is an independent editable/runnable program, executed
in a fresh interpreter. Prose and inline code are explanatory; only the fenced
programs are sent to execution. “Try it” edits are suggestions, not separately
executed setup. `expectedOutput` in the manifest records the checked starter
program for smoke verification, not a result to display instead of running code.

The implementation is experimental. A compact site-level prototype label is enough;
readers should not repeatedly navigate implementation disclaimers inside lessons.

## Starter-program verification

All six starter programs were executed independently with the repository's native
`Interpreter` at `de36017f014f795cf63cf40ead94fe791f58c213` on 9 November 2026.
Their results match `manifest.json`. This verifies the opening tour programs,
not the proposed later chapters or any unimplemented language feature.

Before check-in, all six programs were rechecked against the native source on
`master` at `d08273808aef5e76168ede13fb6f0f8fee00a4d9`; results still match the
authored manifest. The repository-wide `just check` could not run in this
environment because `just` was unavailable.

