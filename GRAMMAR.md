# Surface syntax and interpretation boundaries

Accepted extensions and their implementation boundaries are specified in
[SURFACE-EXTENSIONS.md](design/SURFACE-EXTENSIONS.md). The explicit-delimiter policy
and survey of significant whitespace are in [WHITESPACE.md](design/WHITESPACE.md).

Updated 7 November 2026. This records shared surface contracts and planned language
forms. [GRAMMAR-BOOTSTRAP.md](GRAMMAR-BOOTSTRAP.md) is the complete reference for the
unchanged current parser. Proposed type/generic/numeric forms below are not
claims that this parser accepts them yet.

## Formatting safety

Formatting and whitespace errors may cause syntax errors, never logic errors.
For a form fixed by the applied grammar, code spacing or indentation must preserve
the grammatical structure or be rejected. Raw expression/layout parsing may
retain different trees; a grammar may explicitly support both forms of a keyword.
Those exceptions do not permit silently repairing malformed use of one form. This
motivates explicit aligned `end`s, tight calls and prefix/postfix operators,
required infix spacing, and the whitespace-independent comment meaning of `#`.
[WHITESPACE.md](design/WHITESPACE.md) specifies the requirement, examples of these
exceptions and the bootstrap boundaries that still need review.

## One surface tree

An application has an arbitrary expression head and one argument pack. Successive
packs are separate applications: f(a)(b) is not f(a,b). Bare f differs from f().

The [application-head tests](tests/specification/application-heads.test) separate
syntax from evaluation: Code may contain `True(1)` or `1(1)`. A head's callability
is checked when that Code is evaluated, not by the grammar. See the
[adjacent explanation](tests/specification/application-heads.md). These executable
contracts are authoritative; grammar prose explains their rules and must be kept
in sync with them.
Parentheses group expressions or delimit packs; (x,) and (x) have the same single
positional content in pack position. () is an empty pack, not a standalone unit.
Outfix brackets/braces put their closing delimiter after the pack; they have heads
[] and {}. This does not identify [1,2] with the differently nested [](1,2).

| Source sugar | Application shape |
| --- | --- |
| a.b | b(a) |
| a .b c | b(a)(c) |
| (a,b) .plus (c,d) | plus(a,b)(c,d) |
| a + b | +(a)(b) |
| -x | -(x) |

Prefix `-(x)` negates; infix `1 - x` is `-(1)(x)` and subtracts. `#` always
starts a comment.

Infix operators require surrounding spaces, have equal precedence and associate
right. Prefix punctuation groups a maximal symbol except the quote prefix; postfix
modifiers are read individually. Prefix and postfix operators must touch their
operand (`T * *`, `* *x`, and `- (x)` are errors; `-(x)`, `-x`, `1 - (x)`,
`1 * *x`, `1 * x*`, `x* * 1` parse). Dot and prefix/application chains preserve their
left-associated head structure. Binary punctuation uses infix canonical spelling
where its two-pack shape permits; parentheses preserve the tree. Outfix forms keep
their brackets. Labels follow positional fields, are lowercase and unique, and sort
at the surface layer. Positional pseudo-labels remain ordered.

## Shared patterns, explicit roles

The same structural notation recognizes data and produces captures in bindings,
parameters, arms, macros and grammar interpretation. Context policies are explicit:

- Binding captures are local variables; a named type declaration registers accessors.
- Argument/result pack patterns may ignore extra labels. Constructed shapes are exact
  unless open. Bare ... ignores extra positions; bare ** ignores extra labels.
- Positional rests collect positions only; required labels must exist unless a
  binding default supplies a capture. Defaults never complete a type/value.
- Match arms pair patterns with expressions and are ordered, not first-class functions.
- Concrete pattern alternatives must have unique interpretations; general abstract
  unions need not have disjoint spellings.

Unannotated capture types are an inference obligation, not implicit Any. Existing
bootstrap TitleCase captures require explicit Type annotations; proposed angle type
parameters would supply the declaration role without changing ordinary bare-name
lookup. Keyword-rest record capture/spread is prefix `**rest` / `**(x)` and remains a proposal.

## Type-producing forms and declarations

Working target notation:

```text
type Rectangle concrete Rect(w :: Float32,h :: Float32)
type NonZero refinement Rational .where nonZero
type Number abstract Float32 | Float64
type Binding unambiguous abstract Definition | DestructuringBinding
```

The declaration registers a local name/accessor/display interpretation. Plain
concrete/refinement/abstract expressions produce values without installing captures.
Their exact keywords, qualifier order and angle-parameter sugar remain provisional.
Do not implement an ad-hoc parser exception for a semantic requirement: grammar forms
must remain ordinary tree patterns or an explicitly documented bootstrap seed.

Raw structured expressions are allowed at runtime for now. An annotation, typed
quote or sufficient expected context can give that expression a concrete
interpretation. [C04 and the raw-expression contracts](specs/raw-expression-values.md)
record the distinction. Parsed Code and evaluated raw values are separate roles;
automatic descriptor decoding and the public inspection API remain unsettled.

## Designation, projection and evidence

