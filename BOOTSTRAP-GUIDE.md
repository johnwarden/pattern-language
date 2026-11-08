# Bootstrap interpreter guide

> Compatibility reference for the TypeScript bootstrap and current Test DSL.
> These sections describe bootstrap behavior, including restrictions superseded in
> the intended design. The current contract is in [VALUE-SPACES.md](VALUE-SPACES.md),
> [TYPE-VALUES.md](TYPE-VALUES.md) and [GRAMMAR.md](GRAMMAR.md).
> General unions, Rational literals, declaration-only accessors, proof-based
> refinements remain planned changes. The revised test DSL is implemented below.

> Implemented: exact constructed-field patterns, independent `...`/`**` ignore
> markers, positional-only rest captures, abstract storage slots, and open structural
> facets. Type annotations in text reconstruct concrete identity at abstract positions;
> they are not additional value identity. See [ROADMAP.md](ROADMAP.md) for limits.


One implementation powers the CLI, REPL, and browser playground. Browser JavaScript
is generated from the TypeScript source; there is no separately maintained Python
or browser interpreter in this distribution. 

The goal is structural algebraic programming: precise tagged data and loosely
coupled components, with one pattern system for types, bindings, signatures,
matching, and grammar recognition. Code and DSLs share the expression-tree surface.
Static guarantees, compile-time specialization, and compact compiled representation
are goals; the current implementation is an experimental interpreter.

The long-term goal is an interpreter and compiler written in the language itself,
bootstrapped from a small explicit host core. The roadmap covers ordinary type/refinement descriptions, portable predicate
representations, and staged self-hosting. Structural Type values and typed text now have a working first implementation; portable refinements and self-hosting remain planned.

## Documentation and status

- [Vision](VISION.md): intended benefits and the research hypothesis.
- [Roadmap](ROADMAP.md): accepted specification, current implementation, pending milestones, and completion criteria.
- [Implementation checklist](TODO.md): completed and outstanding engineering work.
- [Grammar reference](GRAMMAR.md): current syntax and interpretation boundaries.
- [Type values and typed text](TYPE-VALUES.md): construction, matching, recursion, global/local serialization, and limits.
- [Body grammar milestone](design/BODY-GRAMMAR.md): implemented vertical spreading and a bounded source-defined Body grammar.

Functions, runtime type interpretations, shared pattern matching, explicit scoped
sidefix macros, quotation/interpolation, structured diagnostics, and internal block
lowering work today. The structural type-value checkpoint adds typed serialization and round-trip tests, alongside
TypeScript checking and the browser build.

There is no static checker, source-language module system, or compiler yet. Ordinary
source-defined type-parameter factories work; compile-time specialization does not.
Milestones 1–3 provide structural type values, shared pattern semantics, typed Code
and a source-defined Test corpus. The next milestones separate elaboration from execution and
build toward independent modules using a specialized JSON decoder and an exhaustive
consumer. See the roadmap for what would establish those claims.

## Type values and one application form

Types are ordinary values, and all applications use argument packs. There is no
angle-bracket application or generic AST node. Primitive Int, Float, Float32, Bool,
String, Symbol, Any, Expression, Body and Type are self-evaluating language atoms.
Number is an accepted alias for Float. Other bare names resolve their bindings;
Foo is an error when unbound, :Foo is a symbol, and Foo(1) uses a constructor tag.
Named type factories and defined functions still dispatch on matching argument packs.

```text
def nonZero(t :: Type)(n :: t) n != 0
nonZero(Int)(5)
# True

def Option(t :: Type) type :None | Some(t)
Option(Int)
# Type(:None | Some(Int))
```

The type form interprets patterns, substitutes bound references, strips captures,
normalizes alternatives, and installs local accessor products. Repeating type on
an existing type is idempotent. Int is a primitive atom; explicit Type(Int) keeps
its distinct wrapper. Type(Rect) removes redundant constructed-type wrapping.
There is one ordinary expression evaluator, not separate type/data name lookup.
Pattern interpretation still recognizes captures and annotations before evaluation.

Source-defined factories work at interpreter runtime. Compile-time specialization,
reflection and generic inference remain future milestones. This change does not
infer Rect from an unannotated Rect(2,2); use :: Rect until inference is implemented.
See [TYPE-VALUES.md](TYPE-VALUES.md) for normalization, recursion and text contracts.

## Run

Node 24 or later executes the TypeScript directly, without installing packages:

```sh
node src/cli.ts --grammar default.pattern demo.pattern
node src/cli.ts --grammar default.pattern --repl
node src/cli.ts --grammar default.pattern --parse demo.pattern
```

A finished grammar form runs on its last line; a blank line still submits.
Entries can contain multiple lines. `:quit` exits. Program mode requires a final
result; REPL mode also accepts definitions and bindings. Failed entries do not
commit bindings.

Open `index.html` to use the included browser build. Browser storage is best-effort;
Save session / Load session provides a portable backup. The embedded ChatGPT
playground uses this same generated bundle.

For development:

```sh
npm ci
npm run check
npm run build
npm test
```

Tests include semantic regressions, normalized-syntax round trips, grammar-dependent
execution, and DOM-level playground tests with storage restoration. DOM tests do
not establish actual iOS lifecycle/storage behavior.

## Structural rules

- A bare name and an application are different nodes: `f` is not `f()`.
- Each application has exactly one argument pack. Successive applications remain
  distinct: `f(a)(b)` is not `f(a,b)`.
- `a.b` means `b(a)`; `a .b c` means `b(a)(c)`.
- All infix operators have equal precedence and associate right. They require
  spaces on both sides. `2 * 3 + 4` therefore evaluates to 14.
