# Bootstrap surface syntax and grammar interpretation

> Compatibility reference for the unchanged TypeScript prototype (source release 75).
> These sections describe bootstrap behavior, including restrictions superseded in
> the intended design. The current contract is in [VALUE-SPACES.md](VALUE-SPACES.md),
> [TYPE-VALUES.md](TYPE-VALUES.md) and [GRAMMAR.md](GRAMMAR.md).
> General unions, Rational literals, declaration-only accessors, proof-based
> refinements and the new test DSL are planned changes, not promises of this guide.

> Implemented: exact constructed-field patterns, independent `...`/`**` ignore
> markers, positional-only rest captures, abstract storage slots, and open structural
> facets. Type annotations in text reconstruct concrete identity at abstract positions;
> they are not additional value identity. See [ROADMAP.md](ROADMAP.md) for limits.


> **27 October implementation checkpoint:** structural descriptor equality,
> recursive local type blocks, identity on explicitly interpreted values,
> same-space comparison, subset checks, and numeric conversions now work.
> See [VALUE-SPACES.md](VALUE-SPACES.md) for tested coverage and limits.
> Full numeric ranges, static overlap proofs, inference for unannotated values,
> and capability-based interface dictionaries remain pending.



This describes implemented syntax, not the proposed compiler or generic factory
extension. See [README.md](README.md) for execution and [ROADMAP.md](ROADMAP.md)
for planned changes. `src/parser.ts` reads structural syntax; `default.pattern`
describes standard sidefix forms. No infix operator has a special precedence.

The playground's Grammar panel shows ordinary dot-infix application separately
from the editable sidefix declarations. There are no reserved infix words:
`a .f b` always means `f(a)(b)`. `where` and `matches` are ordinary operations,
with no name-specific parsing or evaluation rule.

## Source normalization

Before tokenization, remove one leading U+FEFF BOM and replace each original CRLF
pair with LF in one pass. Standalone CR characters are not removed by this pass;
outside literals they retain their whitespace role. The rules apply to the whole
source, including literal and reader-macro content. They do not transform strings
received at runtime. Interior BOM characters are not stripped.

Word symbols, including quoted symbols, labels and interpolation names, are ASCII.
The classes are LowerCamelSymbol, UpperCamelSymbol and UpperSnakeSymbol; one- and two-letter
upper-snake words have a trailing underscore. Literal strings remain Unicode and
are not Unicode-normalized. Unicode identifier casing remains deferred.
Diagnostic spans and excerpts refer to the normalized source; name normalization
does not change their source extents.

## Two interpretation stages

The surface reader produces micro applications, neutral sidefix sequences, and
layout blocks in one syntax-tree family. The selected grammar recognizes those
sequences as forms. A form is not automatically a macro: built-in language roles
and explicitly registered user macros give forms their execution behavior.
Run processes declarations in source order; Parse form does not execute macros.

The following is a schematic of the application/pack layer and the language's
block policy, not a complete parser specification. Sidefix readers, quotation,
layout tokens, and label/default validation are described below and in the source.

```ebnf
program       = statement*, resultPack ;
replEntry     = statement*, [resultPack] ;
statement     = binding | definition | macroRegistration | expression ;
resultPack    = expression | "(" [fields] ")" ;
fields        = positional*, named* ;
named         = lowerCamelIdentifier, ":", expression ;
expression    = postfix, [spacedOperator, expression] ;
postfix       = atom, {arguments | tightDot | typeSuffix | spread} ;
arguments     = "(", [fields], ")" ;
tightDot      = ".", identifier ;
typeSuffix    = "*" | "?" | "!" | "^" | "@" | "$" | "&" | "~" ;
spread        = "…" | "..." ;
atom          = symbol | literal | grouped | outfix | prefixApplication ;
grouped       = "(", macroOrExpression, ")" | "(", newline, block, ")" ;
outfix        = "[", [fields], "]" | "{", [fields], "}" ;
```

