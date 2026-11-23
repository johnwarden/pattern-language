# Spreads and ArgPacks

Sole contract for positional and labeled spreads, anonymous repetition,
vertical row spreading, residual `ArgPack` capture, and open concrete types.
It supersedes [anonymous repeated patterns](anonymous-repeated-patterns.md)
and the former `tests/specification/anonymous-spreads.*`,
`tests/specification/spreading.test`, and `tests/spreading/vertical*` source
suite.

**Bootstrap vs target spelling.** Destination annotations sit to the **left** of
`...`, as in `(cells :: Float32**)...` / `(Float32**)...`. The bootstrap still
accepts only the older `name... :: T**` / `... :: T**` forms (and still uses
`concrete` / `def … type` in these live cases). Each formerly passing contract
has a **bootstrap spelling** fence that must keep passing, next to a **target
spelling** `todo` fence. Phase 2 replaces the bootstrap fences once the runtime
accepts the target form. New ArgPack / open-concrete / collector-head cases have
target `todo`s only (they never had live source coverage).

## Annotation placement

A spread annotation sits to the **left** of `...`. That form replaces
`name... :: T**` / `... :: T**`.

**Justification.** Patterns should mirror the values and expressions they
match. Spreading and collecting then share one postfix shape; the type
annotation attaches to the operand:

```text
Target:
(x :: Rectangle)... = (r :: Rectangle)...
(items :: String*)... = ("a", "b")...
(cells :: Float32**)...
(Float32**)...

Current bootstrap:
(x :: Rectangle)... = (r :: Rectangle)...
items... :: String* = ("a", "b")...
cells... :: Float32**
... :: Float32**
```

The ellipsis is ASCII `...` only; Unicode `…` is not supported syntax. There
is no synthetic underscore binding. Existing underscore syntax is not retired.

## Spread syntax

Use `...` for positional and labeled spreads. The left-hand annotation says
what the spread accepts and how to collect it. `(items :: String*)...`
collects positional strings. An anonymous spread such as `(Float32**)...`
repeats without a binding. A standalone vertical `...` repeats rows. One
repeated dimension contributes one list layer to the aggregate capture.

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Anonymous horizontal repetition checks every element (bootstrap spelling)"
  type Numbers concrete [... :: Float32*]
  assert Numbers == (concrete [_... :: Float32*])
  expect [0.5, 1] :: Numbers is [0.5, 1] :: Numbers
  expect [] :: Numbers is [] :: Numbers
  assert not([0.1] .matches Numbers)
  assert not(["wrong"] .matches Numbers)
end
```

```pattern
todo test "Anonymous horizontal repetition checks every element"
  type Numbers struct [(Float32*)...]
  assert Numbers === (struct [(_ :: Float32*)...])
  expect [0.5, 1] :: Numbers is [0.5, 1] :: Numbers
  expect [] :: Numbers is [] :: Numbers
  assert not([0.1] .matches Numbers)
  assert not(["wrong"] .matches Numbers)
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "An anonymous matrix pattern keeps horizontal and vertical repetition (bootstrap spelling)"
  type Matrix concrete [
    cells... :: Float32**
    ...
  ]
  anonymous = concrete [
    ... :: Float32**
    ...
  ]
  matrix = ([
    ()
    0.5
    1, 2
  ] :: Matrix)
  assert Matrix == anonymous
  assert matrix .matches anonymous
end
```

```pattern
todo test "An anonymous matrix pattern retains horizontal and vertical repetition"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  anonymous = struct [
    (Float32**)...
    ...
  ]
  matrix = ([
    ()
    0.5
    1, 2
  ] :: Matrix)
  assert Matrix === anonymous
  assert matrix .matches anonymous
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Anonymous matrix elements retain their Float32 constraint (bootstrap spelling)"
  anonymous = concrete [
    ... :: Float32**
    ...
  ]
  assert [
    0.5, 1
    2, 4
  ] .matches anonymous
  assert not([
    0.1
  ] .matches anonymous)
end
```

```pattern
todo test "Anonymous matrix elements retain their Float32 constraint"
  anonymous = struct [
    (Float32**)...
    ...
  ]
  assert [
    0.5, 1
    2, 4
  ] .matches anonymous
  assert not([
    0.1
  ] .matches anonymous)
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "An anonymous matrix preserves zero rows versus one empty row (bootstrap spelling)"
  anonymous = concrete [
    ... :: Float32**
    ...
  ]
  empty = anonymous` [
  ]
  oneRow = anonymous` [
    ()
  ]
  assert empty .matches anonymous
  assert oneRow .matches anonymous
  assert not(empty == oneRow)
