# Named functions evaluate to closed function values

Approved in the project chat on 9 November 2026. Supersedes the earlier restriction
that a defined function name can only appear in call position.

A named function resolves to a function value. The value can be stored, passed,
returned and used as a `where` predicate. `.where isSquare` uses ordinary function
value resolution; it is not a special adapter limited to the `where` operator.

The value contains the full implementation and has no free user variables or
hidden lexical environment. Parameter and local binders are bound variables, not
free references. Captured values and transitive user-defined helper/type/accessor
dependencies must be included or closed over as value/definition data. A symbolic
reference to an arbitrary ambient user function is not the complete implementation.
The existing [closed-definition design](../../design/FUNCTION-VALUES.md) explains
this direction and finite recursive dependency groups.

Primitive callable names are the baseline external vocabulary. Prelude or
standard-library function names may be candidates for that vocabulary; the exact
allowed names, versions and portable encoding are not specified by this decision.
The public Function grammar, capture admissibility and overload selection when a
name has multiple definitions remain explicit follow-up questions. This does not
approve a new `OverloadedFunction` representation or choose a specificity policy.

For example, given `def square(n :: Int) n * n`, `f = square`, `apply(square, n)`
and returning `square` are function-value uses. Given the Rectangle/isSquare
definitions in the original inbox example, both `.where (r -> isSquare(r))` and
`.where isSquare` accept a predicate; the latter no longer requires a wrapper.

Conversion in [PR #52](https://github.com/johnwarden/pattern-language/pull/52):
[named-function-values.test](../../tests/specification/named-function-values.test)
captures binding, argument, result and predicate uses as todos, with a supported
lambda control. Those tests do not prove portable closure representation. Keep
this record approved until actual tests also cover the complete implementation
with no free variables through an agreed observable boundary; do not invent an
inspection or serialization API merely to move the file.

Origin: `tests/inbox/2026-11-09-bug-bare-function-name-in-where-clause.test`.
The two restored draft examples both used a lambda. The author's clarification
now supplies the intended bare-name distinction; the draft is retired in favor
of the explicit cases above. No runtime implementation is included in this PR.
