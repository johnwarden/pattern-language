# Source test DSL

The external TypeScript runner reads ordinary source-defined test data. All assertions
execute; the suite does not install source code.evaluate or runtime introspection.

## Files and basic forms

The runner recursively discovers tests/**/*.test, grouped by broad topic. Each file
contains one or more named test blocks. Shared setup belongs inside the test. IDs
are root-relative file paths without .test plus the title slug, and survive selecting
only a subset or inserting/reordering cases. Discovered symlinks are not traversed.
Duplicate title slugs in a file reject. Modifiers apply to assertions and setup,
never whole tests.

```text
test "A value and a predicate"
  def Rectangle type Rect(w :: Float, h :: Float)
  r = Rect(2, 3) :: Rectangle
  expect r.w result 2 :: Float
  assert (r.h == 3)
end

test "Current and future literals"
  expect :Widget result Widget :: UpperCamelSymbol
  legacy expect 5 result 5 :: Expression
  todo expect 5 result 5 :: Rational
end
```

The schema is generated from src/test-schema.ts into examples/test-schema.pattern.
TestFileContent has a required first Test row and a vertical Test* tail. ExpectedResult
uses an ordinary pattern containing literal ::, quoted ::: in its definition:

```text
def ExpectedResult type (expected :: Expression) ::: (expectedType :: Expression)
def ResultExpectation type (:expect (subject :: Expression) :result (result :: ExpectedResult))
```

The result delimiter is required. There are no value/type keyword clauses or results
pack expectations. Multiple expect lines describe distinct scalar observations.
Malformed inner source stays inside a string passed to `parse(Code)`; see Parse
failures of quoted source below.

## Expected data and annotations

```text
test "Symbolic expression data"
  e = :(1 + 1)
  legacy expect e result (1 + 1) :: Expression
end
```

The expected expression is data, not a computation producing 2. Parentheses make
:: apply to the whole expected binary tree. All infix punctuation retains equal
precedence and right associativity, so the ungrouped version is not the same grammar.
Type-expression operands may use local names from setup or a grouped local block.
Expected-type resolution happens before subject evaluation. Expected data is read
only after the result's observed type agrees; invalid data never computes an answer.

A result check requires exactly one positional value, an equal observed type, and
an equal expected value. A broad expected type is not a substitute for exact type
identity. Expected data must have the canonical tree spelling for that type, modulo
surface grouping/formatting normalization. In particular :Widget produces Widget
in UpperCamelSymbol. Quoting Widget in that expected data rejects. The shared printer
uses a space after every comma, without changing the content of string values.

Use assert condition for predicates and assert (condition == False) for negative
predicates. Assert requires one positional value of the actual Bool space, not a
same-spelled constructor from another type and not truthiness. Keep a result check
when the boolean's own type or literal representation is the point being tested.

## Multiple and empty returns

```text
test "Separate return values"
  def dimensions() (2 :: Float, 3 :: Float)
  (width, height) = dimensions()
  expect width result 2 :: Float
  expect height result 3 :: Float
end

test "No return values"
  def nothing() ()
  assert
    () = nothing()
    True
end
```

Destructure a multi-return call once and check its captures separately. Missing or
excess positional returns fail through ordinary binding semantics. Argument packs
still permit ignored extra labels, so separate scalar checks alone are not proof
of exact label sets. Host tests retain direct complete-pack shape/label coverage;
source tests also check labeled capture, missing labels and exact positional arity.
No tuple/unit value or new pack representation is introduced.

Use direct subjects such as expect r.w result 3 :: Float. Keep definitions close to
their uses, put blank lines between tests and logical sections, and avoid numbered
observation captures. Genuine multiple returns may be destructured into descriptive
names. Keep legacy/todo counterparts adjacent so their change is easy to review.

A final ordinary argument-pack row can expose already captured values for a playground
example. It is output, not a check. The example program consists of its setup and
that final pack; checking each capture does not repeat the original call. Single
supported expectations/assertions also provide standalone example programs, even
with accompanying todo assertions. The extracted program excludes todo operands;
the suite still executes every assertion. Todo-only cases are not examples. All 76
existing menu options remain covered through actual controls, fresh/restored sessions.
Each CheckReport records its own actual/expected output rather than only the last
observation. Selecting/building examples never runs them to generate expectations.

## Modifiers, scope and failures

Bindings and definitions may also use legacy/todo prefixes:

```text
legacy def Color type :Black | :White
todo type Color concrete :Black | :White
```

Legacy setup commits current definitions. A consecutive todo setup group is tried
atomically in isolation from the scope before its adjacent legacy setup group.
Successful setup fails with “This setup now succeeds; remove todo.” Failed trials
are silent and cannot leak partial bindings. Incoming ordinary setup and fixtures
remain available. Without an adjacent legacy group, a trial uses current setup.
Consecutive definitions stay grouped to preserve mutual recursion. Normal checks
end the adjacency between alternatives. Setup trial groups count as todo checks;
legacy setup is not counted as a legacy assertion. Actual host errors, malformed
files and failing ordinary/legacy setup are not expected failures.

