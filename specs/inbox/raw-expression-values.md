# Raw runtime expressions and concrete values

Pending clarification in the project chat. The inbox-processing PR #39 is closed;
its regression branch remains available for reference. This is not an approved
replacement for the authored proposal.

Source: [Raw expressions vs typed values](../../tests/inbox/2026-raw-and-typed-expressions.test).
Its code is restored without changing the original expectations. The draft uses
older Test DSL syntax and is outside default discovery.

The example starts with `e = Rect(2, 2)` and expects an `Expression` whose fields
are Rational values, then interprets that expression as a Rectangle with Int
fields. The missing decision is whether evaluating such an application may
produce an ordinary raw Expression value without a concrete expected type, and
whether that requires a distinct mode. Do not conflate a parsed Code tree with
the result of evaluating it or invent a mode/API to make this example pass.

Existing [nested-option contracts](../../tests/bindings/nested-option-designation.test)
already separate ordinary binding/dispatch from explicit one-boundary matching.
The proposal's constructor-pattern boundary must preserve that rule. The new
decision concerns raw runtime values and their interpretation, not reopening
implicit concrete projection or choosing the public inspection/decoding API.

After agreement, capture the settled rule in `../approved/`, preserving or
splitting the original inbox content before removing its file.