Commas separate fields and may trail. Parentheses around a single positional field
are grouping. At an argument/result boundary, zero and multiple fields are packs;
they are never unit/tuple values. Braces explicitly construct tuple-shaped values.

The application node retains even an empty body. `f` and `f()` differ, as do
`[1,2]` and `[](1,2)`. Single-argument packs may omit parentheses for infix operands.
`x -> ()` has an empty right operand pack and therefore returns no values.

Positional labels are `_1`, `_2`, etc. Ordinary positional fields precede named
fields. A positional rest capture or bare ... follows the positional patterns and
may precede named patterns. Bare ** follows all named patterns and must be last.
The syntax tree retains this labeled-tail marker separately from positional fields;
:** remains the literal punctuation symbol. Canonical formatting sorts labels and
retains the marker at the end.

Argument-pack patterns permit extra labels. Constructed-value patterns are exact:
... ignores extra positional values, ** ignores unmatched labels, and rest captures
collect only positional values. For example Rect(w,rest...,color: c,**) still requires
color. Labels requested by a binding pattern are required unless defaulted. Bare captures are lowercase (or reserved positional names). Explicit `T :: Type` also captures a TitleCase type-valued name; bare `T` is a reference, never an inferred capture. Labels and rest captures remain lowercase, with `_` for ignoring a capture in bindings,
parameters, and match patterns. Duplicate names on one matching path are errors.
In type definitions a field may specify `Number` or `w :: Number`. An unannotated
named capture leaves its type to inference; it never implicitly means Any. Until
inference is implemented, type definitions require explicit capture types,
including rest captures. Binding, parameter, and match captures may remain
unannotated without boxing their inputs. `_` cannot define a type field.

Type suffixes apply left to right: `Int?*` is postfix `*` of postfix `?` of `Int`,
distinct from prefix `*(Int?)`. Angle brackets have no application role; spaced `<`
and `>` remain ordinary infix operators.
Prefix punctuation is maximal; each postfix modifier is interpreted separately.

Normalized syntax prints punctuation applied to two successive argument packs
infix: `->(n)(<(n)(5))` becomes `n -> n < 5`. Parentheses preserve a nested left
operand, an operator expression used as a head, and non-singleton or labeled
packs. Thus `*(+(a)(b))(c)` becomes `(a + b) * c`, and `+(a)(b)(c)` becomes
`(a + b)(c)`. Unary and partial applications remain prefix. Named applications
remain prefix; outfix forms keep their brackets. Expression-value display shares
this rule, including quoted code and refinement predicates.

A line is initially a neutral sequence of micro expressions. Macro interpretation
uses the selected grammar. A block is an indented sequence of lines, terminated by
dedent or `end`. A block following a trailing binary operator becomes its final
operand. Parentheses can group a macro or enclose a multiline block.

A program/block must have a final result pack. That rule is enforced by the shared
grammar stage, including nested blocks and unused function bodies. The REPL alone
permits a top-level entry ending in a binding, definition, or macro registration.

Standard forms and their capture names are declared in `default.pattern`. One
starting keyword identifies each sidefix rule. Grammar resolution creates explicit
`form` nodes, retaining named captures for the evaluator. Form boundaries are resolved
before evaluation. Parentheses around prefix applications inside macro sequences
prevent confusion with infix operators; the formatter emits those parentheses.

Examples:

```text
x = (1)
(x) = 1

x = (1,foo: "bar")
(x,foo: f) = (1,foo: "bar")

def pair(x) (x,x)
(a,b) = pair(1)

f = x ->
  y = x ^ 2
  (y,y)
end

def Vector(t :: Type) type [values... :: t*]
def Rectangle type :Rect(width: w :: Int,height: h :: Int)
```

Each separate program must end in a result expression or explicit result pack.
The examples above are individual forms, not one complete executable program.

In a match body, `pattern -> expression` denotes an arm, not an anonymous function
value. The surrounding match grammar gives the arrow this interpretation. The
pattern selects existing scrutinee values and binds names for the result expression;
it does not perform function-argument construction. Outside a match body, the ordinary
anonymous-function grammar can use the same surface arrow tree.

