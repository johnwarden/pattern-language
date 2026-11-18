# Constructor expressions require a concrete destination

The [refined type model](refined-type-model.md) supersedes the 9 November 2026
decision permitting bare runtime Expression values. A constructor expression
such as `Rect(2, 3)`, or a symbol designator such as `:None`, needs an
unambiguous concrete type to designate a value.

Given a Rectangle with Int fields, `(r :: Rectangle) = Rect(2, 3)`
constructs the value. Both `Rect(w, h) = r` and an explicit constructor match
can read its Int fields. A quote such as
``Code` Rect(2, 3)`` preserves the expression as syntax for the applicable grammar.

[C04](../../tests/specification/type-values.test) and the
[construction and quotation tests](../../tests/specification/raw-expressions.test)
cover these cases. Rejection of bare constructors and symbol designators is
todo. Selected legacy checks document what the bootstrap still admits.
