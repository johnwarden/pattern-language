# Language descriptions and the bootstrap boundary

Milestone 2 makes the pattern representation authoritative for structural matching,
capture metadata and descriptor shape recognition. It does not make the interpreter
self-hosted or move expansion ahead of runtime execution; those are later milestones.

## Status boundary — 7 November 2026

This file describes the unchanged bootstrap protocols and executable schemas.
The revised language contract is in [the type-value spec](specs/type-values.md) and
[VALUE-SPACES.md](VALUE-SPACES.md); it does not require this transport taxonomy to
become permanent user-facing syntax. Exact Rational primitives, declaration-only
accessors, general unions and evidence-based checking are planned alignment work.

The next small milestone is [the Test DSL conformance suite](design/TEST-SUITE.md):
revised checks, pending forms, C01–C27 and cogent migrations from TypeScript. It uses
the existing host runner, not a source-language evaluate escape. Source-level
code.evaluate remains milestone 5c. Generic suite grammar and the revised target
Code representation are not implemented by updating this document.

## Ordinary grammar values

```text
l = language()
l .matches languageSchema()
# True

text = toString(Expression)(l)
copy = parse(Expression)(text)
copy == l
# True

parseSyntax(copy)("if True 1 else 2")
# Block([Form("IfExpression", ...)])
```

`language()` describes the active grammar, including currently scoped structural and
sidefix registrations. Its value has one `Language` head with these labeled fields:

| Field | Meaning |
| --- | --- |
| start | The `Program` root |
| rules | Rule name, structural/form role, and unevaluated AST pattern list |
| readers | Named host reader contracts |
| blocks | Final-result, REPL-tail and ordered-arm policies |
| typeGrammar | AST of the executable portable type-description schema |

`languageSchema()` returns the recursive source-defined `Language` facet. Its exact
source is `src/language-description.ts`; build generates
`examples/language-description.pattern` from it. The value returned by `language()`
is syntax/DSL data, not a compiled program or an implicitly installed language.

`parseSyntax(description)(text)` recognizes text against that description and returns
an ordinary AST value. It does not evaluate text, install macro implementations,
import declaration environments or make input bindings visible. A transported macro
signature describes recognition only; its code implementation must be registered
separately before evaluation. Unsupported changes to host readers, block policy or
the type grammar are rejected rather than pretending those contracts are programmable.

The host `Grammar.fromDescription(value, validate)` adapter rebuilds the rule set.
Its required validator recognizes `LANGUAGE_SCHEMA`; the source-language operation
always supplies the isolated executable schema validator. It shares the ordinary
pattern compiler and host reader implementation with the source-grammar constructor.

## Lossless AST representation

The surface reader produces one AST containing micro expressions, argument packs,
sidefix sequences, quotes and layout blocks. Resolved forms retain their names,
items and capture maps. Transport makes these distinctions explicit:

| AST variant | Data form |
| --- | --- |
| Symbol | `Name(text,quoted)` |
| Literal | `NumberLiteral(Rational)` or `StringLiteral(text)` |
| Application | `Apply(head,[Field(label,value),...])` |
| Pack | `Pack([Field(label,value),...])` |
| Quote | `Quote(tree)` |
| Typed quote | `TypedQuote(grammar,tree,interpolate)` |
| String template | `TextTemplate([Text(text),Hole(tree,protection,spelling),...])` |
| Reader quote | `ReaderQuote(reader,[Text(text),Hole(tree,protection,spelling),...])` |
| Sidefix sequence | `Sequence([trees...])` |
| Block | `Block([lines...])` |
| Resolved form | `Form(name,[items...],[Capture(name,rest,[fields...]),...])` |

Thus source `Quote(x)` and source `:x` have different transport trees. AST transport
does not use source-name guesses, host identity or a hidden provenance cache.
Source spans and lexical provenance are session metadata and are intentionally not
transported. Reconstructed source is recognized with fresh locations. Field ordering,
duplicate-label checks and label naming reuse the surface field validator. Each AST
codec call has a 10,000-node and 256-level budget and fails with a language diagnostic.

## One pattern representation

`PatternCompiler` supplies the structural rules. Domain adapters resolve only leaves,
references and reader operations. `patternBindings` derives capture names, explicit
and implicit source sites, positional rest, alternative sites and binding boundaries
from the compiled representation. Declaration validation, dependency analysis,
accessor discovery and hygienic renaming consume it.

