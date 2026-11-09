# Named functions evaluate to closed function values

Approved in the project chat on 9 November 2026. Supersedes the earlier restriction
that a defined function name can only appear in call position.

A named function resolves to a function value. The value can be stored, passed,
returned and used as a `where` predicate. `.where isSquare` uses ordinary function
value resolution; it is not a special adapter limited to the `where` operator.

The value contains the full implementation and has no free user variables or
hidden lexical environment. Parameter and local binders are bound variables, not
free references. Captured values and transitive referenced function/type/accessor
dependencies must be included or closed over as value/definition data. A symbolic
reference to an arbitrary ambient user function is not the complete implementation.
The existing [closed-definition design](../../design/FUNCTION-VALUES.md) explains
this direction and finite recursive dependency groups.

The [subsequent closed-value and printing decision](library-closure-and-local-printing.md)
requires immutable snapshots and exact-value local abbreviation. Referenced
definitions are ordinary definitions, not a separate helper category. Only the
fixed primitive vocabulary remains external initially; ordinary prelude/standard-
library definitions are included like other dependencies. A later external
reference scheme and its portable encoding remain to be specified.
The public Function grammar, capture admissibility and overload selection when a
name has multiple definitions remain explicit follow-up questions. This does not
approve a new `OverloadedFunction` representation or choose a specificity policy.

For example, given `def square(n :: Int) n * n`, `f = square`, `apply(square, n)`
and returning `square` are function-value uses. Given the Rectangle/isSquare
definitions in the original inbox example, both `.where (r -> isSquare(r))` and
`.where isSquare` accept a predicate; the latter no longer requires a wrapper.

Partial conversion on master:
[named-function-values.test](../../tests/specification/named-function-values.test)
captures callable uses, captured values and definitions, recursion, packs, default
laziness and structural identity as todos, with a supported lambda control.
The [test proposal](../inbox/named-function-value-tests.md) maps remaining
representation and selection obligations. These tests do not prove portable
closure representation. Keep
this record approved until actual tests also cover the complete implementation
with no free variables through an agreed observable boundary; do not invent an
inspection or serialization API merely to move the file.

Origin: `tests/inbox/2026-11-09-bug-bare-function-name-in-where-clause.test`.
The two restored draft examples both used a lambda. The author's clarification
now supplies the intended bare-name distinction; the draft is retired in favor
of the explicit cases above. The queue record and tests do not implement runtime
function-value support.
