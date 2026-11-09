# Printing ambiguous concrete values

Pending clarification of exact value-text expectations in the project chat.

Source: [Printing values of ambiguous concrete types](../../tests/inbox/2026-09-11-printing-values-of-ambiguous-concrete-types.test).
Keep its authored expected strings unchanged while deciding the contract.

The value `z` is the inner absence of `String??`. Its first expected string ends
in `:: String` although the selected output grammar is `String??`. The second
uses `toString(Any)` and a type descriptor. The remaining decisions are whether
the first outer tag is intentional, whether printing under a known expected type
includes that outer type at all, and whether names such as `String?` are intended
as local aliases or part of globally decodable text. Do not choose new golden
strings from current output or assume the outer tag is merely a typo.

Inner versus outer absence and preserving enough member information for round
trips already have [concrete-union contracts](../../tests/specification/concrete-unions.test)
and [nested-option contracts](../../tests/bindings/nested-option-designation.test).
Those laws do not by themselves settle these new exact text expectations.

After the intended strings and context are agreed in the project chat, capture the decision in
`../approved/`, link the affected tests, and retire or split the corresponding
inbox source in the same change.
