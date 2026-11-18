# Executable language specification

The `.test` files in this directory define executable language contracts,
including behavior that remains todo. Settle spec changes on a topic branch
first, then update the active tests. Implementation PRs should name the cases
they make pass and remove fulfilled todos. Follow the
[spec lifecycle](../../specs/README.md) and
[development workflow](../../design/TESTING-WORKFLOW.md).

Adjacent notes, such as [application-heads.md](application-heads.md), explain a
test's intent, phase boundary or unresolved question when the code alone is not
clear. Keep those notes and the tests in the same change. Roadmap, grammar and
decision documents link to these contracts and provide context; they must not
become independent specifications with conflicting rules.

Latest author decisions can correct a stale test. Update the executable contract
and its explanation first, record any genuinely missing decision, and only then
change implementation. A todo failing for an unrelated setup/parser error is not
evidence of the intended rule, and a passing placeholder is not coverage.