Recursive inward designation is permitted only along one justified path; nested
absence with multiple interpretations rejects. Explicit match-based projection
crosses one concrete boundary. Ordinary binding and dispatch do not unwrap; multiple
boundaries require repeated matches. A single-arm extraction must cover its admitted
input domain. See [VALUE-SPACES.md](VALUE-SPACES.md), C11 and C12.

Where constraints require evidence. They do not introduce implicit predicate-driven
overload priority. Constants/checks/assertions and specified guarantees can establish
facts; todo assert cannot. ConstructedBy is tabled, and no new unchecked operation or
implicit normalization is part of these forms.

## Literals and source normalization

Numeric literals denote exact Rational values. `0f0.1` selects the Float64-rounded
Rational; it does not create a Float64-typed variable. Explicit converters return
typed values. Precision families, canonical numeric spelling and rounding edges remain
provisional; IEEE special identities remain deferred. Ordinary execution interprets
numeric spellings as exact Rationals; the specification reader still stores them as
inert NumericSource data until an operand is reparsed.

Input removes one leading BOM and normalizes CRLF to LF in one pass. Word symbols
are ASCII LowerCamelSymbol, UpperCamelSymbol or UpperSnakeSymbol. One- and two-letter
upper-snake words end in _: PORT is upper snake; A_ and AB_ distinguish the short cases. Unicode
identifier casing and digit-boundary conversion rules remain deferred; string
contents remain Unicode and are not Unicode-normalized.

Ordinary symbolic literals have intrinsic symbol interpretations. The proposed reserved
PrimitiveType vocabulary and the decision whether Code rejects redundant primitive
quotation remain provisional; no raw Type/quoted-description equality is inferred.

## Quotation and macro staging

The implemented string/quotation contract is in
[QUOTATION-PROPOSAL.md](design/QUOTATION-PROPOSAL.md): raw/escaped text, explicit
interpolation, common single-pass hole handling, layout strings requiring end,
protected nested holes and inert canonical text. This update introduces no new quote
syntax or default interpolation rule. T-backtick reads inert grammar data;
T-dollar-backtick opts into interpolation. Inserted values are not rescanned for holes.

Typed quotation interprets against a grammar without executing the stored program.
Code-producing functions do not automatically register macros. Explicit registration
adds syntax-domain transformation with phase/lexical-origin rules. Defining a grammar
type alone does not reserve its keywords in executable Code. Full preparation and
portable closed dependencies remain later work.

## Rows and repetition

A standalone ... pattern row repeats its preceding row. Each repeated dimension
adds one list layer to the complete capture annotation:

```text
type Matrix concrete [
  cells... :: Float32**
  ...
]
```

Horizontal-only rest has T*. Horizontal rest across repeated rows has T**. Vertical-only
capture followed by ... has T*. Labels sort per pack, while positional and row order
remain significant. Rows are not flattened into commas or promoted to tuple values.
Zero rows, one explicit () row, and flat [] remain distinct. The bootstrap preserves
rows after an opening newline, except comma continuation of the same pack.
For a repetition without a capture name, see the bare annotated ellipsis
[source cases](tests/specification/anonymous-spreads.test).

Single-template mirrored vertical spreading is covered by
[source contracts](tests/spreading/vertical-values.test). Broader row templates
and typed keyword remainders remain planned extensions. General arbitrary
sidefix repetition/alternation remains outside the
bounded grammar. [BODY-GRAMMAR.md](design/BODY-GRAMMAR.md) retains the working Body
subset, ordinary source grammar and exact current empty-layout spellings.

## Test DSL — implemented milestone 5a.1

The source-defined sidefix DSL uses named test blocks with shared setup and
assertion rows. It is distinct from ordinary value-returning Code bodies:

```text
test "Current and future primitives"
  expect :Widget is Widget :: UpperCamelSymbol
  legacy expect 5 is 5 :: Expression
  todo expect 5 is 5 :: Rational
end
```

Assertions and setup bindings/definitions may have modifiers; whole tests do not.
Setup alternatives use the isolated incoming-scope rule in TEST-SUITE.md.
Plain and legacy assertions must pass; todo
assertions execute and must fail. A fulfilled todo fails the test and requests
removing its marker. No case is skipped for containing todos. The same modifiers
apply to assert, `fails` and single-value `is` forms. File/setup/fixture/host
errors cannot be swallowed by todo. Subjects execute in separate child scopes and
cannot supply declarations or checking facts to other assertions.

Expected results use canonical data trees, not evaluable expressions. An optional
trailing `:: Type` asserts the exact observed type; without it the data is read as
the actual subject value's type. Parenthesize an expected binary tree by indenting it
after `is`, not by writing spaced `is (`:

```text
expect e is
  (1 + 1) :: Expression
end
```

Multiple-return calls are destructured once,
then captures are checked separately; predicate checks use assert. The grammar has
no value/type keyword clauses or results-pack expectation. The expected data is an
ordinary Expression capture; the harness reads its optional trailing :: annotation.
Canonical printers place a space after commas; literal string contents are preserved. `.test` files still use the nonempty TestFileContent row
grammar. See [TEST-SUITE.md](design/TEST-SUITE.md) for execution and scope.
