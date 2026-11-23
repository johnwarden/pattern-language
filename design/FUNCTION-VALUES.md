# Closed definitions as function values

The [function value spec](../specs/named-function-values.md) defines closed
`FunctionValue` data, static `PolymorphicValue` groups and the proposed `T => U`
abstract function type. The [printing spec](../specs/library-closure-and-local-printing.md)
describes exact local aliases and portable text.

Specialization is a compiler optimization that preserves the visible overload
group and its dispatch behavior.

## Closing a definition

- Identify free references using the shared pattern binder rules. Parameter names,
  local bindings, local declarations and literal quoted symbols are not free uses.
- Substitute captured values while preserving their concrete interpretations and
  abstract-position annotations. Do not stringify and reparse them as code.
- Include transitive referenced definitions and relevant accessors/type
  dependencies. Repeated definitions can be shared in local defs/lets.
- Preserve recursive/mutually recursive definitions as a finite declaration group.
  Recursion must never require infinite inlining.
- Include the reachable overload group required by a call so transport
  preserves selection and errors.
- Retain default expressions and their closed dependencies. Closing a function
  must not evaluate a default early or change when it is selected.

Function values are inert data. A closed value carries its code and dependencies
and can be reconstructed using the fixed primitives. Ordinary prelude and
standard-library definitions are captured like other dependencies.

Code is different: it is interpreted syntax, and may contain free references.
Evaluating Code requires a defined environment policy. A quoted name inside raw
expression data is not a lexical capture of that name.

## Printing and identity

A function's structural representation includes its binding patterns, closed
body and chosen entry point. Equality compares that structure after normalizing
capture binders only (alpha-equivalence). Call-visible labels and accessor names
stay verbatim; rest capture names are capture binders and normalize to `argN`.
Default-capture sugar prints as `label: argN :: Type`. Expanded printing uses
the same normalized `argN` capture binders (outer to inner by binder position),
skipping any `argN` already used as an exact-alias name in that text, so
alpha-equivalent values print identically; local abbreviation still requires an
exact alias. Inspectable parameter patterns and Body Code expose this same
normalized form, so source capture-binder spelling is not observable through
equality, printing or typed-code inspection. The typed constructor reader uses
the declared types of the parameter packs and body. See the equality, content-key
and printing rules in the
[function value spec](../specs/named-function-values.md).

## Roadmap connection

Milestone 4 provides recursive groups, typed-code inspection and compact type
inspection. Milestone 5 introduces a source-language evaluator and a stated
closed-callable subset, before the static checker. Milestone 10 completes portable
predicates/general functions and their public descriptions. The compiler and full
self-hosting remain later targets; none justifies a native evaluator escape.