end
```

```pattern
todo test "An anonymous matrix preserves zero rows versus one empty row"
  anonymous = struct [
    (Float32**)...
    ...
  ]
  empty = anonymous` [
  ]
  oneRow = anonymous` [
    ()
  ]
  assert empty .matches anonymous
  assert oneRow .matches anonymous
  assert not(empty === oneRow)
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Anonymous positional repetition can precede labeled fields (bootstrap spelling)"
  type Packet concrete Packet(... :: Float32*, note: String)
  packet = Packet(0.5, 1, note: "kept") :: Packet
  expect packet.note is "kept" :: String
  assert not(Packet(0.1, note: "wrong") .matches Packet)
end
```

```pattern
todo test "Anonymous positional repetition can precede labeled fields"
  type Packet struct Packet((Float32*)..., note: String)
  packet = Packet(0.5, 1, note: "kept") :: Packet
  expect packet.note is "kept" :: String
  assert not(Packet(0.1, note: "wrong") .matches Packet)
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Anonymous matrix repetition still needs one list layer per dimension (bootstrap spelling)"
  expect
    concrete [
      ... :: Float32*
      ...
    ]
  fails "E_SPREAD_DIMENSION"
end
```

```pattern
todo test "Anonymous matrix repetition still needs one list layer per dimension"
  expect
    struct [
      (Float32*)...
      ...
    ]
  fails "E_SPREAD_DIMENSION"
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "An expected matrix type keeps its vertical repetition (bootstrap spelling)"
  expect
    [
      ()
      0.5
      1, 2
    ] :: (concrete [
      ... :: Float32**
      ...
    ])
  is
    [
      ()
      0.5
      1, 2
    ] :: (concrete [
      ... :: Float32**
      ...
    ])
  end
end
```

```pattern
todo test "An expected matrix type keeps its vertical repetition"
  expect
    [
      ()
      0.5
      1, 2
    ] :: (struct [
      (Float32**)...
      ...
    ])
  is
    [
      ()
      0.5
      1, 2
    ] :: (struct [
      (Float32**)...
      ...
    ])
  end
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Quoted anonymous repetition patterns print back to the same Code (bootstrap spelling)"
  horizontal = Code` [... :: Float32*]
  vertical = Code` [
    ... :: Float32**
    ...
  ]
  named = Code` [values...]
  leading = Code` [...values]
  assert parse(Code)(toString(Code)(horizontal)) == horizontal
  assert parse(Code)(toString(Code)(vertical)) == vertical
  assert parse(Code)(toString(Code)(named)) == named
  assert parse(Code)(toString(Code)(leading)) == leading
end
```

Target spelling as quoted Code (already parses; keep as an ordinary check):

```pattern
test "Quoted anonymous repetition patterns print back to the same Code"
  horizontal = Code` [(Float32*)...]
  vertical = Code` [
    (Float32**)...
    ...
  ]
  named = Code` [(values :: Any*)...]
  assert parse(Code)(toString(Code)(horizontal)) == horizontal
  assert parse(Code)(toString(Code)(vertical)) == vertical
  assert parse(Code)(toString(Code)(named)) == named
end
```

Anonymous repeated patterns create no capture bindings. Host coverage of that
bootstrap fact remains in `test/anonymous-spreads.test.ts` until the runtime
accepts the new spelling.

## Collecting a spread

Spreading a struct with `r...` emits its positional and labeled arguments.
The collector receives that argument pack. Its pattern checks the emitted
arguments and supplies the result head for a constructed value. The source
head is discarded by the spread. The collector may be concrete or abstract.

**Braced-match rule.** Collectors rebuild under the collector’s head. `{...}`
matches braced packs only, never a differently headed value such as `Rect(...)`.
So `assert not(r .matches (pattern {...}))` when `r` is a `Rect(...)`.

**Justification for `{...}`.** Braces are the opaque pack facet: they match any
concrete braced argument pack without exposing captures. They sit **alongside**
`ArgPack`, which materializes residuals for lookup. Brackets, braces and angle
brackets follow the same spread and collection rules. A named head such as
`BunchOfValues(...)` follows those rules too.

