# Executable language specification

The `.test` files in this directory define the language contracts, including
accepted behavior that remains todo. Implementation PRs should name the files
and cases they implement. Discuss new rules in the project chat, then record the
agreed change directly in [`specs/approved/`](../../specs/approved/) on master.
The queue and validated test-only updates stay on master; feature implementation
uses PRs. Write or revise missing tests before changing implementation. When those
tests exist, move the record to `specs/implemented/` on master and link the cases; todo
tests still describe unfinished runtime behavior. See [the spec lifecycle](../../specs/README.md).

Adjacent notes, such as [application-heads.md](application-heads.md), explain a
test's intent, phase boundary or unresolved question when the code alone is not
clear. Keep those notes and the tests in the same change. Roadmap, grammar and
decision documents link to these contracts and provide context; they must not
become independent specifications with conflicting rules.

Latest author decisions can correct a stale test. Update the executable contract
and its explanation first, record any genuinely missing decision, and only then
change implementation. A todo failing for an unrelated setup/parser error is not
evidence of the intended rule, and a passing placeholder is not coverage.