References and local-capture maps own their captures. Inline type expressions do not
bind variables in surrounding patterns. Defaults and annotations read the surrounding
scope before the new captures bind. Availability analysis follows those computations
and helper signatures. Destructuring and arm captures retain dependencies of their
inputs and pattern computations; ordinary function/type-factory parameters remain
runtime bindings outside explicit expansion. This analysis is conservative. Hygiene leaves quoted literal heads alone and
checks duplicate names across a whole signature before alpha-renaming.

## Adapter contracts and conformance

| Rule | Runtime bindings/parameters/arms | Types/accessors | Syntax/macros/grammar |
| --- | --- | --- | --- |
| Capture | Variable in the matching scope | Scoped accessor, erased from type identity | Unevaluated syntax capture |
| `T :: Type` | Type-valued capture | Type-valued accessor | Requires a corresponding syntax-domain reference; no implicit runtime reflection |
| `_` | Ignore a capture | Forbidden as a type field | Ignore source syntax |
| Default | Supplies an omitted labeled capture | Forbidden | Supplies syntax; it never evaluates default code during recognition |
| Rest | Captures remaining positional values as a list | Positional repetition and list-valued accessor | Captures remaining positional syntax; macro insertion preserves that list |
| Extra labels | Ignored for argument packs; explicit `**` for constructed values | Explicit openness creates a facet | Same pack/constructed distinction |
| Alternative | Ambiguity is an error | Ambiguity is an error; concrete type unions use `UnionType` | Ambiguity is an error |
| Arm order | First successful arm; later arms are not evaluated | Not a union-order rule | Arm blocks are recognized as ordered pattern/expression pairs |

The conformance corpus covers required/missing labels, label order, explicit openness,
exact fields, omitted and invalid defaults, positional rest, duplicate captures and
ambiguous alternatives. It includes type accessors and grammar recognition where the
pattern applies. It does not claim dependent type lookup or runtime-expression
evaluation in a syntax matcher. Computed/generic syntax references require future
elaboration and compile-time factories.

## Portable type descriptions

`TYPE_SCHEMA` is executable source in an isolated interpreter. Every call to the
descriptor interpreter first recognizes the schema. Constructor arity, positional
packs, scalar versus repeated positions, flags and index shape belong to that schema,
not separate decoder grammar rules. Since `**` deliberately ignores extra labeled
values, each such descriptor field is recognized using the same scalar schema before
it is interpreted. This adds no keyword-capture or typed-keyword-rest syntax.

The decoder's remaining checks are interpretation semantics: recursive binder scope,
productive references, concrete/facet boundaries, pattern unions versus unions of
type values, canonical representations and ambiguous interpretations. Schema
membership alone is not proof of those properties. Shape failures report
`E_TYPE_DESCRIPTION` with the received tree in diagnostic notes. Scope and semantic
failures retain their more specific decoder messages.

## Minimal host seed and remaining semantic primitives

`readBootstrap` accepts only surface sequences `def TitleCaseName type Pattern...`.
It needs the surface reader but no installed `def` grammar. This seed installs the
ordinary `Definition`, `MacroRegistration`, `TypeExpression`, `IfExpression` and
`MatchExpression` rules. The active rule set is what `language()` exposes; there is
no separately maintained list of public forms in the transport schema.

The remaining host responsibilities are explicit:

- Surface tokenization, packs, quote/layout boundaries and canonical field order.
- The seed declaration recognizer and grammar reference installation.
- Readers listed by `HOST_READERS`: expression/form/body/arms/program/signature,
  opaque pattern syntax (including the PatternBody reader used by type forms) and lexical literal categories (`Num` aliases `Number`).
- Block-tail policy, ordered-arm recognition and host let/then lowering.
- Pattern leaf resolution, recursion guards, work limits and syntax/value adapters.
- Descriptor interpretation, concrete-space storage, equality, ordering and text.
- Lexical environments, named dispatch, native arithmetic and scoped registration.
- Quote expansion, hygiene, macro availability and runtime evaluation of resolved forms.

The matcher has its own bounded work stack and a separate opaque-reader reentry
limit. Parser, codecs, descriptor interpretation and rendering retain their own
budgets; universal stack safety is not claimed.