- Prefix punctuation is a maximal symbol. Postfix `* ? ! ^` are separate type
  modifiers. `Int?*` means a list of optional integers.
- Outfix `[1,2]` and `{1,2}` have the unquoted heads `[]` and `{}`. They remain
  outfix in normalized output; `[](1,2)` has a different, nested expression head.
- `()` is an empty argument/result pack, not a unit value. `(x)` is grouping.
- Blocks end in a result pack, possibly empty. A final binding or definition is a
  grammar error in both CLI and playground, including inside unused functions.
- A newline immediately after an opening parenthesis can introduce a grouped
  layout block. Normalized output uses this to preserve block operands.

```text
def pair(x) (x,x)
(a,b) = pair(3)
a + b
```

Every positional result must be consumed: `x = (1,2)` is an error. Argument-pack
binding patterns may ignore extra named fields:

```text
x = (1,foo: "bar")
x
```

To request a named result:

```text
(x,foo: f) = (1,foo: "bar")
f
```

Constructed-value patterns require exact fields. Bare ... ignores extra positional
fields and ** ignores extra labels independently; labels requested by the pattern
remain required unless defaulted in a binding context. Positional rest captures
collect a list, never labels. They follow ordinary positional patterns and may
precede named fields; ** is the final item. For example:

```text
Rect(first,rest...,color: c,**) = Rect(1,2,color: :Black,note: 'extra')
(rest,c)
# ([2],:Black)
```

Argument packs retain extra-label tolerance without **. Constructed rest captures
need ** to tolerate extra labels. Explicit spreading rest... unpacks positional
contents; labeled capture/spread remains deferred.

## Patterns, types, and interpretations

Definitions evaluate their bodies as ordinary expressions. A TitleCase definition
must return a type; capitalization never converts its body into a pattern.

```text
def r :Rect(Number)        # ordinary literal value Rect(:Number)
def R type :Rect(Number)   # Type(Rect(Float))
# def R :Rect(Number)      # error: R must hold a type
```

The `type` form resolves type names in its pattern and produces the type value
and local accessor methods. Ordinary functions can also return type values.
Their arguments follow ordinary evaluation: write `make(Float)` to pass a type value. Named recursion and parameterized types retain their
finite references.

Bare lowercase names capture. An explicitly annotated TitleCase name captures a type value: `def Option(T :: Type) type :None | Some(T)`. Bare `T` remains a reference, never an inferred type parameter. TitleCase captures require `Type` annotations (aliases are allowed); primitive and constant names are reserved. Labels remain lowercase, for example `elementType: T :: Type`. A parameter alias does not declare another named type or import accessors. Rest captures hold lists and remain lowercase. `_` is a wildcard; `_1`, `_2`, etc. are reserved
positional names. Uppercase names in value patterns resolve an existing type when
one is bound; unknown bare type names are errors. Quote literal symbolic patterns.
Duplicate binding captures are errors. `_` ignores a binding capture and cannot
define a type field. Named type declarations register accessors separately from the type value.
Explicit inline nested `type …` forms must contain neither. Constructor subpatterns
create no type boundary and keep their captures in the enclosing pattern. Thus
`type :Picture(shape: Rect(w :: Number,h :: Number))` gives Picture the w and h
accessors, not shape. Declare Rectangle separately and use `shape: Rectangle` for
a typed shape accessor. A label implicitly captures only when followed by a type
specification; structural subpatterns introduce only their own captures.

```text
def Picture type :Picture(color: (type :Red | :Black),shape: Rectangle(w :: Number,h :: Number))
p = Picture(color: :Red,shape: Rectangle(3,4)) :: Picture
(p.color,p.w,p.h)
# (:Red,3,4)
```

Here color has an explicit nested type; shape contains a constructor subpattern.
The latter has no independent concrete type or automatic shape accessor. To make
shape a typed field with its own accessor, declare its type separately:

```text
def Rectangle type :Rectangle(w :: Number,h :: Number)
def Picture type :Picture(shape: Rectangle)
p = Picture(shape: Rectangle(3,4)) :: Picture
(p.shape.w,p.shape.h)
# (3,4)
```

```text
def Vector(t :: Type) type [values... :: t*]
[1,2] :: Vector(Int)
```

`T*` accepts zero or more elements. Type-argument spreading remains different:

```text
def Tuple(ts... :: Type*) type {ts…}
{1,"hello"} :: Tuple(Int,String)
```

Named types are lazy references retaining their names and arguments. Recursion
unfolds during matching; the recursion guard uses declaration/argument identity,
not display strings. `def List(T) type :Nil | :Cons(T,List(T))` is supported.

Annotations establish a concrete interpretation; identical structural type definitions share a space:

```text
def Rectangle type :Rect(w :: Number,h :: Number)
r = Rect(3,4) :: Rectangle
(r.w,w(r))
```

Both calls produce 3. The type definition introduces its capture accessors into its
lexical scope. A call collects applicable ordinary functions and visible accessors;
there is no priority for an ordinary function over an accessor. Multiple applicable
candidates are an error. Accessors require a carried interpretation, not a search
for every type that could structurally match. Parameter annotations establish the
interpretation too.

Named fields are matched by label regardless of their source order. Canonical
syntax, displayed values, equality, and ordering sort named fields alphabetically
(by Unicode UTF-16 code-unit order), after the positional fields. Duplicate labels are
surface syntax errors; duplicates introduced by spreading are runtime errors.

Labels must start lowercase and use camelCase (for example `firstName`); uppercase
labels and explicit `_1:` labels are syntax errors. Positional pseudo-labels remain
internal. In a pattern, a label followed by a type specification supplies its own
default capture:

