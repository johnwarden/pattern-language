# Independent review before the typed-code milestone

The reviewer received the current documentation and source files without the
conversation history, and made no edits. The reviewed baseline passed 627 tests.

## Confirmed findings and resolutions

1. Generated type-pattern classification ignored lexical provenance for aliases,
   private named types and parameterized references. The runtime pattern compiler
   now uses provenance-aware lookup consistently with ordinary expression lookup.
2. Macro hygiene renamed literal names inside raw parenthesized colon quotations,
   leaking private generated binder names. Raw data now preserves literal names;
   an explicit outer interpolation pass still visits only its structural holes.
3. Availability analysis treated named helper parameters as free references to an
   outer runtime binding. Declaration signatures now introduce their parameter
   scopes after checking annotations/defaults, using the common capture metadata.

Regression cases are in test/milestone-four.test.ts. The review also identified a
stale roadmap test count and an outdated diagnostic describing match arms as
anonymous functions. Both are corrected.

## Architecture boundary

The review correctly distinguished source-order execution from phase separation:
evaluateBlock executes accepted forms, and expandMacro evaluates expanded output.
Recursive declaration groups do not by themselves solve that boundary. The roadmap
now separates typed-code/groups, source-defined evaluation, prepared elaboration,
and static checking. Prepared execution must eventually demonstrate that repeated
execution does not repeat expansion and unused bodies receive availability checks.

The reviewer withdrew a suspected named-hole ordering issue after checking that
parser fields preserve source order. No fourth correctness bug was confirmed.

Validation after fixes: TypeScript checking and browser build pass; 639 tests and
83 shared language cases pass. The review was independent of the implementation
work that followed; regression tests establish the reported fixes.