```pattern
todo test "Collecting a spread uses the collector's head"
  type Color struct :Red | :Blue
  type ColoredRectangle struct Rect(width :: Int, height :: Int, color: Color)
  type Bunch struct BunchOfValues(Int, Int, color: Color)

  r = Rect(3, 5, color: :Red) :: ColoredRectangle
  (p :: {...})... = r...
  (b :: Bunch)... = r...

  expect p is {3, 5, color: :Red} :: (struct {Int, Int, color: Color})
  expect b is BunchOfValues(3, 5, color: :Red) :: Bunch
  assert p .matches (pattern {...})
  assert not(r .matches (pattern {...}))
end
```

Choosing the original type as collector reconstructs the value.

```pattern
todo test "Reconstructing a spread into a value of the same type"
  type Color struct :Red | :Blue
  type ColoredRectangle struct Rect(width :: Int, height :: Int, color: Color)

  r = Rect(3, 5, color: :Red) :: ColoredRectangle
  (reconstructed :: ColoredRectangle)... = r...
  assert reconstructed === r
end
```

## Horizontal rest (C19)

A positional rest collects only remaining positions. Labels are not consumed by
that rest. Independent `...` openness and bare `**` label-ignore keep the pack
distinction.

Bootstrap spelling (current; replace in phase 2):

```pattern
test "C19 horizontal rest remains a typed positional list (bootstrap spelling)"
  expect
    def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
    copy()
  is
    (
      []
    ) :: (
      def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
      type [_... :: Float32*]
    )
  end

  expect
    def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
    copy(0.5)
  is
    (
      [0.5]
    ) :: (
      def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
      type [_... :: Float32*]
    )
  end

  expect
    def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
    type Packet concrete Packet(Float32, Float32, color: String, note: String)
    packet = (Packet(0.5, 1, color: "blue", note: "extra") :: Packet)
    Packet(first, rest... :: Float32*, color: c, **) = packet
    rest
  is
    (
      [1]
    ) :: (
      def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
      type Packet concrete Packet(Float32, Float32, color: String, note: String)
      packet = (Packet(0.5, 1, color: "blue", note: "extra") :: Packet)
      Packet(first, rest... :: Float32*, color: c, **) = packet
      type [_... :: Float32*]
    )
  end

  expect
    def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
    type Packet concrete Packet(Float32, Float32, color: String, note: String)
    packet = (Packet(0.5, 1, color: "blue", note: "extra") :: Packet)
    Packet(first, rest... :: Float32*, color: c, **) = packet
    c
  is
    (
      "blue"
    ) :: (
      def copy(xs... :: Float32*) [xs...] :: [_... :: Float32*]
      type Packet concrete Packet(Float32, Float32, color: String, note: String)
      packet = (Packet(0.5, 1, color: "blue", note: "extra") :: Packet)
      Packet(first, rest... :: Float32*, color: c, **) = packet
      String
    )
  end
end
```

```pattern
todo test "C19 horizontal rest remains a typed positional list"
  def copy((xs :: Float32*)...) [xs...] :: [(_ :: Float32*)...]
  expect copy() is [] :: [(_ :: Float32*)...]
  expect copy(0.5) is [0.5] :: [(_ :: Float32*)...]

  type Packet struct Packet(Float32, Float32, color: String, note: String)
  packet = Packet(0.5, 1, color: "blue", note: "extra") :: Packet
  Packet(first, (rest :: Float32*)..., color: c, **) = packet
  expect rest is [1] :: [(_ :: Float32*)...]
  expect c is "blue" :: String
end
```

## Vertical capture and mirrored spreading (C20)

Horizontal rest across repeated rows has `T**`. Spreading those rows with
`rows...` plus a standalone vertical `...` rebuilds the matrix. Zero rows `[]`
differ from one empty row `[()]`.

Bootstrap spelling (current; replace in phase 2). The three trailing scenario
assertions stay `todo` (they already required evaluated-Code assert):

