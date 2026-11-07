# Vertical spreading and a Body-first Code grammar

Updated 3 November 2026. Milestone 5a is implemented for the bounded source grammar
in [examples/body-grammar.pattern](../examples/body-grammar.pattern). TodoList,
Matrix and nested Body inspection are executable playground cases. The full
bootstrap Code reader remains in use; this subset is opt-in, not a full replacement.


## Relationship to the revised design

Updated 7 November 2026. The executable examples below retain bootstrap def/type
syntax. Future declaration-only accessor products and concrete/refinement/abstract
forms are specified in [LANGUAGE-DECISIONS.md](LANGUAGE-DECISIONS.md); this document
is evidence for the implemented bounded grammar, not a claim those revisions ship.
Capture dimensions and one required final Code result row remain valid. A test-body
DSL has its own setup/check grammar; adding tests must not weaken the Code Body rule.
[The next small milestone](TEST-SUITE.md) adds pending conformance and selective
migration before more Code coverage. Optional runtime Expression remains undecided.

## Goal and boundary

Parse and inspect a small language of definitions, destructuring bindings and a
required final result row using source-defined types and the shared pattern engine.
Use this Body grammar as the foundation for a cleaner Code grammar. This milestone
does not implement code.evaluate, type inference, a compiler or a full language.

Keep type/Type and unionType/UnionType as the current spellings. type accepts
patterns, type references or a mixture to describe a concrete structural space;
it is idempotent on an existing type value. unionType accepts only type-valued
members and preserves their existing concrete identities. A raw expression such
as Error(String) is not automatically a type member: write type Error(String).
Expression and ExpressionTree are themselves legitimate type values. Retain the
current restriction on unions of distinct refinements of the same concrete space.

Raw non-atomic syntax is intended to belong to one concrete ExpressionTree space.
Body, DestructuringBinding and Definition are explicit grammar interpretations;
they need not be raw tree categories. In particular, x + y and +(x)(y) have one
application shape with two distinct packs, without a primitive BinaryApplication.

## Row repetition and capture dimensions

A standalone ... row in a pattern repeats the immediately preceding row pattern
at the same indentation. It is vertical repetition, not a wildcard consuming the
rest of a sidefix expression. A horizontal name... repeats positional fields
within one argument pack. The row marker's meaning belongs to pattern
interpretation; the evaluator must not acquire a TodoList or Body special case.

Each repeated dimension contributes one list layer to a capture. Its annotation
constrains the complete aggregate capture, not a single iteration:

| Pattern shape | Capture shape |
| --- | --- |
| One capture row followed by vertical ... | A list of row values |
| Horizontal rest capture in one row | A list of positional values |
| Horizontal rest capture followed by vertical ... | A list of rows, each a list of positional values |

A single capture declaration may collect across repetitions; it is not a duplicate
capture declaration on every iteration. Independent duplicate capture names remain
errors. The common compiler must account for both dimensions before checking the
aggregate annotation. Outer vertical repetition supplies the outer list layer.

### A vertical collection

```text
def TodoList type :todo
  todos :: String*
  ...
end

list = TodoList`
  todo
    "item 1"
    "item 2"
  end
end

# list.todos is ["item 1", "item 2"] with type String*.
```

The capture is todos, not todos...: only the vertical dimension is repeated.
The capture name contributes an accessor, not a physical field label or type identity.

### Two dimensions

```text
def Matrix type [
  values... :: Float**
  ...
]

(m :: Matrix) = [
  1, 2
  3, 4
]

# m.values is [[1,2],[3,4]] with type Float**.
```

Float** means two successive postfix list operators. It is separate from bare **
in a pack pattern, which ignores extra labels. Vertical repetition collects rows;
horizontal repetition collects the positional values in each row. Float** admits
ragged rows; equal row widths would require an additional constraint.

Newlines separating rows cannot be flattened into commas. Rows and pack boundaries
must survive surface parsing, quoting, matching and serialization. An argument pack
does not thereby become a standalone tuple. Only accessing the repeated capture
materializes ordinary nested list values. Nor is the matrix surface tree silently
identified with the different source tree [[1,2],[3,4]]. Labels remain unique and
canonically sorted within their own pack; row and positional order remain significant.

## Simplified Body grammar

The following shape is executable with the source-defined dependencies in
[body-grammar.pattern](../examples/body-grammar.pattern). Pattern accepts symbols
and annotated captures; ValueExpression accepts numbers, strings, symbols, addition
and multiplication; Definition accepts simple micro function signatures and a
value or nested Body. This bounded subset does not claim full Code coverage.

```text
def Binding unionType DestructuringBinding | Definition
def DestructuringBinding type (patterns... :: Pattern*) := (value :: (unionType ValueExpression | Body))

