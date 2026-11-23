# Significant whitespace and explicit delimiters

## Formatting safety

**Formatting and whitespace errors may produce syntax errors, never logic errors.**

This guarantee is relative to the grammar being applied. When that grammar fixes
a construct's form, formatting must preserve its grammatical structure, apart
from source locations, or be rejected as a syntax error. A whitespace mistake
must not silently change scope, clause ownership, operator fixity, argument packs,
or whether code is treated as a comment. A later type error or runtime failure is
not a substitute for rejecting malformed syntax.

This is why whitespace can be significant without being allowed to introduce
logic errors. A reader must not guess a different interpretation to make a
formatting mistake valid. The rule applies to indentation and line reflow as
well as horizontal spacing, including Code, quotations, custom grammars and the
Test DSL. Whitespace inside string literals and raw reader payloads is data;
editing that content is not code formatting.

| Boundary | Required outcome |
| --- | --- |
| Indented blocks | Missing or misaligned `end` rejects; indentation cannot silently move a statement into another body. |
| Calls | `f(x)` is application; `f (x)` rejects instead of becoming a different valid call or sidefix form. |
| Infix operators | `a + b` is infix; `a+b` rejects instead of acquiring another meaning. |
| Prefix and postfix operators | `-x`, `-(x)` and `T**` are valid; `- (x)`, standalone `* *x` and `T * *` reject. |
| Comments | `#` starts a comment with or without a preceding space; `x# note` and `x # note` have the same code. |
| Postfix percent | `x%` is postfix; `x %` rejects as incomplete infix syntax. Adding a space cannot produce another valid interpretation. |

