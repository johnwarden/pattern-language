# Strings and quotation specification

## Current decision boundary — 7 November 2026

The later design record introduces no new string/quote surface rule. Redundant
primitive quotation remains provisional. Raw runtime Expressions are now allowed
for now under [their current contracts](../specs/implemented/raw-expression-values.md);
that does not settle the complete public syntax/descriptor mapping.
The test-suite milestone adds pending inert forms before source code.evaluate.
General type-value changes are in LANGUAGE-DECISIONS.md; the implementation scope
below remains the bootstrap's tested quotation contract.


Implemented 2 November 2026 for the surface and portable-data subset described
here. The filename is retained so existing design links remain valid.

## Implementation boundary

Raw/escaped text, explicit interpolation, typed grammar quotation, protected holes,
exact block layout, Unicode-scalar/UTF-8 validation and canonical inert String
printing are implemented. Templates and interpolation modes have explicit public
SyntaxNode variants and fresh-context Code text round trips. Typed splicing retains
values and lexical origins without stringify/reparse. Reader functions receive
fragments and values separately, including under an outer interpolation pass.

Code is TreeGrammar(SyntaxNode), not a wrapper around an untyped expression.
The external TypeScript harness can evaluate stored Code. Source-level
code.evaluate remains deferred to the source interpreter; there is no native
source-language run/evaluate operation. Portable captured environments, general
reader extension protocols, byte strings and arbitrary computed grammar prefixes
remain outside this implementation.

In ExpectedOutput, ::: quotes the existing :: symbol; it is not a new operator.
Both expected operands stay raw, including unresolved type names.

## Purpose and boundaries

Use one staging model for text, code, and DSL quotation: recognize a quote and its
source holes, parse its literal parts, and insert hole results exactly once.
Quotation constructs data; evaluation of that data is a separate operation.
Text insertion and structural insertion deliberately have different conversions.

The user has accepted the review's direction on strings and quotations: explicit
interpolation, raw versus escaped text, common staging, source-hole recognition
before escape decoding, structural insertion, and inert canonical round trips.
The concrete lexical, conversion and transport choices below define the prototype.

The user additionally specified these binding block-string constraints:

- Truly empty physical lines contain zero whitespace and count as properly
  indented content, including at the beginning and end of the body.
- Whitespace-only lines must contain the required indentation; otherwise they
  are errors, not empty lines or dedent terminators.
- Preserve leading and trailing content newlines. Remove exactly the framing
  newline after the opener and before the closing line; do not trim blank lines.
- Require at least one physical content line and an explicit `end`. Immediate
  closure, dedent termination and EOF termination are errors. `end # comment`
  is an accepted closing line.

Text prefixes use exact spaces/tabs from the first content anchor, as specified
below. Ordinary code uses the same prefix relation: any combination of tabs and
spaces, with nested indent a strict prefix extension and no tabstop width.

## Forms

| Form | Meaning |
| --- | --- |
| `'text'` | Raw string, no escapes or interpolation |
| `"text"` | Escaped string, no interpolation |
| `$'text'` | Raw string with explicit source holes |
| `$"text"` | Escaped string with explicit source holes |
| `:name`, `:f(args)` | Quote the symbol/head; arguments retain ordinary evaluation |
| `:(expression)` | Raw structural quotation |
| ``T` expression`` | Raw quotation parsed using T's grammar |
| ``T$` expression`` | T's grammar with structural source holes |

A string opener immediately followed by a source line break starts a block,
terminated by explicit `end` as specified below. Typed quote blocks use the
language's ordinary expression layout, not the text-block dedentation algorithm.
Inline typed quotes consume the remaining expression up to its enclosing
delimiter or line boundary; parentheses can delimit them explicitly.

Backticks alone are not accepted. The type prefix is explicit
even for Code: raw expression data and interpreted Code data are distinct.

## Accepted source normalization

After decoding source to Unicode scalars and before tokenization, replace each
CR immediately followed by LF with one LF, in one noniterated pass. This applies
throughout source, including raw strings and reader content. Leave standalone
CR unchanged by this normalization. For example, source CR CR LF LF becomes
CR LF LF, not LF LF. Do not run the replacement again on the result.

