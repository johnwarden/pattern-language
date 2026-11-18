# Closed definitions as function values

## Current decision boundary — 9 November 2026

A named function now resolves to a function value: it can be bound, passed,
returned or supplied to `where` without an anonymous wrapper. That value contains
the complete implementation with no free user variables. The
[approved record](../specs/named-function-values.md) links the current
callable-use todos and identifies the still-missing portable representation tests.
The [closed-value and local-printing decision](../specs/library-closure-and-local-printing.md)
also confirms immutable snapshots and exact-value abbreviation. Referenced
definitions are ordinary definitions; "helper" is not a language category.

Specialization is only a later compiler optimization. First-class OverloadedFunction
values remain an unaccepted separate proposal; generating private specializations
must not expose new overloads, alter dispatch or change validity. Declaration-only
accessors and duplicate import policy follow the integrated decision record. This
closed-callable direction remains future work, not an implemented serialization API.


Accepted direction. The TypeScript prototype still has private lexical closures;
the portable Function value grammar and closing algorithm remain future work.

A function value is represented by its self-contained definition, with no free
variables. Its equality is structural value equality, not behavioral/extensional
equality and not host closure identity. Types and callable values therefore share
the principle that their public representations stand on their own.

## Closing a definition

- Identify free references using the shared pattern binder rules. Parameter names,
  local bindings, local declarations and literal quoted symbols are not free uses.
- Substitute captured values while preserving their concrete interpretations and
  abstract-position annotations. Do not stringify and reparse them as code.
- Include transitive referenced definitions and relevant accessors/type
  dependencies. Repeated definitions can be shared in local defs/lets.
- Preserve recursive/mutually recursive definitions as a finite declaration group.
  Recursion must never require infinite inlining.
- Without static dispatch selection, include the reachable overload set required
  by a call, preserving its ambiguity/error behavior. Named functions are values;
  the representation/selection rule for an overloaded name remains unspecified.
- Retain default expressions and their closed dependencies. Closing a function
  must not evaluate a default early or change when it is selected.

Self-contained means no hidden lexical environment is needed to reconstruct the
callable. Only the fixed primitive vocabulary remains external initially;
ordinary prelude and standard-library definitions are included like other
referenced definitions. Later external references must identify exact definitions.
This does not mean the function is
pure. A portable primitive vocabulary,
capability values and unsupported captures need explicit policies; opaque host
handles cannot become public syntax merely by assigning them an ID.

Code is different: it is interpreted syntax, and may contain free references.
Evaluating Code requires a defined environment policy. A quoted name inside raw
expression data is not a lexical capture of that name.

## Printing and identity

Global text contains enough definition/value data to reconstruct the callable in
a fresh environment. Local printing can reuse an in-scope name only when its
actual definition is the dependency being displayed; matching spelling is not
sufficient. Shadowing must fall back to the closed definition. This parallels
local/global type printing and does not alter value identity.
Another exact visible alias may also be used; preferred naming among multiple
valid aliases remains unspecified. Abbreviation must preserve the entire value,
including any definition group, and cannot silently incorporate later additions.

The exact Function grammar, binder naming/canonicalization, dependency ordering,
recursive reference representation, primitive references, bounds on closing work,
and admissible captures remain to be specified. No alpha-equivalence, semantic
function equivalence or implicit optimizing normalization is assumed.

## Roadmap connection

Milestone 4 provides recursive groups, typed-code inspection and compact type
inspection. Milestone 5 introduces a source-language evaluator and a stated
closed-callable subset, before the static checker. Milestone 10 completes portable
predicates/general functions and their public descriptions. The compiler and full
self-hosting remain later targets; none justifies a native evaluator escape.

## Proposed function-type constraints

The proposed Function(T...)(U...) constructor constrains a callable's complete
parameter/result specifications. Function(Int)(Int) describes the simple one-input,
one-result case; it does not merge successive invocation packs or by itself imply
currying. Full Param/Result descriptors must retain labels, defaults, positional
rest and successive packs. Their grammar remains to be settled.

A callable can be destructured into its parameter patterns and Body. For
(x :: Int) -> x ^ 2, the stored pattern must retain the capture x as well as Int.
extractTypes(patterns) can return [Int], but replacing the pattern with Int alone
would lose the body's binder. Captures are not extra free variables in the closed
definition: the parameter pattern binds them.

The proposed constraint evaluatedTypes(body,bindings: extractBindings(patterns))
== U is a checking/proof obligation. It must not run the body speculatively or
assume inference exists. Until the checker supports it, require explicit evidence
or reject an unsupported obligation. A Body's structural category, such as
FunctionApplication, describes its code tree; its evaluated result type is a
separate fact. Do not conflate the callable's type value with its particular
parameter names or implementation body. Syntax fragments and parameter patterns
remain inspectable through the shared pattern/typed-code model.
