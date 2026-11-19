# Portable refinement predicates

Draft for milestone 10. Extend the initial [predicate enum contract](refinement-predicates.md)
to user-defined predicates after the language has a portable
[closed function representation](../design/FUNCTION-VALUES.md).
Existing enum predicates retain their bare spelling after `.where` and
their enum identity.

## Closed predicate values

A predicate may eventually be a named user function or a lambda,
including one that captures values or calls other definitions.
Its portable representation must include the dependencies needed
to reconstruct the callable in a fresh environment. Reuse the
closed function representation, including its handling of finite
recursive groups. A predicate does not require a first-class
overload group.

A user-defined predicate's identity comes from its closed
representation. Equality does not compare which inputs two
predicates accept. The enclosing refined descriptor compares its
base pattern and predicate through their ordinary structural rules.

For example, a program can refine a rectangle with a local function
that checks whether its width and height match. To reconstruct the
refined type, global text must carry the closed predicate and any
definitions it depends on. The local name is usable in local text
only when it resolves to the same closed value. Global text for an
enum predicate still prints its bare case name after `.where`.

## Decisions and contract coverage

- Choose the public closed callable expression and its placement in
  canonical type text. A parenthesized lambda is a candidate for a
  noncapturing predicate once it has a portable identity.
- Specify how to resolve a portable predicate name that also names an
  enum case. Preserve round trips for the existing bare enum spelling.
- Specify admissible captures and dependency identity, including
  recursive helpers and predicate references to type values.
- Round-trip a predicate with a captured value in a fresh scope.
  Cover local shadowing, recursive dependencies and a refined member
  nested in another type. Check that predicates with different
  captures produce different descriptors even when names agree.
- Generalizing predicate representation leaves the
  [evidence rules](https://github.com/johnwarden/pattern-language/blob/spec/refinement-evidence/specs/refinement-evidence.md)
  in place. Dispatch uses established evidence, and explicit checks
  supply evidence for the exact predicate that was checked.
