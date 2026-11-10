# Legacy assertion coverage

Legacy means an observation we intend to retire, not simply an older test. Keep
supported behavior as ordinary expect/assert checks. When the replacement is
settled, put an executable todo for the same subject beside the legacy assertion.
Each still has its own required outcome: legacy must pass and todo must fail.

Every legacy assertion in the source suite either has a same-subject todo or is
listed below because its exact replacement is not yet specified. A host
check verifies this inventory against every legacy assertion in tests/**/*.test.
Adding a blanket failing placeholder is not a replacement specification.

The paired contracts cover intrinsic String/Rational identity, primitive metatypes,
ordinary symbol identity, and unresolved symbolic-construction changes.
The todo uses an expected error when the old expression should become invalid.
Normal arithmetic, copying/rest cardinality and defaults use established concrete
types where their subject does not depend on raw Expression compatibility.

The playground extracts the supported program without its todo operands. All
checks still execute in the suite, including expected failures. Todo-only cases
are not runnable examples. Adding a companion todo must not remove an example.

## Replacements that require a design decision

These rows describe precisely what remains blocked, rather than silently assigning
ExpressionTree, a Code category, a numeric result type or a new descriptor encoding.
The case ID is relative to tests/. Subjects are the direct expressions checked in that case.
Resolve the named decision, then replace its row with a same-subject todo or an
ordinary assertion if the intended result is already implemented.

| Case | Subject | Blocking decision |
| --- | --- | --- |
| `examples/expressions#deferred-expected-output` | `e(expected)` | D03 / milestone 5b: the concrete interpretation of raw syntax captured by Expression. |
| `examples/expressions#language-as-data` | `len(rules)` | D04: numeric result space of collection lengths; Int family/default numeric vocabulary is provisional. |
| `examples/expressions#language-as-data` | `len(nodes)` | D04: numeric result space of collection lengths. |
| `examples/expressions#open-structural-facet` | `toString(Rectangular)(p)` | C15 / typed text: final reconstruction syntax for an abstract facet and its concrete descriptor. |
| `examples/expressions#inspect-and-rebuild-syntax` | `syntaxExpression(changed)` | D03 / milestone 5b: public syntax-tree-to-value mapping; raw runtime Expressions are now permitted. |
| `examples/grammars#sidefix-data-dsl` | `e(expected(check(t)))` | D03 / milestone 5b: a raw grammar operand is syntax, not necessarily an evaluated Rational literal. |
| `examples/grammars#sidefix-data-dsl` | `type(expected(check(t)))` | D03 / milestone 5b: concrete representation of a raw grammar operand. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `actual(t)` | D03 / milestone 5b: representation of an unevaluated quoted operand. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `e(expected(t))` | D03 / milestone 5b: concrete representation of an unevaluated compound tree. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `type(expected(t))` | D03 / milestone 5b: concrete representation of a raw grammar operand. |
| `examples/grammars#test-dsl-with-typed-code` | `e(expected(check(t)))` | D03 / milestone 5b: numeric syntax in a raw expected operand versus evaluated numeric identity. |
| `examples/grammars#test-dsl-with-typed-code` | `type(expected(check(t)))` | D02/D03: reserved primitive names in raw syntax versus evaluated type values. |
| `examples/macros#typed-code-recursive-for-each-macro` | `value` | D03 / milestone 5b: inferred concrete result spaces for unannotated nested lists and empty branches. |
| `examples/types#inspect-a-pattern-union` | `left` | The `todo ConcreteType(:|(left)(right)) = t` setup is authored beside the legacy destructuring; the host pairing cannot match because the subject changes (`left`/`right` are bound by that setup). |
| `examples/types#inspect-a-pattern-union` | `right` | Same as `left`: todo setup authored, pairing is subject-changing. |
| `examples/types#portable-recursive-type` | `text` | Recursive spelling kept as is (`Recursive(...)` / `Recur(0)`); separate decision. |
| `examples/types#local-recursive-type-block` | `x` | Recursive spelling kept as is (`Recursive(...)` / `Recur(0)`); separate decision. The expected type parses the old text. |
| `examples/types#type-normalization-and-wrappers` | `Type(Int)` | Retired wrapper: the approved replacement `Int :: PrimitiveType` is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `examples/types#type-normalization-and-wrappers` | `Type(Rect)` | Retired wrapper applied to a declared type name: the table gives no replacement for `Type(Rect)` (only for the full descriptor). |
| `examples/types#type-normalization-and-wrappers` | `Type(Type(Rect))` | Retired nested wrapper: no approved replacement. |
| `examples/types#types-are-ordinary-values` | `Type(Int)` | Retired wrapper: the approved replacement `Int :: PrimitiveType` is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `examples/types#types-as-ordinary-values` | `Type(pattern) == t` | Retired destructuring: the replacement `todo assert ConcreteType(pattern) == t` (and a todo setup `ConcreteType(pattern) = t`) is authored beside it, but the subject changes, so the host pairing cannot match. |
| `specification/overlapping-unions#overlapping-option-unions-construct-unannotated-none-is-ambiguous` | `UnionType(Int?, String?)` | The `AbstractType(ConcreteType(...) \| ...)` replacement is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `specification/overlapping-unions#overlapping-numeric-and-constructor-unions-construct` | `UnionType(Int, Float)` | Replaced by contracts in `specification/type-values`: "Kind constructors never reorder or deduplicate" and "Patterns normalize when evaluated". Legacy kept until `UnionType` is retired; a same-subject todo would need `UnionType`. |
| `specification/overlapping-unions#overlapping-numeric-and-constructor-unions-construct` | `UnionType(Int, Int) == UnionType(Int)` | Replaced by the same two contracts in `specification/type-values` (deduplication belongs to `abstract` pattern evaluation, not the constructor; `AbstractType(Int)` is itself rejected). Legacy kept until `UnionType` is retired. |
| `specification/overlapping-unions#overlapping-abstract-facet-members-retain-spaces` | `UnionType(type Rectangular, type Colored)` | Old internal description encoding (`Facet`/`Apply`/`OpenFields`); no encoding replacement is authored. A language-level replacement would be an `AbstractType`-with-open-facet equality contract (`type Rectangular abstract Rect(w :: Float, h :: Float, **)`), not specified yet. |
| `specification/primitives#quoted-primitive-names-in-code` | `(type String(:A)) == Type(Apply(Literal(String), Fields(:A)))` | The new descriptor data for a reserved-head pattern such as `String(:A)` is not specified; the old `Apply(Literal(...))` encoding is not carried over. |
| `types/descriptions#explicit-apply-describes-a-literal-reserved-head` | `Type(Apply(Literal(String), Fields(:A))) == (type String(:A))` | The new descriptor data for a reserved-head pattern such as `String(:A)` is not specified; the old `Apply(Literal(...))` encoding is not carried over. |
| `types/identity#uniontype-normalizes-like-uniontype` | `(unionType String | Int) == UnionType(Int, String)` | Replaced by "Patterns normalize when evaluated" in `specification/type-values`; legacy kept until `UnionType` is retired (a same-subject todo would need `UnionType`). |
| `types/identity#uniontype-normalizes-like-uniontype` | `(unionType Int | String | Int) == UnionType(String, Int)` | Replaced by "Patterns normalize when evaluated" in `specification/type-values`; legacy kept until `UnionType` is retired (a same-subject todo would need `UnionType`). |

Normal assertion status does not promise that all bootstrap fixture/declaration
spellings will survive. It records the behavior being tested. Retiring a legacy
contract must also migrate setup that depends on it; a future constructor-rejection
check cannot continue using the rejected construction in shared setup.