Named type declarations may contain captures. Every type expression rejects defaults. An explicit
inline nested `type …` boundary prohibits captures; use a separately named declaration
when that nested type needs accessors. A constructor subpattern introduces
no type boundary: its captures belong to the enclosing type. This validation does
not change the surface tree. Visible lexical scopes may not bind two declaration
names to equal structural type values; matching overlap alone is not a duplicate.

A label with a type specification implicitly captures its field: `width: Int` binds
width. Explicit captures (`width: w :: Int`) and ignored captures (`width: _`) override
this default. A label with a structural pattern introduces only the pattern's own
captures: `shape: Rect(w,h)` binds w and h, not shape. `rest...` consumes remaining
fields and always captures only positional values. `rest: type [_... :: Int*]` matches a single labeled list value.

Named field order is irrelevant to matching. Canonical output orders named fields alphabetically after positional fields. Duplicate explicit labels are surface syntax errors, including in patterns.

A rest capture produces one list value, even when it captures zero or one fields. Thus `[y,rest...] = [1,2]` binds `rest` to `[2]`. This also applies to function parameters and type capture accessors.

Labeled field patterns may include `= defaultExpression`, with either an explicit
capture (`color: c :: Color = Black`) or an implicit one (`color: Color = Black`).
These are interpreted from the ordinary infix tree; precedence is unchanged.
The default is used only for an absent label and must match the field pattern.
Defaults are valid only in binding patterns, including parameters and match arms.
They populate captures without modifying input values. Type expressions reject them
with E_TYPE_DEFAULT. An ordinary factory function can accept defaulted parameters
and explicitly return a complete value; type annotations never complete fields.
Option types are written `T?` by convention (the postfix tree), with no
field-specific interpretation. Prefix `?(T)` is not Option. Defaults must match
the annotated type. A label in a binding pattern may be absent because it has a
default, not because its type is `T?`. Type fields remain required.

Names use ASCII lower camel, upper camel or upper snake; capital runs are allowed.
Lower-snake words and malformed underscore separators reject. Prefix `!` is
reserved. Tight postfix `!` is a distinct postfix construction. Assignment binds
only as a direct block statement; it has no general expression-level binding
behavior. User-authored macros are implemented. Static type checking is not;
concrete-type inference, pattern membership rules, and restrictions on overlapping named interpretations
remain design work in the roadmap.

## Quotation and user-defined sidefix forms

`:(expression)` quotes the complete raw tree with no interpolation pass.
`:f(args)` quotes only f; its arguments evaluate normally. `:f` quotes a bare
symbol. These are structural expression data, not automatically Code. Explicit
structural interpolation uses a typed `T$` backtick quote, not colon quotation.
A field colon must be tight to its label: `label: value` differs from `label :(value)`.

`def f(patterns) expression` defines an ordinary function with a micro signature,
including when its result is Code. `macro (:keyword (capture :: Expression) ...) transformerExpression`
registers a sidefix macro and its grammar. Macro signatures must be sidefix;
function definitions must use micro signatures. Macro invocation uses sidefix
syntax, never function-call syntax. The transformer body may call an ordinary
code-producing helper. It need not contain a Code constructor itself; the actual
result is checked when invoked. Capture annotations should be parenthesized in
sidefix signatures. Registration bodies can be expressions or blocks. A name
may not mix ordinary and macro methods.

Macro registrations extend the grammar sequentially and within lexical blocks. Parse-only
operations do not commit extensions. Macro expansions preserve source metadata;
they are not printed and reparsed.

## Strings and quotation

Quotation is raw unless `$` explicitly enables interpolation. Single quotes are
raw text; double quotes decode escapes. Neither interpolates by default.

