# Vision: one structural foundation

Updated 7 November 2026. This is the research/design direction. The
[roadmap](ROADMAP.md) distinguishes it from the implemented TypeScript bootstrap.

## Thesis

Data, types, patterns and code can share a structural foundation. One compositional
pattern specification recognizes admissible structure and captures its parts across
type interpretation, bindings, function/macro signatures, matching and DSL grammars.
The hypothesis is that this reduces the independent rules programmers need while
combining algebraic discipline, structural interoperability and extensible syntax.

Sharing a matcher is not itself proof of simplicity. The user-facing contracts must
compose: pack boundaries, concrete identity, capture roles, evidence and evaluation
phases must remain understandable when features are nested.

## Structural values and explicit interpretations

Applications have expression heads and complete argument packs. Data, source forms,
types and grammar descriptions can use the same tree foundation without having the
same concrete identity. A concrete descriptor establishes a space; refinement keeps
that space; an abstract view keeps the member's actual space. This avoids nominal
module dependencies without pretending that identical spelling always means equal
values in distinct domains.

Descriptors use structural value equality, not extensional equivalence of arbitrary
predicates. Captures and local declaration names do not change identity. Declarations
expose local accessors/display names; plain type construction must not install them.
Different static guarantees can constrain equal values without adding history to them.

Canonical typed text aims at parse(T)(toString(T)(v)) == v and equal text for equal
values under the same T. Global text is independent of lexical names; local variants
may use visible names. The decoding grammar matters. General unions may need member
annotations; an unambiguous DSL grammar separately promises annotation-free text.
Every-type coverage, portable predicates and closed callable representations remain goals.

## Intended benefits

- Algebraic data, explicit absence/failure, refinements and progressively stronger
  static checks. Options, results and a later effect model are intended discipline,
  not safety guarantees already established by the interpreter.
- Independently authored modules exchange structurally equal values without a shared
  nominal type-definition module. Import/accessor policy and schema evolution still
  need real module experiments.
- Homoiconic programs and DSLs with familiar applications, infix/dot sugar and sidefix
  control forms. Typed grammar reading remains separate from code execution.
- Rich tagged data and canonical text with a small surface, supporting both data
  interchange and source metaprogramming.
- Compact compiled concrete representations. Abstract slots retain actual member
  descriptors where needed; metadata erasure is a selective optimization, not a
  blanket ban on runtime type information.
- A learnable pattern algebra with explicit role policies. Binding-only defaults,
  ordered match arms and syntax-domain macros need honest explanations rather than
  claims that every context is identical.

## Small semantic boundaries

Exact Rational literals identify numeric values. Fixed-precision carveouts have their
own operations; exact designation cannot silently round. Explicit converters return
typed values. IEEE special identities remain deferred.

Designation can recurse through a unique justified inward path. Explicit projection
crosses one concrete boundary. Refinement evidence is a checking fact; overlapping
base/refinement overloads do not gain predicate-driven priority. ConstructedBy is
tabled until refined values can be decoded without compromising canonicality.

Specialization is a later compiler optimization, not the meaning of abstract calls.
The next conformance milestone records the intended rules as pending test DSL cases,
then promotes cases as their implementation is verified. A green suite must not count
unimplemented todo cases as passes.

## Self-hosting and evaluation

Build a small source interpreter over a typed Code grammar, then port the matcher,
structural representation and compiler. Source code.evaluate should have an explicit
pure subset and environment/closed-callable contract, not a hidden native evaluator
escape. Macro preparation, portable dependencies and a static checker have separate
completion gates. A backend is chosen on implementation merit; no Go target is
required by the language model.

Use the shared source corpus to compare bootstrap, source and compiled behavior.
Measure performance only with a meaningful compiled representation, and evaluate
novelty/learnability separately from feature count. The paper's core evidence is
cross-context patterns, canonical type/value transport, structural interoperability,
a non-code DSL and eventually a specialized generic parser, with exceptions stated.
