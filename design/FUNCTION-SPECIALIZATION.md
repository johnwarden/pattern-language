# Function specialization as polymorphic narrowing

**Status:** decisions recorded (Jonathan, 2026-11-23, revised same day;
OMP review 2026-11-24 addressed); runtime and checker unimplemented.
**Related:** [D13 in LANGUAGE-DECISIONS](LANGUAGE-DECISIONS.md#d13-specialization-is-polymorphic-narrowing--confirmed-direction),
[named function values](../specs/named-function-values.md) (merged #84),
[ambiguous values](../specs/ambiguous-values.md),
[type-values designation](../specs/type-values.md#designation-and-matching),
[fixed-precision numbers](../specs/fixed-precision-numbers.md) (`Int` is a plain alias of `Int64`),
[MATCH-DISJOINTNESS](MATCH-DISJOINTNESS.md),
[FUNCTION-VALUES](FUNCTION-VALUES.md),
[#109 exact match arms](https://github.com/johnwarden/pattern-language/pull/109),
[#110 constructor heads](https://github.com/johnwarden/pattern-language/pull/110),
[#112 D21 collision / accessor+def overload groups](https://github.com/johnwarden/pattern-language/pull/112).

This note records the intended language model. It supersedes the older reading
of D13 as “compiler optimization only,” and drops an earlier draft’s
one-signature / one-`match`-body normalization. Executable sketches live in
[specs/function-specialization.md](../specs/function-specialization.md); they
are illustrative `todo` contracts, not a full test suite.

## Decided

1. **A function whose domain is abstract is a `PolymorphicValue`**, even when
   it has a single definition. A function whose domain is entirely concrete is
   an ordinary closed function value, not a polymorphic value.

   **What “abstract domain” means.** Look at the function’s complete
   argument-pack sequence (each pack’s required positional and labeled
   patterns, including rests and open residuals, after defaults are accounted
   for as optional). The domain is **abstract** when **any** of those
   patterns is an abstract type under ordinary designation: a union (including
   a written single-member abstract union), a `pattern` / facet (including
   open facets), `Any`, or an abstract refinement (`T .where p` under
   `pattern`). The domain is **concrete** only when every such pattern is a
   concrete type (a `struct` space, concrete carveout, or plain alias of
   one). A function with **no parameters** (only an empty pack) has a
   concrete domain: there are no patterns that could be abstract. Untyped
   parameters are treated as abstract (`Any`). Defaults do not by themselves
   make a domain abstract; the type of the defaulted parameter does.

   **`Int` / `Float` are concrete.** `Int` is a plain alias of `Int64`, and
   `Float` of `Float64` (Jonathan, 2026-11-27; fixed-precision docs updated
   separately). A function written with `Int` or `Int64` is an ordinary
   concrete function value, not a `PolymorphicValue`. Single-member abstract
   unions remain allowed; they are a different construct from these plain
   aliases.

2. **Overloaded functions (several definitions) and single abstract-domain
   definitions are both polymorphic values.** The same rules decide which
   types such a value can represent and how it narrows when used at a
   specific type. Those rules are the existing polymorphic / ambiguous-value
   designation rules (see [ambiguous-values](../specs/ambiguous-values.md),
   [type-values designation](../specs/type-values.md#designation-and-matching),
   and [named-function-values](../specs/named-function-values.md) for group
   capture and arrow selection). They apply unchanged; this note does not
   invent a second narrowing system.

3. **Do not normalize distinct spellings into one definition for equality.**
   Two ways of defining the same effective function — for example several
   `def describe` overloads versus one `def describe(x :: (Int | String))`
   with a `match` body — keep their own closed representations. This note
   does **not** require them to compare equal or unequal; do not pin either
   outcome in contracts. There is no canonical rewrite that turns an overload
   set into a single match body (or the reverse).

4. **Specialization means applying those polymorphic-value rules.** When a
   polymorphic function is requested at a narrower arrow type — for example
   assigning `f` to a variable typed `(Int => Int)` or `(Float64 => Float64)` —
   the language interprets the polymorphic value at that arrow: it checks that
   the Int-narrowed (or Float64-narrowed) function’s result fits the requested
   output, and yields that interpretation. The same check covers specializing
   an `area` over an abstract / open rectangle domain to a concrete rectangle
   type. Requesting a **wider** domain than the value admits fails the same
   way. If the value cannot be shown to fit the requested type, that is an
   ordinary type mismatch: `E_PATTERN_MISMATCH`, the same code used when
   designation or typed binding fails elsewhere (emitted from pattern matching
   in [`src/pattern.ts`](../src/pattern.ts); used throughout designation
   contracts such as
   [nested-option designation](../tests/bindings/nested-option-designation.test)
   and [type-values-rationale](../specs/type-values-rationale.md)). There is no
   silent runtime fallback and no specialization-specific error code.

   A **concrete** (non-polymorphic) function requested at an arrow is checked
   by ordinary arrow compatibility from
   [named-function-values](../specs/named-function-values.md): its declared
   input and result must fit the requested `T => U` under designation. That is
   not polymorphic narrowing; failure is still `E_PATTERN_MISMATCH`. Because
   `Int` is a plain alias of `Int64`, `incr` over `Int` fits `(Int => Int)`
   and `(Int64 => Int64)` the same way.

   Calling a specialized (or original) function **outside** its domain is a
   different failure: `E_NO_METHOD` (no applicable callable), as in
   [named-function-values](../specs/named-function-values.md). Ascription /
   designation mismatch is `E_PATTERN_MISMATCH`; a call that simply has no
   matching clause is `E_NO_METHOD`.

5. **Validity is checked over the full declared domain; narrowing never
   rescues an invalid definition.** A definition is checked when defined,
   against every arm / clause of its declared domain. Specialization and
   arrow ascription must not make an otherwise invalid definition succeed by
   restricting attention to a reachable subset of that domain. Private
   compiler memoization of narrowed forms (milestone 11) remains a later
   optimization of already-defined behavior; it must not invent
   source-visible specialization lists or change validity.

## Relation to earlier D13 and #84

Earlier prose treated specialization as a deferred private compiler
optimization that must preserve visible overloads. That optimization story
can remain. It is no longer the definition of specialization in the language
model. The full-domain validity rule above restores, at the language level,
the old D13 prohibition on specialization making invalid definitions valid
only at known call sites.

[#84](https://github.com/johnwarden/pattern-language/pull/84) (merged) defines
closed `FunctionValue` data, bare capture of a static overload group as
`PolymorphicValue`, and ordinary equality for those forms. This note extends
the polymorphic-value reading to a **single** definition whose domain is
already abstract. Ordinary value rules apply; there are no special printing
rules for abstract-domain functions.

## Illustrative shape (display)

    type OpenRect pattern Rect(w :: Int, h :: Int, ...)

    # Single definition, abstract / open domain → PolymorphicValue
    def area(r :: OpenRect)
      match r
        Rect(w, h, ...) -> w * h
      end
    end

    # Several definitions → also PolymorphicValue; equality to a
    # single-definition spelling is not pinned by this note.
    def describe(x :: Int) "int"
    def describe(x :: String) "string"

    def describeMatch(x :: (Int | String))
      match x
        Int -> "int"
        String -> "string"
      end
    end

    (intDescribe :: (Int => String)) = describe

    # Concrete-only domain → ordinary FunctionValue, not PolymorphicValue.
    # Int is a plain alias of Int64 (concrete).
    def incr(n :: Int) n + (1 :: Int)
    (asInt :: (Int => Int)) = incr