```text
name = "Jo"
('Hello, $name',"Hello, $name",$"Hello, $name","one\ntwo")
# ("Hello, $name","Hello, $name","Hello, Jo","one\ntwo")

:Box(name)           # Box("Jo"): only the head is quoted
:(Box(name))        # Box(:name): the entire expression is raw
Code` hello($name)   # stores a dollar expression, without reading name
Code$` hello($name)  # stores hello("Jo")
```

`T` followed tightly by a backtick interprets the remaining tree against T's
grammar, without evaluating it or adding a T wrapper. `T$` followed by a backtick
first inserts structural hole values. Successive packs, types and lexical origins
survive insertion; incompatible grammar positions fail. Use `$(args...)` for
positional splicing. `:(...)` has no implicit interpolation pass.

In interpolating forms, `$name` reads one identifier and `$(expression)` evaluates
a balanced expression. Holes run left to right exactly once. Inserted text or trees
are never rescanned. An outer structural pass visits nested quote/template syntax;
`$$name` or `$$(expression)` protects a hole for one later stage. Direct string
evaluation turns those spellings into literal `$name` or `$(expression)` text.
String holes insert their contents; symbols insert their names; other values use
unannotated display. This text conversion does not define value serialization.

```text
name = "Jim"
Code$`
  name = "Jo"
  $"Hello, $$name"
end
# Stores a template that will read the inner name when the Code is evaluated.
```

Raw `reader' text` consumes the rest of its line. `reader$' text` enables holes.
Escaped readers use `reader"text"` / `reader$"text"`. Readers receive two lists:
text fragments and separate hole values, with one more fragment than value.
The source-defined reader owns HTML/SQL escaping or other interpretation.

A text opener immediately followed by LF starts a block closed by an aligned
`end` (optionally followed by a comment). A physical content line is required;
EOF and dedent never close a quote. Strip the common indentation prefix and only
the framing LF after the opener and before the closer. All other leading/trailing
blank lines remain. A truly empty line needs no indentation; a whitespace-only
line must have the complete prefix. Block quotes and ordinary code use the same
leading-prefix relation: any combination of tabs and spaces is allowed. Nested
indent is a strict extension of the parent prefix; incompatible prefixes reject.
There is no tabstop-width conversion.

Escapes are exactly `\n \r \t \v \b \f \0 \" \\ \xHH \uHHHH \UHHHHHHHH`.
`\x` is ASCII-only; other numeric escapes must denote Unicode scalar values.
Unknown escapes, surrogates and line continuations fail. Inline text rejects literal
LF, CR, VT, FF, NEL, LS and PS; use a block or escaped double quotes.
Canonical String output is always an inert, escaped double-quoted inline literal,
including literal dollars. It round-trips boundary whitespace and all scalar strings.

The public SyntaxNode schema explicitly represents templates, protected holes and
interpolation modes. Printing/parsing stored syntax never runs holes or readers.
See [the quotation specification](design/QUOTATION-PROPOSAL.md) for exact layout,
staging, scalar and transport rules. Source-level `code.evaluate`, general keyword
splicing and portable captured environments remain later work.

## Fixed-length sidefix signatures

No new sidefix alternation or repetition is supported. A sidefix signature has a
fixed sequence of keywords/readers. Spread is an argument-pack operation:
`:all Pair(xs... :: Int*)` may match Pair(), Pair(1), or Pair(1,2), but
`:all (xs... :: Int*)` is rejected at declaration time. `x :: [_... :: Int*]` matches one
list-shaped expression, never a variable-length sequence of integers.

Non-generic declarative type patterns introduced with `def Name type Pattern`
are available to subsequent sidefix annotations with the same structural pattern.
Their captures are private to the named interpretation. Computed/parameterized
declarations remain outside this grammar-registration subset.

Def and its Signature reader remain bootstrap constructs. No variadic sidefix
syntax is needed to keep the current definition form working.

## Refinements and type-producing blocks

`T .where predicate` is an ordinary call, `where(T)(predicate)`. It constructs
a subset of T's concrete space. The predicate is an evaluated function value;
there is no implicit `_` subject or special permission to pass a defined function
as a value. Use a closure, for example `n -> isInt64(n)`.

