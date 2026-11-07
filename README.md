# Pattern language

Source: [johnwarden/pattern-language](https://github.com/johnwarden/pattern-language) (private).

One structural pattern language for data types, bindings, function and macro
signatures, matching, and DSL grammars. The goal is a small, consistent language
with structural interoperability, canonical typed text, and an eventual source
interpreter/compiler. The TypeScript implementation is the bootstrap reference.

## Design and implementation status

The revised value model extends beyond the bootstrap. All **127 source cases run**:
**247 assertions pass (70 legacy)** and **116 todo assertions fail as expected**.
A fulfilled todo fails the suite and requests removal of its marker. All 76
playground examples share this corpus. TypeScript retains host/API/DOM checks. The complete verification gate passes
730 tests, with no skipped cases; build and type checking also pass.

| Intended contract | Current bootstrap |
| --- | --- |
| Concrete construction, identity-preserving refinements and abstract views | Structural types, subset checks, abstract slots and facets; revised boundary rules still need integration |
| Numeric literals denote exact Rational values; `0f` is a Float64-rounded Rational | JavaScript-backed Int/Float/Float32; Number aliases Float |
| General abstract unions; unambiguous grammars are a separate requirement | All union members must pass the current disjoint-syntax check |
| Named type declarations register accessors; plain type construction is capture-free | `def ... type ...` and existing type-expression accessor products |
| Structured values need an established concrete interpretation | Raw Expression compatibility values are still allowed |
| Refinement requirements use evidence; projection crosses one explicit boundary | Runtime subset machinery; no complete proof checker |
| Test DSL supports assertion-level todo and legacy contracts | Implemented source-defined steps, grouped .test files, executed expected-failure assertions, shared CLI/CI/browser corpus |

ConstructedBy is tabled until refinement decoding is solved. IEEE special-value
identity remains deferred. Specialization is only a later compiler optimization.
There is no source-language module system, static checker, source `code.evaluate`,
or compiler yet.

## Read the specification

- [Roadmap](ROADMAP.md): current state, boundaries, milestones and completion gates.
- [Value spaces](VALUE-SPACES.md): identity, construction, projection and abstract storage.
- [Type values](TYPE-VALUES.md): declarations, descriptors, factories and typed text.
- [Grammar](GRAMMAR.md): shared surface rules and intended interpretation boundaries.
- [Decision record and 27 design cases](design/LANGUAGE-DECISIONS.md): reasons,
  statuses and decision-to-case coverage.
- [Test-suite milestone](design/TEST-SUITE.md): revised DSL, todo and selective migration.
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
under `tests/`, and contain one or more `test` blocks. The runner
recursively discovers every `.test` file; the playground embeds runnable cases
from `tests/examples/`.

```text
test "Current and future literal types"
  expect :Widget result Widget :: UpperCamelSymbol
  legacy expect 5 result 5 :: Expression
  todo expect 5 result 5 :: Rational
end
```

Modifiers apply to assertions, never whole tests. Ordinary and legacy assertions
must pass. Todo assertions run and must fail; failures are silent, while successes
fail the suite with a request to remove todo. Shared setup, malformed source and
internal harness errors still fail normally. Values and their observed types are
checked independently; expected values use data syntax, not expressions to evaluate.
A result annotation replaces separate value/type clauses. Destructure multi-return
calls once and check each capture; use assert for predicate checks.

[The suite specification](design/TEST-SUITE.md) defines the grammar and scope;
[the migration inventory](design/TEST-MIGRATION.md) records coverage. The next
language milestone is **5a.2: align the bootstrap with the revised value model**.
It progressively replaces legacy checks with fulfilled future contracts. No
self-hosted evaluator is required to run the suite.

[Every legacy assertion is accounted for](design/LEGACY-ASSERTIONS.md): 48 have
todo replacements and 22 await explicit design decisions. Supported behavior uses
ordinary checks; an older test is not automatically legacy.

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

Submit a REPL entry with a blank line; `:quit` exits. Program blocks require a
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
just test-language                 # recursively scans tests/**/*.test
just test-language --list
just test-language tests/bindings
```

The browser and CLI use the same TypeScript modules. Host tests retain implementation
invariants and actual-control checks for every playground example in fresh and
restored sessions. Todo failures are counted separately from passing assertions.
