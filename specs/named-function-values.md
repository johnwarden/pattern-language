# Named functions evaluate to closed function values

A name with one function definition evaluates to a value that can be stored,
passed, returned or partially applied. An overloaded name evaluates to its visible
group as a first-class value: `saved = f` captures that group with no ascription
required. Each closed function carries its implementation and the transitive values,
functions, types and accessors it uses. The same closing rules apply to lambdas and
named functions.

## Closed function values

This language is pure. Its values are inert data and always have a representation. A function
value stores parameter patterns and an inert body. Calling the value matches its
argument packs and evaluates the body. A function may capture any language value.

The proposed concrete type is:

    type FunctionValue struct FunctionValue((args :: ArgPack<Pattern>)...)(body :: Body)

Each input pack uses the parameter-pattern grammar and retains its binders,
labels, rests and defaults. The `->` macro replaces free references with
their lexical values. It inserts typed value data, preserving concrete types
and annotations where needed. Parameter and local binders keep their scope.
Quoted names remain syntax data. Defaults stay inert until the call selects
them.

Global function text is ordinary type-directed constructor text.
`parse(FunctionValue)` reads each argument pack through its declared
parameter-pattern type and the last field through `Body`. The result contains
those patterns and that body as data. Reading the body leaves it inert until
the function is called.

Closing includes referenced implementations and resolves references in parameter
patterns, defaults and the body. Ordinary prelude and library dependencies follow
this rule. The fixed primitive vocabulary is available to every closed value.
A recursive group uses finite local bindings. One candidate representation puts
both declarations in the stored `Body`, where they bind each other.

    FunctionValue(n :: Int)(
      def evenImpl(k :: Int) if k == (0 :: Int) True else oddImpl(k - (1 :: Int))
      def oddImpl(k :: Int) if k == (0 :: Int) False else evenImpl(k - (1 :: Int))
      evenImpl(n)
    )

This shows the fields of `even`. The fields of `odd` are identical except for
the final expression `oddImpl(n)`. The bodies have different entry expressions.
The declarations use the ordinary scope rules for code stored as `Body`.

## Function types

`T => U` denotes an abstract type whose members are function values. Initially,
`=>` constructs that abstract type directly. It requires the function's normalized input
pack patterns to equal the normalized input patterns `T` and requires evidence
that the body produces results matching `U` under those bindings. The check uses
type information and does not execute the body. A simple `Int => String`
describes one input pack containing an `Int` and a `String` result. Successive
argument packs retain their boundaries. The proposed signature form describes
both sides as sequences of `ArgPack<Pattern>`.

Signature normalization is independent of the spelling of capture binders.
The concrete value retains those binders so the body can use them. Once
user-defined refinement predicates can express the same checks, the abstract
type can be described as a refinement of `FunctionValue` over the normalized
input packs and the body's checked result. A checked result annotation can
supply that evidence.

## Static overload groups

A name's group includes all its declarations in the same lexical scope,
regardless of their placement relative to uses. Entering another scope can
change the visible group through shadowing. Declaration order plays no role
in selecting a candidate. If several alternatives qualify equally, dispatch
reports ambiguity.

Binding `saved = f` captures all of `f`'s declarations in that scope,
including ones spelled later, as one `PolymorphicValue`. No ascription is
required. An annotation on a receiving binding or parameter can still supply an
expected type that designates one alternative from the group.

`PolymorphicValue` stores its typed alternatives as positional fields of one
argument pack. For two overloaded constants, the value can be
`PolymorphicValue("Hello" :: String, 5 :: Int)`. For overloaded functions the
alternatives are closed callable clauses. Only the interpreter or compiler forms
these values from overloaded names; they always emit a normalized field order.
A hand-written constructor keeps the author's order.

### Why groups are values

Capturing a group as a value lets a program store, pass, return or serialize
a choice to be made later. The receiver gets the same alternatives and their
closed dependencies, even after leaving the original scope.

    def pick(key :: String)(value :: Int) key
    def pick(key :: String)(value :: String) value

    x = pick("key")
    x(2 :: Int)   # "key"
    x("value")   # "value"

`pick("key")` applies one pack and returns a partial application containing
both remaining clauses and the binding `key = "key"`. A plain assignment
stores that result. The caller can finish the application later, once it has
the second pack. Binding `saved = pick` captures the bare name's whole group
before any packs are supplied.

## Designation and dispatch