```pattern
test "C20 row capture and spreading are mirror images (bootstrap spelling)"
  expect
    type Matrix concrete [
      cells... :: Float32**
      ...
    ]
    x = ([
      0.5, 1
      2, 4
    ] :: Matrix)
    rows = x.cells
    rows
  is
    (
      [[0.5, 1], [2, 4]]
    ) :: (
      type Matrix concrete [
        cells... :: Float32**
        ...
      ]
      x = ([
        0.5, 1
        2, 4
      ] :: Matrix)
      rows = x.cells
      type [_... :: Float32**]
    )
  end

  assert
    type Matrix concrete [
      cells... :: Float32**
      ...
    ]
    x = ([
      0.5, 1
      2, 4
    ] :: Matrix)
    rows = x.cells
    y = ([
      rows...
      ...
    ] :: Matrix)
    (y == x)
  end

  todo expect
    type Matrix concrete [
      cells... :: Float32**
      ...
    ]
    x = ([
      0.5, 1
      2, 4
    ] :: Matrix)
    rows = x.cells
    y = ([
      rows...
      ...
    ] :: Matrix)
    assert y == x
    empty = ([
    ] :: Matrix)
    oneEmptyRow = ([
      ()
    ] :: Matrix)
    empty.cells
  is
    (
      []
    ) :: (
      type Matrix concrete [
        cells... :: Float32**
        ...
      ]
      x = ([
        0.5, 1
        2, 4
      ] :: Matrix)
      rows = x.cells
      y = ([
        rows...
        ...
      ] :: Matrix)
      assert y == x
      empty = ([
      ] :: Matrix)
      oneEmptyRow = ([
        ()
      ] :: Matrix)
      type [_... :: Float32**]
    )
  end

  todo expect
    type Matrix concrete [
      cells... :: Float32**
      ...
    ]
    x = ([
      0.5, 1
      2, 4
    ] :: Matrix)
    rows = x.cells
    y = ([
      rows...
      ...
    ] :: Matrix)
    assert y == x
    empty = ([
    ] :: Matrix)
    oneEmptyRow = ([
      ()
    ] :: Matrix)
    oneEmptyRow.cells
  is
    (
      [[]]
    ) :: (
      type Matrix concrete [
        cells... :: Float32**
        ...
      ]
      x = ([
        0.5, 1
        2, 4
      ] :: Matrix)
      rows = x.cells
      y = ([
        rows...
        ...
      ] :: Matrix)
      assert y == x
      empty = ([
      ] :: Matrix)
      oneEmptyRow = ([
        ()
      ] :: Matrix)
      type [_... :: Float32**]
    )
  end

  todo assert
    type Matrix concrete [
      cells... :: Float32**
      ...
    ]
    x = ([
      0.5, 1
      2, 4
    ] :: Matrix)
    rows = x.cells
    y = ([
      rows...
      ...
    ] :: Matrix)
    assert y == x
    empty = ([
    ] :: Matrix)
    oneEmptyRow = ([
      ()
    ] :: Matrix)
    (empty != oneEmptyRow)
  end
end
```

```pattern
todo test "C20 row capture and spreading are mirror images"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  x = ([
    0.5, 1
    2, 4
  ] :: Matrix)
  rows = x.cells
  expect rows is [[0.5, 1], [2, 4]] :: [(_ :: Float32**)...]
  y = ([
    rows...
    ...
  ] :: Matrix)
  assert y === x
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Captured matrix rows spread vertically without flattening (bootstrap spelling)"
  type Matrix concrete [
    cells... :: Float32**
    ...
  ]
  original = ([
    ()
    (0.5,)
    1, 2
  ] :: Matrix)
  rows = original.cells
  rebuilt = ([
    rows...
    ...
  ] :: Matrix)
  assert rebuilt == original
  expect
    rebuilt
  is
    [
      ()
      (0.5,)
      1, 2
    ] :: Matrix
  end
end
```

```pattern
todo test "Captured matrix rows spread vertically without flattening"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  original = ([
    ()
    (0.5,)
    1, 2
  ] :: Matrix)
  rows = original.cells
  rebuilt = ([
    rows...
    ...
  ] :: Matrix)
  assert rebuilt === original
  expect
    rebuilt
  is
    [
      ()
      (0.5,)
      1, 2
    ] :: Matrix
  end
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Vertical spreading distinguishes an empty matrix from one empty row (bootstrap spelling)"
  type Matrix concrete [
    cells... :: Float32**
    ...
  ]
  empty = ([
  ] :: Matrix)
  oneRow = ([
    ()
  ] :: Matrix)
  emptyCopy = ([
    empty.cells...
    ...
  ] :: Matrix)
  rowCopy = ([
    oneRow.cells...
    ...
  ] :: Matrix)
  assert emptyCopy == empty
  assert rowCopy == oneRow
  assert emptyCopy != rowCopy
  expect
    emptyCopy
  is
    [
    ] :: Matrix
  end
  expect
    rowCopy
  is
    [
      ()
    ] :: Matrix
  end
end
```

