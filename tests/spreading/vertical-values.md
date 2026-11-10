# Mirrored vertical row spreading

[The source cases](vertical-values.test) implement the reconstruction side of
[C20](../specification/spreading.test): a horizontal row spread followed by a
standalone vertical marker consumes a list of row lists. Each inner list supplies
one row. Empty lists contribute empty rows; an empty outer list contributes no
rows. Existing rows before and after the spread retain their order.

The cases cover ragged and singleton rows, zero rows versus one empty row,
interpreted Float32 elements, and brace collections. Expected values use the
named Matrix/Table row patterns. The exact concrete type returned by a repeated
capture accessor remains [pending](../../specs/approved/anonymous-repeated-patterns.md);
these checks specify reconstruction without choosing a conversion rule.

This slice supports a single horizontal spread in the repeated row. More complex
row templates and keyword spreading remain outside it. C20's first reconstruction
assertion is now ordinary coverage. Its other three original todo subjects also
use `assert` inside evaluated Code, which remains unsupported; they are retained
as todos. The focused cases here cover their row-shape obligations independently.

Source error cases cover invalid row-list dimensions and a leading vertical
marker. Unsupported broader row templates are not permanent rejection contracts.
The host vertical-spread tests retain operand evaluation counts, diagnostic
locations, and the distinction between empty collection data and an empty
executable program. No public inspection or decoding API is introduced.