This follows Rust's CRLF rule so ordinary LF/CRLF source-file conversions do not
change program meaning. See the primary [Rust input-format specification](https://doc.rust-lang.org/reference/input-format.html).

**Also accepted subsequently:** remove one leading U+FEFF BOM from decoded
source, before the CRLF pass. Do not remove interior U+FEFF characters. Normalize
identifier tokens to NFC for their language identity. These are specific accepted
frontend exceptions, not general string normalization. See Rust's primary
[identifier specification](https://doc.rust-lang.org/reference/identifiers.html).
The complete identifier character, spelling and diagnostic specification remains
to be elaborated; adopting NFC does not implicitly adopt every Rust lexical rule.

String contents, including raw strings and literal fragments of templates or
readers, remain Unicode-unnormalized after source BOM/CRLF preprocessing. An
identifier inside an interpolation expression follows identifier normalization;
literal text around it does not. Escapes and runtime values are not subjected to
the source BOM-removal operation or identifier NFC.

Escapes are decoded later: `"\r\n"` still denotes CR followed by LF. CRLF arriving
in runtime values, interpolation results or file data is not source-normalized.
Do not normalize an inert value after constructing it. Exact values containing
CRLF remain representable through escapes and canonical round-trip text.

## Unicode and escapes

Strings are sequences of Unicode scalar values: U+0000 through U+10FFFF,
excluding U+D800 through U+DFFF. Equality compares that sequence exactly.
No normalization, case folding, or grapheme segmentation is implicit. For
example, `"\u00E9"` and `"e\u0301"` are different strings.

Default file encoding is UTF-8. Invalid input encoding is an error; invalid
scalar escapes are errors, not replacement characters. Parsing APIs receive
scalar sequences; a host UTF-16 adapter must reject unpaired surrogates.

Escaped strings accept exactly `\n`, `\r`, `\t`, `\v`, `\b`, `\f`, `\0`,
`\"`, `\\`, `\xHH`, `\uHHHH`, and `\UHHHHHHHH`. Hex widths are exact.
`\xHH` must be at most 7F. Surrogate escapes and values above 10FFFF fail;
two surrogate escapes do not combine into a scalar. Other escapes fail,
including `\$`, `\'`, `\a`, octal escapes, and backslash line continuation.
Raw strings give backslash no special role. An inline raw string containing an
apostrophe can use an escaped double quote or a single-quoted block.

Proposed inline-prohibited line separators are LF, CR, VT, FF, NEL (U+0085),
LS (U+2028), and PS (U+2029), after the accepted source normalization above.
Finalize this inventory and their layout roles separately. In particular,
normalization leaves lone CR unchanged; that does not itself classify CR as an
ordinary character, line delimiter or error in every lexical context. Do not
silently convert lone CR or other Unicode separators to LF. Escapes can represent
these scalars regardless of their literal-source restrictions.

## Source holes are recognized before escape decoding

In interpolating quotes only, recognize `$name`, `$(expression)`, and `$$`
from source characters. `$name` is exactly one identifier, not a postfix chain;
use `$(person.name)` for an expression. Other dollar uses are errors. A host
expression parser balances `$(...)`, including nested strings and quotes;
the first textual `)` is not necessarily its end.

`$$` protects a dollar from the current active interpolation pass. In a directly
evaluated string its result is a literal dollar; in residual template syntax it
can preserve a hole for the next stage, as described below. Decode escapes only
in escaped-string literal fragments after hole recognition. Then evaluate holes
left to right exactly once. Neither decoded characters nor inserted values are
scanned for new holes. Escape decoding never manufactures syntax.

| Source, with `name = 'John'` | String result |
| --- | --- |
| `'$name'` | `$name` |
| `$'$name'` | `John` |
| `$'$$name'` | `$name` |
| `$"\u0024name"` | `$name` |
| `$"\u0024(name)"` | `$(name)` |
| `"\u0024name"` | `$name` |
| `$"\$name"` | Error: invalid escape |

For `name = '$other'`, `$'$name'` yields the literal `$other`. The initially
suggested `interpolate(unescape(raw))` is therefore not this contract. Reader
macro analogies do not require implementation as composed runtime functions.

## Text-hole conversion

String holes insert exact contents without quotation syntax. Symbol holes insert
their name (so :Red contributes Red). Other values use unannotated expression
display. No alternate value equality or serialization contract follows from this
text conversion: use toString(T) explicitly when canonical typed text is wanted.
Portable closure/environment representations remain an implementation gap, not an
exemption from the eventual every-type round-trip goal.

Conversion results are plain content: dollars, newlines, or quote delimiters in
them cannot alter surrounding syntax. Newlines in a hole result are allowed
even when the surrounding source quote is inline.

## Raw colon quotation

`:name` quotes a symbol. In `:f(args)`, only f is quoted; arguments are not
recursively quoted. A symbol applied to evaluated arguments forms self-evaluating
data. `:(expression)` quotes the structural expression. Its raw dollar prefix
applications remain syntax data; prefix/postfix symbols belong to the grammar.
For example `:($x)` does not read x. These head-only and whole-expression forms
must remain distinct. Malformed syntax remains an error.

Colon quotation is raw. Use an explicitly interpolating typed quote when holes are needed.
Do not add a second colon interpolation modifier in this minimal design.

Constructor heads and quoted literal symbols retain the separate rules of the
type-value migration; quotation does not make ordinary bound names self-quote.

## Typed grammar selection and structural insertion

The implemented prefix is a lexical name resolving to a type. A computed type
can be bound to such a name; this is not a reason to ban computed types. Arbitrary
expression prefixes and the point at which their grammars become available
remain syntax/staging decisions. Milestone 3 does not define arbitrary-expression
grammar prefixes or their staged availability rules. Unknown or non-type targets
fail; the selected type interprets inert structure rather than evaluating it.

The selected grammar recognizes the body directly. Do not first recognize it
as Code and then cast or convert it to T. For example, a DSL may recognize
`a then b` even when Code has no corresponding form.

The shared quote reader recognizes explicit holes and supplies opaque hole
nodes to the selected grammar. A hole occupies one expression position; the
grammar can validate its category structurally, including after insertion.
An inserted value may be an entire sidefix subtree containing keywords. It does
not inject character fragments that retokenize a neighboring identifier or
operator. The earlier blanket ban on inserting keywords was too broad.

Evaluating an interpolating typed quote evaluates each hole in its lexical
environment and inserts the resulting structural value. It neither converts
the value to text nor reparses it. The completed structure must satisfy T and
the local structural position. Incompatible values fail rather than being
implicitly quoted, evaluated, or converted. Code uses its own expression-data
grammar for these checks. No general string-to-code conversion is implied.

Positional argument splicing is an important initial target, not casually
deferred. Proposed `Code$` input `sum($(args...))` evaluates args once and inserts
its positional elements, preserving each element's type and pack boundary.
Ordinary `$(args)` inserts one list value. Settle the exact spelling and whether
spread is hole-expression or destination-pack syntax; labeled splicing remains
separate. Do not conflate a list, a result pack and successive application packs.

Typed subtrees preserve their interpretation and structure during insertion.
For x representing a + b, left insertion prints `(a + b) * 2`; right insertion
prints `2 * a + b`, because infix operators have equal precedence and associate
right. Those are rendering decisions, not substitution by printed text. A String
value fails in a MathExp position that does not admit String.

Raw quotation performs no outer interpolation pass. An explicit interpolating
quote performs the structural pass described next; dollar protection is relative
to that pass rather than a promise of permanent shielding by nested quotes.

## Nesting, evaluation, and capture

**Accepted:** an explicit outer interpolation pass traverses stored expression
and string-template syntax. A nested quote is data in that traversal, not an
automatic shielding boundary. Raw outer quotation performs no such pass.

For example, with name bound to Jim in the construction environment:

```text
name = "Jim"
Test$` test "example"
  name = "Jo"
  $"Hello, $name"
expect ...
```

The result contains the inert assignment to Jo and a stored string template
whose content is Hello, Jim. Construction reads the outer name; it does not
execute the assignment. To preserve a later hole:

```text
name = "Jim"
Test$` test "example"
  name = $name
  $"Hello, $$name"
expect ...
```

The stored assignment now has the String value Jim on its RHS. The residual
template contains `$name`, which is evaluated only when that stored code later
executes. `$$` protects exactly one active pass, not every later pass.

The same distinction applies to nested expression quotes:

```text
x = :a
outer = Code$` (Code$` $x)
```

Constructing outer substitutes a into the stored inner quote syntax without
executing that quote. With the eventual public Code grammar, the result is an
interpreted nested-quote value, not the result of evaluating the inner quote.
An explicit outer hole can instead evaluate that quote in the normal way:

```text
x = :a
outer = Code$` $(Code$` $x)
```

Here the nested quote is evaluated as the outer hole's expression, and its
result is inserted once. Syntax is not subsequently evaluated by insertion.

Rewrite the original hole nodes once; do not revisit inserted values or newly
residual holes in the same pass. Escape decoding and inserted string contents
must not manufacture holes. For example, inserting an outer String `$secret`
must retain literal content, whereas source `$$name` deliberately retains a
later-stage hole. Residual template trees and their printer must preserve this
distinction without blind stringify/reparse. The public schema uses TextTemplate(parts), ReaderQuote(reader,parts), and
TypedQuote(grammar,tree,interpolate). Parts are Text(String) or
Hole(SyntaxNode,Int,String): the integer counts protected passes, and the spelling
is empty for an active hole. A protected text hole retains its literal dollar
spelling because direct string evaluation must distinguish $$name from $$(name).
One additional dollar protects a recognized hole for one additional pass; at most
32 protected stages are accepted. Inserted literal dollars print as \u0024 in
residual templates so inert source round trips cannot manufacture new holes.

The implementation preserves
lexical origins and current hygienic macro behavior; do not adopt the earlier
draft's proposed unhygienic model by default. Source metadata is not value
identity, and portable environments must not depend on host provenance caches.

Parse-only operations recognize quote and hole structures but never execute
holes, type constructors, reader functions, or user macros. Parsing a template
expression is different from reconstructing the value that executing it yields.

## Exact text-block layout

**Accepted:** truly empty lines count as indented content, whitespace-only lines
must satisfy required indentation, and only the two framing newlines are removed.
Additional leading/trailing content newlines are preserved.

Let I be the opening statement's ordinary indentation and P be its required
content prefix. P may be any consistent combination of spaces and tabs; TAB-only
indentation is not required. The first non-whitespace content line establishes P (or the first
whitespace-only line when there is no non-whitespace content). Every nonempty
line must begin with that exact prefix; empty lines are exempt.
Once P is known, do not infer or trim further common whitespace from the body.

The opener must be the last token on its line and immediately precede a source
line break. The concrete preservation algorithm is:

1. Consume and exclude exactly the line break immediately after the opener.
2. Collect at least one physical content line before an explicit closer. The
   closing line is I followed by `end`, optional horizontal whitespace, and an
   optional `# comment`. A line beginning with P followed by `end` is content.
   An opener immediately followed by the closing line is a syntax error.
3. A zero-character physical line is always content, contributes an empty line,
   and never closes the quote. It needs no printed indentation prefix.
4. Check whitespace-only lines before other indentation handling: they must begin with
   P, or report an indentation error. Strip P exactly once and retain everything
   after it. Such a line cannot silently terminate the quote.
5. Other nonempty lines must begin with P; strip P exactly once. A dedented
   statement is not an implicit closer: report missing `end`/indentation error.
   EOF without explicit `end` is an error. EOF after a valid `end` is allowed.
6. Exclude exactly the line break immediately before the closing line. Preserve
   every earlier content break and remaining whitespace. Equivalently, join the
   collected, prefix-stripped physical content lines with their intervening
   separators and add no final separator. Ordinary normalized LF source uses LF.
   Other separator classifications must not silently normalize additional scalars.
7. For interpolating/escaped variants, recognize source holes before escapes
   in this dedented template. Preserve a source-position map for diagnostics.

Opener and closer on consecutive lines are invalid. One intervening truly empty
content line yields the empty string; two yield one LF. A sole content line y
yields y without a final LF. This is framing removal, not blank-line trimming.

Here `<P>` denotes the required prefix and `<TAB>` a content tab; neither is
literal source notation:

| Content lines between opener and closing line | Result before escape/hole processing |
| --- | --- |
| none | syntax error |
| one truly empty line | `''` |
| two truly empty lines | `"\n"` |
| `<P>y` | `'y'` |
| `<P>y`, empty line | `"y\n"` |
| empty line, `<P>y`, empty line | `"\ny\n"` |
| two empty lines, `<P>foo`, two empty lines | `"\n\nfoo\n\n"` |
| `<P><TAB>y` | `"\ty"` |
| `<P>  ` | two spaces |
| whitespace-only line missing P | indentation error |
| `<P>end` | `'end'` |

For example, `y`, two empty content lines, and the closer produce three physical
breaks after y. Excluding only the final framing break leaves two content LFs.
Explicit `end`, including `end # comment`, is required in every case.

Apply the accepted source-wide one-pass CRLF normalization before this algorithm,
including raw block/reader text. Do not additionally normalize standalone CR or
other Unicode characters while joining content lines. Finalize their lexical
layout roles separately. Escaped strings can express exact CRLF content with
`\r\n`; decoding happens after source normalization. Inline and block variants
retain the same escape and hole rules.

## Reader boundary

Raw reader' text extends to the end of its line; reader$' text enables
holes. Escaped reader"text" and reader$"text" provide a delimited, total source
form. Each opener also supports the text-block rules. General reader extension
protocols and byte strings remain deferred. Raw text fragments and separate hole
values are the common interface. The language must not concatenate holes before handing them to an
HTML/SQL-style reader. A reader owns interpretation and domain-specific escaping.
Reader invocation occurs during evaluation, never inert value parsing.

## Canonical inert text

The canonical printer emits every String as a noninterpolating inline escaped
double-quoted string. Escape double quotes, backslashes, the named controls above,
every source line separator, remaining C0 controls, DEL, and C1 controls. Use
uppercase fixed-width hex, preferring a named escape where one exists; use
`\uHHHH` for other BMP scalars requiring escaping and `\UHHHHHHHH` when needed
outside the BMP. Other scalars print literally. Dollar is literal and needs no
escape. This policy is independent of locale and Unicode character categories.

Always-inline output is a small correct initial canonical policy. Block output
and single-quote preferences are optional later printer changes requiring their
own stable rules; they are not needed to make block input available.

Canonical global expression/type value text uses portable structural type
descriptors and inert value forms, not a required local name such as Expression.
Typed quote sugar may appear in source or scope-relative display but is not a
replacement for that global representation. Quoted templates with hole nodes
serialize those nodes as data, without executing them. The explicit SyntaxNode codec and inert Code reader preserve those nodes and
interpolation modes; neither executes templates or readers.

For every supported value v accepted by T:

```text
parse(T)(toString(T)(v)) == v
concreteType(parse(T)(toString(T)(v))) == concreteType(v)
toString(T)(parse(T)(toString(T)(v))) == toString(T)(v)
```

Equal values print identically regardless of the originating quote spelling or
local type name. Source spelling and allocation identity are not preserved.
No parse/print path runs a hole or evaluator. Unsupported portable representations
must be reported explicitly, not silently excluded from the language's eventual
every-type goal.

## Minimum conformance examples

The conformance tests cover:

- All scalar/escape errors above; U+0000; a non-BMP scalar; distinct composed and
  decomposed strings; raw backslashes; both quotation marks; literal dollars.
- One-pass source CRLF normalization, including raw strings/readers; standalone
  CR unchanged; CR CR LF LF becoming CR LF LF without a second pass; escaped
  and runtime-inserted CRLF preserving both scalars; one leading BOM removed,
  interior BOM preserved; equivalent identifier spellings sharing NFC identity
  while composed/decomposed string contents remain distinct.
- All block table rows, whitespace-only boundary lines, retained relative
  indentation, an indented content `end`, mixed consistent prefixes, immediate
  closure rejection, `end # comment`, missing-prefix errors and EOF/dedent errors.
- Source-dollar escapes that cannot create holes, inserted dollars that cannot
  recurse, balanced nested hole syntax, and left-to-right single evaluation.
- Outer/inner expression and Test string-template examples above; one-stage
  dollar protection; inserted `$secret` remaining literal while source `$$name`
  preserves a later hole; head-only colon quotation; Code holes accepting valid
  trees; incompatible DSL holes rejected without stringify/reparse; positional
  splicing retaining type/order/pack boundaries; parenthesis examples above.
- A DSL form absent from Code's grammar, lexical grammar shadowing, a name bound
  to a computed type, and parse-only hole nonexecution. Arbitrary expression
  prefixes require a syntax decision rather than an assumed permanent ban.
- Printer idempotence and exact String round trips over every short combination
  of quotes, backslashes, dollars, controls, blank lines, and indentation.
- Typed structural round trips in a fresh scope lacking the original DSL name,
  including quoted hole nodes, without executing code or user readers.

## Accepted direction and unresolved details

The accepted direction and exact blank-line/boundary rules are recorded above.
Do not reopen source-hole-before-escape staging, silently restore implicit
interpolation, trim boundary blank lines, or treat underindented whitespace-only
lines as empty. These constraints need no further user decision.

General reader protocols, byte strings, formatting dispatch, keyword splicing,
arbitrary computed grammar-prefix expressions, a fuller Unicode identifier policy
and portable captured environments remain separate work. Positional splicing and
representable staged templates are implemented, including typed grammar checks,
left-to-right single evaluation, inert public-tree transport and fresh-context
closed Code round trips. Text-reader nesting is limited to 128 and protected text
holes to 32 stages, in addition to existing parser, codec and interpreter budgets.

The current implementation is split across text-reader.ts (shared source reader),
string-format.ts (scalar validation/canonical spelling), macros.ts (structural
staging/hygiene), syntax-values.ts (typed syntax/data bridge), and runtime.ts
(evaluation/reader invocation). File adapters reject malformed UTF-8; the parser
removes one initial BOM, performs one-pass CRLF normalization and NFC-normalizes
identifier tokens. Runtime String contents are never source-normalized.