```pattern
todo test "Vertical spreading distinguishes an empty matrix from one empty row"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  empty = ([
  ] :: Matrix)
  oneRow = ([
    ()
  ] :: Matrix)
  emptyCopy = ([
    empty.cells...
    ...
  ] :: Matrix)
  rowCopy = ([
    oneRow.cells...
    ...
  ] :: Matrix)
  assert emptyCopy === empty
  assert rowCopy === oneRow
  assert not(emptyCopy === rowCopy)
  expect empty.cells is [] :: [(_ :: Float32**)...]
  expect oneRow.cells is [[]] :: [(_ :: Float32**)...]
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Vertical spreading retains surrounding rows in source order (bootstrap spelling)"
  type Matrix concrete [
    cells... :: Float32**
    ...
  ]
  middle = ([
    1, 2
    4
  ] :: Matrix)
  combined = ([
    0.5
    middle.cells...
    ...
    8, 16
  ] :: Matrix)
  expect
    combined
  is
    [
      0.5
      1, 2
      4
      8, 16
    ] :: Matrix
  end
end
```

```pattern
todo test "Vertical spreading retains surrounding rows in source order"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  middle = ([
    1, 2
    4
  ] :: Matrix)
  combined = ([
    0.5
    middle.cells...
    ...
    8, 16
  ] :: Matrix)
  expect
    combined
  is
    [
      0.5
      1, 2
      4
      8, 16
    ] :: Matrix
  end
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Vertical spreading retains interpreted Float32 elements (bootstrap spelling)"
  type Matrix concrete [
    cells... :: Float32**
    ...
  ]
  original = ([
    float32(0.1), 1
  ] :: Matrix)
  rebuilt = ([
    original.cells...
    ...
  ] :: Matrix)
  assert rebuilt == original
  assert rebuilt.cells == original.cells
end
```

```pattern
todo test "Vertical spreading retains interpreted Float32 elements"
  type Matrix struct [
    (cells :: Float32**)...
    ...
  ]
  original = ([
    float32(0.1), 1
  ] :: Matrix)
  rebuilt = ([
    original.cells...
    ...
  ] :: Matrix)
  assert rebuilt === original
  assert rebuilt.cells === original.cells
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Brace collection rows spread with the same dimensions (bootstrap spelling)"
  type Table concrete {
    cells... :: String**
    ...
  }
  original = ({
    "first"
    ()
    "second", "third"
  } :: Table)
  rebuilt = ({
    original.cells...
    ...
  } :: Table)
  assert rebuilt == original
  expect
    rebuilt
  is
    {
      "first"
      ()
      "second", "third"
    } :: Table
  end
end
```

```pattern
todo test "Brace collection rows spread with the same dimensions"
  type Table struct {
    (cells :: String**)...
    ...
  }
  original = ({
    "first"
    ()
    "second", "third"
  } :: Table)
  rebuilt = ({
    original.cells...
    ...
  } :: Table)
  assert rebuilt === original
end
```

These three need no annotation spelling change and stay ordinary passing checks:

```pattern
test "Vertical spreading requires a list of row lists"
  expect
    rows = 1
    [
      rows...
      ...
    ]
  fails "E_VERTICAL_SPREAD"

  expect
    rows = [1, 2]
    [
      rows...
      ...
    ]
  fails "E_VERTICAL_SPREAD"
end
```

```pattern
test "A vertical value marker requires a preceding row"
  expect
    [
      ...
    ]
  fails "E_VERTICAL_SPREAD"
end
```

```pattern
test "Quoted vertical row spreads remain inert Code"
  quoted = Code` [
    missingRows()...
    ...
  ]
  assert parse(Code)(toString(Code)(quoted)) == quoted
end
```

Bootstrap spelling (current; replace in phase 2). Uses live `def … type`
declaration form:

```pattern
test "Vertical matrix capture preserves empty and nonempty rows (bootstrap spelling)"
  def Matrix type [
    values... :: Float**
    ...
  ]
  m = Matrix` [
    ()
    (1,)
    2, 3, 4
  ]
  expect m.values is [[], [1], [2, 3, 4]] :: (type [_... :: Float**])
end
```

