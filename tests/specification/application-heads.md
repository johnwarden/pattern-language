# Application heads: parsing and evaluation

[application-heads.test](application-heads.test) is the executable contract. This
note explains the phase distinction; it does not specify a separate grammar.

Code can represent `True(1)`, `1(1)` and nested applications without executing
them. Parsing, typed quotation, Code construction and Code membership must agree
on accepting these trees. No special constant-call rejection or new public tree
variant is needed in the grammar.

When evaluating an application, the head must be a Symbol constructor head or
evaluate to a function under the existing callable/dispatch rules. Numeric,
String, Bool and constructed data values do not become functions merely because
they occur before an argument pack. Literal/computed Booleans are Bool values;
their internal symbol-shaped payload must not make them Symbol constructor heads.
An expression returning a closure can be called, so `make()(7)` remains valid.
Successive argument packs stay separate; this does not flatten `f(a)(b)` to f(a,b).

Current numeric/String-head evaluation already reports `E_NOT_CALLABLE`. Boolean
and constructed-data heads still use a permissive constructor path, so their
negative contracts are todo. Remove those markers only when evaluating the head
produces the intended error; rejecting Code during parsing is not a valid fix.

The source test runner evaluates assertion subjects as parsed Code. A focused host
test additionally parses a stored Code value and evaluates that same value to
check the diagnostic phase. There is no new source-language code.evaluate escape.

This contract does not choose the order of an invalid-head error versus errors
in its arguments, introduce first-class overload sets, or change the separate
quoted-primitive policy. Unresolved public callable/descriptor interfaces remain
unresolved. The grammar-rejection approach in #49 is superseded by the author's
evaluation-time clarification.
