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
| `examples/types#canonical-type-alternatives` | `toString(Type)(a)` | Descriptor text is now the ordinary value text, but whether `:Black | :Red` keeps its quotes inside a descriptor value is not fixed by the printing rules; the todo is not authored until it is. |
| `examples/types#factory-defaults-and-complete-types` | `toString(Type)(type Rectangle)` | Descriptor text is now the ordinary value text, but the text of a nested declared type (`color: Color`) inside a descriptor and the quote spelling of `:Black` are not fixed by the printing rules. |
| `examples/types#inspect-a-pattern-union` | `left` | Inspection is now ordinary matching on `ConcreteType(...)`, but the shape of the alternatives pattern and whether `left`/`right` stay Expressions are not specified; the `:|(left)(right)` spelling is not carried over. |
| `examples/types#inspect-a-pattern-union` | `right` | Same as `left`: the element interpretation after matching the kind constructor is not specified. |
| `examples/types#portable-recursive-type` | `text` | Recursive spelling kept as is (`Recursive(...)` / `Recur(0)`); separate decision. |
| `examples/types#local-recursive-type-block` | `x` | Recursive spelling kept as is (`Recursive(...)` / `Recur(0)`); separate decision. The expected type parses the old text. |
| `examples/types#type-normalization-and-wrappers` | `Type(Int)` | Retired wrapper: the approved replacement `Int :: PrimitiveType` is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `examples/types#type-normalization-and-wrappers` | `Type(Rect)` | Retired wrapper applied to a declared type name: the table gives no replacement for `Type(Rect)` (only for the full descriptor). |
| `examples/types#type-normalization-and-wrappers` | `Type(Type(Rect))` | Retired nested wrapper: no approved replacement. |
| `examples/types#types-are-ordinary-values` | `Type(Int)` | Retired wrapper: the approved replacement `Int :: PrimitiveType` is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `examples/types#types-as-ordinary-values` | `Type(pattern) == t` | Retired destructuring: the replacement `todo assert ConcreteType(pattern) == t` (and a todo setup `ConcreteType(pattern) = t`) is authored beside it, but the subject changes, so the host pairing cannot match. |
| `postfix/values#optional-type-descriptions-print-as-none-unions` | `toString(Type)(type String?)` | Descriptor text is now the ordinary value text, but whether `:None` keeps its quote inside a descriptor value (and nested descriptor text) is not fixed by the printing rules; not authored until it is. |
| `postfix/values#optional-type-descriptions-print-as-none-unions` | `toString(Type)(type String??)` | Descriptor text is now the ordinary value text, but whether `:None` keeps its quote inside a descriptor value (and nested descriptor text) is not fixed by the printing rules; not authored until it is. |
| `specification/concrete-unions#a-direct-union-arm-takes-precedence-over-inward-designation` | `toString(Float??)(inner)` | Descriptor text inside a `:: <type>` suffix: quote spelling of `:None` and the position of nested descriptors are not fixed by the printing rules; not authored until they are. |
| `specification/concrete-unions#nested-string-options-print-relative-to-the-requested-grammar` | `toString(String??)(inner)` | Descriptor text inside a `:: <type>` suffix: quote spelling of `:None` and the position of nested descriptors are not fixed by the printing rules; not authored until they are. |
| `specification/concrete-unions#an-explicit-concrete-member-identifies-an-otherwise-ambiguous-branch` | `toString(MyType)(x)` | Descriptor text inside a `:: <type>` suffix: quote spelling of `:None` and the position of nested descriptors are not fixed by the printing rules; not authored until they are. |
| `specification/concrete-unions#an-explicit-concrete-member-identifies-an-otherwise-ambiguous-branch` | `toString(MyType)(y)` | Descriptor text inside a `:: <type>` suffix: quote spelling of `:None` and the position of nested descriptors are not fixed by the printing rules; not authored until they are. |
| `specification/overlapping-unions#overlapping-option-unions-construct-unannotated-none-is-ambiguous` | `UnionType(Int?, String?)` | The `AbstractType(ConcreteType(...) \| ...)` replacement is a todo beside it, but the subject changes, so the host pairing cannot match. |
| `specification/overlapping-unions#overlapping-numeric-and-constructor-unions-construct` | `UnionType(Int, Float)` | AbstractType does no automatic reordering; whether overlap-ordered identity survives for any constructor is undecided. |
| `specification/overlapping-unions#overlapping-numeric-and-constructor-unions-construct` | `UnionType(Int, Int) == UnionType(Int)` | AbstractType does no extra normalization; whether duplicate members collapse is undecided. |
| `specification/overlapping-unions#overlapping-abstract-facet-members-retain-spaces` | `UnionType(type Rectangular, type Colored)` | The new descriptor data for an open-facet member (`Rect(w :: Float, h :: Float, **)`) is not specified; the old `Facet(Apply(OpenFields(...)))` encoding is not carried over. |
| `specification/primitives#quoted-primitive-names-in-code` | `(type String(:A)) == Type(Apply(Literal(String), Fields(:A)))` | The new descriptor data for a reserved-head pattern such as `String(:A)` is not specified; the old `Apply(Literal(...))` encoding is not carried over. |
| `types/descriptions#explicit-apply-describes-a-literal-reserved-head` | `Type(Apply(Literal(String), Fields(:A))) == (type String(:A))` | The new descriptor data for a reserved-head pattern such as `String(:A)` is not specified; the old `Apply(Literal(...))` encoding is not carried over. |
| `types/identity#uniontype-normalizes-like-uniontype` | `(unionType String | Int) == UnionType(Int, String)` | The `ConcreteType`/`AbstractType` constructors never reorder or deduplicate (normalization belongs to `concrete`/`abstract` patterns), so `UnionType`'s normalizing identity has no same-subject replacement; the `unionType` pattern form is not part of the constructor migration. |
| `types/identity#uniontype-normalizes-like-uniontype` | `(unionType Int | String | Int) == UnionType(String, Int)` | The `ConcreteType`/`AbstractType` constructors never reorder or deduplicate (normalization belongs to `concrete`/`abstract` patterns), so `UnionType`'s normalizing identity has no same-subject replacement; the `unionType` pattern form is not part of the constructor migration. |

Normal assertion status does not promise that all bootstrap fixture/declaration
spellings will survive. It records the behavior being tested. Retiring a legacy
contract must also migrate setup that depends on it; a future constructor-rejection
check cannot continue using the rejected construction in shared setup.
