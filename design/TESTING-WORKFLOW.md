# Specification-first development and inbox triage

The executable language specification drives implementation. Existing accepted
todo contracts under `tests/specification/` take priority over unrelated roadmap
foundations. The roadmap records what remains to make those contracts pass; it
must include their actual surface syntax, not describe only internal machinery.
The `.test` files are the language specification. Prose explains and indexes the
cases; it must not define a competing contract that can drift independently.

## Decisions, specification queue and PR boundaries

Discuss and clarify new rules with Jonathan in the project chat. After agreement,
create a record in `specs/approved/` containing the settled decision, motivating
examples, scope and source inbox paths. Remove the corresponding inbox file when
the approved record preserves all its intent; split out unsettled portions first.
New intake belongs in `specs/inbox/`. Existing optional `tests/inbox/` drafts remain
explicitly runnable while triaged. See [the lifecycle](../specs/README.md).

Open a PR for one or more approved specs. Keep one active specification-queue PR
for records and test-only batches; a feature PR can also write the actual tests
for its approved specs before changing implementation. Land test-only batches
ahead of dependent implementation where practical. Record unmerged dependencies
explicitly rather than copying or silently altering another branch's contract.

When actual tests capture an approved decision, move the record to
`specs/implemented/` in that PR, adding links to the files/cases and PR. This means
implemented **as tests**, not completed runtime behavior: the tests may remain
todo. Do not move a partially captured record as if complete; split it or keep it
approved. Once captured, the tests carry the executable contract and the moved
record preserves the decision and links. Return new design questions to chat.

A specification change may update existing tests, make mass edits, or illustrate
a new syntax/rule without adding a new case. There is no required one-to-one
mapping between a spec example, a test case and an implementation PR. Each
implementation chooses how to apply and validate the relevant contract, and names
the affected `.test` files or specification commits.

When possible, every implementation PR names the `.test` file and case titles it
implements. An existing case on master is already an executable specification;
do not add a duplicate just to create a new todo. For missing behavior, write the
todo contract first, then make it an ordinary check when implemented. Tooling,
host/protocol or build work should state why a meaningful language test cannot
express its observation and use the appropriate host check.

Put additional explanations beside the relevant `.test` file when needed, such as
[application-heads.md](../tests/specification/application-heads.md). Keep notes and
contracts in the same change. Roadmap, grammar and decision documents link to
those cases, summarize status and preserve rationale; avoid separate copies of
the normative examples. A new author ruling may correct a stale test, but the
contract and its explanation must be updated before implementation proceeds.

## From a specification to implementation

1. Establish the intended behavior from existing tests and approved decisions.
   Discuss unsettled questions in the project chat, then record agreed changes
   in `specs/approved/`. Distinguish approved behavior, missing implementation and
   open questions. Reconcile stale cases with later decisions first.
2. Add or update focused `.test` contracts **before implementation**. Start with
   the existing specification cases; add missing coverage rather than copying a
   large scenario into several files. Give each assertion one clear obligation
   and keep its definitions close to their use. Include relevant positive,
   negative and cross-context cases.
3. For an accepted unimplemented feature, use todo and record the missing feature
   and owning workstream. Execute the case and inspect its actual failure. A
   parser/setup/expected-type failure can hide the behavioral rule being tested;
   an expected todo failure is not proof that the right rejection occurred.
4. Claim the PR with its approved specs, target test cases, session, branch and
   shared methods. Move fully captured specs to `specs/implemented/` with test
   links. Implement the smallest coherent change that satisfies those contracts.
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

`specs/inbox/` holds new proposals, questions and motivating examples. Existing
`tests/inbox/` drafts remain an intake source during triage; default suites and
pre-push exclude them, and an explicit file/directory path runs them.
Read the submitted source and comments before classifying it. Preserve its intent;
an obsolete assertion delimiter or placeholder `assert 1 == 1` is not evidence
that the underlying proposal is implemented or covered.

Keep authored draft examples visible. Do not comment them out or substitute
passing no-op assertions to satisfy CI; optional inbox discovery already keeps
unapproved drafts out of default runs. Restore temporarily commented examples
before triage, preserving their intended expectations and open questions.

Split a submission when it contains both settled behavior and open questions.
Each settled portion should take one of these routes:

| Route                                     | Destination and action                                                                                                                              | Completion evidence                                                                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed bug in specified behavior       | Extract a minimal ordinary regression in the relevant default-suite topic and fix it on a bugfix PR. Keep the PR draft while the regression is red. | The regression fails for the intended reason before the fix and passes after it; related behavior remains valid.                                                       |
| Accepted specification addition or change | Record the chat decision in `specs/approved/`; a PR writes or revises actual tests before implementation. | Move the record to `specs/implemented/` with test links; todo remains until the intended behavior passes. |
| Example of supported behavior             | Add a runnable case under `tests/examples/` using current supported syntax and meaningful assertions.                                               | The example executes and checks its stated behavior through the shared corpus. A future feature belongs in a specification todo rather than a passing-looking example. |

If behavior is not yet decided, keep that portion explicitly **pending decision**
in the inbox register. Record the smallest question and any supported control;
do not label it a confirmed bug, silently alter the semantics or invent a golden
serialization string. The public inspection/decoding boundary, bare named
function values and deferred collision policy remain governed by their existing
decisions. A filename containing `bug` is not itself a language decision.

Record the original file, disposition, destination case(s), PR and remaining
questions in [the inbox register](../tests/inbox/README.md) or the proposal's spec
record. Once approved content fully captures an inbox item, remove that draft;
do not leave competing active copies of the same specification. A split item's
unresolved portion may remain, clearly marked. No item is resolved by comments,
no-op checks or an expected failure caused only by a different unsupported syntax.

## Current order

#31 and #32 are integrated. #39's inbox handoff is closed while its needed
decisions are clarified in the project chat and captured as approved specs.
Make the concrete/abstract declaration surface in #48 work against
the existing named cases, then work through their generic, projection, evidence
and interoperability obligations in explicit slices. Keep the later internal
foundation handoffs #43-#45 parked until these priorities are addressed and those
handoffs have executable acceptance contracts. Review current decisions before
resuming; their scope documents do not settle new public syntax.
