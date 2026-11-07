# Bootstrap type values and typed text

> Compatibility reference for the unchanged TypeScript prototype (source release 75).
> These sections describe bootstrap behavior, including restrictions superseded in
> the intended design. The current contract is in [VALUE-SPACES.md](VALUE-SPACES.md),
> [TYPE-VALUES.md](TYPE-VALUES.md) and [GRAMMAR.md](GRAMMAR.md).
> General unions, Rational literals, declaration-only accessors, proof-based
> refinements and the new test DSL are planned changes, not promises of this guide.

The interpreter represents types as ordinary immutable expression values. Compiled
matchers and accessor products are derived caches, not public identity. This document
describes the implemented model; the drafts under design/ are not specifications.

## Ordinary names and ordinary application

Primitive type atoms are self-evaluating language values: Int, Float, Float32, Bool,
String, Symbol, Expression, Body, Any, and Type. Number is an accepted alias for
Float; global text always uses Float. Int currently uses JavaScript-safe integers,
Float uses finite Float64 arithmetic, and Float32 rounds explicitly.

```text
r = Int
r
# Int :: Type in the REPL
```

Other bare names resolve their lexical bindings. A bare unbound Foo is an error,
not a literal symbol. A quoted :Foo is a symbol. Constructor applications such as
Foo(1) use a tag head without requiring quotation. Defined functions, including
native Type/Facet constructors and named type factories, still dispatch normally.
True and False are self-evaluating language constants. NaN is not implemented.

```text
def Rect type Rect(Float,Float)
t = Rect
r = Rect(2,2) :: Rect
(t,r)
# (Type(Rect(Float,Float)),Rect(2,2))
```

There is no alternate name-lookup mode for evaluating type values. The type form
interprets a pattern, substitutes bound values/references, removes capture names,
normalizes alternatives, and returns a type. Pattern interpretation still differs
from ordinary expression evaluation: captures and field patterns are syntax that
must be recognized before their bodies could be evaluated as code.

### One application form for factories

Angle-bracket application is removed. Types are values passed in ordinary packs:

```text
def nonZero(T :: Type)(n :: T) n != 0
positive = nonZero(Int)
(positive(5),positive(0))
# (True,False)
```

This is ordinary whole-pack partial application. It does not infer type arguments
or promise compile-time specialization. Later packs compile their patterns in the
scope containing captures from earlier packs. Explicit `T :: Type` captures a type-valued TitleCase name; bare `T` is a reference. Labels remain lowercase. A captured type is a lexical alias, not another type declaration or accessor import. Primitive/constant names cannot be captured. Rest captures hold lists and remain lowercase.

Named type factories use the same parameter-pattern matcher:

```text
def Option(T :: Type) type :None | Some(T)
def List(T :: Type) type :Nil | Cons(T,List(T))
def Tuple(ts... :: Type*) type {ts...}
(Option(Int),List(Int),Tuple(Int,String))
```

A named type factory must return a type. A matching ordinary pack instantiates it;
a TitleCase application that does not match its factory pack remains tagged data,
so V(3) and the type factory call V(Int) can coexist. Matching/interpretation checks
whether that data belongs to the intended type. Empty applications remain distinct
from bare names, and f(a)(b) remains distinct from f(a,b).

The unary modifiers are ordinary applications too: Int* is *(Int), Int? is ?(Int),
and Int^ is ^(Int). Their domains are disjoint from numeric operator packs.
Postfix ! remains reserved for future action types. There is no generic AST node.

## Normalization and identity

```text
(type Int,type type Int,Type(Int))
# (Int,Int,Type(Int))
```

The type form is idempotent on existing type values. Explicit Type(Int) retains its
wrapper and is a different value tree from Int. Type(Rect) normalizes redundant
constructed-type wrapping, and Type(Type(Int)) retains the existing Type(Int).
These rules also preserve explicit wrappers in nested and recursive descriptions.
They are constructor normalization, not a special equivalence relation for types.

Type values compare using ordinary value-tree equality. Local aliases, capture
names, object identity and cached matchers do not participate. Pattern alternatives
are normalized using the ordinary structural order: bare symbols precede numbers,
strings and applications. Thus :None/:Nil precede Some(...)/Cons(...). Numeric
alternatives sort numerically. Ordered match arms and raw quoted trees are not sorted.
Duplicate/ambiguous alternatives remain errors.

```text
def Color type :Red | :Green
(v :: :Green | :Red) = :Red
v
# :Red :: Color in the REPL
```

Only one named declaration for an equal structural type identity may be visible.
Primitive names are reserved. Independent scopes may use different names for equal
types. References and ordinary variable bindings do not create a new declaration.
The built-in Number spelling is an alias, not another user declaration.

