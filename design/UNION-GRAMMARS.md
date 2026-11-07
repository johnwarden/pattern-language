# Unions, concrete alternatives and grammar interpretation

Updated 7 November 2026. The integrated contract is in
[LANGUAGE-DECISIONS.md](LANGUAGE-DECISIONS.md), especially D05–D07 and D09.

## Concrete alternatives versus abstract unions

A concrete pattern establishes one structural space. Changing its alternatives
changes its descriptor and identity. An abstract union preserves the existing
member spaces, even when two members have overlapping source spellings. Refinements
preserve their base space. This distinction remains intentional; no extensional
predicate-equivalence solver is introduced.

```text
# Intended working notation, not current bootstrap syntax.
type Status concrete :Red | :Green
type PrimaryColor concrete :Red | :Green | :Blue
type EitherFloat abstract Float32 | Float64
```

Identically spelled Red values in the first two spaces are not the same concrete
value. An EitherFloat slot retains whether its payload is Float32 or Float64.
General typed text includes enough reconstruction information when spelling alone
cannot recover that member. No first-success union parsing policy is introduced.

## Unambiguous is a separate requirement

A DSL can require unambiguous interpretation and annotation-free value text through
a separate grammar qualifier/certificate. It concerns the complete grammar, including
nested abstract fields and facets. It does not establish a new concrete identity or
make every general union subject to a syntax-disjointness proof.

The exact qualifier spelling, supported proof subset and certification protocol remain
provisional. C13 specifies overlapping general unions; C14 specifies the separate
unambiguous requirement. An inability to certify a grammar may be an explicit bounded
implementation restriction; it must not redefine general union membership.

## Current bootstrap compatibility

The current source spelling `unionType A | B` constructs normalized UnionType(A,B)
from type-valued members. Its matcher requires disjoint admitted syntax and rejects
Int/Float, overlapping option and empty-list alternatives. This remains an implemented
restriction, superseded in the intended design. Primitive symbol classes and their
Symbol union work. The exact updated type/generic sugar is not yet implemented.

[The bootstrap type reference](../TYPE-VALUES-BOOTSTRAP.md) documents working syntax.
Tests enforcing blanket disjointness remain implementation regressions until the
alignment slice deliberately replaces them. They must not be migrated as the final
language's rule merely because they currently pass.

## Syntax interpretation and Code

Structured runtime expressions need a concrete interpretation. A raw parsing/pattern
domain is distinct in role from an optional explicitly interpreted Expression value;
no decision requires permanent primitive Application/Binding categories or automatically
identifies descriptor syntax with an evaluated type. The public representation mapping
is settled before full Code grammar expansion.

The implemented Body subset supports direct inert inspection via source-defined types.
Rows retain packs, and each repeated dimension adds a capture list layer. It is a
foundation for Code, not a full replacement for the current executable reader. General
arbitrary sidefix repetition/alternation remains outside the bounded subset.

## Test data before more grammar features

[Milestone 5a.1](TEST-SUITE.md) executes every case in grouped .test files under
tests/. Assertion modifiers combine current and future contracts: legacy must pass
until removed, todo must fail and a fulfilled todo fails the suite. They do not
modify whole tests. Shared setup failures remain ordinary failures. Exact observed
result types and canonical expected data are checked independently of value payloads;
complete packs remain explicit. C01–C27 use those forms, with supported checks promoted
to ordinary assertions. This does not replace the bootstrap union model or install
source code.evaluate.

Singleton normalization, family facets and import/accessor collisions remain explicit
policy choices. ConstructedBy is tabled and IEEE details are deferred. No union or
test-grammar work silently chooses those unrelated features.