```text
def Option(T :: Type) type :None | Some(T)
def NoInt Option(Int) .where (v -> v .matches :None)
(x :: Number .where (n -> isInt64(n))) = 10
```

`value .matches pattern` means `matches(value)(pattern)`. A type value supplies
its compiled pattern and concrete-space constraints. Any other value is a literal
pattern tested for equality; incompatible concrete spaces return False. Quoted
syntax is never implicitly evaluated or resolved in an ambient scope.

```text
pattern = type :Some(Int)
Some(3) .matches pattern
# True
Some(3) .matches :Some(Int)
# False: Some(Int) is a literal symbolic value here.
```

Malformed patterns, ambiguous alternatives, and predicate errors propagate;
only an actual mismatch becomes False. Both operations use ordinary dispatch,
including ambiguity errors and partial application by whole argument packs.
Their current implementations are core native functions, like numeric operations.

Primitive atoms self-evaluate and other bound type names resolve to their values
in ordinary expressions. Bare unbound names are errors; use quotation for symbolic
leaves. A user-defined function can receive a type value and return a refinement:

```text
def restrict(base)(predicate) base .where predicate
small = restrict(type Int)(n -> n < 5)
3 :: small
```

The `type Pattern` form still explicitly interprets a pattern. Lowercase calls in
type-expression positions use the ordinary evaluator and must return a type.
Computed definition bodies do not accidentally declare predicate names as accessors.

An annotation's type operand may be a parenthesized layout block whose final
expression denotes a type. Local def declarations permit self-reference and stay
alive through that returned type's environment. See VALUE-SPACES.md for examples.

## Type descriptions and typed text

Type(pattern), Facet(pattern) and UnionType(...) are ordinary applications over
expression data. Primitive type values are self-evaluating atoms such as Int and
Float, not Primitive(...) wrappers. Recursive/Recur and Apply/Fields retain finite
recursion and arbitrary expression heads in that description algebra.

The built-in parse(t), toString(t), parseLocal(t) and toStringLocal(t) factories
use ordinary packs and return callable specialized functions. Source functions may
likewise take a type in one pack and use it in later parameter patterns. This does
not promise compile-time specialization. Global data parsing is inert and never
calls the code evaluator or installs user grammar.

## Literal operator patterns

A colon-quoted application pattern makes its constructor head literal while
arguments remain patterns. The common compiler applies this rule to bindings,
signatures, types, and match arms. For example, def split(:|(a)(b)) (a,b) captures
the operands of a union expression. Unquoted a | b remains alternation.
In sidefix type forms, group punctuation applications: type (:|(Symbol)(Symbol)).
In evaluated data, quoting an application head still evaluates its arguments.

## Abstract storage and open type patterns

Value-expression :: requires a concrete/refinement RHS; an abstract RHS reports
E_ABSTRACT_ASCRIPTION. Binding and parameter constraints may use Any, multi-space
unions, or facets, provided values already have a concrete interpretation. Typed
match patterns perform narrowing. Annotation syntax in serialized abstract text
reconstructs that interpretation; it does not create a public annotation-pair value.

An explicit type pattern containing an open field marker produces Facet(Pattern).
It retains the complete concrete input and creates only scoped accessor definitions.
Type(Pattern) describes complete concrete values and cannot disguise open constraints.
The portable OpenFields(Fields(...),labels: Bool,positional: Bool) description records
both kinds of openness. Literal punctuation symbols and constructor heads use the
ordinary quoted-head/Apply escapes; prefix keyword rest capture/spread remains unsupported.

## Name lookup and type normalization

Bare primitive names are self-evaluating language atoms; other names resolve their
lexical bindings. Bare symbols require quotation. Constructor heads in applications
need no quotation; defined functions and named type factories dispatch normally.
The type form recognizes a pattern and returns a normalized, capture-free type value
plus local accessor products. Its name lookup uses the same evaluator as ordinary
expressions. `type type Int` is Int; Type(Int) retains its explicit wrapper.
There is no generic AST node or angle-bracket application. Updated quote/refinement
proposals under design/ do not alter this implemented grammar.

