# Ambiguous values use the existing type-directed text contract

The author's 9 November clarification points back to the existing contract, not
a new printing policy. See [the type-value spec](type-values.md#canonical-expressions-and-typed-text)
and [the bootstrap reference](../TYPE-VALUES-BOOTSTRAP.md#global-and-local-typed-text).

`toString(T)(v)` prints data for the decoder `parse(T)`. Retain member/type
information where it is needed to reconstruct the same value and concrete
identity; omit annotations already determined by that grammar. Global text uses
structural descriptors, independent of lexical aliases. `toStringLocal(T)` may
reuse valid names and requires the corresponding scope to decode them.

For the inner absence `(:None :: String?) :: String??`, printing for `String??`
retains the inner member designation without redundantly printing the known
outer type. Printing for `Any` must retain enough information to recover the
entire concrete `String??` value. A trailing `:: String` in the old draft is not
a contract to retype that value as a String.

The initial specification-queue commit on master captures the String example in
[concrete-unions.test](../tests/specification/concrete-unions.test),
including reconstruction under both `String??` and `Any`. Existing cases there
and in [overlapping-unions.test](../tests/specification/overlapping-unions.test)
cover direct arms, inner members, overlapping abstract spaces and annotation
omission. Use those tests rather than independently evolving expected prose text.

Origin: `tests/inbox/2026-09-11-printing-values-of-ambiguous-concrete-types.test`.
The obsolete `value` clauses, code-style colon quotation in value text, local
aliases in global text, and redundant/inconsistent outer tag are superseded by
the established contract. Its two decoder-context checks are preserved in the
source suite; no new golden representation for Function values is selected.
