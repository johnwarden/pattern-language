# Executable language specification

The `.test` files in this directory define the language contracts, including
accepted behavior that remains todo. Implementation PRs should name the files
and cases they implement. Write and commit missing todo tests before opening an
implementation PR, using the active specification-queue PR for new contracts.

Adjacent notes, such as [application-heads.md](application-heads.md), explain a
test's intent, phase boundary or unresolved question when the code alone is not
clear. Keep those notes and the tests in the same change. Roadmap, grammar and
decision documents link to these contracts and provide context; they must not
become independent specifications with conflicting rules.

Latest author decisions can correct a stale test. Update the executable contract
and its explanation first, record any genuinely missing decision, and only then
change implementation. A todo failing for an unrelated setup/parser error is not
evidence of the intended rule, and a passing placeholder is not coverage.
