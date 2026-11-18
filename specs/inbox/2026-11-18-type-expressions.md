# Every type has a type expression

Proposal for review. It responds to Jonathan's ruling on
[#80](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6979344843)
that every type should have a type expression and that a type with no
writable one is a bug.
[Type values](../approved/type-values.md) · [Ambiguous value designators](../approved/ambiguous-values.md) · [Closed function values](../approved/named-function-values.md) · [Refinement evidence](refinement-evidence.md)

The examples were run on master at `1a6e56b` and on #80 at `559f397`. They use
the spellings that work there: `abstract` where the drafts and rulings say
`pattern`, `concrete` or the legacy `type` where the rulings say `struct`,
and the kind constructors `Type(...)`, `UnionType(...)` and `Facet(...)`,
which the approved type-values record and the type-model draft rename.
Nothing proposed here depends on those spellings. In a test block, `todo`
marks a line that fails today.

## The problem

A type expression is source that evaluates to a type, such as `Int`,
`String?` or `concrete Box(Int)`. Text that the interpreter prints for a type
should be one. For some types it is a label that cannot be written back.
With `p = Int .where (n -> n > (5 :: Int))`:

| | `p*` | `p?` |
| --- | --- | --- |
| Printed on master when the type is a program result | `Int .where (n -> n > 5 :: Int)*` | `type T \| :None` |
| Printed on master in the mismatch for `"a" :: p*` and `"a" :: p?` | `expected Int .where (n -> n > 5 :: Int)*` | `expected type T \| :None` |
| Printed at #80 as a suggested interpretation | `[7] :: Int .where (n -> n > 5 :: Int)*` | `7 :: type T \| :None` |
| Result of writing that text back after `::` | `E_EXPECTED_PREDICATE`, because `*` attaches to the lambda | `E_UNBOUND_TYPE: unbound type name: T` |

Two more suggestions at #80 fail when pasted. A member that is a recursive
type, such as `def FloatList type :Nil | :Cons(Float, FloatList)`, is printed
as `:Nil :: Recursive(:Nil | Cons(Float, Recur(0)))`, which gives
`E_PATTERN_MISMATCH`. An `Any` member is printed as `"hi" :: Any`, which
gives `E_ABSTRACT_ASCRIPTION`.

The same types fail in three other places on master. `toString(Type)(p*)` is
`E_TYPE_SERIALIZATION`. `p == p` is `E_VALUE_REPRESENTATION`. A value of type
`p*` has no typed text: `toString(Any)` of it is `E_TYPE_SERIALIZATION`.

## Root cause

The implementation has no notion of a type expression. A type value carries
two other texts, and printing chooses between them.

**The description.** `typeDescription` (`src/type-data.ts`) encodes a type's
pattern as data. `toString(Type)` prints that data inside a kind constructor,
`parse(Type)` reads it back, and `==` on types compares it. For most types
this text already is a type expression. On master
`Type(:None | String) == String?` holds. With
`def IntList type :Nil | :Cons(Int, IntList)`, so does
`Type(Recursive(:Nil | Cons(Int, Recur(0)))) == IntList`.

The description has no node for a refinement. A predicate is a host closure
with no structural form, so `typeDescription` stops with "refinement types
need a portable predicate description before serialization". It stops for
the whole type. One refinement anywhere inside leaves `p*`, `p?`,
`type :Box(p)` and `abstract p | Float` with no description at all.

**The display name.** Every place that builds a type value also stores a
`name` for messages (`anonymousType`, `refine`, `modifiedType`, `instantiate`
and `unionType` in `src/runtime.ts`). The name is assembled as text:

- The source of a pattern as it was written, in the scope where it was
  written. `type :Box(p)` keeps the local name `p`. Every `T?` is named
  `type T | :None`, the body of the prelude's
  `def (T :: Type)? type T | :None`.
- An element's name followed by a suffix, with no parentheses:
  `Int .where (n -> n > 5 :: Int)` and then `*`.
- Placeholders such as `structural type` and `<predicate>`.

`display` (`src/values.ts`) prints the description when there is one and the
name when there is not. #80 does the same for suggestions, after rewriting
the description as a bare pattern (`typeExpressionText`).

| Suspect | Finding |
| --- | --- |
| Closures in predicates | The cause for every type that contains a refinement. There is no description, so the name is printed. |
| Lost names | A symptom. The name keeps `p`, and the prelude's `T`, from where the pattern was written. It is printed only because the description is missing. |
| Anonymous structural types | Not a cause. Each has a description. Its text evaluates to an equal type, with the two exceptions in the table of kinds below. |
| Recursion | Not a cause. The description exists, and #80 printed it without its constructor. After `::`, `Recursive(...)` alone reads as a constructor named `Recursive`. `:Nil :: Type(Recursive(:Nil \| Cons(Float, Recur(0))))` pastes back today. |
| `Any` | Not a type-expression problem. `Any` is its own expression. `"hi" :: Any` fails because `::` in a value expression takes a concrete or refinement type. See Open choice 6. |

Parentheses alone would not have repaired the refinement suggestions.
Without a description, a type's identity falls back to the session identity
of its predicate closure (`typeIdentity`, `src/type-descriptor.ts`), so each
evaluation of `Int .where (n -> n > (5 :: Int))` is a different type. A
union with member `p*` rejects `[7] :: (Int .where (n -> n > (5 :: Int)))*`
with "value belongs to a different concrete type". Only the name selects the
member: `[7] :: p*`. A refinement needs an identity before any closed
expression can denote it.

## Proposed rule

1. Every type value has a canonical type expression. It is an ordinary
   expression that names no user definition. Evaluated in a fresh scope, it
   yields a type that is `==` to the original. Equal types have the same
   canonical expression.
2. Text printed for a type is a type expression. `toString(Type)` and a
   type-valued result print the canonical one. A message or local text may
   print a shorter one only if it evaluates to an equal type where it is
   printed. A label that is not such an expression is never printed.
3. The expression is built from the type's structure. The expression of
   `T*`, of a field or of an alternative contains the expression of `T`, in
   parentheses where the grammar needs them.

This proposal takes the canonical expression to be the description inside
its kind constructor. That is what `toString(Type)` prints today for every
type that has a description, and what typed value text uses as its `::` tag,
as in `None :: Type(:None | String)`. The proposal keeps that text and makes
it total. Open choice 3 lists the alternative.

## How each kind gets its expression

| Kind | Text on master | Evaluates to an equal type | Under the rule |
| --- | --- | --- | --- |
| Primitive | `Int`, `Any` | Yes | Unchanged |
| List, option, result | `Type([Repeat(Int)])`, `Type(:None \| String)`, `Type(Error(Any) \| Ok(Int))` | Yes | Unchanged |
| Constructor, record, enum, literal union | `Type(Box(Int))`, `Type({w: Int})`, `Type(:Green \| :Red)`, `Type(1 \| 2)` | Yes | Unchanged |
| Declared type, generic instance | Its structure: `Type(Rect(Int, Int))`, `Type(Wrap(Int))` | Yes | Unchanged |
| Abstract union, facet | `UnionType(Float, Int)`, `Facet(Apply(:Rect, OpenFields(...)))` | Yes | Unchanged |
| Recursive | `Type(Recursive(:Nil \| Cons(Int, Recur(0))))` | Yes at the root. No when a type boundary sits inside the binder, as in mutual recursion and `Code` | Open choice 4 |
| Lower-case head, sidefix grammar | `Type(:box(Int))`, `Type(:syntaxSequence(:item, Int))` | No, it is `E_NOT_CALLABLE`. `parse(Type)` reads it | Open choice 4 |
| Refinement | None, it is `E_TYPE_SERIALIZATION` | No text to evaluate | Its base and its predicate |
| Contains a refinement | None, it is `E_TYPE_SERIALIZATION` | No text to evaluate | Composed from its parts |

Three changes complete the table.

- **A refinement gets a description.** It holds the base and the predicate,
  and two refinements are equal when both are equal. Its expression is the
  base's expression and the predicate's expression in the refinement form.
  That form is `Int .where (n -> n > (5 :: Int))` today, and the type-model
  draft keeps it inside the descriptor, as in `Pattern(Int .where nonZero)`.
  The predicate's expression belongs to the function-value records, which
  make a function value a closed definition that compares structurally.
  Open choice 1 proposes a first slice. With it, `==`, `toString(Type)`,
  typed value text and the removal of repeated alternatives start to work
  for types that contain a refinement. Reading a refinement's text with
  `parse(Type)` needs a reader for function text, and stays with the
  type-values record.
- **Printing composes.** `p*` prints the expression of `p` in parentheses and
  then `*`. A description that stands for a type on its own is printed with
  its constructor. The stored name is no longer printed where a type is
  shown: as a result, by `toString`, or as the type in a message.
- **A kind constructor accepts as source what `parse(Type)` accepts.** Two
  forms are good data today but not good source: a type boundary inside a
  recursion binder, and a lower-case constructor head. See Open choice 4.

## Examples

These load on master as written. Plain lines pass there.

```pattern
test "A structural type's text reads back to an equal type"
  def IntList type :Nil | :Cons(Int, IntList)
  u = abstract Int | Float

  assert parse(Type)(toString(Type)(String?)) == String?
  assert parse(Type)(toString(Type)(Int*)) == Int*
  assert parse(Type)(toString(Type)(u)) == u
  assert parse(Type)(toString(Type)(IntList*)) == IntList*
end

test "A recursive type can be written where a type is expected"
  def IntList type :Nil | :Cons(Int, IntList)

  assert Type(Recursive(:Nil | Cons(Int, Recur(0)))) == IntList
  expect
    (x :: IntList) = (:Nil :: Type(Recursive(:Nil | Cons(Int, Recur(0)))))
    x
  is Nil :: IntList
end
```

A refinement expression denotes one type, however often it is evaluated, and
a type that contains a refinement has an expression too.

```pattern
test "A refinement expression evaluates to the same type each time"
  p = Int .where (n -> n > (5 :: Int))

  todo assert p == p
  todo assert (Int .where (n -> n > (5 :: Int))) == p
  todo assert not((Int .where (n -> n > (6 :: Int))) == p)
end

test "A type that contains a refinement has an expression"
  p = Int .where (n -> n > (5 :: Int))

  todo assert (Int .where (n -> n > (5 :: Int)))* == p*
  todo assert (Int .where (n -> n > (5 :: Int)))? == p?
  todo assert (type :Box(Int .where (n -> n > (5 :: Int)))) == (type :Box(p))
end
```

The text of a recursive type evaluates as source wherever `parse(Type)`
reads it.

```pattern
test "A recursive type's expression evaluates across a type boundary"
  def A type :Leaf | :Node(B)
  def B type :Empty | :Some(A)

  assert parse(Type)(toString(Type)(A)) == A
  todo assert Type(Recursive(:Leaf | Node(Type(:Empty | Some(Recur(0)))))) == A
end
```

A type expression written after `::` selects the union member it names.

```pattern
test "A written type expression selects the member it names"
  def IntList type :Nil | :Cons(Int, IntList)
  def FloatList type :Nil | :Cons(Float, FloatList)
  lists = abstract IntList | FloatList
  p = Int .where (n -> n > (5 :: Int))
  u = abstract p* | Float*

  assert
    (x :: lists) = (:Nil :: Type(Recursive(:Nil | Cons(Float, Recur(0)))))
    x .matches FloatList
  end
  todo assert
    (x :: u) = ([7] :: (Int .where (n -> n > (5 :: Int)))*)
    x .matches p*
  end
end
```

## Normalization

Jonathan's rulings on #80
([answers](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6979344843),
[addendum](https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6981505313))
are that repeated alternatives are removed when they are equal type values,
that `pattern :Box(Int) | Box(Int)` is one alternative whose redundant quote
is dropped, and that normalization happens only in the `pattern` and
`struct` macros.

- The canonical expression uses the kind constructor, which keeps what it is
  given. So it reproduces every type exactly, including one that a
  constructor built with its alternatives in another order. On master the
  legacy `Type(...)` constructor still sorts. The approved type-values record
  and the ruling end that, and exactness depends on it.
- A macro form is a second expression for a type that is already normalized,
  which is every type the macros produce: `Type(:A | :B) == (type :B | :A)`.
  A message may print it under rule 2.
- Removing repeats by value needs `==` on every alternative. For a
  refinement that is the same missing identity. On master `type p | p` is
  accepted, prints as `type p | p`, and makes `7` ambiguous.
- A normalized type keeps no record of the quote, so its expression writes
  the constructor head once. Open choice 5 covers the quote.

## Suggestions in #80

The approved [ambiguity record](../approved/ambiguous-values.md) writes each
interpretation as source, `designator :: Type`. Under the rule the type side
is a type expression for the member.

| Member | Printed at `559f397` | Under the rule |
| --- | --- | --- |
| `p*` | `[7] :: Int .where (n -> n > 5 :: Int)*` | `[7] :: (Int .where (n -> n > (5 :: Int)))*` |
| `p?` | `7 :: type T \| :None` | `7 :: (Int .where (n -> n > (5 :: Int)))?` |
| Recursive | `:Nil :: Recursive(:Nil \| Cons(Float, Recur(0)))` | `:Nil :: Type(Recursive(:Nil \| Cons(Float, Recur(0))))` |

The third pastes back today. The first two evaluate today, but they select
the member only once a refinement has an identity. Until then Open choice 2
applies. An `Any` member is Open choice 6.

Two repairs need nothing new, so #80 can make them now: print a description
with its constructor, and stop printing the name. Identity for predicates is
the larger piece.

Every member has a type expression, so every surviving interpretation can be
listed. What remains is the condition the record already sets: pasting a
suggestion selects the interpretation it names. A long expression can fall
back to the count form, which reports only how many interpretations match,
as #80 already does for a long designator.

## Open choices

1. **Identity for predicates.** The rule needs two evaluations of one
   predicate expression to give equal function values. The
   [function-value design](../../design/FUNCTION-VALUES.md) says a function
   value is its closed definition and compares structurally, with no
   alpha-equivalence. No contract yet covers a lambda that is evaluated
   twice. The [libraries draft](overloading-libraries-and-printed-function-values.md)
   leaves the global spelling of a closed predicate open, the
   [function-value test proposal](named-function-value-tests.md) lists
   predicate type reconstruction among the cases that wait for it, and the
   [roadmap](../../ROADMAP.md) places portable predicates in milestone 10.
   - (a) Take a first slice now. A predicate written as a lambda whose body
     names only its parameters, literals and primitives is identified by its
     syntax, and its expression is the parenthesized lambda. That covers
     `n -> n > (5 :: Int)`. A predicate that captures a value, calls a user
     definition or is a named function waits for the function-value work.
   - (b) Wait for the complete function-value representation. No refinement
     has an expression until then.

   I recommend (a). It is the smallest change that makes `p == p`,
   `toString(Type)(p*)` and the suggestions above work.
2. **A predicate that has no expression yet.** Under 1(a) this is a predicate
   outside the first slice. Under 1(b) it is every predicate.
   - (a) Print a name in scope that denotes exactly that type or predicate,
     as the approved
     [local-printing record](../approved/library-closure-and-local-printing.md)
     allows for values: `[7] :: p*`, or `Float .where isNonZero`. With no
     such name, a message uses its count form and `toString(Type)` keeps
     `E_TYPE_SERIALIZATION`.
   - (b) Never print a name. Use the count form and `E_TYPE_SERIALIZATION`
     only.

   I recommend (a). `[7] :: p*` selects the member at #80 today. Either way
   the label is never printed.
3. **Which spelling is canonical, and which shorter ones a message may
   print.**
   - (a) The kind-constructor form is canonical for every type. It is the
     only form that reproduces every type, because the constructors never
     normalize, and it is what `toString(Type)` and typed value text print
     today.
   - (b) The macro form with its sugar is canonical for a normalized type
     (`String?`, `concrete Box(Int)`), and the constructor form for the
     rest.

   I recommend (a), with shorter spellings left to messages. Three of those
   need a yes or no: `T?` and `T*`, which #80 prints; a name in scope that
   denotes exactly the type, which #80 rules out and the type-model draft
   leaves open; and a bare pattern after `::`, as in `Box(3) :: Box(Int)`,
   which #80 also prints. Master accepts a bare pattern there, but on its
   own `Box(Int)` evaluates to a raw term, and the type-model draft lists
   raw patterns in type positions as possible future syntax.
   `Box(3) :: concrete Box(Int)` is an expression and selects the same
   member.
4. **Recursion.** The approved type-values record keeps `Recursive(body)`
   and `Recur(n)` until a separate decision. As source, a kind constructor
   nested inside the binder is evaluated before the binder exists, so the
   text of a mutually recursive type fails with "recursive type reference
   Recur(0) is outside its binder". `parse(Type)` reads the same text, and so
   does the quoted form `Type(:( ... ))`.
   - (a) Keep the spelling. Have a kind constructor read its argument as a
     pattern, as `parse(Type)` does. This also admits a lower-case head such
     as `Type(:box(Int))`.
   - (b) Add a named binder for recursive type expressions.

   I recommend (a). The type-model draft's rule against raw expression
   values would make that reading necessary for every description, because
   `Repeat(Int)` and `Cons(Int, Recur(0))` are raw terms. A third route is a
   block that declares the type under a local name and returns it. It is a
   closed expression only where no equal type is declared. It fails with
   `E_DUPLICATE_TYPE` in the scopes where a suggestion is printed.
5. **The redundant quote.** The ruling is that
   `pattern :Box(Int) | Box(Int)` is one alternative and normalization drops
   the quote. Making the redundant quote an error is the alternative that is
   not decided.
   - (a) Drop it.
   - (b) Report it as an error.

   One fact bears on (b). The quote is redundant only where `Box` names no
   type factory. With `def Box(T :: Type) type :Box(T)` in scope, master
   reads `Box(Int)` as a call, `type :Box(Int) | Box(Int)` has two
   alternatives, and the factory's own body needs the quote. So the error
   would depend on what is in scope, and text printed for such a scope needs
   the quoted head. Removing repeats by value gives the right answer in both
   scopes without an error. I recommend (a).
6. **A member that is abstract.** With `u = abstract Any | String`,
   `(x :: u) = "hi"` is ambiguous at #80 and on master. Both members accept
   the designator, and both would hold the same `"hi" :: String`, because an
   abstract member keeps the value's own type. `"hi" :: Any` is not a value
   expression, and `"hi" :: String` changes nothing. A value that is already
   bound and typed is reported the same way, and so is a value that two
   facets admit.
   - (a) Not ambiguous. When every accepting member would hold the same
     value, bind that value.
   - (b) Reject the union, because one member admits everything another
     admits. The number-literals draft rejects overloads on that ground.
   - (c) Keep the error and print the count form, since no ascription can
     choose.

   The approved ambiguity record calls a designator ambiguous when more than
   one member accepts it, so (a) and (b) amend it. I recommend (a). This is
   a question about ambiguity, not about type expressions.

## How this was checked

Master and #80 were exported to scratch directories at the two commits
above. Every output quoted here came from running the program shown on that
tree. The test blocks were run as one `.test` file on both trees: each plain
line passes, and each `todo` line fails for the reason this proposal gives.
No code was changed.