```pattern
todo test "Vertical matrix capture preserves empty and nonempty rows"
  type Matrix struct [
    (values :: Float**)...
    ...
  ]
  m = Matrix` [
    ()
    (1,)
    2, 3, 4
  ]
  expect m.values is [[], [1], [2, 3, 4]] :: [(_ :: Float**)...]
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "An empty vertical matrix is an empty list of rows (bootstrap spelling)"
  def Matrix type [
    values... :: Float**
    ...
  ]
  m = Matrix` [
  ]
  expect m.values is [] :: (type [_... :: Float**])
end
```

```pattern
todo test "An empty vertical matrix is an empty list of rows"
  type Matrix struct [
    (values :: Float**)...
    ...
  ]
  m = Matrix` [
  ]
  expect m.values is [] :: [(_ :: Float**)...]
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Row collection literals evaluate their fields (bootstrap spelling)"
  def Matrix type [
    values... :: Float**
    ...
  ]
  x = 3
  (m :: Matrix) = [
    x, x + 1
    x * 2, 9
  ]
  expect m.values is [[3, 4], [6, 9]] :: (type [_... :: Float**])
end
```

```pattern
todo test "Row collection literals evaluate their fields"
  type Matrix struct [
    (values :: Float**)...
    ...
  ]
  x = 3
  (m :: Matrix) = [
    x, x + 1
    x * 2, 9
  ]
  expect m.values is [[3, 4], [6, 9]] :: [(_ :: Float**)...]
end
```

Bootstrap spelling (current; replace in phase 2):

```pattern
test "Repeated application rows collect heads and argument packs independently (bootstrap spelling)"
  def Calls type
    (heads :: Symbol*)(arguments... :: Float**)
    ...
  end
  x = Calls`
    f(1, 2)
    g(3)
  end
  expect x.heads is [f, g] :: (type [_... :: Symbol*])
  expect x.arguments is [[1, 2], [3]] :: (type [_... :: Float**])
end
```

```pattern
todo test "Repeated application rows collect heads and argument packs independently"
  type Calls struct
    (heads :: Symbol*)((arguments :: Float**)...)
    ...
  end
  x = Calls`
    f(1, 2)
    g(3)
  end
  expect x.heads is [f, g] :: [(_ :: Symbol*)...]
  expect x.arguments is [[1, 2], [3]] :: [(_ :: Float**)...]
end
```

The exact concrete type returned by a repeated capture accessor remains open
(#65). These checks specify reconstruction without choosing a conversion between
a row matrix and an ordinary list of lists.

Host-only vertical-spread checks (operand evaluation count, diagnostic column
locations, empty program vs empty collection, syntaxKey row boundaries) remain
in `test/vertical-spread.test.ts` with bootstrap spelling until the runtime
accepts the new annotation form.

## Vertical-only capture (C21)

Bootstrap spelling (current; replace in phase 2):

```pattern
test "C21 vertical-only capture is a list of items (bootstrap spelling)"
  expect
    type TodoList concrete :todo
      todos :: String*
      ...
    end
    items = TodoList`
      todo
        "first"
        "second"
      end
    end
    items.todos
  is
    (
      ["first", "second"]
    ) :: (
      type TodoList concrete :todo
        todos :: String*
        ...
      end
      items = TodoList`
        todo
          "first"
          "second"
        end
      end
      type [_... :: String*]
    )
  end
end
```

```pattern
todo test "C21 vertical-only capture is a list of items"
  type TodoList struct :todo
    (todos :: String*)...
  end
  items = TodoList`
    todo
      "first"
      "second"
    end
  end
  expect items.todos is ["first", "second"] :: [(_ :: String*)...]
end
```

## Keyword remainder (C22)

Still a proposal. Prefix `**rest: {**}` is not replaced by this file’s
`ArgPack` residual form; settle spelling when implementing labeled remainders.
This case was already `todo` before consolidation (no bootstrap passing fence).

