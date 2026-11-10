# Application heads: parsing and evaluation

[application-heads.test](application-heads.test) is the executable contract. This
note explains the phase distinction; it does not specify a separate grammar.

Code can represent `True(1)`, `1(1)` and nested applications without executing
them. Parsing, typed quotation, Code construction and Code membership must agree
on accepting these trees. No special constant-call rejection or new public tree
variant is needed in the grammar.

An unquoted constructor form such as `Tag(1)` constructs data. An evaluated Symbol
value does not become callable: `:Tag(1)`, `(:Tag)(1)` and a bound `:Tag` all fail
on evaluation. Whole-expression quotation `:(Tag(1))` remains inert data.
Numeric, String, Bool, reserved primitive/type values and concrete constructed
data values do not become functions merely by preceding an argument pack.
Literal/computed Booleans retain their Bool identity despite their symbol-shaped
payload. A visible actual function still calls, including the existing `Type`
and `String` functions; an expression returning a closure can also be called.

An untyped raw Expression term may occupy a later head position: `Tag(1)(2)`
and a bound raw `Tag(1)` produce nested data, while a `Tagged` value cannot.
Successive packs remain separate; this does not flatten `f(a)(b)` to `f(a,b)`.
Code parsing accepts these shapes without executing them. The dot application
`1 .Plus 2` constructs `Plus(1)(2)` with the same complete-pack distinction.

The source test runner evaluates assertion subjects as parsed Code. A focused host
test additionally parses a stored Code value and evaluates that same value to
check the diagnostic phase. There is no new source-language code.evaluate escape.

This contract does not choose the order of an invalid-head error versus errors
in its arguments, introduce first-class overload sets, or change the separate
quoted-primitive policy. Unresolved public callable/descriptor interfaces remain
unresolved. The grammar-rejection approach in #49 is superseded by the author's
evaluation-time clarification.