## Grammar-directed quotes: first slice

A typed quote retains a dedicated TypedQuote(grammar,tree,interpolate) syntax node. A bound DSL
type interprets its raw tree without evaluating names or adding a type-name tag.
Unknown targets fail. Code uses the source-defined TreeGrammar(SyntaxNode) type,
with no constructor wrapper. Raw T-backtick and interpolating T-dollar-backtick are distinct surface nodes.

Grouped sidefix patterns may define ordinary data types; their keywords are selected
by the typed quote and do not become executable Code forms. Such values currently
use syntaxSequence for canonical structural text. ::: is colon quotation of the
existing :: symbol, just as :+ quotes +. A quoted head in a pattern matches that
literal operator instead of applying its Code meaning. Infix spacing and
associativity are unchanged.
ExpectedOutput can therefore be declared as:

```text
def ExpectedOutput type (e :: Expression) ::: (type :: Expression)
expected = ExpectedOutput` (1 + 2) :: UnknownType
```

Both captures remain raw Expression trees. A runner must explicitly interpret them.

## Structural inspection bridge

syntaxSchema() returns the executable recursive SyntaxNode type shared with the
language-description schema. syntaxTree(expression) exposes a raw Expression as
ordinary typed tree data. syntaxExpression(tree) validates that schema and restores
raw Expression data without resolving names, expanding macros or executing code.

Apply(head,fields) contains one expression head and a complete list of
Field(label,tree) values, including positional pseudo-labels and sorted named labels.
An empty call has an empty field list; another Apply preserves the next pack. Pack
is a distinct node for an argument/result pack. Quote, TypedQuote, Sequence, Block
and Form are explicit variants, distinct from similarly spelled applications.
Ordinary binding/match patterns can inspect and reconstruct these values. The
schema is available in examples/syntax-tree.pattern.

Reconstruction is syntax-only: it does not recreate lexical closure environments,
run code, or install grammar rules. Direct Code splicing preserves its stored tree
and origins. Portable captured Code and environment-preserving edits to the explicit
view remain work.

## Interpreted Code

TreeGrammar(T) is a type constructor for interpreting surface syntax using an
ordinary structural tree-schema type T. Its public type value is
TreeGrammar(typeDescriptionOfT); equality uses that ordinary value tree. Code is
source-defined as TreeGrammar(SyntaxNode); the executable source is
examples/code-grammar.pattern. The adapter validates the encoded view with the
same matcher. It is a documented host boundary, not a name-based Code exception.

Typed Code values store their trees explicitly. Code quotations and Code(expression)
produce interpreted values, while :Code(...) remains an ordinary symbolic application.
Macro expansion requires the interpreted Code space and uses that tree directly.
Same-grammar Code holes preserve their trees; primitive lifting adds concrete
ascriptions, and incompatible interpreted splices report E_QUOTE_GRAMMAR. Each
positional splice element is checked. Raw Expression remains the explicit migration
bridge; general cross-DSL literal lifting is not implicit.
An inserted Code value contributes its tree, preserving pack boundaries and lexical
origins instead of adding a constructor. Ordinary application patterns can destructure
it, and syntaxTree provides the complete explicit view. Source-defined refinements
can classify applications without creating another concrete space; see
examples/code-categories.pattern.

There is no native source-language run/evaluate operation. The external TypeScript
test harness uses Interpreter.evaluateCode(value), a host-only API that evaluates
in a child scope/grammar of its session and returns the entire result pack.
Source-defined code.evaluate is deferred to the source interpreter milestone.
Code fields can appear in ordinary sidefix Test data without execution. Both inline
and indented expected clauses work: a nested non-Code data grammar interprets its
block's line items as a sidefix sequence, with single-item sequences unwrapped.
Code preserves block structure and Expression fields remain opaque. This is the
same interpretation rule as the outer data quote, not a special expect keyword.

examples/test-schema.pattern defines TestFileContent and ordinary sidefix test/check
forms. `.test` files under tests/ contain one or more test blocks and are discovered
recursively. Bodies contain shared setup and interleaved assertions. Modifiers apply
to assertions: plain/legacy checks must pass; todo checks run and must fail, with a
success failing the suite and requesting removal of todo. There is no skipped-case
form. File/setup/fixture/host failures remain failures. Subjects execute in isolated
child scopes, so no assertion grants another a definition or proof fact.

Expected results are canonical data, not executed expressions. The DSL uses
expect subject result expected :: Type and assert for predicate checks. Group
binary expected data before ::. Exact observed types and single positional arity
are checked separately from payload equality. Multi-return values are destructured
once and checked through separate assertions; no results-pack form remains. Error
checks use an E_ code or message substring, limited to subject errors. Test DSL forms
are not executable Code keywords. Every canonical printer puts a space after commas,
preserving string contents. The CLI prints annotated program values as in the REPL;
--parse prints syntax. See [design/TEST-SUITE.md](design/TEST-SUITE.md).

Type-directed Code text is canonical surface source. Parsing it is inert. Nested
Code currently retains an explicit structural :: annotation so the data reader knows
which grammar to use before decoding the field. Lexical environments and internal
form metadata without a surface representation are explicitly unsupported for
portable printing/comparison; no host object identity is exposed as language equality.

## Recursive declaration groups

A maximal consecutive sequence of ordinary def forms is one recursive group.
The block recognizer records each declaration before constructing its values;
runtime lexical snapshots then share only that group's declared names. Bindings,
macro registration and other expressions end the group. Each nested block and
REPL submission has its own groups. Generic type families use the same rule.
Nonproductive alias cycles and duplicate structural declarations still reject.
This adds no surface token, changes no precedence and does not hoist bindings.

## Disjoint union type form

The source grammar declares UnionTypeExpression as :unionType (pattern :: PatternBody).
Its operands separated by | are evaluated as type values, then normalized by the
same constructor as UnionType(A,B). This does not alter infix precedence or turn
pattern alternatives into type unions. The user-facing test expectation/display
and suite proposals are recorded in design/UNION-GRAMMARS.md; existing tests still
use e :: T and the REPL still uses the current inspection layout.


## Vertical repetition and a source-defined Body

A standalone ... pattern row repeats the immediately preceding row at the same
indentation. Horizontal name... repeats positional fields within a pack. Each
dimension contributes one list layer to the capture annotation: todos :: String*
followed by vertical ... collects strings; values... :: Float** followed by ...
collects rows of floats. An annotation with too few list layers is an error.

Balanced delimiters with an opening newline preserve separate rows, except where
commas continue the same argument pack. Thus [ followed by rows 1,2 and 3,4 is a
two-row layout, while [ followed by 1, then 2, then 3 is a flat comma-continued pack.
The canonical printer keeps layout rows distinct. [\n] is a zero-row layout;
[\n ()\n] has one empty row; [] remains a flat empty list. Blank/comment-only
lines are layout, not empty elements. Labels stay unique and sorted per pack.

The compiler uses block/sequence trees with Row field matching and Collect
repetition in the common pattern engine. Repetitions consume complete rows;
ambiguous partitions reject, rather than selecting a greedy interpretation.
General repetition/alternation among arbitrary sidefix fields is still deferred.

[The Body grammar specification](design/BODY-GRAMMAR.md) and
[executable source](examples/body-grammar.pattern) define the bounded recursive
Body/Binding grammar. Zero or more statement rows precede one required result row.
An explicit () final pack is allowed; a missing final row is not. := quotes = in a
pattern. Typed quote/read/print and direct pattern inspection are inert. A lexical
Body declaration can replace the bootstrap Body alias; the full bootstrap Code
reader remains in use until milestone 5b.