```text
def R type :Rect(width: Int, height: Int)
r = Rect(width: 3, height: 4) :: R
r.width * height(r)
```

`width: Int` captures as `width`; `width: w :: Int` captures only as `w`.
An explicit wildcard (`width: _`) suppresses capture. This rule also applies to
function parameters and binding patterns. `rest: Int*` captures one labeled list;
`rest...` captures the remaining argument fields (including zero fields).

Named labels and explicit capture names are separate:

```text
def Rectangle type :Rect(width: w :: Int)
r = Rect(width: 3) :: Rectangle
r.w
```

A rest accessor returns one list value; explicitly spread it to obtain several arguments. Capture names do not become physical
labels in the underlying value. Equality and ordering ignore accessor names,
but require matching concrete spaces.

Vertical spreading and a bounded source-defined Body grammar now work through the
shared matcher. TodoList, Matrix and nested Body inspection are runnable playground
examples. [BODY-GRAMMAR.md](design/BODY-GRAMMAR.md) specifies rows, capture dimensions
and empty layouts; [examples/body-grammar.pattern](examples/body-grammar.pattern)
contains the executable grammar. Full Code coverage and code.evaluate follow later.

## Grammar and execution

The grammar file uses the same declaration spelling as type definitions:

```text
def Definition type :def (signature :: Signature) (body :: Body)
def MacroRegistration type :macro (signature :: Signature) (body :: Body)
def TypeExpression type :type (pattern :: PatternBody)
def IfExpression type :if (condition :: Expression) (consequent :: Body) :else (alternative :: Body)
def MatchExpression type :match (subject :: Expression) (arms :: Arms)
```

This small declaration bootstrap is explicit. Macro starting keywords must be
unique. `Expression`, `Body`, `Pattern`, `PatternBody`, `Signature`, and `Arms` are bootstrap
syntax categories. `Program` is the validated block entry point. Other named rules,
structural patterns, captures, alternatives, and repetition use the shared matcher.

Parse and Run use the same selected grammar. For example, changing `:if` to `:when`
in `IfExpression` changes the executable syntax. Registered semantic roles use the
rule name and its captures, never a second keyword parser in the evaluator. A new
custom macro may be parsed with `Grammar.parseAs`; execution requires an explicit
semantic handler. A grammar definition is not arbitrary executable host code.

Macro operands are resolved before evaluation. The grammar resolver can consume a
surface tail for any registered macro in a final operand; it does not search for
and mutate a special `type` token. Grouped macros are supported as expression heads.

## Implementation modules

These are host TypeScript modules, not a source-language import system.

| Module | Responsibility |
|---|---|
| `syntax.ts`, `application-format.ts` | Structural syntax, argument/result boundaries, shared application formatter |
| `parser.ts` | Tokens, uniform operator sugar, grouping, neutral sequences and layout |
| `pattern-compiler.ts` | One compiler for structural pattern syntax, including captures and rest fields |
| `pattern.ts` | One matcher for syntax and runtime values, via domain adapters |
| `grammar.ts` | Grammar declarations, macro resolution, block/result validation |
| `bootstrap.ts` | Minimal host reader for grammar declarations |
| `language-description.ts` | Recursive Language schema, ordinary grammar data and lossless AST transport |
| `elaboration.ts` | Ordered block recognition and final-result validation |
| `lowering.ts` | Internal let/then operations for block bindings and sequencing |
| `macros.ts` | Syntax/data conversion, quotation, hygiene, and source origins |
| `availability.ts` | Conservative checks for unavailable runtime dependencies |
| `values.ts` | Runtime values, lexical scopes, interpretations, equality and ordering |
| `runtime.ts` | Evaluation of resolved forms; lazy type references and call dispatch |
| `cli.ts` | CLI and multiline REPL adapter |
| `playground.ts` | Browser controls, session backup and best-effort draft persistence |

The shared compiler takes domain-specific leaf resolvers. Syntax references such
as `Expression` consume source forms; runtime references such as `Int` recognize
values. The structural algorithm is shared. All contexts share the pack/constructed distinction: packs permit extra labels; constructed patterns require explicit **. This is not inferred from an
environment lookup or from the identity of a UI control.

## Deliberate limits

This is an experimental interpreter, not a compiler or a statically typed language.

- Numbers use finite JavaScript numbers and reject unsafe integer literals/results.
  There is no exact-decimal arithmetic. Arithmetic operators consume two successive
  one-element packs; use `negate(x)` or `0 - x` for numeric negation. `-(x)` remains
  the first pack of subtraction, consistent with application by packs.
- Data order is numbers, strings, symbols, then constructed terms. Terms compare
  head, ordered field labels/values, then length. Opaque functions currently lack
  public structural equality/ordering; interpreter object identity is not language
  equality. Representable type values compare ordinary capture-free value trees,
  including finite recursive references.
  Explicitly interpreted values carry concrete identity; compiled packing and
  every-type canonical parse/toString are not yet implemented. Closure round trips in particular
  still require portable structural descriptions of their code and environments.
- Overlapping pattern alternatives that produce multiple complete matches are
  rejected as ambiguous. This is a conservative matcher policy, not set-theoretic
  union simplification or a subtype solver.
- `T?` uses `None | Some(T)` and `T^` uses `Ok(T) | Error(_)` as provisional
  conventions. Postfix `!` is reserved for future action types; action values and
  execution are not implemented. No console, file, network, or library-import
  capabilities are supplied.
- Recursive declaration groups are supported. Per-type parse/toString function
  synthesis remains planned.

