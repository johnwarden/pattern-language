# Raw expressions remain allowed at runtime

Approved in the project chat on 9 November 2026 and converted into executable
contracts committed directly to master in the initial specification-queue batch.
This is the rule for now; it supersedes the earlier blanket rejection of a
structured expression without a concrete expected type. No new static/untyped
mode flag is required or specified by this decision.

`e = Rect(2, 2)` is allowed as a raw runtime `Expression`. Destructuring that raw
expression obtains Rational fields. Given a Rectangle definition with Int fields,
`(r :: Rectangle) = e` interprets the raw expression as that concrete value.
Ordinary constructor binding must not implicitly unwrap the resulting Rectangle;
an explicit match crosses one concrete boundary and yields the Int fields.

Contracts:

- [C04 in type-values.test](../../tests/specification/type-values.test): ordinary
  raw construction and Rational captures; the separate new declaration syntax
  remains todo.
- [raw-expressions.test](../../tests/specification/raw-expressions.test): concrete
  interpretation, constructor-binding rejection (todo), and explicit matching.
- [defaults.test](../../tests/bindings/defaults.test) and
  [expressions.test](../../tests/examples/expressions.test): raw Symbol-headed
  construction is supported behavior rather than a legacy/rejection pair.

Raw expression values, parsed Code and values obtained by evaluating Code remain
distinct roles. This ruling does not make a descriptor equal its described value,
choose automatic descriptor decoding, or settle the public inspection API.

Origin: `tests/inbox/2026-raw-and-typed-expressions.test`, whose creation,
destructuring, designation and explicit-boundary examples are captured above.
The original nested/obsolete Test DSL draft is retired. Implemented here means
captured as tests; the constructor-binding todo is still runtime work.