## Captures, accessors and defaults

```text
t = type Rect(w :: Float,h :: Float)
r = Rect(2,3) :: t
(r.w,h(r),t == (type Rect(Float,Float)))
# (2,3,True)
```

A type expression with captures installs local accessor products while its type
value contains only the capture-free pattern. Named declarations retain those
products in their declaration environment. Lazy specializations retain accessors
across lexical snapshots; transporting the structural type value alone does not
transport its defining scope or accessor names.

Binding/parameter/match patterns capture lowercase variables, or explicitly annotated TitleCase type values (`T :: Type`). Type declarations can use the same explicit capture to define a type-valued accessor. Explicit inline
nested type forms cannot declare captures; constructor subpatterns retain enclosing
captures. Unannotated type captures require inference and are currently rejected.
Bindings may leave capture types implicit without treating them as Any.

Defaults remain binding-only. They supply omitted captures without adding fields
to a value. All type patterns reject defaults with E_TYPE_DEFAULT. Convenience
factories are ordinary functions. Canonical/default-applying type proposals remain
under design and are not implemented.

## Portable description vocabulary

| Form | Meaning |
| --- | --- |
| Int, Float, Bool, etc. | Primitive type atoms; no Primitive(...) wrapper |
| TreeGrammar(T) | Concrete syntax space interpreted with the ordinary structural tree schema T |
| Type(Pattern) | Concrete pattern-defined value space |
| Facet(Pattern) | Abstract structural constraint preserving the original member |
| UnionType(T,U,...) | Abstract union of existing concrete spaces |
| A \| B | Alternatives inside one concrete pattern |
| Literal(value) | Literal data where a descriptor/reference would be ambiguous |
| Fields(...) | Exact argument-pack description |
| OpenFields(Fields(...),labels: Bool,positional: Bool) | Independent field-openness axes |
| Repeat(P) | Positional repetition inside an argument pack |
| Row(Fields(...)) | Match one complete layout row as a field pack |
| Collect(P) | Repeat rows and aggregate each capture into an outer list |
| Sequence(P,...) | Compose field patterns, including repeated and required rows |
| Apply(P,Fields(...)) | Explicit application, including constrained/nonliteral heads |
| Recursive(P), Recur(depth) | Finite recursive binder and reference |

Type(Rect(Float,Float)) is ordinary data syntax. Primitive references are bare atoms;
ordinary symbolic leaves require quotation. Application heads are tags. Literal
heads that collide with descriptor constructors use Apply/Literal escapes. Head
constraints such as Apply(Int,Fields()) must retain Apply: Int here constrains a
head value rather than naming a literal constructor tag. Lowercase/punctuation
literal heads retain quotation where ordinary source evaluation would call a function.

Recursion is finite in canonical text:

```text
def List(T :: Type) type :Nil | Cons(T,List(T))
toString(Type)(List(Int))
# "Type(Recursive(:Nil | Cons(Int,Recur(0))))"
```

Nested type boundaries are retained. Recur uses recursive binder depth; ordinary
nested Type scopes do not become extra recursive binders. Unsupported or invalid
references report a descriptor path. Capture slots and wildcard fields are not part
of canonical type descriptions. Row, Collect and Sequence encode vertical grammars
without capture names or host identities. Recursive construction does not memoize
a type identity until deferred members have finished normalizing.

The executable schema in examples/type-descriptions.pattern is generated exactly
from src/type-schema.ts and checked with the shared matcher in an isolated scope.
Schema recognition is the required first step of interpretation. Constructor arity, flags, indices and scalar/pack shapes have one schema authority. Extra labeled descriptor fields use the same scalar schema. The decoder retains recursive-scope, canonicality, value-space and ambiguity checks. See LANGUAGE-BOOTSTRAP.md for the explicit boundary.

## Global and local typed text

```text
parse(t)(toString(t)(value)) == value
```

parse, toString, parseLocal and toStringLocal are ordinary factories. Supplying the
type returns a callable specialized to it. Global text uses structural descriptions;
local text may abbreviate names when the same binding still denotes that type.
Stored local factories retain the naming scope where they were specialized.

The convenience toString(value) overload accepts non-type values. toString(t) with
a type value is the factory call; print a type with toString(Type)(t). The domains
are deliberately disjoint, rather than choosing a different overload implicitly.

Playground Run and REPL inspection use local names for the result's type annotation, while a type
value itself is displayed structurally. Boolean constants and built-in predicates produce interpreted Bool values without inference. Quoted :True remains symbolic data. Raw uninterpreted values show Expression;
there is still no general inference or implicit constructor-interpretation pass.
Use r = Rect(2,2) :: Rect or (r :: Rect) = Rect(2,2) for a concrete interpretation.