These are consequences of the principle, not independent formatting preferences.
They do not establish complete parser conformance; remaining gaps are recorded
under [Bootstrap boundary](#bootstrap-boundary).

### Raw layout and explicit grammar alternatives

The rule does not require all whitespace variants of raw expressions to have
one tree. For example:

```text
a b
  c
end
```

```text
a
  b
  c
end
```

Without an applied grammar, these may be different expression/layout trees: the
first has an inline `b` followed by a body containing `c`; the second has a body
containing both `b` and `c`. Raw parsing alone cannot decide which form `a` needs.
The fixed micro-syntax rules, such as operator adjacency, still apply.

A grammar may also explicitly admit both forms of the `a` keyword. Both can
then be valid with different meanings. That is a declared grammar alternative,
not a reader silently repairing malformed use of a single form. If the applied
grammar admits only one form, the other must fail grammar validation. Merely
observing that the bootstrap accepts two trees does not establish this exception;
the absence of an applied grammar or the keyword's alternatives must justify it.
These examples state the contract; they do not claim that the bootstrap already
supports declaring every such grammar alternative.

## Layout and explicit closure

**Ratified layout contract.** Block and clause completeness come from the active
surface grammar’s quoted keyword chains, not a hardcoded `assert`/`expect`/`else`
list. Indentation is not a semantic delimiter. Parse failures of malformed inner
source belong in [TEST-SUITE.md](TEST-SUITE.md) (`expect parse(Code)(text) fails` of quoted text).

Indentation makes structure readable. It must not be the sole evidence that an
executable indented block has ended. Layout-introduced forms require an explicit
aligned end. Dedentation alone cannot silently move statements between scopes.
Balanced (), [] and {} already provide explicit delimiters; they are not an
implicit-dedent escape for ordinary function, do, match or test blocks.

For example, the inner do below is missing its own end and must be rejected:

```text
main = do
  f = do
    println("a")
  println("b")
  f
end
```

Making println("b") one level deeper must not repair this missing terminator and
silently change when it runs. End alignment and ownership must be validated.
The valid program puts an aligned end after the inner body.

A sidefix form may have several operands separated by clause keywords from the
**active surface grammar**, not a hardcoded assert/expect list. A clause keyword
at the form's indent closes the previous indented operand; there is no `end`
before that clause. `end` is required when the last remaining operand is still
an unclosed indented body. Completing the grammar with an inline last operand
does not invent a trailing `end`.

```text
expect
  something
fails "error"
```

is one FailsExpectation. The `fails` clause comes from the test grammar, so no
`end` stands between the subject and `fails`. Adding or removing indentation
around `something` must not change that membership: the same keywords written
flat (`expect something` then `fails "error"`) are the same form.

```text
assert
  something
end
```

needs the aligned `end` because `assert`'s grammar has no later clause to close
the indented operand. A user-defined form with the same shape (`:hold body ::
Body` vs `:probe body :: Body :then result :: Expression`) follows the same
rule. Do not special-case assert or expect.

When a later clause itself takes an indented operand, that operand still needs
`end`. The enclosing test's `end` does not substitute:

```text
expect
  def f(x: Int = (1 / 0)) x
  f(x: 8)
result
  8 :: Int
end
```

## Strings inside sidefix forms

Dedentation ends an indented string's content without swallowing the surrounding
clause or terminator. An else line belongs to the containing grammar, not the text.
One final end may close the final string and its surrounding if:

```text
s = if 1 == 0 '
  Hello, World!
else '
  What's cookin'?
end
```

Do not hardcode else as a string delimiter. Apply layout and explicit owner rules
to arbitrary sidefix grammars. Preserve string indentation stripping, meaningful
blank lines, raw contents and the existing CRLF/BOM conventions. EOF is not an
implicit terminator. This changes the bootstrap's string/terminator ownership and
needs coordinated reader, grammar, diagnostics and fixture migration.

Indentation is an exact prefix of tabs and spaces, the same relation block quotes
use when stripping content. Nested indent is a strict extension of the parent
prefix. Incompatible mixed prefixes reject. Do not convert tabs to a visual
width.

## Survey

| Whitespace boundary | Meaning / required validation |
| --- | --- |
| Indentation outside explicit delimiters | Describes block membership via the same tab/space prefix relation as block quotes; missing or misaligned end must reject rather than accept another scope. |
| Newlines outside balanced delimiters | Raw layout may retain different rows. An applied keyword grammar must validate its declared forms rather than silently reinterpret one form as another. |
| Newlines inside collection delimiters | Comma continuations and vertical rows need validation against the applicable grammar. Their complete formatting-safety coverage remains unverified. |
| Spaces around infix operators | Both sides are required; a+b is invalid, not a different addition expression. |
| Tight postfix punctuation | T* is a suffix application; T * U is spaced infix syntax. Prefix and postfix operators must touch their operand: `T * *` is an error (write `T**`); standalone `* *x` is an error; `1 * *x`, `1 * x*`, and `x* * 1` parse. `#` always starts a comment (`x#` and `x #` are both `x`). Suffixes wrap in source order. Prefix `+Int` and `+(Int)` are the same application tree; tight `Int+` is not that wrap. |
| Tight function calls versus sidefix operands | `f(x)` is application. A non-keyword term then spaced `(` is an error (`f (x)`, `f(x) (y)`). A keyword operand may begin with a grouping only if the operand continues (`assert (1 + 2) == 3`); a wholly parenthesized operand (`assert (x)`, `if (x)`) is an error. Infix operators may be followed by a grouped operand (`a - (b)`, `1 - (x)`). Prefix operators must touch (`-(x)`, `-x`); standalone `- (x)` is an error. |
| Dot notation | a.b and a .b c follow the stated call/pack rules; arbitrary spacing around dot is not permitted. |
| Label colon | Must touch its label. Separating it must not reinterpret a label as different valid code. |
| Quotation / reader prefixes | Tight T` and reader quote prefixes select syntax. Spacing changes must preserve the interpretation or reject, including in custom grammars. |
| String indentation | Strip the common required prefix; insufficiently indented nonempty content rejects. Deeper indentation is string data. |
| Blank string lines | Empty physical lines are retained; whitespace-only lines must satisfy the indentation prefix. Framing lines alone are stripped. |
| String spaces / newlines | Remain data. No claim is made that whitespace edits inside strings are semantics-preserving. |
| Source CRLF / initial BOM | Normalize CRLF to LF and strip one leading BOM; other string characters remain data. |

Significant whitespace constrains valid spelling within a grammar-selected form.
Raw layout and explicitly declared keyword alternatives are the exceptions above;
they do not authorize arbitrary fallback between calls, operators or scopes.

## Call spacing

The surface grammar allows `:keyword MICRO_EXPRESSION` but not
`:keyword (MICRO_EXPRESSION)`. A spaced `(` after a keyword is valid only when
that group *starts* the operand and the micro-expression continues; wrapping the
entire operand is a syntax error. That way `assert (x)` cannot mean `assert x`,
and adding or removing those parentheses cannot flip one valid tree into another.
Tight `f(x)` is application. A non-keyword term then spaced `(` is always an
error. The same rule holds in Code, quotation `:(...)`, `parse(Code)`,
sidefix/surface grammars, and `.test` files.

```text
f(x)                    # application
f x                     # sidefix operand or sequence
f (x)                   # error: term then spaced (
f(x) (y)                # error: a completed application is a term
assert True             # keyword operand
assert (1 + 2) == 3     # valid: the operand begins with a group and continues
assert (x)              # error: the operand is only a parenthesized group
assert ((1 + 2) == 3)   # error: same, the whole operand is grouped
if (x)                  # error
type Point              # type form
type(Point)             # application of type
type (Point)            # error
todo()                  # tight empty call
todo ()                 # error, including todo ( / newline / )
a - (b)                 # valid: infix operator then group
-(x)                    # valid: prefix operator touches the group
-x                      # valid: prefix operator touches the operand
- (x)                   # error: prefix operator must touch its operand
x = (1, 2)              # valid: pack after =
expect e is (1 + 1) :: Expression   # valid: is operand continues
```

`def f() (x, y)` is the term error (`f()` then spaced `(`); indent the pack.
The bootstrap currently reads same-indent `f` then `(x)` on the next line as two
rows. The treatment of this ordinary-expression boundary under the formatting
principle still needs review; see below. Postfix suffixes stay tight (`T?`, `T*`,
`T^`).

The REPL treats a buffer as ready when the active grammar can parse it as a
finished entry. It must not wait for an extra blank line after `end` or after a
completing inline clause, and it must not run a clause-bearing form before that
grammar is complete. A blank line still force-submits whatever is pending.

## Bootstrap boundary

Layout-introduced blocks require an aligned `end` while that operand is still
open. Clause continuations and form completeness come from the active grammar's
quoted keyword chains, not a hardcoded `else`/`assert`/`expect` list. A missing
closure is `E_BLOCK_END`. Indented typed quotes still use `E_QUOTE_END`. A string
inside a sidefix form stops at that form's clause keyword and may share the
form's final `end`. Dedentation alone is not a semantic delimiter.

The formatting principle is a design requirement, not a claim that every
whitespace boundary is already checked. Ordinary expression-row boundaries need
classification against the raw-layout exception: the bootstrap evaluates
`f = x -> x + 1` followed by `f(2)` to 3, but splitting that call into `f` and
`(2)` on separate rows returns 2. This behavior is observed; whether that boundary
should require stronger syntax is unresolved here. Collection rows, quotation
boundaries and custom-grammar reflow also need systematic review. No new rejection
rule or general proof of conformance is selected by this document.

tests/layout/explicit-ends.test covers EOF, missing nested terminators,
indentation changes, an expectation borrowing its test's end, a `fails` clause
completing without a preceding `end`, quoted if/else branches, extra `end`
after a complete inline clause, incomplete infix, and `parse(Code)` of quoted
malformed source.
tests/layout/indent-prefixes.test covers pure tabs, pure spaces, mixed prefixes,
and quote-indent stripping. tests/layout/custom-grammar.test installs a session
`hold` macro, evaluates `hold` with an aligned `end`, and checks `hold` without
`end` through `parse(Code)` (default Code grammar, not session macros). Required
infix spacing remains an ordinary check. Host test/layout-ends.test.ts keeps
Grammar-object `parseSurface` (including `:otherwise` vs `:else`) and sequential
session macros for probe/then success, extra `end` after `then`, `hold` without
`end`, and a wholly parenthesized `hold` operand.
test/repl.test.ts covers grammar-driven REPL completeness.
test/indent-prefix.test.ts keeps the prefix-relation unit checks.
tests/specification/postfix-suffixes.test covers suffix wrap order (`T**` is
`(T*)*`), spaced infix trees, that a pack field `**` is not a suffix on the
previous field, and that prefix `+Int` / `+(Int)` are the same tree while tight
`Int+` is not rewritten to prefix `+`. tests/specification/postfix.test covers
the touching rule and that `#` is a comment. specs/numeric-literals-and-text.md#signed-values-and-prefix-negation
covers prefix negation versus infix subtraction.
