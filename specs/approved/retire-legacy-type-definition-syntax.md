# Retire alternate type-definition spellings

Approved by Jonathan in the project chat on 9 November 2026: retire
`x = type pattern` and `def Name type ...`; `def` must not provide an alternate
way to declare a type. The motivation is one clear spelling for each role.

Use dedicated declarations and ordinary type-producing expressions:

```pattern
type Rectangle concrete Rect(width :: Int, height :: Int)
t = concrete Rect(Int, Int)

type EitherFloat abstract Float32 | Float64
u = abstract Float32 | Float64

alias = Rectangle
```

The last binding stores an existing type value; it is not another declaration.
Plain construction remains capture-free and does not install accessor products.
Named declarations retain their established declaration/accessor behavior.

Retired forms must be rejected rather than silently normalized to the new syntax:

```pattern
t = type Rect(Int, Int)

def Rectangle type Rect(width :: Int, height :: Int)

def Rectangle concrete Rect(width :: Int, height :: Int)

def EitherFloat abstract Float32 | Float64
```

The last two are important: removing only the old `type pattern` expression must
not leave `def Name concrete/abstract ...` as a confusing second declaration path.
These snippets are negative test inputs, not current executable rejection coverage.
Their diagnostic contract should be made concrete with the implementation tests.

## Boundary needing clarification

The distinction between declaring a type and computing with Type values needs
one explicit example. In particular, is an ordinary function returning a Type
value still legal?

```pattern
def makeBox(t :: Type) concrete Box(t)
```

Likewise, clarify `def` constants that merely refer to an existing Type value.
Do not infer a blanket ban on Type-valued computation, or make indirect `def`
aliases a new declaration mechanism, before that boundary is agreed in chat.

## Implementation and test prerequisites

Existing positive controls are C04/C05 in
[type-values.test](../../tests/specification/type-values.test), C13 in
[interpretations.test](../../tests/specification/interpretations.test) and C16 in
[declarations.test](../../tests/specification/declarations.test). Add focused
negative cases for the retired forms before changing recognition/evaluation.

This is a coordinated breaking change. Audit the source prelude, default/source
grammar bootstrapping, schemas, all tests/fixtures, canonical Code printing, docs
and editor consumers. Parameterized/postfix/variadic type declarations used by
the prelude need supported replacements before compatibility is removed. Preserve
the source-defined optional convention and complete runtime argument packs.

Raw data and global descriptor text use their own grammars; this surface change
does not choose a new descriptor-decoding or public inspection API. Keep old
Code text/quotation round-trip expectations explicit during the migration.

The expectation-DSL rename is a separate coordinated change. Do not silently
expand that scheduled migration into this language-syntax retirement. Keep this
record approved until its replacement/rejection contracts are actual tests;
runtime removal follows those tests and the prerequisite work.
