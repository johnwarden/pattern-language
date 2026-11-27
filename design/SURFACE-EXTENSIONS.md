# Surface syntax and grammar extension contracts

These are accepted design requirements. The implementation status of each slice is
tracked in ROADMAP.md; examples here do not imply that the bootstrap implements it.

## Postfix expressions and conventions

[POSTFIX.md](POSTFIX.md) is the authoritative postfix contract, including the
9 November clarification. Shifted top-row punctuation `~ ! @ $ % ^ & *`, plus
`?`, has distinct postfix syntax. `#` is a comment, not a postfix operator.
Each suffix wraps once. Prefix and postfix application remain different trees
throughout matching and transport. Prefix and postfix operators must touch their
operand. Prefix `-(a)` negates; infix `-(a)(b)` subtracts.

Optional `T?` is the source-defined convention `concrete T | :None`; it is not a
reader or matcher primitive. Nested unions preserve explicitly designated member
boundaries and prefer a direct arm before recursive designation. Future lifting,
such as `sqrt?`, is separate work. The source prelude and runnable tests use the
bootstrap declaration syntax; target `type ... concrete ...` spelling remains
part of the declaration milestone.

`T+` nonempty-list semantics and keyword remainder capture/spread remain future
work. Each repeated collection dimension still requires its explicit list layer;
vertical repetition still requires `...`.

## ASCII word-symbol classes

The classes are LowerCamelSymbol, UpperCamelSymbol and UpperSnakeSymbol. Word
symbols use ASCII; strings remain Unicode. General Unicode capitalization/conversion
rules are deferred. Trailing underscores distinguish the one- and two-letter upper-snake names from
upper-camel names. PORT is UpperSnake, with port / Port as its camel equivalents. The possible constant /
environment-variable role of UpperSnake is not decided by lexical classification.

| Lower camel | Upper camel | Upper snake |
| --- | --- | --- |
| a | A | A_ |
| ab | Ab | AB_ |
| aB | AB | A_B |
| aBc | ABc | A_BC |
| abC | AbC | AB_C |
| abCd | AbCd | AB_CD |

Conversions must use explicit word boundaries, not acronym guessing. The table is
the contract for letter-only names; digit-boundary conversion rules remain work.
Lower snake and kebab classes are not introduced by this change.

## Typed macros and preparation environments

[Typed macro expansion and lexical capture](../specs/macro-expansion.md)
specifies explicit registration, structural selection and preparation environments.
It also proposes contextual operand checking and a source definition of the
expression arrow.

## Unquoted DSL syntax in Code

An established expected type may select a DSL grammar for unquoted source. Bindings,
arguments and return positions must use the same expected-grammar elaboration rule.
Field expressions evaluate normally; dollar holes are for quotations, not ordinary
variable references. No expected grammar means no arbitrary selection among DSLs.

```text
def MyDsl type (:do String :with String)
x = MyDsl` do "Foo" with "bar"
name = "bar"
(y :: MyDsl) = do "Foo" with name
assert x == y
expect toString(MyDsl)(x) is 'do "Foo" with "bar"' :: String
```

Keep :do and :with quoted in pattern declarations to distinguish fixed keywords
from captures. The values and their grammar-directed canonical text omit those
colons. Supporting this requires expected-grammar propagation and field-expression
evaluation; a special parser case for annotated bindings would be insufficient.

The bootstrap implements the single-line String-field slice for annotated bindings
and uniquely known callables (named functions, later curried packs, and
closure-valued variables). Canonical `toString :: String`, return positions,
indented expected-type layout and further Code categories remain later work.

## Test setup alternatives

Assertions retain their existing todo / legacy behavior. Setup bindings and
definitions can also carry the modifiers:

```text
legacy def Color type :Black | :White
todo type Color concrete :Black | :White
```

Legacy setup installs the current binding. Its adjacent todo replacement is tried
in isolation from the same incoming scope, so a duplicate-name error cannot keep
an implemented replacement marked todo forever. Failed todo setup is silent; a
successful replacement fails with a request to remove todo. It does not overwrite
the legacy binding or supply evidence/bindings to subsequent checks. Malformed file
syntax and host errors remain real failures. Recursive declaration alternatives
must be tried as complete groups. These semantics need explicit runner support;
ordinary assertion isolation alone is not sufficient. This support is implemented
by the source-defined setup wrappers and external runner; see TEST-SUITE.md.