A bare overloaded name used where a whole value is wanted yields its
`PolymorphicValue` group. For example, `saved = f`, `(saved :: Any) = f` and
`toString(Any)(f)` capture or print that group. An expected type that admits
one alternative can still designate from the group: for `(s :: String) = f`,
the alternatives of `f` can designate a `String` value, just as `5` can
designate an `Int` in `(n :: Int) = 5`. An expected function type can select
one matching callable clause the same way. If several alternatives remain
eligible for that expected type, report `E_AMBIGUOUS_VALUE_DESIGNATOR`.

A captured or partially applied `PolymorphicValue` is an ordinary value. A
binding, argument or printer whose expected type directly admits the whole
value receives it as-is. In a typed context that needs an alternative,
designation can still select from the stored candidates.

Calls through a stored group use the same argument-pack matching, literal
designation, selection and diagnostics as direct calls with that group visible.
An application with no applicable callable reports `E_NO_METHOD`.
Ambiguous literal designation follows the ordinary call rules.

Overloads must have disjoint domains for complete sequences of argument
packs and satisfy the [shared-prefix rule](#overlapping-packs-that-would-finish-and-continue).
A subsequent application to a group considers its callable alternatives.

## Equality and printing

Function equality compares closed representations structurally after normalizing
**capture binders** only. Call-visible labels and accessor names stay verbatim.
Rest capture names are capture binders, not call labels: `xs...` in
`def f(xs... :: Int*) [xs...]` normalizes like any other binder, so
`def f(xs... :: Int*) [xs...]` equals `def f(ys... :: Int*) [ys...]`. When a rest
has a call-visible label separate from its binder, that label stays verbatim and
only the binder renames. A parameter such as `width: Int` is both a call label
and a default capture; normalization renames only the capture, yielding
`width: arg1 :: Int`, not `arg1: Int`. Expanded printing writes that explicit form
rather than the default-capture sugar. Bound capture variables become positional
forms such as `arg1`, `arg2`, …. Two aliases of the same value compare equal.
Definitions that differ only in capture-binder spelling are equal
(alpha-equivalence). Definitions that differ in labels remain unequal: they
accept different call labels and must not compare equal or print identically.
Different implementations can give the same answers and still compare unequal.
An arrow type already compares normalized parameter patterns with capture binders
erased; function values now follow the same capture-binder policy while retaining
call-visible labels. Justification: capture names are local spelling, not part of
the callable's meaning; labels are part of identity because calls use them.

Expanded printing (no exact local alias) uses those same normalized capture
binders, so alpha-equivalent values print identically and capture-binder spelling
is not observable through equality or printing. Number binders in source order
outer to inner: each successive parameter-pack capture (including rest captures)
and each nested-lambda capture takes the next unused index (`arg1`, `arg2`, …).
A rebinding that shadows an outer name still gets a fresh index; references in
the body use the index of the binder they resolve to. When assigning `argN`
spellings, skip any index whose spelling is already used as an exact-alias local
name in that printed text, so an alias spelled `arg1` cannot capture a binder
reference. Local text may still abbreviate a function value with a visible name
that resolves to the same closed value. A binding that already holds a
`PolymorphicValue`, or a bare overloaded name that denotes that exact group, can
be such an alias. If several names qualify, choose the first in lexical order by
spelling. A name that denotes a different value in a nested scope is ineligible.
Global text carries the closed value for a reader in a fresh scope. See
[library-closure-and-local-printing.md](library-closure-and-local-printing.md).

Destructuring a callable through the shared pattern/typed-code model exposes
parameter patterns and Body in this same normalized form. Source capture-binder
spelling is not recovered from inspection; call-visible labels and accessor names
remain as in the closed value.

## Internal content keys

Implementations may replace embedded free-variable definitions inside closed
function values and types with evaluator-internal content keys (hashes), and
keep a cache that recovers the definition from the key. Keys are computed from
the same normalized closed structure that equality uses, so they line up with
alpha-equivalence. Treat key comparison as a one-way filter: different keys
mean unequal; equal keys still confirm with a structural comparison, covering
hash collisions. Recursive and mutually recursive groups share keys without
infinite expansion. Overload groups keep name/scope identity and positional
`PolymorphicValue` equality; keys apply to closed clause bodies and captured
dependencies, not as a substitute for the group snapshot from `saved = f`.

This matches the type definition cache idea:
`typeIdentity` / `descriptionKey` and `Interpreter.types` in the TypeScript
bootstrap (`src/type-descriptor.ts`, `src/type-data.ts`, `src/runtime.ts`).
Type keys already erase declaration and capture names; function keys normalize
capture binders the same way for equality and caching.

When printing, if a visible local name denotes a binding whose content key
equals the dependency's key, use that name under the exact-alias rule. Hashes
never appear in public text.

### Decided: normalize capture binders before hashing

**Decided** (with the equality and printing rules above). Before hashing,
normalize capture binders to positional forms `arg1`, `arg2`, … outer to inner
by binder position, including rest captures and nested lambdas. Call-visible
labels stay verbatim. Alpha-equivalent functions therefore share a key, matching
public equality and expanded printing. (An earlier draft left argN renaming as a
decision against observable binder spelling; that choice is settled here as
capture-binder alpha-equivalence.)

### Future directions (Unison-inspired caching)

[Unison's content-addressed codebase](https://www.unison-lang.org/docs/the-big-idea/)
motivates stronger caching once definitions have stable content keys:

> Thus, we can parse and typecheck definitions once, and then store the results
> in a cache which is never invalidated.

> This idea also applies to caching test results for pure computations
> (deterministic tests that don't use I/O). There's no need to rerun a
> deterministic test if none of its dependencies have changed!

Those are future directions for the evaluator and test runner, not current
requirements. Content addressing could also pin imported libraries: a future
package manager might write lockfiles of hashes, still needing release or
revision numbers, or a local cache that holds the actual content. See
[library-closure-and-local-printing.md](library-closure-and-local-printing.md)
for exact external referents and closed portable text.

A public Unison-style codebase-as-database is out of scope. Source remains
editable text; keys stay evaluator-internal unless a later decision publishes
them.

## Overload representation and open decisions

Fenced tests mark behavior pending implementation with `todo`.

### Canonical overload order

When the interpreter or compiler forms a `PolymorphicValue` from a declaration
group or from application results, it sorts alternatives lexicographically by
their global typed text. Closed alternatives have finite text, including
recursive references. That order stabilizes representation and printing.
Dispatch selects candidates independently of order.

Hand-written `PolymorphicValue(...)` keeps the author's field order.

```pattern
todo test "Reordered overload declarations produce the same captured group"
  def forward()
    def f :: String "Hello"
    def f :: Int 5
    f
  end
  def backward()
    def f :: Int 5
    def f :: String "Hello"
    f
  end

  (s :: String) = forward()
  (t :: String) = backward()
  expect s is "Hello"
  expect t is "Hello"
  assert forward() == backward()
  assert toString(PolymorphicValue)(forward()) == toString(PolymorphicValue)(backward())
end
```

### Group equality

`PolymorphicValue` uses ordinary positional structural equality of its typed
alternatives. The interpreter or compiler is the only producer of these values
from overloaded names and always emits the normalized order, so captured groups
compare equal after reordering declarations. A hand-written
`PolymorphicValue(...)` with permuted fields compares unequal; that is
accepted. Closed function clauses inside a group compare under alpha-equivalence
as above.

```pattern
todo test "Group equality compares the typed alternatives in their stored positions"
  left = PolymorphicValue("Hello" :: String, 5 :: Int)
  copy = PolymorphicValue("Hello" :: String, 5 :: Int)
  right = PolymorphicValue(5 :: Int, "Hello" :: String)

  assert left == copy
  assert not(left == right)
  assert parse(PolymorphicValue)(toString(PolymorphicValue)(left)) == left
end
```

### Capture-binder spelling in function equality

```pattern
todo test "Alpha-equivalent functions compare equal"
  def first(x :: Int) x
  def same(x :: Int) x
  def renamed(y :: Int) y

  assert first == same
  assert first == renamed
end
```

```pattern
todo test "Labeled parameters keep labels under alpha-equivalence"
  def f(width: Int) width
  def g(height: Int) height
  def renamed(width: w :: Int) w
  def sameLabel(width: v :: Int) v

  assert not(f == g)
  assert not(toString(FunctionValue)(f) == toString(FunctionValue)(g))
  assert renamed == sameLabel
end
```

```pattern
todo test "Rest capture binders normalize under alpha-equivalence"
  def f(xs... :: Int*) [xs...]
  def g(ys... :: Int*) [ys...]

  assert f == g
  assert toString(FunctionValue)(f) == toString(FunctionValue)(g)
end
```

```pattern
todo test "Alpha-equivalent functions print with the same normalized binders"
  def first(x :: Int) x
  def renamed(y :: Int) y
  def two(a :: Int, b :: String) a
  def twoRenamed(p :: Int, q :: String) p
  def nested(x :: Int)
    (y :: Int) -> x + y
  end
  def nestedRenamed(a :: Int)
    (b :: Int) -> a + b
  end
  def shadow(x :: Int)
    def inner(x :: Int) x
    inner
  end
  def shadowRenamed(a :: Int)
    def inner(b :: Int) b
    inner
  end

  assert toString(FunctionValue)(first) == toString(FunctionValue)(renamed)
  assert toString(FunctionValue)(two) == toString(FunctionValue)(twoRenamed)
  assert toString(FunctionValue)(nested) == toString(FunctionValue)(nestedRenamed)
  assert toString(FunctionValue)(shadow) == toString(FunctionValue)(shadowRenamed)
  expect toString(FunctionValue)(first) contains "arg1"
  expect toString(FunctionValue)(two) contains "arg1"
  expect toString(FunctionValue)(two) contains "arg2"
  expect toString(FunctionValue)(nested) contains "arg2"
  expect toString(FunctionValue)(shadow) contains "arg2"
end
```

```pattern
todo test "Normalized binder spelling skips an argN already used as an alias"
  def helper(n :: Int) n
  arg1 = helper
  def uses(x :: Int) helper(x)
  expect toStringLocal(FunctionValue)(uses) is "FunctionValue(arg2 :: Int)(arg1(arg2))"
end
```

### Arrow types and captured groups

Recommended. An arrow type describes a single callable. In
`(g :: (Int => String)) = saved`, when `saved` contains both an
`Int => String` clause and a `String => String` clause, designation binds
`g` to the Int clause. `saved` still contains both clauses. A union that
admits both clauses produces an ambiguity error for that binding.

```pattern
todo test "An arrow type selects one clause from a captured group"
  def f(x :: String) "string"
  def f(x :: Int) "int"
  saved = f

  (g :: (Int => String)) = saved
  expect g(2 :: Int) is "int"
  expect g("x") fails "E_NO_METHOD"
  expect saved("x") is "string"

  expect
    (either :: ((Int => String) | (String => String))) = saved
    either
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end
```

### Overlapping packs that would finish and continue

Two overloads must accept disjoint sets of complete argument-pack sequences.
In addition, reject the declarations if any sequence of packs completes one
overload and is an accepted proper prefix of the other. The checker reports
`E_OVERLAPPING_OVERLOAD` at the declaration. A clause completes when it
receives its final declared pack, including when its result is itself callable.

For example, `def pick(key :: String) "done"` and
`def pick(key :: String)(value :: Int) "later"` share a one-pack sequence that
completes the first clause while the second still expects another pack.
The complete sequences have different lengths, and the shared-prefix rule
rejects the pair.

Two clauses may share a prefix when both still expect another pack and
their complete domains are disjoint. Different pack counts may coexist
when the initial packs they accept are disjoint. The rule applies to
overload declarations only. A stored `PolymorphicValue("done", callable)`
still supports ordinary designation and callable selection. This extends
the disjointness rule used for overloads and match arms, and avoids groups
that mix completed values with callables, which would require evaluating a
completed body when forming the group.

```pattern
test "A completing clause may not share its final pack with a continuing overload"
  expect
    def pick(key :: String) "done"
    def pick(key :: String)(value :: Int) "later"
    "defined"
  fails "E_OVERLAPPING_OVERLOAD"
end
```

```pattern
test "A clause returning a callable still completes at its declared final pack"
  expect
    def pick(key :: String)
      (value :: Int) -> "done"
    end
    def pick(key :: String)(value :: Int) "later"
    "defined"
  fails "E_OVERLAPPING_OVERLOAD"
end
```

```pattern
test "Different pack counts can coexist with disjoint initial packs"
  def pick(key :: String) "done"
  def pick(key :: Int)(value :: String) value

  expect pick("key") is "done"
  expect pick(2 :: Int)("later") is "later"
end
```

### Predicate names in refinements

In `T .where isNonZero`, the bare name designates the `Predicate` enum case.
Reading the type's text in a scope with a local function named `isNonZero`
recovers the same descriptor. The [predicate enum spec](https://github.com/johnwarden/pattern-language/blob/spec/type-expressions-and-kinds/specs/refinement-predicates.md)
defines the current operand type. The [portable-predicate draft](https://github.com/johnwarden/pattern-language/blob/spec/portable-refinement-predicates/specs/refinement-predicates-portable.md)
describes a future explicit operand for a closed function.

```pattern
todo test "A bare .where name designates the Predicate enum despite a local callable"
  def isNonZero(n :: ExactRational) False

  type NonZero pattern ExactRational .where isNonZero
  text = toString(Type)(NonZero)
  restored = parse(Type)(text)
  assert restored === NonZero
  expect text contains "isNonZero"
  assert (1 :: ExactRational) .matches NonZero
  assert not((0 :: ExactRational) .matches NonZero)
end
```

## Fresh-interpreter contract

Use two independent interpreters with the same primitives. In the first,
create `original = makeShift(3 :: Int)` using the fixture below and serialize it
with `toString(FunctionValue)(original)`. In the second, bind `offset = 100 :: Int`
and parse only the serialized text as a `FunctionValue`. Assert structural
equality with the original, that the reconstructed value maps `2 :: Int` to
`5 :: Int`, and that printing it again produces the same global text. The
host round-trip suite can supply the independent interpreters. The source test
below checks the round trip under a conflicting lexical binding.

## Executable contracts

```pattern
test "A named function can be stored and invoked as a value"
  def square(n :: Int) n * n

  todo expect
    f = square
    f(3 :: Int)
  is 9 :: Int
end

test "A named function can be passed and returned as a value"
  def square(n :: Int) n * n
  def apply(f, n :: Int) f(n)
  def getSquare() square

  todo expect apply(square, 4 :: Int) is 16 :: Int
  todo expect getSquare()(5 :: Int) is 25 :: Int
end

test "Named function values retain captured values across caller shadowing"
  offset = 3 :: Int
  def shift(n :: Int) n + offset
  def invoke(f, offset :: Int) f(2 :: Int)

  todo expect invoke(shift, 100 :: Int) is 5 :: Int
end

test "Named function values retain transitive referenced definitions"
  def twice(n :: Int) n * (2 :: Int)
  def step(n :: Int) twice(n) + (1 :: Int)
  def calculate(n :: Int) step(n)
  def invoke(f)
    def twice(n :: Int) n * (100 :: Int)
    def step(n :: Int) 999 :: Int
    f(3 :: Int)
  end

  todo expect invoke(calculate) is 7 :: Int
end

test "Named function values retain a finite mutually recursive group"
  def even(n :: Int) if n == (0 :: Int) True else odd(n - (1 :: Int))
  def odd(n :: Int) if n == (0 :: Int) False else even(n - (1 :: Int))

  todo assert
    f = even
    f(8 :: Int)
  end

  todo assert
    f = even
    not(f(9 :: Int))
  end
end

test "Named function values preserve successive argument packs"
  def add(x :: Int)(y :: Int) x + y

  todo expect
    f = add
    partial = f(2 :: Int)
    partial(3 :: Int)
  is 5 :: Int
end

test "Named function values preserve labeled parameter binders"
  def join(first: String, second: String) first + ":" + second

  todo expect
    f = join
    f(second: "b", first: "a")
  is "a:b" :: String
end

test "Named function values preserve rest capture binders"
  def collect(xs... :: Int*) [xs...] :: (struct [_... :: Int*])

  todo expect
    f = collect
    f(1 :: Int, 2 :: Int, 3 :: Int)
  is [1, 2, 3] :: (struct [_... :: Int*])
end

test "Closing a named function does not evaluate unused defaults"
  def choose(value: Int = (1 / 0)) value

  todo expect
    f = choose
    f(value: 8)
  is 8 :: Int
end

test "Named function defaults retain their captured values"
  fallback = 3 :: Int
  def choose(value: Int = fallback) value
  def invoke(f, fallback :: Int) f()

  todo expect invoke(choose, 100 :: Int) is 3 :: Int
end

test "A returned named function retains a departed scope's captured value"
  def makeShift(offset :: Int)
    def shift(n :: Int) n + offset
    shift
  end

  todo expect
    f = makeShift(3 :: Int)
    f(2 :: Int)
  is 5 :: Int
end

test "A returned named function retains local type and accessor definitions"
  def makeReader()
    type Box struct Box(value :: Int)
    def read(box :: Box) box.value
    read
  end

  todo expect
    f = makeReader()
    f(Box(3))
  is 3 :: Int
end

test "Aliases of one named function value preserve identity"
  def identity(n :: Int) n

  todo assert
    f = identity
    g = f
    f == g
  end
end

test "Different implementations do not become equal from equivalent behavior"
  def unchanged(n :: Int) n
  def addZero(n :: Int) n + (0 :: Int)

  todo assert
    f = unchanged
    g = addZero
    not(f == g)
  end
end

test "Stored overloads use the same argument designation and dispatch"
  def f(x :: String) "string"
  def f(x :: Int) "int"

  expect f("x") is "string"
  expect f(2) is "int"
  expect f(True) fails "E_NO_METHOD"

  todo expect
    saved = f
    saved("x")
  is "string"
  todo expect
    saved = f
    saved(2)
  is "int"
  todo expect
    saved = f
    saved(True)
  fails "E_NO_METHOD"
  todo assert
    saved = f
    saved .matches PolymorphicValue
  end
end

test "A stored function survives shadowing of its original name"
  def f(x :: String) "outer"

  def invoke(saved)
    f = (_ -> "inner")
    replacement = f
    if replacement("x") == "inner" saved("x") else "shadow failed"
  end

  expect f("x") is "outer"
  expect invoke(_ -> "control") is "control"
  todo expect
    saved = f
    invoke(saved)
  is "outer"
end
```

```pattern
todo test "A saved overload group includes all declarations in its scope"
  def f(x :: String) "string"
  saved = f
  def f(x :: Int) "int"

  expect f(2 :: Int) is "int"
  expect saved("x") is "string"
  expect saved(2 :: Int) is "int"
end
```

```pattern
todo test "A bare overloaded name captures and prints through Any"
  def f(x :: String) "string"
  def f(x :: Int) "int"

  (saved :: Any) = f
  assert saved .matches PolymorphicValue
  text = toString(Any)(f)
  restored = parse(Any)(text)
  assert restored .matches PolymorphicValue
  expect restored("x") is "string"
  expect restored(2 :: Int) is "int"
end
```

```pattern
todo test "Static overloaded constants designate through an expected type"
  def f :: String "Hello"
  saved = f
  def f :: Int 5
  def passThrough(x :: Any) x

  assert saved .matches PolymorphicValue
  (s :: String) = f
  (n :: Int) = saved
  expect s is "Hello" :: String
  expect n is 5 :: Int

  (stored :: Any) = passThrough(saved)
  text = toString(Any)(stored)
  restored = parse(Any)(text)
  assert restored .matches PolymorphicValue
  (restoredString :: String) = restored
  (restoredInt :: Int) = restored
  expect restoredString is "Hello" :: String
  expect restoredInt is 5 :: Int
  assert toString(Any)(restored) == text
end
```

```pattern
todo test "An expected function type can select one overload"
  def f(x :: String) "string"
  def f(x :: Int) "int"
  def invoke(g :: (Int => String)) g(2 :: Int)

  expect invoke(f) is "int"
  expect
    (g :: ((Int => String) | (String => String))) = f
    g
  fails "E_AMBIGUOUS_VALUE_DESIGNATOR"
end
```

```pattern
todo test "A partial application stores all pending overloads and earlier bindings"
  def pick(key :: String)(value :: Int) key
  def pick(key :: String)(value :: String) value
  expect pick("key")(2 :: Int) is "key"
  expect pick("key")("value") is "value"

  x = pick("key")
  expect x(2 :: Int) is "key"
  expect x("value") is "value"

  saved = pick
  fromSaved = saved("other")
  expect fromSaved(2 :: Int) is "other"
  expect fromSaved("value") is "value"
end
```

```pattern
todo test "Global function text retains a capture under a conflicting binding"
  def makeShift(offset :: Int)
    def shift(n :: Int) n + offset
    shift
  end
  def restore(text, offset :: Int) parse(FunctionValue)(text)

  original = makeShift(3 :: Int)
  printed = toString(FunctionValue)(original)
  restored = restore(printed, 100 :: Int)

  assert restored == original
  expect restored(2 :: Int) is 5 :: Int
end
```

```pattern
todo test "Local function text chooses the first exact visible alias by name"
  def square(n :: Int) n * n
  beta = square
  alpha = square

  expect toStringLocal(FunctionValue)(square) is "alpha"
  assert parseLocal(FunctionValue)("alpha") == square
end
```
