# Specification-first development and inbox triage

The executable language specification drives implementation. Existing accepted
todo contracts under `tests/specification/` take priority over unrelated roadmap
foundations. The roadmap records what remains to make those contracts pass; it
must include their actual surface syntax, not describe only internal machinery.

## From a specification to implementation

1. Establish the intended behavior from the current specification and Jonathan's
   decisions. Distinguish accepted behavior, unsupported implementation and open
   design questions. Reconcile a stale case with a later settled decision first.
2. Add or update focused `.test` contracts **before implementation**. Start with
   the existing specification cases; add missing coverage rather than copying a
   large scenario into several files. Give each assertion one clear obligation
   and keep its definitions close to their use. Include relevant positive,
   negative and cross-context cases.
3. For an accepted unimplemented feature, use todo and record the missing feature
   and owning workstream. Execute the case and inspect its actual failure. A
   parser/setup/expected-type failure can hide the behavioral rule being tested;
   an expected todo failure is not proof that the right rejection occurred.
4. Claim an implementation PR with the target test cases, session, branch and
   shared methods. Implement the smallest coherent change that satisfies them.
   A design/scope-only PR is a handoff, not permission to implement unspecified
   behavior. Do not choose a public API or branch policy to make a test pass.
5. Run the targeted cases without their todo modifiers on the implementation
   branch. Remove fulfilled todos, retire paired legacy checks deliberately,
   and keep still-missing obligations explicit. Do not replace intended values
   with current outputs, weaken assertions or count placeholder checks as coverage.
6. Run related regression checks and `just check` on the final PR head. Report
   what was observed, what remains unverified and which cases became ordinary
   passing contracts. Update roadmap/decision status and the PR description to
   match the delivered behavior, then mark ready for review. Merge still requires
   Jonathan's explicit authorization for that PR.

Portable language behavior belongs in `.test` files. Keep TypeScript checks for
host APIs, precise diagnostic metadata, counters, transport/process boundaries
and other observations the language suite cannot express. Expected results are
inert authored data, not expressions evaluated to manufacture the answer.

The concrete/abstract declaration and type-value cases C05/C06/C13/C15/C16 are
current targets; C05/C12/C18 also specify parameterized forms. Refinement evidence,
public inspection/decoding and other genuinely unresolved boundaries do not get
invented implementations simply because a larger todo scenario mentions them.

## Inbox intake and triage

`tests/inbox/` is a staging area for authored examples, questions and bug reports.
Default suites and pre-push exclude it; an explicit file/directory path runs it.
Read the submitted source and comments before classifying it. Preserve its intent;
an obsolete assertion delimiter or placeholder `assert 1 == 1` is not evidence
that the underlying proposal is implemented or covered.

Split a submission when it contains both settled behavior and open questions.
Each settled portion should take one of these routes:

| Route                                     | Destination and action                                                                                                                              | Completion evidence                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed bug in specified behavior       | Extract a minimal ordinary regression in the relevant default-suite topic and fix it on a bugfix PR. Keep the PR draft while the regression is red. | The regression fails for the intended reason before the fix and passes after it; related behavior remains valid.                                                       |
| Accepted specification addition or change | Update the specification and add focused todo cases under `tests/specification/` before implementation.                                             | The contract is executable, its current failure is understood, and its owning implementation PR names it. Remove todo when the intended behavior passes.               |
| Example of supported behavior             | Add a runnable case under `tests/examples/` using current supported syntax and meaningful assertions.                                               | The example executes and checks its stated behavior through the shared corpus. A future feature belongs in a specification todo rather than a passing-looking example. |

If behavior is not yet decided, keep that portion explicitly **pending decision**
in the inbox register. Record the smallest question and any supported control;
do not label it a confirmed bug, silently alter the semantics or invent a golden
serialization string. The public inspection/decoding boundary, bare named
function values and deferred collision policy remain governed by their existing
decisions. A filename containing `bug` is not itself a language decision.

Record the original file, disposition, destination case(s), PR and remaining
questions in [the inbox register](../tests/inbox/README.md). Once an item is fully
covered, move/remove the draft or retain only a short pointer with its resolution;
do not leave competing active copies of the same specification. A split item's
unresolved portion may remain, clearly marked. No item is resolved by comments,
no-op checks or an expected failure caused only by a different unsupported syntax.

## Current order

Finish the existing value/declaration/boundary work in #31, #32 and #39 with their
specified regressions. Make the concrete/abstract declaration surface work against
the existing named cases, then work through their generic, projection, evidence
and interoperability obligations in explicit slices. Keep the later internal
foundation handoffs #43-#45 parked until these priorities are addressed and those
handoffs have executable acceptance contracts. Review current decisions before
resuming; their scope documents do not settle new public syntax.
