# Significant whitespace and explicit delimiters

**Ratified layout contract.** Block and clause completeness come from the active
surface grammar’s quoted keyword chains, not a hardcoded `assert`/`expect`/`else`
list. Indentation is not a semantic delimiter. Parse failures of malformed inner
source belong in [TEST-SUITE.md](TEST-SUITE.md) (`expect parse` of quoted text).

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
does not invent a trailing `end`. A redundant `end` after that complete inline
clause is `E_UNEXPECTED_END`; it cannot close the completed form or steal an
enclosing block.

```text
expect
  something
error "error"
```

is one ErrorExpectation. The `error` clause comes from the test grammar, so no
`end` stands between the subject and `error`. Adding or removing indentation
around `something` must not change that membership: the same keywords written
flat (`expect something` then `error "error"`) are the same form.

```text
assert
  something
end
```

needs the aligned `end` because `assert`'s grammar has no later clause to close
the indented operand. A user-defined form with the same shape (`:hold (body ::
Body)` vs `:probe (body :: Body) :then (result :: Expression)`) follows the same
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
| Newlines outside balanced delimiters | Separate rows / statements; joining or splitting rows can intentionally change a program. |
| Newlines inside collection delimiters | Can distinguish vertical rows from comma continuation; row boundaries can change collection rank. |
| Spaces around infix operators | Both sides are required; a+b is invalid, not a different addition expression. |
| Tight postfix punctuation | T* is a suffix application; T * U is spaced infix syntax. Suffixes wrap in source order. Prefix `+Int` and `+(Int)` are the same application tree; tight `Int+` is not that wrap. |
| Tight function calls versus sidefix operands | f(x) is application; f (x) is a space-separated sequence requiring a grammar, not automatic application. |
| Dot notation | a.b and a .b c follow the stated call/pack rules; arbitrary spacing around dot is not permitted. |
| Label colon | Must touch its label. Separating it is not an alternative label spelling and may only have meaning in another explicitly selected grammar. |
| Quotation / reader prefixes | Tight T` and reader quote prefixes select syntax; adding spaces does not preserve that interpretation automatically. |
| String indentation | Strip the common required prefix; insufficiently indented nonempty content rejects. Deeper indentation is string data. |
| Blank string lines | Empty physical lines are retained; whitespace-only lines must satisfy the indentation prefix. Framing lines alone are stripped. |
| String spaces / newlines | Remain data. No claim is made that whitespace edits inside strings are semantics-preserving. |
| Source CRLF / initial BOM | Normalize CRLF to LF and strip one leading BOM; other string characters remain data. |

The goal is not to make every whitespace edit harmless. It is to reject accidental
block-scope changes that lack explicit closure, while keeping intentional row,
fixity and literal-content distinctions visible in the grammar.

The REPL treats a buffer as ready when the active grammar can parse it as a
finished entry. It must not wait for an extra blank line after `end` or after a
completing inline clause, and it must not run a clause-bearing form before that
grammar is complete. A blank line still force-submits whatever is pending.

## Bootstrap boundary

Layout-introduced blocks require an aligned `end` while that operand is still
open. Clause continuations and form completeness come from the active grammar's
quoted keyword chains, not a hardcoded `else`/`assert`/`expect` list. A missing
closure is `E_BLOCK_END`. A redundant `end` after a complete inline final clause
is `E_UNEXPECTED_END`. Indented typed quotes still use `E_QUOTE_END`. A string
inside a sidefix form stops at that form's clause keyword and may share the
form's final `end`. Dedentation alone is not a semantic delimiter.

tests/layout/explicit-ends.test covers EOF, missing nested terminators,
indentation changes, an expectation borrowing its test's end, an error clause
completing without a preceding `end`, quoted if/else branches, extra `end`
after a complete inline clause, incomplete infix, and `expect parse` of quoted
malformed source.
tests/layout/indent-prefixes.test covers pure tabs, pure spaces, mixed prefixes,
and quote-indent stripping. tests/layout/custom-grammar.test covers a session
`macro` plus `expect parse` for `hold` without `end`. Required infix spacing
remains an ordinary check. Host test/layout-ends.test.ts keeps Grammar-object
`parseSurface` (including `:otherwise` vs `:else`) and sequential session macros
for probe/then success. test/repl.test.ts covers grammar-driven REPL completeness.
test/indent-prefix.test.ts keeps the prefix-relation unit checks.
tests/specification/postfix-suffixes.test covers suffix wrap order (`T**` is
`(T*)*`), spaced infix trees, that a pack field `**` is not a suffix on the
previous field, and that prefix `+Int` / `+(Int)` are the same tree while tight
`Int+` is not rewritten to prefix `+`. Distinct postfix application, including
tight `Int+` as a postfix tree, remains later work.