Surface structure errors belong to parsing; malformed declarations/capture syntax
and descriptor shapes to declaration processing; supplied-field and alternative
failures to matching; macro availability/hygiene errors to expansion or registration;
ordinary unbound names and computation failures to evaluation. Some dependent
annotations and unused bodies still resolve lazily. Moving those checks ahead of
execution is milestone 6's elaboration work and milestone 7's static checking.

The recognizer/AST description above is implemented milestone 2 tooling. The public
recursive Code tree grammar, grammar-directed typed quotes and macro-facing Code
inspection are implemented by milestone 3's source schemas and syntax-domain adapter,
rather than by the transport codec alone.

## Code and Test grammars: milestone 3

TypedQuote is now an explicit surface/transport AST variant. Bound DSL type quotes
interpret raw trees instead of adding a constructor named after the type. Grouped
fixed-length sidefix data patterns share the matcher and do not register Code keywords;
the existing syntaxSequence data encoding provides their canonical representation.
PatternBody keeps type-pattern operands opaque, including captures named type, while
recognizing nested type forms. Pattern operands of binding/arrow operators likewise
remain opaque to Code-form resolution. Unknown typed-quote targets fail. Code now
uses the source-defined TreeGrammar(SyntaxNode) space without a wrapper.

ExpectedOutput is an ordinary type with Expression captures on either side of a
literal :: head, written ::: in its pattern. Its input is e :: T, interpreted as
data by that grammar rather than evaluated as Code ascription.
No new runtime expected-value category or automatic type lookup is introduced.
Inline and indented expected clauses share the generic data-layout interpretation.
The external Test runner reads the source schema, then resolves expected types only
in its explicit fixture environment and interprets expected values as data. All
playground cases and representative conformance cases are source Test files; no
parallel browser source/expected tables are maintained.
Typed Code fields do not execute during construction. The milestone 3 runner uses
the external reference interpreter; source-level code.evaluate is deferred.

The public syntax inspection bridge uses the same SyntaxNode schema as Language:
syntaxSchema() returns its type, syntaxTree converts syntax to ordinary typed tree
data, and syntaxExpression validates and decodes that data. Conversion and schema
recognition are host adapters; tree structure and ordinary matching are not separate
host policies. The decoder still validates field order and duplicates. This bridge
is syntax-only: it neither executes Code nor reconstructs captured environments.
TreeGrammar(T) is the one new syntax-domain host adapter. The accepted tree shapes
are specified by ordinary source types, not a second host matcher. Its portable type
descriptor is included in the executable type-description schema. Code's prelude
comes from CODE_SCHEMA and is loaded outside the isolated schema bootstrap, avoiding
a recursive dependency on Code while constructing schemas. Macros now require an
interpreted Code result and splice its stored tree; symbolic Code(...) tags do not
qualify. Code(expression) remains an ordinary compatibility factory.

Interpreter.evaluateCode(value) is a host-only embedding API. It forks the host
session's scope and grammar, evaluates the stored block and returns its full pack.
It does not export test-local declarations. Neither run nor evaluate is installed as
a native source-language operation. A source-defined code.evaluate belongs to the
source interpreter milestone. Closed Code has surface-source round trips; captured origins
and internal forms without portable source reject serialization/comparison. The
syntax/data adapters are shared in syntax-values.ts, independently of macro expansion.

The embedding boundary also exposes interpretSyntax (inert grammar interpretation),
readValue (the same canonical reader used by parse), and call (ordinary source
dispatch with explicit complete packs). call uses private temporary argument bindings
in a child scope, not JavaScript eval or a first-class method namespace. The external
harness owns file loading, fixture setup, execution, expectation checking and reports;
it supplies no native test/expect/run/evaluate operations to the source language.

The quote codec stores semantic fragments and holes, not delimiter spelling.
Protection counts distinguish a deliberately deferred hole from literal inserted
text. Only protected text holes retain their dollar spelling (e.g. `$name` versus
`$(name)`), since direct string evaluation must preserve that literal content.
Raw and interpolating TypedQuote nodes remain distinct. Decoding validates every
fragment, protection count, spelling and subtree without executing them.

Consecutive ordinary definitions are buffered as one lexical recursive group.
Grammar registration remains inert and source ordered. Named declarations are
bound, linked to sibling declaration names, and then non-generic types are
completed/validated. Captured ordinary bindings keep their earlier lexical scope.
This is not a prepared execution pipeline; macros still expand during Run.
Source-level code.evaluate is now milestone 5, ahead of static checking.
