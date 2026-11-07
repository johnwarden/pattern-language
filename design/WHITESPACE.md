# Significant whitespace and explicit delimiters

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

A sidefix form may have several indented operands separated by its own clause
keywords. Its final end closes the whole form. Thus this expectation needs its
own end; the enclosing test's end does not substitute for it:

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

## Survey

| Whitespace boundary | Meaning / required validation |
| --- | --- |
| Indentation outside explicit delimiters | Describes block membership; missing or misaligned end must reject rather than accept another scope. |
| Newlines outside balanced delimiters | Separate rows / statements; joining or splitting rows can intentionally change a program. |
| Newlines inside collection delimiters | Can distinguish vertical rows from comma continuation; row boundaries can change collection rank. |
| Spaces around infix operators | Both sides are required; a+b is invalid, not a different addition expression. |
| Tight postfix punctuation | T* is a suffix application; T * U is spaced infix syntax. Suffixes wrap in source order. |
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

## Bootstrap boundary

Layout-introduced blocks require an aligned `end`. Clause continuations come from
the active grammar's sidefix keywords, not a hardcoded `else` list. A missing
closure is `E_BLOCK_END`. Indented typed quotes still use `E_QUOTE_END`. A string
inside a sidefix form stops at that form's clause keyword and may share the
form's final `end`.

tests/layout/explicit-ends.test covers EOF, missing nested terminators,
indentation changes, an expectation borrowing its test's end, a closed nested
inner end, grouped parentheses versus a layout block, match termination, a
closed expect/result under Test layout forms, and the shared string/if
terminator. Required infix spacing remains an ordinary check. The cases parse
source without running println or requiring code.evaluate. Host
test/layout-ends.test.ts also covers a shared string stopping at a custom
`otherwise` clause.

Tight postfix punctuation is one suffix character: T* is a wrap, T * U is infix,
T** is (T*)*, and T+ parses as the same suffix wrap. tests/layout/postfix-suffixes.test
covers that wrapping. T+ as a nonempty-list refinement, and a distinct postfix
tree from prefix + / ordinary application, remain deferred: they need shared
adapter identity, not a reader-only change.

Tight `f(x)` is application; spaced `f (x)` is a sequence that needs a sidefix
grammar, not an automatic call. A field colon must touch its label: `w: 1` is
the label `w`, while `w :(1)` is a positional sequence of `w` and a quotation.
tests/layout/call-label-spacing.test records those reader distinctions. No new
public meaning is added; the reader already implemented both survey rows.
