# Surface syntax and grammar extension contracts

These are accepted design requirements. The implementation status of each slice is
tracked in ROADMAP.md; examples here do not imply that the bootstrap implements it.

## Postfix expressions and type names

Postfix application is a distinct surface-tree form, alongside ordinary application
and sidefix sequences. Every postfix punctuation symbol uses the same type-name /
constructor-head rule. A bare name resolves its type binding; a constructor head
retains its symbol identity. No colon is needed just because a head is punctuation.
Type definitions, quotation, binding patterns and match patterns share this tree.

```text
type Question String?
q = "Does this actually work"? :: Question
expect q result "Does this actually work"? :: Question
match q (s :: String)?
expect s result "Does this actually work" :: String
```

Tight postfix punctuation is one symbol per character. Each suffix wraps the
expression immediately to its left: String?*^! is (((String?)*)^)!, or an action
returning a fallible result of a list of optional strings. T** is (T*)* and not a
new two-character postfix operator. Prefix punctuation still forms maximal symbols.
The surface reader recognizes ... and bare ** markers; their repetition/openness
meaning belongs to interpretation. Keyword remainder capture/spread remains later
work and cannot silently change this suffix rule. Effects are still deferred.

T+ denotes a nonempty list, refining T* without creating a new concrete list space.
Vertical repetition remains explicit; a list annotation alone is not row repetition:

```text
def TestFileContent type
  tests :: Test+
  ...
end
```

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

A grammar type describes a macro's input. An ordinary function
expandMacro(env)(statement) transforms that typed input into Code. Defining the
function alone does not install a macro: registration remains explicit. Registered
input grammars may describe sidefix, application, body or annotation forms; this
intentionally expands beyond the bootstrap's sidefix-only macro restriction.

LexicalEnvironment is a read-only preparation environment. It exposes binding types
and compile-time information, not unrestricted runtime values. Keep source spans
and hygiene when projecting typed inputs. Select structurally, then validate
environment-dependent constraints; a failed predicate does not select a fallback
expander. Environment-dependent types initially belong to preparation, with no
promise of portable runtime environment/refinement serialization.

```text
type BooleanExpression(env :: LexicalEnvironment) refinement
  (expression :: Expression) env.typeOf(expression) is Bool
end
def expandMacro(env :: LexicalEnvironment)(:unless (condition :: BooleanExpression(env)) (body :: Body))
  Code$` if($condition, $zeroValue, $body)
end
```

This sketch does not define zeroValue or choose a new registration spelling.
Diagnostics should identify the failing operand, expected contextual type, inferred
type, macro/grammar name and source location. For example, a String condition in
unless should report expected BooleanExpression / Bool and received String, rather
than only saying that the entire form failed to match.

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
expect toString(MyDsl)(x) result 'do "Foo" with "bar"' :: String
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