```pattern
todo test "C22 keyword remainder retains its record field types"
  type PersonRecord struct {name: String, id: Int64, age: Int8}
  type Person pattern {name: String, id: Int64, **}
  type AgeInfo struct {age: Int8}
  def extra(person :: Person)
    {name: name, id: id, **rest: {**}} = person
    rest
  end
  john = ({name: "John", id: 5, age: 48} :: PersonRecord)
  expect extra(john) is {age: 48} :: AgeInfo
end
```

## ArgPacks

A trailing `(capture :: ArgPack)...` on a constructor pattern collects the
residual pack of unmatched positional and labeled arguments. `ArgPack` is a
single prelude type. Its slots accept `Any` and preserve each argument's
concrete type. An argument already matched by an explicit field is checked
against that field's pattern and is **not** re-captured into the residual.

`Label`, `MapEntry`, `Map`, `ArgPack`, and `get` are **prelude** destinations:

```text
type Label struct LowerCamelSymbol
type MapEntry(T :: Type, U :: Type) struct MapEntry((key :: T) :=> (value :: U))
type Map(T :: Type, U :: Type) struct Map((entries :: MapEntry(T, U)*)...)
type ArgPack struct ArgPack(
  positionalArguments: Any*,
  labeledArguments: Map(Label, Any)
)
def get(p :: ArgPack, i :: NonNegativeInt | Label) :: Any
```

`get` accepts a nonnegative positional index or a `Label` and returns `Any`
when the argument exists. Labeled lookup uses a quoted lower camel symbol as
the key, as in `y.properties.get(:color)`. Behavior for absent keys is open.

```pattern
todo test "ArgPack holds the residual pack and exposes get"
  type Color struct :Red | :Blue
  type ColoredRectangle struct Rect(width :: Int, height :: Int, color: Color)
  type AugmentedRectangle pattern Rect(
    width :: Int,
    height :: Int,
    (properties :: ArgPack)...
  )

  r = Rect(3, 5, color: :Red) :: ColoredRectangle
  (y :: AugmentedRectangle) = r

  expect
    y.properties
  is
    ArgPack(
      positionalArguments: [] :: Any*,
      labeledArguments: Map(
        MapEntry(:color :=> (:Red :: Color))
      ) :: Map(Label, Any)
    ) :: ArgPack
  end

  expect y.properties.get(:color) is :Red :: Color
end
```

```pattern
todo test "An ArgPack preserves mixed concrete types in both kinds of argument"
  type WithExtras pattern Packet(id :: Int, (extras :: ArgPack)...)
  type MixedPacket struct Packet(Int, String, Int, note: String, priority: Int)

  packet = Packet(1, "text", 2, note: "label", priority: 3) :: MixedPacket
  (p :: WithExtras) = packet

  assert p.extras .matches ArgPack
  expect p.extras.positionalArguments is ["text" :: String, 2 :: Int] :: Any*
  expect p.extras.get(:note) is "label" :: String
  expect p.extras.get(:priority) is 3 :: Int
end
```

## Open concrete types

The same residual spread can define an open concrete type. The residual
arguments remain part of the constructed value and appear when it is spread.

**Decision.** This file **lifts** the retire-legacy rule that a concrete type
cannot be open. Open concrete types with `(capture :: ArgPack)...` are allowed.
See [retire legacy type-definition syntax](retire-legacy-type-definition-syntax.md).

**Two phases.** Phase 1 (this spec): the language decision allows open concrete
types; examples stay `todo`. Phase 2 (later): update that retirement contract
and the implementation so open concrete descriptions stop failing with
`E_TYPE_DESCRIPTION`.

```pattern
todo test "An open concrete type retains its residual labels"
  type Color struct :Red | :Blue
  type ClosedRectangle struct OpenRectangle(Int, Int, color: Color)
  type OpenRectangle struct OpenRectangle(
    width :: Int,
    height :: Int,
    (properties :: ArgPack)...
  )

  (z :: OpenRectangle) = OpenRectangle(3, 5, color: :Red :: Color)
  expect z is OpenRectangle(3, 5, color: :Red :: Color) :: OpenRectangle
  expect z.properties.get(:color) is :Red :: Color
  assert not(z .matches ClosedRectangle)

  (rebuilt :: OpenRectangle)... = z...
  assert rebuilt === z
end
```

### Bootstrap transition

Do not treat today’s bootstrap rejection of open concrete descriptions as the
destination rule. The [syntax-retirement contract](retire-legacy-type-definition-syntax.md)
will be updated together when open concrete collection is implemented.
