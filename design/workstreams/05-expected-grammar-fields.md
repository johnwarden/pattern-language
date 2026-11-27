# Workstream 5: expected-grammar fields beyond String

Status: draft implementation handoff. This PR initially adds this contract only;
it does not extend runtime behavior. This is a bounded next slice of roadmap 5b
and the accepted unquoted-DSL contract in
[SURFACE-EXTENSIONS.md](../SURFACE-EXTENSIONS.md).

## Current boundary and first deliverable

`src/expected-grammar.ts` currently recognizes only single-line sidefix sequences
whose variable fields are concrete String. Annotated bindings and a uniquely
known callable's current pack already share that mechanism. Keep those routes
shared while adding the existing Rational and Int field domains, including a
sequence mixing those domains with String. This adds no numeric widths or aliases.

This target uses existing bootstrap declaration and pack syntax:

```text
def Message type :say String :times Rational
name = "hello"
def amount() 1 + 2
(value :: Message) = say name times amount()
assert value == Message` say "hello" times 3
```

The quoted control already reads on master. The unquoted binding with a literal,
variable or `amount()` currently fails as an incomplete form. This is a supported
field-domain restriction to remove, not evidence for new return/layout syntax.

Fields evaluate as normal expressions in the caller's scope, once each; fixed
keywords remain grammar data. Their values must then satisfy the expected field
domain. Use the shared elaborator, not a special parser rule for each primitive
or a second path for annotated bindings. Preserve source locations on failures.

## Acceptance cases

Cover the same Message grammar through an annotated binding, a positional and
labeled parameter, a later curried pack, and a closure-valued variable. Each must
agree with the typed-quote control for literal, bound-variable and ordinary-call
fields. Include mixed String/Rational/Int fields and wrong-domain negatives.

Retain complete-pack arity/label checks, caller shadowing, and the existing
all-String cases. Use a host observation where needed to prove that fields are
not evaluated twice. Add a no-expected-grammar case and an ambiguous-callable
case: neither may pick a DSL or overload by guessing or trying predicates.
Dollar holes retain quotation semantics; ordinary variables need no hole.

Keep expected test results inert. Prefer `.test` cases for portable behavior;
retain targeted host tests for evaluation counts and precise diagnostics.
Re-run `tests/specification/expected-grammar.test`, affected field/call/quotation
checks, and `just check` before marking the implementation ready.

## Scope and ownership

Own `src/expected-grammar.ts` and its tests. If necessary, edit only the existing
expected-grammar integration methods in `src/runtime.ts`:
`expectedFieldsFromPattern`, `expectedTypeForArgument`,
`completeExpectedGrammarLine`, `evaluateExpectedGrammar` and `evaluateFields`.
Announce the specific methods in a claim before editing. Preserve a single
elaboration rule across all current entry points.

Start independently from master; do not copy another workstream's implementation.
#31 owns intrinsic String identity, reserved symbols and value-text reading;
#32 owns type construction/declaration/accessor products; #39 owns concrete
binding/dispatch projection roles. Coordinate shared runtime methods and rebase
after their authorized integration. No other owner's branch is modified here.

## Explicit limits

Return-position grammar propagation and indented expected-DSL layout remain later
5b slices. So do broad Code categories and the Syntax-to-Expression migration.
This PR adds no static checker, full preparation API, public tree/descriptor
mapping, new numeric family, implicit rounding or overload priority. If a field
would require executing an unsupported reader or inventing a grammar boundary,
leave it unsupported and report the smallest example.

Equivalent declarations and accessor collisions remain errors; public
inspection/decoding awaits Jonathan's examples. Keep inbox optional by default.
The coordinator seeds this handoff; implementation ownership is unclaimed until
an agent posts its session, branch and method list. Mark ready only with passing
implementation checks. Each merge needs Jonathan's authorization for this PR.