Source and matching budgets keep ordinary mistakes bounded. They are not a
production security sandbox. No source-language expression is passed to host eval.

## Optional labeled defaults

```text
def Color type :Black | :White
(size: s :: Int, color: c :: Color = :Black) = (size: 3)
c
# :Black
```

A default applies only when its label is absent. A present value is validated,
never silently replaced. The default is evaluated in the pattern's lexical
scope only when needed, must produce one value, and is checked by the same
pattern. It cannot refer to sibling captures from the same argument pack.
Explicit captures and implicit label captures both work: `color: c :: Color = Black`
and `color: Color = Black`. A default itself makes a label optional, so
`size: Int = 3` also works. `T?` always means `?(T)` (currently `None | Some(T)`),
including in defaulted fields. A default must inhabit the annotated type:
`color: c :: Color? = Some(Black)` is valid; `color: c :: Color? = Black` is not.
Omitting a default keeps a label required, even if its value type is `T?`.


Defaults are permitted in binding patterns: destructuring bindings, function
parameters, and match arms. They supply captures without adding fields to the input.
All type expressions reject defaults with E_TYPE_DEFAULT. Ascriptions and typed
parameters require complete fields; they cannot repair incomplete values.

This restriction follows the role of each context: types describe admitted values;
binding patterns additionally produce captures. A default supplies a missing capture,
not a missing stored field. Type-level default completion would make expression
construction depend on the declarations in scope, including ambiguity between a
colorless rectangle and a colored rectangle with a default. Ordinary factory functions
keep that choice explicit. See [the design rationale](VALUE-SPACES.md#why-type-patterns-reject-defaults).

Use an ordinary function to construct a value with convenient defaults:

```text
def Rectangle type :Rect(w :: Int,h :: Int,color: String)
def rectangle(w :: Int,h :: Int,color: String = 'black')
  Rect(w,h,color: color) :: Rectangle
end
rectangle(2,3)
# Rect(2,3,color: "black")
```

Rect(2,3) itself remains the same expression regardless of visible declarations.
There is no generated constructor, scoped constructor lookup, implicit completion,
or user-normalizer lookup. Factories and normalizers are ordinary explicit calls.
Membership, match arms, and typed parsing inspect values without changing them.

Overload recognition checks supplied values without evaluating omitted defaults
or predicates. Only the selected function binds captures and evaluates needed
defaults once. Supplied invalid values cannot use defaults as a fallback. Positional
and rest-capture defaults remain unsupported.

## Namespaces, binding, and interpretation limits

Captures on a named type declaration create accessor methods; captures in a binding
pattern create variables. Referring to that type does not inject its accessor names
as variables or install its methods again. Explicit inline nested types reject captures
and defaults; constructor subpatterns share the enclosing pattern's captures. A function's parameter pattern behaves as a destructuring binding
against its incoming argument pack at entry. Match arms are pattern–expression pairs,
not functions: each arm selects a subset of the scrutinee, binds its captures, and
evaluates its expression. They share the matcher, without argument construction or
an independently callable function value. Grouped layout must
consume all source lines. Ambiguous alternatives propagate as errors rather than
ordinary mismatches. Word symbols use ASCII lower camel, upper camel or upper
snake. UpperSnake one- and two-letter names require a trailing underscore; underscores
otherwise separate uppercase words. _ and positional pseudo-names remain reserved.

The shared pattern compiler records which source positions introduce captures,
including labeled shorthand and positional rest. Declaration validation, accessors,
compile-time dependency checks and macro hygiene consume that representation.
Capture locations are compiler metadata and never affect type identity or text.
Defaults and annotations use the surrounding scope before the new captures bind;
quoted literal patterns and symbolic constructor heads do not become captures.

Variable bindings and function definitions now occupy separate namespaces.
Bare names resolve only variables. Defined functions, accessors, and built-ins
cannot be returned or passed as values; use an anonymous wrapper such as
`x -> f(x)`. Direct named calls consider both visible defined methods and any
callable local variable of that name. Exactly one candidate must match:
multiple matches are an ambiguity error, and a non-callable variable does not
hide defined methods. Dot calls follow the same rule. Anonymous functions and
whole-pack partial applications remain first-class values. Ambiguity is detected
at call time; signature overlap is not yet rejected at declaration time.

This restriction is intentional: a defined name such as positive designates an
overload set, not one function value. If no variable named positive exists,
`p = positive` is invalid; use `p = x -> positive(x)`. The wrapper supplies an
explicit call where dispatch can use the arguments. The same rule applies when
only one overload exists, so adding another does not change bare-name meaning.

`=` binds only as a statement in a program/block; evaluating an ordinary nested
`=` application does not mutate the environment. Defaults and type patterns give
`=` their own interpretation. Blocks lower bindings through internal let/then
operations; the core executor does not interpret the surface equals operator.
That lowering is host implemented, not yet a language-defined block macro.
Scoped definition lowering and full separation of elaboration from runtime remain
unfinished; user-defined macros currently expand on demand.

Different structural type definitions may coexist even when they match some of
the same syntax. The one-owner-per-head rule remains dropped. Equal structural type
identities have one declaration name across visible lexical scopes; independent scopes
may use different names. Named generic specializations are checked when materialized,
and repeated references to one declaration do not register it again.

The numeric prelude exposes Int, Float and Float32 as ordinary type atoms. Number
is an alias for Float; canonical global text uses Float. Type-expression evaluation
installs local accessors, while transporting a structural Type value does not
transport its defining scope. Named declarations retain their accessor products;
lazy generic products remain visible through that declaration across snapshots.
Source-language module imports remain pending.

## Concrete types, abstract slots, and facets

Concrete interpretation determines a value's space and eventual packing. Moving the
value into Any, a multi-space union, or a facet uses an internal abstract slot
retaining its actual concrete descriptor; it does not change value identity.

```text
n = 3 :: Int
(x :: Any) = n
(x == n,toString(Any)(x),toString(Int)(x))
# (True,"3 :: Int","3")
```

Source value-expression :: accepts only concrete/refinement types. Abstract types
belong in binding/parameter constraints, and typed matches narrow them. Raw/empty
data needs an explicit concrete interpretation until inference is implemented.
Annotations in typed text are reconstruction metadata at abstract positions, not
synthetic runtime :: trees. The old quoted annotation-inspection pattern is removed.

Open type patterns define structural facets rather than concrete spaces:

```text
def Colored type :Rect(Number,Number,color: String)
def Rectangular type :Rect(w :: Number,h :: Number,**)
r = Rect(2,3,color: 'black') :: Colored
(p :: Rectangular) = r
(p,p.w,p.h,p == r)
# (Rect(2,3,color: "black"),2,3,True)
```

The complete Colored value, including color, is retained. Facet accessors are local
methods subject to ordinary ambiguity checks. Public Facet(Pattern) descriptions and
typed values round-trip in fresh interpreters. Capability-based interfaces, operation
dictionaries, static proof checking, and general inference are later milestones.

Global parse/toString text expands concrete descriptions; local variants use only
valid visible aliases. Concrete positions omit redundant annotations; abstract
positions always include the actual concrete type. REPL inspection shows concrete
types, or Expression for uninterpreted syntax. This does not guess Int
versus Number or infer generic types. Opaque function inspection/serialization remains
limited. See [TYPE-VALUES.md](TYPE-VALUES.md) for exact coverage and constraints.

## Diagnostics

Language errors expose a structured `diagnostic` with a code, phase, primary source
range, notes, related definition locations, and candidate causes.
`renderDiagnostic(error)` is shared by CLI and playground. It prints source
excerpts and underlines. The playground selects the offending range when its
source matches the current editor. Errors in old REPL closures retain the original
entry's source document. Source metadata is non-enumerable and excluded from
structural comparison and canonical syntax.

Matching retains paths and expected/actual values. Dispatch reports rejected
candidates individually and ambiguous calls identify matching definitions.
Generic parameter spelling, duplicates, and variadic placement are checked when
a type is declared, even if unused. See TODO.md for remaining validation work and
the macro/type-model roadmap.

## User-defined macros

Quotation returns expression data. It does not execute the quoted application;
explicit interpolation holes are evaluated at their quotation stage. The REPL
prints the value without adding a quotation marker:

```text
def f(x) 2 * x
b = :f(1)
c = :(f(1))
(b == c,b)
# (True,f(1))
```

Ordinary functions can return quotation or `Code` data. `def` never registers a
macro, regardless of the function's body or result. Registration is explicit:

```text
def twiceCode(e) Code$` $e + $e
macro (:twice (e :: Expression)) twiceCode(e)
(twiceCode(2 + 3),(twice (2 + 3)))
# (5 + 5,10)
```

`twiceCode` evaluates its arguments and returns data. `macro (:twice (e :: Expression)) ...` installs
a transformer under the name `twice`; its parameters match unevaluated syntax,
its body computes `Code`, and its result is expanded at the call site. The body
may call ordinary helper functions, use local bindings, or select a result with
control flow. There is no inspection of the body's final syntax to classify it.
A registered transformer must return one value interpreted as Code. A symbolic
application merely spelled Code(...) is not sufficient; it reports E_MACRO_RESULT.

Sidefix registrations also install a parsing rule:

```text
def unlessCode(c,v) Code$` if $c 0 else $v
macro (:unless (c :: Expression) (v :: Body)) unlessCode(c,v)
unless False
  x = 3
  x + 1
end
# 4
```

`Expression` and `Body` describe syntax, not the value it evaluates to. Registration
is lexical and sequential. Local rules stay in their block; successful REPL
registrations persist. Parse-only does not execute transformer bodies or commit
rules. Failed submissions roll back grammar and environment changes together.
Sidefix `def` signatures are now an error: use explicit `macro` registration.

Ordinary and registered methods cannot share a name, and callable variables
cannot share a registered macro name. Use a separate transformer name as above.
Macro signatures must be sidefix sequences beginning with a quoted keyword.
Function definitions must use micro syntax. Macro registrations with micro
signatures are rejected, as are micro calls to registered macros. Each sidefix
starting keyword has one registration in a grammar scope. Ordinary code-producing functions support the same
multiple packs and runtime lexical captures as other ordinary functions.

Macro registration checks for dependencies on runtime bindings, including through
ordinary helper closures, parameter defaults, and interpolation holes. Quoted
references remain allowed. For example, inside `def demo(x)`, a macro can emit
`Code` followed by a backtick and `x`, but cannot insert `$x` with `Code$` followed by a backtick. A local literal
`n = 5` may be used during expansion. Errors identify the unavailable lexical
reference. Ordinary functions returning Code have no such restriction.

This is currently conservative interpreter staging, not a compiler: ordinary
function parameters are marked runtime even when a particular call passes a
constant. Compile-time specialization and stronger availability inference are
planned. Registration inside a function is checked when that body is interpreted;
a future compiler must perform this check while elaborating the function.

Template lambda, binding, and generated declaration parameters retain hygiene;
free template references resolve in the definition scope. An explicit outer interpolation pass enters nested quote/template trees;
additional dollars protect holes for a later stage. Expansion diagnostics include call and definition
origins. Depth is capped at 100, alongside the interpreter's step budget.

Generated definitions and macro registrations are supported. Consecutive ordinary
definitions form recursive lexical groups. Full phase-separated compilation and
language-defined block lowering remain pending. Non-micro syntax still uses internal structural tags;
a stable public introspection encoding is a compile-time-only roadmap item.

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
line must have the complete prefix. Consistent tabs/spaces are permitted in text
prefixes; ordinary code indentation remains spaces-only.

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

## Consistency checkpoint

Sidefix sequences are fixed-length. No sidefix alternation or repetition extension
is introduced. Spread `...` is confined to argument packs, including a constructor
pack nested inside a sidefix signature. `T*` means one list-shaped expression in
both function and sidefix macro patterns. Capture records retain field labels and rest
identity from the common matcher through macro evaluation.

A non-parameterized declarative `def Point type :Point(x :: Int)` is registered
for both runtime interpretation and syntax recognition. Its internal capture names
remain private. Registrations obey block scope and failed-REPL rollback.
Parameterized and computed type declarations are not yet exported into the grammar
environment; this is a staged subset, not general type inference.

`:f(x)` quotes only its head; `:(f(x))` is raw structural data. Use a typed
interpolating quote for holes. Display and canonical String source use the same
escaped inline spelling, preserving literal dollars, delimiters and all boundary
whitespace. Portable code/function environments remain limited; see TYPE-VALUES.md.

The bootstrap grammar still recognizes def/signature/body. This keeps declaration
discovery independent of evaluating definitions. Defining def entirely in user
syntax is deferred; no sequence operators are added just for bootstrapping it.
Accessor metadata comes from the shared compiled pattern, including constructor
subpatterns; explicit nested type references retain separate ownership. Macro hygiene and other binding analysis still have separate walkers;
consolidating those remains an architectural task.


### Architecture checkpoint

The surface reader produces grammar-independent syntax. Recognized sidefix forms use
`kind: "form"`, regardless of whether they are executed as macros. `bootstrap.ts`
contains the host seed reader; `elaboration.ts` walks blocks in source order and
provides recognition, declaration-acceptance, and final-validation hooks. The
prototype's final-result rule is an explicit language policy. Run now interprets forms sequentially, installing generated definitions before reading
the next form. Function bodies retain definition-time grammar; local extensions do not escape.
Parse form remains non-executing and cannot discover a grammar generated by executing a macro.
Internal binding/sequence lowering is implemented as described below. Scoped
declaration lowering and a separately executable elaboration
phase remain planned; consecutive ordinary defs now form recursive groups, as specified in [ROADMAP.md](ROADMAP.md).


### Generated local grammar

```text
macro (:install :answer) Code` macro (:answer (x :: Expression)) Code$` $x
def demo()
  install answer
  answer 42
end
demo()
```

The result is `42`. The generated `answer` macro exists only inside each invocation
of `demo`. The inner quote belongs to the
new macro and substitutes its own argument when called.


### Block lowering

Definition-free micro-expression blocks now lower to a chain of internal `let` and
`then` operations. A `let` carries the complete pattern and RHS argument pack, then
continues after matching through the same pattern engine used by function arguments.
The core does not interpret the surface equals operator. Blocks requiring grammar
extension still elaborate one form at a time and use that same lowering for bindings.

The development API exports `lowerBlock(tree)` and `Interpreter.runCore(core)`;
`tree` is an interpreted block returned by `Interpreter.parse`. `runCore` has the
same transactional session behavior as `run`. Parse-only still does not execute
macros that generate declarations. These core operations are internal and cannot
be intercepted by defining a user variable named `let`.

This is a host-implemented lowering pass; blocks are not yet language-defined macros.
Scoped definition lowering and moving `if`/`match` to macros remain follow-up work.

## Value-space runtime checkpoint

See [VALUE-SPACES.md](VALUE-SPACES.md) for the current contract and limits.

```text
(x :: Number .where (n -> isInt64(n))) = 10
(y :: Int) = 10
x.toInt == y
# True; x == y instead reports E_INCOMPARABLE_TYPES.
```

```text
def NoInt Int? .where (v -> v .matches :None)
a = :None :: NoInt
b = :None :: Int?
a == b
# True; :None :: String? is a different concrete space.
```

The numeric backend remains limited to safe JavaScript integers, including the
current Int implementation. No full 64-bit integer support is claimed.

`where` and `matches` use ordinary function dispatch and two successive argument
packs: `T .where p` is `where(T)(p)`. Neither word is reserved by the parser, and
neither has a special evaluator branch. Predicates are function values; wrap a
defined function with a closure such as `n -> isInt64(n)`.

```text
def restrict(base)(predicate) base .where predicate
small = restrict(type Int)(n -> n < 5)
3 :: small

pattern = type :Pair(Int,Int)
Pair(1,2) .matches pattern
```

Type values supply the full shared pattern specification. Other arguments to
`matches` are literal-value patterns: `:None` matches None, while `:Some(Int)`
denotes the literal symbolic value Some(Int). Use `type :Some(Int)` for the
typed constructor pattern. Comparison errors between concrete spaces become a
non-match here; ordinary equality still rejects incompatible spaces.

Existing drafts using bare infix `where`/`matches` must be edited to dot notation
and explicit predicate closures; saved source is not silently rewritten.

## Structural type values and global/local text

Structural types support ordinary construction and matching as Type(pattern), with
primitive atoms such as Float and Int as leaves. For example, Float displays as Float;
Rect displays as Type(Rect(Float,Float)) after its declaration. An abstract union of
Circle and Square retains its member descriptions, and recursive types have finite
portable descriptions. Root aliases collapse while nested type boundaries remain.
The typed API implements `parse(T)(toString(T)(value)) == value` for supported
structural values. `parseLocal(T)` and `toStringLocal(T)` may use names in that scope.
See [TYPE-VALUES.md](TYPE-VALUES.md) for examples and explicit limits.

## One value equality

Legacy bootstrap behavior: Int equals its raw canonical atom :Int; Type(Int) has
a distinct wrapped tree. Their compiled
matchers are caches and do not participate in comparison. Canonical uncached type
trees work in annotations, generic calls, and matching, and have the same global
text as their cached form. Invalid/noncanonical type-shaped trees remain data.

Closures and unsupported predicate/default environments cannot currently be compared
because they lack structural representations; E_VALUE_REPRESENTATION reports this
general limitation. Host object identity is not a language equality rule.

## Design drafts

The [quotation draft](design/QUOTATION-PROPOSAL.md) and
[refinement/canonical-type draft](design/REFINEMENT-CANONICAL-PROPOSAL.md) record
ongoing design work and accepted clarifications. The string/quotation specification is implemented for its documented subset.
Type defaults and implicit normalization are not language features. General
canonicalization remains a separate proposal; constructedBy is tabled.

## Inspecting and transporting the language

`language()` returns the active grammar as ordinary data; `languageSchema()` returns
its recursive source-language schema. `parseSyntax(language())("if True 1 else 2")`
returns an AST without evaluating source or installing macro implementations.
Descriptions and schemas support fresh-scope round trips.

See [LANGUAGE-BOOTSTRAP.md](LANGUAGE-BOOTSTRAP.md) for the transport format,
conformance matrix, minimal Def seed and complete host-semantic inventory. Whole-program
elaboration and self-hosting remain later milestones.

Milestone 2 review: [CODE-REVIEW-MILESTONE-2.md](CODE-REVIEW-MILESTONE-2.md).

## Grammar-directed DSL quotes and Code

```text
def ExpectedOutput type (e :: Expression) ::: (type :: Expression)
expected = ExpectedOutput` (1 / 0) :: MissingType
(expected.e,expected.type)
# (1 / 0,:MissingType)
```

Neither expression is executed and MissingType is not looked up. In the pattern,
::: quotes the existing :: symbol; it does not introduce another operator. In the
typed quote, :: is interpreted as data by ExpectedOutput rather than as executable
ascription. Bound type quotes interpret their raw trees and
return that type, without adding a type-name constructor. Unknown quote targets fail.
Grouped fixed-length sidefix types can likewise be quoted and destructured as data;
see examples/sidefix-data.pattern. They do not install executable Code keywords.

Code is defined in source as TreeGrammar(SyntaxNode), using the same recursive
schema as inspection. TreeGrammar(T) is the syntax-domain adapter: T describes a
surface tree's structural view. Quotes validate that view with the common matcher
and return interpreted syntax without a Code(...) wrapper. Code(:expression) is a
compatibility factory that performs the same interpretation; :Code(...) is just data.
Interpolation is explicit: T-backtick is raw; T-dollar-backtick performs one structural pass.

Direct syntax splices require the same concrete grammar. Raw Expression remains
a compatibility bridge; known primitive values are lifted with explicit concrete
ascriptions so executing the generated Code preserves their interpretation.
Other interpreted spaces require an explicit syntaxTree/syntaxExpression bridge.
These checks also apply to every element of a positional splice.

```text
a = Code` x + 1
b = Code$` $a * 2
b
# (x + 1) * 2 :: Code
```

Source-level code.evaluate is deferred to the interpreter written in the language;
neither run nor evaluate is installed as a native language operation. Milestone 3's
test runner uses the external TypeScript reference interpreter. Its host-only
Interpreter.evaluateCode(value) API evaluates stored Code in an isolated child of
the host session, preserving the complete result pack. Local definitions and bindings
do not escape. This is an embedding API, not a source-language JavaScript escape.

Mere quotation does not capture runtime bindings or register macros. Macro templates
retain their existing lexical origins and hygiene through direct Code splicing.
Code's tree schema validates structure; elaboration/execution still checks scoped
forms and language semantics. A source interpreter still needs source-defined
environments, evaluation rules and callable dispatch, not just the syntax tree.

Closed source trees have inert parse(Code)(toString(Code)(c)) round trips, including
blocks, sidefix syntax and nested quotes. Captured template environments and internal
forms not reproducible from surface source reject portable serialization/comparison
explicitly. Nested Code fields currently retain structural :: reconstruction metadata;
omitting that metadata through type-directed field readers remains pending.
See examples/code-grammar.pattern, examples/code-categories.pattern and
examples/typed-test.pattern. All playground cases are ordinary `.test` data under
`tests/examples/`, shared with the external test runner.

Applications and packs can now be inspected and rebuilt as ordinary tree data:

```text
tree = syntaxTree(:(factory(1)(2,color: :Red)))
Apply(function,arguments) = tree
changed = Apply(function,[Field("_1",NumberLiteral(3)),Field("color",Name("Red",True))])
syntaxExpression(changed)
# factory(1)(3,color: :Red)
```

syntaxSchema() supplies the shared source-defined SyntaxNode type. Each Apply has
one complete field list; successive packs, empty calls, computed heads and labels
remain distinct. The inverse validates tree/field structure and never executes it.
See examples/inspect-expression.pattern. The explicit syntax view is also usable
for Code. syntaxExpression reconstructs syntax only; preserving lexical environments
through arbitrary edits to the reified view remains pending. Direct Code splicing
retains the original tree and lexical origins.

## Test DSL and shared examples

The runner recursively scans tests/**/*.test. Files contain one or more named test
blocks, organized by broad subdirectory. The ordinary schema in examples/test-schema.pattern
requires a first Test row and permits a repeated Test* tail. Shared setup belongs
inside a test; assertion modifiers cannot be applied to an entire test.

```text
test "Current and future primitives"
  expect :Widget result Widget :: UpperCamelSymbol
  legacy expect 5 result 5 :: Expression
  todo expect 5 result 5 :: Rational
end
```

Plain and legacy assertions must pass. Legacy marks a current contract to retire
explicitly. Todo assertions execute and must fail; a success fails the case with
“This assertion now passes; remove todo.” Expected failures have no diagnostics and
are counted separately from passing assertions. No todo case is skipped. File,
shared setup, fixture and host failures still fail normally. Each assertion evaluates
in a child scope and cannot change a later assertion's definitions, bindings, grammar
or proof environment. All assertions are attempted after an ordinary check failure.

```sh
npm run test:language
npm run test:language -- --list
npm run test:language -- tests/examples/grammars.test
npm run test:language -- --fixture fixtures.pattern my-tests.test
```

Each case has a fresh interpreter. Fixtures and shared setup are available to
expected-type expressions, which resolve before the subject runs. Once pack/type
checks agree, expected values are interpreted as canonical data, never executed
to obtain an answer. Actual and expected observed types must be equal; matching a
payload under a broader type is insufficient. Widget is the correct data spelling
for the result of :Widget in UpperCamelSymbol. A quoted expected :Widget is rejected
rather than silently reinterpreted. Bootstrap Expression values keep their existing
printing rules and are explicitly legacy where their behavior is expected to change.

Result expectations require exactly one positional value, its exact observed type,
and canonical expected data: expect r.w result 2 :: Float. An expected symbolic
binary tree must be grouped: expect e result (1 + 1) :: Expression. It is data,
not a calculation producing 2. Predicate checks use assert rather than boolean
expectations. Destructure multiple returns once, then check each capture separately.
An empty-return assertion can bind () to the call, then return True. Ordinary pack
shape and label rules remain covered by host tests. There is no results expectation
or separate value/type keyword pair. Errors still use expect subject error "reason".

All 128 cases execute: 249 assertions pass (70 legacy) and 117 todos fail as expected.
All 76 playground examples remain standalone programs, with setup and optional final return packs included in their
editable source. The build embeds source without running it to regenerate expected
answers. Actual controls exercise every option from fresh/restored sessions, and
saved drafts retain their storage identity. A bounded source-only reader stores
future spellings, but execution still uses ordinary parsing. This does not implement
future types or code.evaluate. See [the suite specification](design/TEST-SUITE.md).

Program and REPL output both use annotated display, for example `Widget :: UpperCamelSymbol`.
--parse still prints surface syntax. Empty results print (). Every result in a
multi-result pack is annotated, retaining labels.

For embedding, Interpreter.interpretSyntax reads inert trees with an ordinary
grammar, readValue uses the canonical data reader, and call invokes source operations
with explicit successive packs. These are host APIs alongside evaluateCode; none
installs source-language eval or a JavaScript escape.

Source removes one initial BOM and normalizes CRLF to LF once. Word symbols are
ASCII; Unicode identifier capitalization is deferred. String contents remain Unicode
and receive no Unicode normalization. The string/quotation specification is implemented.

## Recursive groups and typed-code inspection

Consecutive ordinary def statements share their declared function/type names.
A binding, macro registration or expression ends the group; later ordinary
bindings are not visible in earlier definitions. Groups are local to their block
or REPL submission. Nonproductive type aliases reject, and failed groups roll back.

```text
def Sum type (a :: MathExp) :+ (b :: MathExp)
def Product type (a :: MathExp) :* (b :: MathExp)
def MathExp UnionType(Sum,Product,Symbol,Number)
MathExp
```

UnionType retains member spaces and requires disjoint syntax. MathExp positions
interpret their unique member without explicit annotations. The mutualTypes playground example constructs
and round-trips a nested mathematical value with those annotations.

Code's public recursive schema is also bound as SyntaxNode. Inspecting Code shows
TreeGrammar(SyntaxNode); inspecting a type value expands its root definition and
uses visible names for nested types. Global toString(Type) stays fully structural.
See typedCodeBinding for matching a Code refinement and inspecting a binding's
left/right packs without executing it. The newer verticalBody example uses direct
source-defined binding and Body patterns. Full Code coverage precedes source-level
code.evaluate; static checking follows both. [Closed function values](design/FUNCTION-VALUES.md)
records the accepted no-free-variable representation and its remaining mechanisms.

## Intrinsic symbols and grammar-defined unions

```text
x = :a
x
# a :: LowerCamelSymbol

def MathExp unionType Symbol | Number
(a :: MathExp) = :a
toString(MathExp)(a)
# "a"
```

Symbol is the prelude union of LowerCamelSymbol, UpperCamelSymbol and
PunctuationSymbol. UnionType members must have disjoint syntax; overlap and
unsupported proofs reject. Union parsing selects the unique concrete member,
including in fields/lists, and printing omits redundant union annotations.
Facet/Any reconstruction tags remain explicit. The current overlapping Int/Float,
Int?/String? and list unions are invalid rather than resolved by branch priority.
See simpleExpressionUnion and unannotatedUnion in the playground. The smaller
Full Code grammar and executable nested test suites remain next work;
[the design notes](design/UNION-GRAMMARS.md) distinguish them from this fix.
