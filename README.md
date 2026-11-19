# Pattern language

Source: [johnwarden/pattern-language](https://github.com/johnwarden/pattern-language) (private).

One structural pattern language for data types, bindings, function and macro
signatures, matching, and DSL grammars. The goal is a small, consistent language
with structural interoperability, canonical typed text, and an eventual source
interpreter/compiler. The TypeScript implementation is the bootstrap reference.

## Design and implementation status

The revised value model extends beyond the bootstrap. The source suite under
`tests/` is the shared language corpus; playground examples use the same files.
A fulfilled todo fails the suite and requests removal of its marker. TypeScript
retains host/API/DOM checks. `just check` is the full CI gate: lint, typecheck,
build, host tests and the source suite.

| Intended contract | Current bootstrap |
| --- | --- |
| Concrete construction, identity-preserving refinements and abstract views | Structural types, subset checks, abstract slots and facets; revised boundary rules still need integration |
| Numeric literals denote exact Rational values; `0f` is a Float64-rounded Rational | Exact Rational values and syntax payloads; explicit Float32/Float64 conversion and canonical numeric text |
| General abstract unions; unambiguous grammars are a separate requirement | Overlapping `UnionType` members are allowed; `unambiguous` is unimplemented |
| Named type declarations register accessors; plain type construction is capture-free | `def ... type ...` and existing type-expression accessor products |
| Raw runtime Expressions are allowed for now; expected types can establish concrete interpretations | Raw construction, designation and one-boundary explicit matching work; ordinary constructor-binding rejection remains todo |
| Refinement requirements use evidence; projection crosses one explicit boundary | One-boundary match projection and direct-member designation; proof checking remains future work |
| Test DSL supports whole-test todo and assertion-level todo/legacy contracts | Implemented source-defined steps, grouped .test files, executed expected-failure assertions, shared CLI/CI/browser corpus |

ConstructedBy is tabled until refinement decoding is solved. IEEE special-value
identity remains deferred. Specialization is only a later compiler optimization.
There is no source-language module system, static checker, source `code.evaluate`,
or compiler yet.

Editor diagnostics and outlines are available through the
[Node language server](editors/lsp/README.md), including a Sublime Text 4166
configuration. Analysis never executes open programs or tests.

## Read the specification

- [Roadmap](ROADMAP.md): current state, boundaries, milestones and completion gates.
- [Value spaces](VALUE-SPACES.md): identity, construction, projection and abstract storage.
- [Type values](TYPE-VALUES.md): declarations, descriptors, factories and typed text.
- [Grammar](GRAMMAR.md): shared surface rules and intended interpretation boundaries.
- [Postfix conventions](design/POSTFIX.md): generic operators, source-defined optionals, nested union designation and future lifting.
- [Decision record and 27 design cases](design/LANGUAGE-DECISIONS.md): reasons,
  statuses and decision-to-case coverage.
- [Test-suite milestone](design/TEST-SUITE.md): revised DSL, todo and selective migration.
- [Development workflow](design/TESTING-WORKFLOW.md): spec branches, active tests
  and implementation PRs.
- [Language specifications](specs/README.md): accepted decisions and how to
  propose changes.
- [Executable specification](tests/specification/README.md): authoritative `.test`
  contracts and adjacent explanatory notes.
- [Vision](VISION.md) and [engineering checklist](TODO.md).

Working prototype syntax is documented separately in the
[bootstrap guide](BOOTSTRAP-GUIDE.md), [bootstrap grammar](GRAMMAR-BOOTSTRAP.md),
and [bootstrap type reference](TYPE-VALUES-BOOTSTRAP.md). Their old restrictions
must not be mistaken for the revised intended language.

## The intended model

Examples in this section specify future behavior; the declaration spellings and
angle type parameters are working notation where still marked provisional.

```text
type Rectangle concrete Rect(w :: Float32,h :: Float32)
r = (Rect(2,3) :: Rectangle)
(r.w,w(r))
```

Concrete types establish structural value spaces. Refinements preserve a base
space while adding a guarantee. Abstract unions/facets preserve the actual member
space; storing through an abstract variable does not change the value.

```text
type EitherFloat abstract Float32 | Float64
(a :: EitherFloat) = float32(0.5)
(b :: EitherFloat) = float64(0.5)
```

The two members can use overlapping numeric syntax. Typed text supplies enough
information to recover the member. A separate unambiguous-grammar requirement
supports DSL text that does not need reconstruction annotations.

Every numeric literal denotes an exact Rational value. `0f0.1` denotes the exact
Rational selected by Float64 rounding, rather than a Float64-typed value. Exact
designation cannot silently round; explicit converters return typed values:

```text
(0.5 :: Float32)       # exact
float32(0.1)           # explicit rounding, returns Float32
(0.1 :: Float32)       # rejected: not exactly representable
```

One application has an expression head and one pack. `f(a)(b)` is distinct from
`f(a,b)`; `f()` is distinct from `f`. Dot notation preserves that structure:
`a .b c` means `b(a)(c)`. Infix operators require spaces, have equal precedence,
and associate right. Patterns share these trees, with explicit role differences
for binding defaults, type accessors, ordered match arms and macro staging.

## The conformance DSL

Milestone **5a.1 is implemented**. Test files use `.test`, live in broad groups
under `tests/`, and contain one or more `test` or `todo test` blocks. The runner
discovers `.test` files under `tests/` and tests in `pattern` and `pattern test` fences under
`specs/`. The playground embeds runnable cases from `tests/examples/`.

```text
test "Current and future text result types"
  expect :Widget is Widget :: UpperCamelSymbol
  expect 0.1 is 0.1 :: Rational
  legacy expect toString(Rational)(0.1) is "0.1" :: Expression
  todo expect toString(Rational)(0.1) is "0.1" :: String
end
```

`todo` also applies to whole tests. Such cases run as one expected-failure unit,
allow partial progress, and require removing the marker once the full case passes.
`legacy` applies only to assertions and setup bindings/definitions.
Legacy setup supplies current definitions; adjacent todo setup is tried in isolation
from the same incoming scope, so duplicate names cannot mask an implemented replacement.
Ordinary and legacy assertions
must pass. Todo assertions run and must fail; failures are silent, while successes
fail the suite with a request to remove todo. Shared setup failures count as
expected only inside a whole-test todo. Fixture failures, malformed source and
internal harness errors still fail normally. Values and their observed types are
checked independently; expected values use data syntax, not expressions to evaluate.
A result annotation replaces separate value/type clauses. Destructure multi-return
calls once and check each capture; use assert for predicate checks.

[The suite specification](design/TEST-SUITE.md) defines the grammar and scope;
[the migration inventory](design/TEST-MIGRATION.md) records coverage. The next
language milestone is **5a.2: align the bootstrap with the revised value model**.
It progressively replaces legacy checks with fulfilled future contracts. No
self-hosted evaluator is required to run the suite.

[Every legacy assertion is accounted for](design/LEGACY-ASSERTIONS.md) with a same-subject todo or a specific unresolved decision. Supported behavior uses ordinary checks. Run `just test-language` for current counts.

## Getting started

Prerequisites: Devbox, and direnv hooked into your shell.

```sh
git clone <repo> && cd <repo>
direnv allow      # Devbox pins tools; init_hook installs git hooks and npm ci when the lockfile changes
just              # lists recipes
```

Cloud VMs have no direnv; run `just` directly there. The justfile is the command
surface. `just check` is the full CI gate.

## Run the current bootstrap

Word symbols use the ASCII classes LowerCamelSymbol, UpperCamelSymbol and
UpperSnakeSymbol. One- and two-letter upper-snake words need a trailing underscore:
PORT is upper snake, with port / Port as its camel equivalents. Unicode strings are unchanged. The
possible constant-binding role of upper snake remains a separate design choice.

Node 24 or later executes the TypeScript directly. Programs and REPL entries print
annotated values, for example `Widget :: UpperCamelSymbol`; --parse prints syntax:

```sh
just run demo.pattern
just run demo.pattern --grammar default.pattern
just repl
just run demo.pattern --parse
just watch demo.pattern
```

A finished grammar form runs on its last line; a blank line still submits. `:quit` exits. Program blocks require a
final result pack, possibly empty. The REPL also accepts bindings and definitions;
failed entries do not commit changes. Current type-factory syntax uses ordinary
packs, for example `def List(T :: Type) ...`, not the proposed angle sugar.

Open `index.html` for the generated browser playground. Its editable examples and
expected results come from shared source Test files; selecting an example does not run it.
Drafts use best-effort browser storage, with Save session / Load session for backup.

```sh
just setup
just check
just typecheck
just build
just test
just test tests/examples/patterns.test # one source test file
just test tests/examples              # source tests in a directory
just test test/indent-prefix.test.ts  # one host test file
just test-language                   # runs .test files and executable spec fences
just test-language --list
just test-language tests/bindings
```

The browser and CLI use the same TypeScript modules. Host tests retain implementation
invariants and actual-control checks for every playground example in fresh and
restored sessions. Todo failures are counted separately from passing assertions.

Source test runs print each `.test` filename before its cases. Malformed files
report the filename and source diagnostic.