def Body type
  bindings :: Binding*
  ...
  resultExpression... :: ValueExpression*
end
```

Here := quotes the punctuation symbol = in the pattern. It does not introduce a
new assignment operator. Binding is a union of two explicit type values, not a
union of arbitrary raw expressions. These mutually referring types use the existing
recursive declaration-group model rather than a second forward-reference mechanism.

The prefix has zero or more Binding rows. The final row is required and contains a
positional argument pack of ValueExpression syntax. It may be explicitly (), which
collects an empty resultExpression list; it may not be absent. Thus a body containing
only bindings or definitions remains a grammar error. A single-expression body has
an empty bindings list and one expression in its final row.

The grammar must distinguish binding/definition rows from value-expression rows.
A broad application production must not also classify = or def statement forms
as ordinary ValueExpression alternatives. Likewise, a binding RHS Body is distinct
from a micro value-expression RHS. Do not choose a partition by greediness or by
trying the more specific alternative first. Ambiguous interpretations are errors.

### Direct inspection

```text
binding = DestructuringBinding`
  (a,b) =
    y = 2
    z = 3
    (y * z, y)
  end
end

((symbol1 :: LowerCamelSymbol, symbol2 :: LowerCamelSymbol) := (body :: Body)) = binding

# symbol1 is the symbol a; symbol2 is the symbol b.
# body.bindings contains the two typed binding values y = 2 and z = 3.
# body.resultExpression contains the syntax y * z and y.
```

This reads data. It must not resolve a, b, y or z, perform the bindings, multiply
values, install definitions or expand macros. Binding patterns within the quoted
code are syntax values; captures in the outer inspection pattern bind local names.
Access through body.bindings uses the same accessor machinery as ordinary types.

## Surface and implementation contract

Balanced delimiters with an opening newline preserve separate rows unless commas
continue the fields. [\n] is a zero-row layout, while [\n ()\n] has one empty
row; [] is a flat empty list. The canonical printer emits an opening newline for
layouts and preserves these distinctions. TodoList's empty sidefix block can be
written as TodoList` todo ( followed by a newline and a closing parenthesis, with
space before the parenthesis. Blank/comment-only lines are layout, not elements.

The surface uses its existing block, sequence and pack trees. The pattern compiler
lowers row fields and repetition to Row, Collect and Sequence in the shared matcher;
the public descriptor schema encodes those forms without captures or host identities.
No TodoList, Matrix or source Body evaluator case is installed. The reader enables
inert layout syntax when the expected structural grammar contains it.

Each repeated dimension peels one list layer for element checking and restores it
when materializing the capture. Empty repetitions retain their aggregate type.
Rows are rebuilt from interpreted fields so, for example, Float32 rounding survives
storage and serialization. Source ranges are retained for element diagnostics.

A local source Body declaration can replace the bootstrap raw Body alias. Real
primitive names remain reserved. Recursive declaration groups define the mutually
referring grammar; type identities are cached only after construction completes.

## Acceptance tests and completion

- Corrected TodoList capture and horizontal/vertical Matrix capture return String*
  and Float**, including zero rows, empty row packs and ragged rows. Wrong element types and wrong capture dimensionality fail at useful
  source locations.
- Flat packs, separate rows, nested applications and successive packs remain distinct
  through parse, quote, matching and canonical printing. Ragged Float** rows remain
  valid unless a separate width constraint is supplied.
- Bodies accept zero/multiple binding rows, definitions among those rows, nested
  RHS bodies and a final single/multiple/explicitly empty result pack. A missing
  final row, a binding as the final row or a binding after the result row rejects.
- The direct-inspection example succeeds without evaluating quoted code. Undefined
  identifiers and failing calculations in inert bodies remain inert.
- Ambiguous repetition partitions reject; recognition never executes predicates,
  defaults or user code to decide a partition. Existing deterministic matching
  behavior is preserved.
- parse(T)(toString(T)(value)) == value for the new supported types and captures,
  including type descriptions transferred to a fresh interpreter.
- Every exposed sandbox example belongs to the shared source corpus and passes the
  actual menu/control checks in fresh and restored sessions. Design-only snippets
  stay in documentation until they are executable.

These acceptance cases pass through ordinary source-defined types, direct patterns
and accessors. Every exposed example is checked against its shared expectation in
fresh and restored playground sessions. Full
Code coverage, nested executable test groups, source code.evaluate, static checking,
and keyword-field capture/spread remain subsequent work. General repetition or
alternation of arbitrary space-separated sidefix fields is not introduced here.