The bootstrap host runner recreates trial scopes by replaying committed pure setup;
it does not expose a new evaluator or a runtime environment capability to source.
Playground programs include supported setup without modifier prefixes and omit trials.

| Assertion | Required outcome |
| --- | --- |
| expect / assert | Pass |
| legacy expect / legacy assert | Pass until explicitly retired |
| todo expect / todo assert | Fail silently; success fails with “This assertion now passes; remove todo.” |

Legacy is reserved for a contract intended to change. Pair it with a same-subject
todo when the replacement is settled. If it is not, record the precise unresolved
decision in [LEGACY-ASSERTIONS.md](LEGACY-ASSERTIONS.md). A corpus check rejects
unaccounted legacy assertions and stale unresolved entries. Stable semantics belong
in ordinary assertions even when their setup still uses bootstrap declarations.

The same modifiers apply to expect subject error "reason". An E_ string matches
a subject diagnostic code exactly; another string matches its message by
substring.
Finding the expected error satisfies an error assertion, so it is an unexpected
success when that assertion is todo. Setup, fixture, malformed source and host
exceptions are never swallowed by todo. All assertions run after ordinary check
failures. Expected failures are counted separately from passing assertions; no case
is skipped. A case containing only expected failures satisfies its test contract
with zero passing assertions. The term inert is reserved for capability/value meaning.

Each case has a fresh interpreter, initialized by an optional --fixture FILE. Shared
setup commits only inside that case and preserves recursive declaration groups.
Each subject and expected-type block has an isolated child scope: bindings, definitions,
grammar changes and proof facts cannot flow to later assertions. A subject-local type
name does not escape into its expected-type operand. The static proof checker is
future work; test assertions do not add its facts to setup.

## Parse failures of quoted source

Malformed program text cannot be a live `expect` subject: the outer `.test` file
would fail to parse. There is no special parse-error clause. Write an ordinary
error check whose subject is `parse(Code)` of a string:

```text
test "infix"
  expect parse(Code)("x + ") error "Missing second argument to infix operation"
end
```

`parse(Code)(text)` is the typed Code reader and uses the default Code tree
grammar, not session macros. Finding the expected error passes; a successful
parse fails with “the subject succeeded.” An `E_` string matches a diagnostic
code exactly; another string matches its message by substring. Todo and legacy
modifiers apply as they do to any other error check.

Successful parses belong in the test as ordinary code. Comparing two spellings
of the same or different tree, or checking a newline/indent shape that cannot be
embedded in the outer file, uses ordinary `parse(Code)(text)` expressions too.

Escaped strings (`"if True\n  1\n\t2\nend"`) are valid when the inner text cannot
be a prefix-consistent block quote (mixed tab/space payloads inside a
space-indented test file). A bound block quote is the readable form for longer
payloads that can use the same indent prefix as the test.

A spaced infix operator with no right operand reports “Missing second argument to
infix operation”. Tight `a+b` still reports that infix operators require spaces
on both sides.

Live subjects in the outer file are parsed with Code plus Test layout forms.
Clause keywords that exist only on a replaced `Grammar` object (`otherwise`
instead of `else`, `probe`/`then` before a session `macro` has been parsed into
a later entry) cannot appear as live outer syntax. Quote them for `parse(Code)`;
keep host `parseSurface` / sequential `Interpreter.parse` when the point is a
session grammar or a Grammar object that is not the default Code tree.

## Future contracts and coverage

Source-only adapters store provisional angle packs, extended numeric spellings,
quoted numeric atoms and proposed keyword-rest labels. Original source/spans remain
authoritative, and ordinary parsing still checks every executed operand. Storage
adapters cannot accidentally make an unsupported future form pass. Malformed files
reject even if their assertions would have been todo.

Named cases C01–C27 live in `tests/specification` and use the same grammar.
The decision record explains them with focused examples; the `.test` files are
authoritative and need not match that document byte-for-byte. Supported contracts
carry no todo; C27 remains an exploratory lexical candidate. Fifty-seven former complete-pack expectations were split into
scalar checks or an explicit empty-pack assertion. Payloads and type checks were
retained, with printer string fixtures changed only for the requested comma spacing.
[TEST-MIGRATION.md](TEST-MIGRATION.md) records the coverage boundaries.

Program and REPL output use the same annotated printer. --parse prints surface syntax.
Full Code interpretation, the source evaluator, remaining numeric families and static
proof checking remain later milestones. GitHub is the project source of truth; CI
runs type checking, build, host tests and the complete source suite without application
secrets and with read-only repository permissions.
