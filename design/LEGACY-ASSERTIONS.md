# Legacy assertion coverage

Legacy means an observation we intend to retire, not simply an older test. Keep
supported behavior as ordinary expect/assert checks. When the replacement is
settled, put an executable todo for the same subject beside the legacy assertion.
Each still has its own required outcome: legacy must pass and todo must fail.

The source suite retains 70 legacy assertions: 48 have a same-subject todo and
22 are listed below because their exact replacement is not yet specified. A host
check verifies this inventory against every legacy assertion in tests/**/*.test.
Adding a blanket failing placeholder is not a replacement specification.

The paired contracts cover intrinsic String/Rational identity, primitive metatypes,
ordinary symbol identity, and rejection of unspecified concrete construction.
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
| `examples/expressions#inspect-and-rebuild-syntax` | `syntaxExpression(changed)` | D03 / milestone 5b: whether runtime raw syntax exists and the public tree-to-value boundary. |
| `examples/grammars#sidefix-data-dsl` | `e(expected(check(t)))` | D03 / milestone 5b: a raw grammar operand is syntax, not necessarily an evaluated Rational literal. |
| `examples/grammars#sidefix-data-dsl` | `type(expected(check(t)))` | D03 / milestone 5b: concrete representation of a raw grammar operand. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `actual(t)` | D03 / milestone 5b: representation of an unevaluated quoted operand. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `e(expected(t))` | D03 / milestone 5b: concrete representation of an unevaluated compound tree. |
| `examples/grammars#dsl-tests-with-explicit-value-and-type` | `type(expected(t))` | D03 / milestone 5b: concrete representation of a raw grammar operand. |
| `examples/grammars#test-dsl-with-typed-code` | `e(expected(check(t)))` | D03 / milestone 5b: numeric syntax in a raw expected operand versus evaluated numeric identity. |
| `examples/grammars#test-dsl-with-typed-code` | `type(expected(check(t)))` | D02/D03: reserved primitive names in raw syntax versus evaluated type values. |
| `examples/macros#code-function-versus-registered-macro` | `twice (2 + 3)` | D04: arithmetic over default exact literals is optional; default arithmetic/result rules are not specified. |
| `examples/macros#typed-code-recursive-for-each-macro` | `value` | D03 / milestone 5b: inferred concrete result spaces for unannotated nested lists and empty branches. |
| `examples/quotation#quoted-expression-values` | `b` | D03 / milestone 5b: whether runtime raw syntax is exposed and its concrete type. |
| `examples/types#canonical-type-alternatives` | `toString(Type)(a)` | Type-value representation: final public descriptor text; structural equality and round trips remain ordinary assertions. |
| `examples/types#factory-defaults-and-complete-types` | `toString(Type)(type Rectangle)` | Type-value representation: final descriptor encoding, including primitive names and nested spaces. |
| `examples/types#inspect-a-pattern-union` | `left` | Type-value representation: concrete interpretation of a projected pattern descriptor. |
| `examples/types#inspect-a-pattern-union` | `right` | Type-value representation: concrete interpretation of a projected compound descriptor. |
| `examples/types#local-and-global-type-text` | `global` | Type-value representation: final global descriptor encoding. |
| `examples/types#portable-recursive-type` | `text` | Type-value representation: public recursive binder/reference spelling; transport remains an ordinary assertion. |
| `examples/types#types-as-ordinary-values` | `toString(Type)(t)` | Type-value representation: final global descriptor encoding. |

Normal assertion status does not promise that all bootstrap fixture/declaration
spellings will survive. It records the behavior being tested. Retiring a legacy
contract must also migrate setup that depends on it; a future constructor-rejection
check cannot continue using the rejected construction in shared setup.
