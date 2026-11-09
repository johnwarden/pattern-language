# Postfix syntax and conventions

Author clarification, 9 November 2026. This supersedes descriptions of postfix
`?` as a built-in optional type or of optional values as `Some(value)`.

## Syntax

The shifted top-row punctuation `~ ! @ # $ % ^ & *`, and `?`, can be tight
postfix operators. A postfix node has an operand and one punctuation character.
It is distinct from prefix/infix application. Consecutive suffixes wrap outward:
`T**` is `(T*)*`; `String?*^!` is `(((String?)*)^)!`. This decision does not add
`+` as a suffix; the separate nonempty-list proposal remains future work.

Bare type names resolve their type values. A constructor head retains its symbol
identity, including punctuation heads. Types, quotations, binding patterns and
match arms preserve the same prefix/postfix distinction.

The target declaration example is:

```text
type PostfixAt (String)@
type PrefixAt @(String)

(x :: PostfixAt) = "foo"@
(y :: PrefixAt) = @"bar"

expect x == y error "E_INCOMPARABLE_TYPES"
```

Matching `(s :: String)@` against `x` extracts `"foo"`; matching `@(t :: String)`
against `y` extracts `"bar"`. The comparison is between the bound `x` and `y`.
It cannot silently compare just their payloads as if they shared a concrete type.

Bootstrap declarations still use `def Name type ...`. An inline prefix pattern
that would be mistaken for infix syntax can be placed in an indented type body.
The runnable equivalents and transport checks live in
`tests/specification/postfix.test`.

Tight `#` is postfix punctuation; a separated `#` starts a line comment. Strings
keep their own lexical rules. Explicit interpolating quote prefixes such as
``Code$` ``, `$"..."` and `$'...'` retain their quotation meaning.

## Definitions supply meaning

Postfix punctuation has no universal optional, error, action or lifting meaning.
A source definition can supply an operation; without a matching definition, the
syntax can describe a distinct postfix construction. Prefix and postfix
definitions occupy separate callable namespaces and use the ordinary parameter
matcher. The reader and shared matcher do not contain an optional-`?` case.
The bootstrap retains its existing list `T*` and result `T^` type conventions;
those compatibility rules are separate from the source-defined optional convention.

The optional convention is this target definition:

```text
type T? concrete T | :None
```

The bootstrap source prelude expresses it with the existing type-construction
spelling:

```text
def (T :: Type)? type T | :None
```

It is a source-level convention, available to the ordinary definition machinery.
The interpreter accepts an empty or alternative source prelude for embeddings.
Present optional values are unwrapped: `4 :: Float?` is present and
`:None :: Float?` is absent. Neither `4?` nor `Some(4)` is the optional value
constructor. Other source libraries can define other postfix operations.

## Nested concrete unions

Designation first preserves an explicitly identified immediate member. For raw
data, a matching arm at the current concrete boundary takes precedence over a
path requiring inward designation. Recursive designation is attempted when no
arm matches directly. Multiple equally applicable paths remain ambiguous;
source order never chooses between peer branches.

For `Float??`, this distinguishes outer and inner absence:

```text
(outer :: Float??) = :None
(sameOuter :: Float??) = :None :: Float??
(inner :: Float??) = :None :: Float?
```

`outer` and `sameOuter` are equal. `inner` carries the `Float?` member and is
different from `outer`. The inner annotation must survive matching, comparison
and typed text round trips. Both expression ascription and an annotated binding
use the same designation rule.

When neither arm matches directly, member evidence is necessary:

```text
type MyType concrete String? | Float?
(x :: MyType) = :None :: String?
```

Here `x` retains the `String?` branch. Bare `:None` is ambiguous between the two
inward paths. `:None :: String` is invalid because String does not contain None.
The bootstrap equivalent declares `def MyType type String? | Float?`.

Designation may introduce a justified boundary. Projection removes one boundary
and remains explicit in match arms. Bindings, dispatch, defaults and predicates
do not inherit projection merely because matching is in progress.

## Future lifting

The author intends to use postfix syntax for lifting operators later. These are
target examples, not implemented lifting behavior:

```text
(present :: Float?) = 4
(absent :: Float?) = :None

expect sqrt?(present) result 2 :: Float?
expect sqrt?(absent) result :None :: Float?
```

The examples use separate inputs. They do not require the same deterministic
call on 4 to return both 2 and None. Lifting signatures, multiple packs and
arguments, domain-error behavior and effects remain unspecified. Supporting
postfix syntax and the optional convention does not complete this work.
