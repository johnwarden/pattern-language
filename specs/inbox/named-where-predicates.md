# Named functions as where predicates

Pending clarification in the project chat.

Source: [Bare function name in where clause](../../tests/inbox/2026-11-09-bug-bare-function-name-in-where-clause.test).
Both authored examples have been uncommented, and the placeholder passing
assertion removed. Their current bodies both use `r -> isSquare(r)`; the code
does not yet show the bare-name form described by the title.

The candidate distinction is `.where (r -> isSquare(r))` versus `.where isSquare`.
The intended second form needs confirmation before writing its contract. If a
named function is accepted in this position, the spec must say whether `.where`
resolves that predicate specially or ordinary named functions become first-class
values more generally. General first-class overload sets are not an existing
decision and must not be enabled as an incidental bugfix.

Keep the original draft outside the default suite while this is decided. Then
capture the agreed rule and meaningful examples in `../approved/`; do not rewrite
the duplicate lambda to a guessed bare name or invent overload-selection policy.