Bare symbolic data prints with colon quotation. This also affects symbolic variable
atoms inside quoted expression trees. Parsing global data is inert: it never calls
functions, installs declarations or evaluates interpolation. Primitive atoms resolve
against the fixed language vocabulary, not user lexical bindings.

Disjoint union positions omit :: tags: their grammar uniquely reconstructs the
member. Facet/Any positions serialize the concrete type explicitly. Abstract slots
do not add a structural annotation node to value identity.

```text
(x :: Any) = 3 :: Int
(toString(Any)(x),toString(Int)(x),x == (3 :: Int))
# ("3 :: Int","3",True)
```

Source expression :: T requires concrete/refinement T. Abstract domains belong in
binding/parameter/match constraints. Disjoint union parsing selects its concrete
member; facet/Any parsing still requires a concrete :: tag.

Open facets retain every original field and the original concrete member descriptor.
Their required fields must exist. Facets, concrete types, nested abstract fields,
finite recursive descriptions, and supported structural values have fresh-context
round-trip coverage. Ordinary concrete pattern alternatives still reject ambiguity.

## Implementation limits

No general static checker, source modules, compile-time specialization, or compiler
exists yet. Int is not full-width signed Int64; Float rejects nonfinite values.
General function/closure and refinement-predicate descriptions are not portable;
unsupported equality/serialization fails explicitly instead of using host IDs.
Refinement evaluation is still the earlier interpreter prototype, not the future
assert/proof system. Capability dictionaries and broad inference remain planned.

Exact scalar-string source notation and explicit quote interpolation/staging are
implemented; see design/QUOTATION-PROPOSAL.md. Canonicalizing types, defaults on
types, and lazy normalization remain separate design work.

Playground Run and REPL results include their local type annotations. Uninterpreted results are displayed as `Expression` until inference is implemented. Serialization through `toString(T)` retains its existing type-directed contract.

Local type-value inspection expands the root definition and substitutes visible
type names inside it. Code displays TreeGrammar(SyntaxNode), with SyntaxNode
available for inspecting the recursive tree grammar. Named recursive references
remain finite. Ordinary type annotations can use the type name. toStringLocal
may name an entire type; global toString(Type) stays fully structural for
fresh-context parsing. These printing choices do not change structural identity.

Consecutive def declarations can define mutually recursive named types/families.
They complete before structural identity checks. Recursive UnionType descriptors
keep their member interpretation and decode in the enclosing recursive scope;
Recur is legal only with a valid enclosing binder, even though the schema admits
its shape. Bindings and non-definition forms terminate a declaration group.

## Grammar-directed DSL quotation: first slice

T` tree looks up T as a type and interprets quoted data against it without executing
ordinary names or adding a T(...) node. Self-recursive DSL types and grouped fixed
sidefix patterns use the same compiled matcher and accessor products as explicit
ascription. Sidefix values use the existing syntaxSequence structural encoding.

ExpectedOutput is an ordinary type `(e :: Expression) ::: (type :: Expression)`.
Here ::: quotes the :: head in the pattern; its input uses ordinary ::, for example
ExpectedOutput` (1 / 0) :: MissingType. The selected grammar determines its meaning.
Both fields are raw syntax, including unknown type names. Its consumer decides when
and where to resolve the type and interpret the value. No type inference, automatic
expected-value evaluation or new annotation wrapper is implied.

TreeGrammar(T) is an ordinary type value selecting a structural schema for syntax.
Code is source-defined as TreeGrammar(SyntaxNode). Code quotation returns an
interpreted tree; Code(expression) is an interpretation factory, not a wrapper.
Direct Code splices preserve that tree and its existing lexical origins. Its concrete
identity is the ordinary TreeGrammar(schema) value, and its payload identity is the
explicit structural syntax tree, including quote/pack distinctions.

Closed Code text round-trips inertly in a fresh context. Code stored inside data or
abstract slots currently retains explicit structural :: reconstruction metadata.
Captured Code without a portable environment and compiler forms without a surface
representation remain serialization gaps, reported explicitly. Source refinements
can express Code categories in the same concrete space; portable predicate-bearing
category types remain subject to the general refinement serialization gap.

## Intrinsic symbols and disjoint type unions

SentenceCaseSymbol, TitleCaseSymbol and PunctuationSymbol are intrinsic classes.
Symbol is their prelude union. A bare symbol literal receives its natural class;
its immediate context can interpret it, while a stored typed variable cannot be
silently converted to a different space. unionType A | B normalizes to UnionType(A,B).
Union members must be provably disjoint in the supported structural subset. Shared
None, empty-list and numeric syntax reject. See design/UNION-GRAMMARS.md.
