# Proposed named-function and library-value test set

Discuss the remaining decisions in the project chat. The agreed callable,
closure and identity behavior is already captured in
[named-function-values.test](../../tests/specification/named-function-values.test).
The [closed-value/printing decision](../approved/library-closure-and-local-printing.md)
is approved, but its complete representation-level test conversion is pending.

## Existing executable todos

The source suite checks:

1. Bind, pass, return and directly supply a named predicate to `where`.
2. Capture a value despite a caller parameter with the same name.
3. Retain two levels of referenced definitions despite caller-local replacements.
4. Call a mutually recursive group through a stored function value.
5. Preserve complete successive argument packs, labeled parameter binders, rest
   capture binders and ordinary partial application.
6. Avoid evaluating an unused failing default when closing the function, while
   retaining captured values used by a selected default.
7. Return a named function that captures a departed scope's parameter, or uses
   that scope's local type and accessor definitions.
8. Preserve identity through aliases, while keeping structurally different
   implementations unequal even when their behavior agrees.

These currently exercise named-value rejection first. Inspect each obligation
again as implementation progresses; a fulfilled binding case does not complete
the closed representation. Old private lexical closures could satisfy several
behavioral cases without making the public value portable.

## Approved obligations awaiting a concrete representation

The following are test proposals, not current runnable coverage. `Function` and
its typed-text support follow the spelling in the author's draft; their exact
public schema remains to be agreed.

| Proposed case | Required observation |
| --- | --- |
| Stored value is a snapshot | Store `old = f`; subsequently extend/rebind the visible group. The old value and its global text remain unchanged. The test must use the eventual approved group-extension syntax. |
| Whole-group local abbreviation | If visible `f` denotes a different group, local text for `old` must not use `f`, even if one clause is shared. It may use another exact alias or expand the value. |
| Shadowed local name | Put a different function value in a parameter named `f`; locally print the old `f` value. Parsing that text in the same scope must recover the old value. |
| Named local printing | With one valid visible name, local text can abbreviate the corresponding complete value with that name. Do not assert a preferred name when multiple aliases are valid. |
| Local and global function round trips | `parseLocal(Function)(toStringLocal(Function)(f)) == f`; separately, global text reconstructs the same value without lexical aliases. |
| Captures survive fresh-context reconstruction | Encode a function with a captured scalar and transitive definitions, then decode in an independent interpreter lacking those bindings. Calls and structural identity agree. |
| Recursive reconstruction is finite | Encode/decode mutually recursive definitions; decoding terminates and calls preserve results. Do not assert a chosen binder/reference encoding yet. |
| Predicate type reconstruction | Globally encode/decode `Rectangle .where isSquare` in an environment with neither name. Its descriptor and behavior agree; local text may use exact visible names. |
| Defaults remain lazy after reconstruction | Reconstruct a function with a failing default; supplying that argument still succeeds, while closing/printing/decoding does not execute the default. |

A small host check is appropriate for genuinely independent interpreter contexts;
the language currently has no source-level fresh-session operation. Do not invent
one solely to make this a `.test` case. Portable call behavior stays in the source
suite; the host check should exercise the agreed public serialization boundary.

Illustrative local-printing case, once the Function grammar is specified:

```pattern
test "A shadowed name cannot abbreviate a different function value"
  def original(n :: Int) n + (1 :: Int)
  def replacement(n :: Int) n + (100 :: Int)
  def check(old, original)
    text = toStringLocal(Function)(old)
    assert text != "original"
    assert parseLocal(Function)(text) == old
    True
  end

  assert check(original, replacement)
end
```

The shape of this case is proposed: evaluated-Code `assert`, the public Function
type and its typed-text support are separate prerequisites. Its expected outcome
is value preservation, not one particular expanded printed body.

## Decisions needed before authoring expected results

| Case family | Specific question |
| --- | --- |
| Overloaded named functions | Bare `f` captures the visible group in a `PolymorphicValue` with `definitions :: Definition*`. Once the `Definition` schema is specified, store, pass and return the group and exercise every disjoint arm. |
| Constants | Given String and Float definitions of `zero`, what selects an alternative? Test a direct name and `saved = zero` consistently; ordinary typed binding must not gain a name-only exception accidentally. |
| Ambiguous and absent selections | For a decided selection operation, zero, one and multiple matching definitions need explicit error/success contracts. Include an abstract expected type admitting both constants. |
| Overlap and dispatch | Check definition-time disjointness, direct membership and nested designation priority. Exercise the remaining peer ambiguity errors. [Dispatch rules](2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md#designation-and-ambiguity) |
| Library syntax and identity | Is a value one named group or several definitions? Which names are structural fields versus binders? Are reordered definitions or renamed binders equal? No alpha-equivalence or ordering normalization is assumed. |
| Function annotations | Which parameter/result/capture types are part of the public value, which must be explicit and which may be inferred? Printing must not execute a body to establish them. |
| External references | Test the fixed primitive vocabulary first. A later library-reference scheme needs tests for exact referents, unavailable definitions and wrong versions, without relying on spelling alone. |

Do not turn these questions into todo assertions with guessed golden values.
After agreement, capture the rule under `../approved/` and write its focused
contracts before implementation.
