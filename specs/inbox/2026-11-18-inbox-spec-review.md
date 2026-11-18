# Review of the inbox spec drafts

> Status 2026-11-18: Jonathan deprecated #77 and #78 (closed unmerged) and closed #82. His answers on #80 are in https://github.com/johnwarden/pattern-language/pull/80#issuecomment-6979344843. The new draft `refinement-evidence.md` arrived after this review and isn't covered here.

None of the eight drafts in `specs/inbox/` is ready to approve as written. `arithmetic-precedence.md` is closest: its rules are consistent and its cases are precise, so it needs edits and confirmation of three consequences. The other seven need decisions from Jonathan first, and the type-model draft is furthest away.

I posted nothing to GitHub, because the drafts were committed directly to master and no PR adds them. I changed nothing in the repository.

The review is of master at [`90b9377`](https://github.com/johnwarden/pattern-language/commit/90b9377). Three things changed while I worked, so parts of the brief are out of date:

- [#79](https://github.com/johnwarden/pattern-language/pull/79) was closed unmerged at 16:03 UTC today. One minute earlier, `90b9377` moved its ordering cases into the fixed-precision draft as value-based contracts and reversed its `==` cases.
- [#80](https://github.com/johnwarden/pattern-language/pull/80) was force-pushed to [`559f397`](https://github.com/johnwarden/pattern-language/commit/559f397) and now implements the renamed `E_AMBIGUOUS_VALUE_DESIGNATOR`, matching [`e3921e8`](https://github.com/johnwarden/pattern-language/commit/e3921e8).
- `specs/inbox/type-values-and-wrapping.md`, the second 12 November draft the earlier review named, is not in the tree or in any reachable history. The 17 November type-model draft covers that ground. The fixed-precision draft no longer requires `(1 :: Int) + n`; a literal on the left is now accepted.

## Drafts and verdicts

The spec queue was created on 9 November, so every draft falls inside the ten-day window. Dates are 2026, +01:00.

| Short name | File in `specs/inbox/` | Added | Last changed | Verdict |
| --- | --- | --- | --- | --- |
| Precedence | `arithmetic-precedence.md` | [`cda695c`](https://github.com/johnwarden/pattern-language/commit/cda695c), 10 Nov | [`90171a8`](https://github.com/johnwarden/pattern-language/commit/90171a8), 17 Nov | Needs edits |
| Fixed-precision | `fixed-precision-numbers.md` | [`8a5608e`](https://github.com/johnwarden/pattern-language/commit/8a5608e), 12 Nov | `90b9377`, 17 Nov | Needs decisions |
| Number-literals | `2026-11-17-number-literals-and-strong-functional-equality-and-ambiguity.md` | [`21592f2`](https://github.com/johnwarden/pattern-language/commit/21592f2), 17 Nov | [`cdfe11e`](https://github.com/johnwarden/pattern-language/commit/cdfe11e), 17 Nov | Needs decisions |
| Type-model | `2026-11-17-refined-type-model.md` | [`0db45ea`](https://github.com/johnwarden/pattern-language/commit/0db45ea), 17 Nov | [`215e0da`](https://github.com/johnwarden/pattern-language/commit/215e0da), 17 Nov | Needs decisions |
| Rational-literals | `rational-literals-and-text.md` | [`93c5fb6`](https://github.com/johnwarden/pattern-language/commit/93c5fb6), 10 Nov | [`1d657a9`](https://github.com/johnwarden/pattern-language/commit/1d657a9), 10 Nov | Needs decisions |
| Kind-patterns | `prelude-type-kind-patterns.md` | [`eaeee18`](https://github.com/johnwarden/pattern-language/commit/eaeee18), 10 Nov | unchanged | Needs decisions |
| Function-value tests | `named-function-value-tests.md` | [`9888c3d`](https://github.com/johnwarden/pattern-language/commit/9888c3d), 9 Nov | [`d562173`](https://github.com/johnwarden/pattern-language/commit/d562173), 9 Nov | Needs decisions |
| Libraries | `overloading-libraries-and-printed-function-values.md` | [`d07734c`](https://github.com/johnwarden/pattern-language/commit/d07734c), 9 Nov | `9888c3d`, 9 Nov | Needs decisions |

One draft test also sits in `tests/inbox/`: `mixed-addition-partial-application.test`, added by [`5eab897`](https://github.com/johnwarden/pattern-language/commit/5eab897) on 17 Nov. It needs edits and is covered under Fixed-precision.

Against the rulings you listed:

- **Bool literals:** nothing in the drafts contradicts the ruling.
- **Quoted primitive names:** moving `Int` and `Float` to the prelude changes which names are primitive (Fixed-precision 9).
- **Unspaced fractions:** the rational-literals draft makes bare `1/3` a syntax error, which contradicts the ruling as worded (Rational-literals 1).
- **`assert X` / `assert not(X)`:** not followed in the fixed-precision draft (finding 6) or in parts of the type-model draft.
- **`.test` form:** most examples in the type-model and number-literals drafts are not loadable test rows.

In the findings, `:130` means line 130 of the draft under review; other files are named in full.

## Precedence — needs edits

All 15 fenced cases load under today's reader, and five already pass on master (those starting at `:141`, `:150`, `:170`, `:175` and `:207`).

I ran an instrumented copy of the reader over every `.test` and `.pattern` file. Of about 3,700 infix expressions, 26 change grouping and none hits the new mixed-associativity error. The 26 are 20 binding defaults, 3 refinement predicates, the 2 cases that pin equal precedence, and 1 string concatenation whose value does not change.

1. **Binding defaults regroup, with no case covering them.**
   - `c :: String = "black"` reads today as `::(c)(=(String)("black"))`, and the default recognizer depends on that shape (`src/syntax.ts:154-155`).
   - Under the table at `:22-28` it becomes `=(::(c)(String))("black")`. Twenty patterns are affected, for example `tests/bindings/defaults.test:28` and `tests/language/labels.test:231`.
   - The same change makes three forms valid that are errors today: `x :: Int = 5` as an annotated binding, `x :: Int -> x`, and `:Red | :Green -> "warm"` as a match arm. The type-model draft already relies on the first (`2026-11-17-refined-type-model.md:550`).
2. **`T .where x -> body` becomes a lambda with no error.**
   - `->` is in the weakest tier, so `Code .where e -> isApplication(e)` regroups to `(Code .where e) -> isApplication(e)`.
   - Three existing sites are affected: `examples/code-categories.pattern:8`, `tests/examples/types.test:235` and `:308`.
   - Sibling drafts write the same form (`2026-11-17-refined-type-model.md:48`, `overloading-libraries-and-printed-function-values.md:59`).
   - Rejecting an arrow to the right of a tighter operator would be safer than a silent regroup. Either way it needs a case.
3. **Comparisons bind more weakly than every dot-infix operator.** `a == b .and c == d` reads as `a == ((b .and c) == d)`, and `:130` pins this. `…number-literals…md:33` writes `x == 0 && foo(x) != foo(0)` expecting the opposite.
4. **`^` and `%` land in the right-associative middle tier (`:27`).**
   - `a * b ^ c` reads as `(a * b) ^ c`; `a ^ b + c` and `a % b + c` are mixed-associativity errors.
   - Both are native operators today. Three uses of `^` in evaluated test code need migrating to `pow` (`tests/examples/expressions.test:36`, `tests/language/blocks.test:12`, `:30`).
   - The case at `:170-173` does not pin `^`'s tier, and `%` is not mentioned.
5. **`:78-83` waits on a different decision.** `toString(Expression)` prints `Node(:-, {10})(Node(:-, {3})(2))` today, so `expect text contains "(3 - 2)"` would keep failing after precedence lands. Use `Code`, or record the Expression-text decision.
6. **Type name.** Value cases use `:: Rational` (`:86-89`, `:97-99`, `:142-144`, `:153-161`), while the numeric drafts use `ExactRational` (`fixed-precision-numbers.md:134`).
7. **Numeric-equality tokens (`:50-63`).** The rule is formatting-safe for the cases listed, but it has three costs:
   - It is the first exception to "`#` always starts a comment" (D01, `design/POSTFIX.md:39`).
   - It permanently bans comments that begin with `=`, such as `# => 3` or `#====`. None exist today.
   - It leaves `def (=#=)(a)(b)` and prefix `=#=(a)(b)` unspecified.
   - A spelling without `#`, for example `=~=`, has none of these costs.
8. **Record status.**
   - The approved `arithmetic-operator-grouping.md` was deleted in [`e1db80d`](https://github.com/johnwarden/pattern-language/commit/e1db80d) while its replacement is still in the inbox, so no approved record governs grouping.
   - The closing note (`:242-244`) names only C25. Equal precedence is also pinned by `tests/conformance/expressions.test:51-57`, host goldens (`test/formatting.test.ts:36-39`, `test/cli.test.ts:49-53`), `src/playground.ts:23`, and by D01, README, ROADMAP, GRAMMAR.md and `design/TEST-SUITE.md`.
9. **Small.** `:32-33` says the error identifies the first operator, but the messages at `:114-118` name neither. The cases pin whole sentences, not a diagnostic code.

## Fixed-precision — needs decisions

The value-based rule (`:60-65`, `:157-162`) agrees with the number-literals draft. Several outcomes are already true on master:

- `n == 0` for an Int `n` is `E_INCOMPARABLE_TYPES`.
- `0.1 :: Float64` reports "not exactly representable as Float64".
- Integer `/` truncates toward zero.
- `def (+)(a)(b)` heads and the saved partial `+(n)` work.

1. **Arm order at `:104-110` gives the wrong result under the draft's own projection rule.**
   - The definitions at `:84-89` rely on a match arm projecting an Int to its ExactRational base. Under that rule an Int `b` also matches the first arm, `(q :: ExactRational)`.
   - Master already behaves this way for other wrappers: with `(b :: Any) = "hi" :: String?`, a `(s :: String)` arm placed first wins over `(o :: String?)`.
   - The sum would be an ExactRational, contradicting `:77-79` and the inbox test at `:12-13`.
   - Put the Int and Float64 arms first, or state that arms test the member's own type before projecting.
2. **Literal arguments to union-typed operands depend on an unapproved rule.**
   - `b :: Int | ExactRational` (`:82`) and `Number | ExactRational` (`:50`) accept `1` in two ways.
   - Under the approved record that is ambiguous: on #80, `3 .matches (abstract Int | Rational)` answers "please specify `3 :: Int` or `3 :: Rational`".
   - The draft therefore needs question 1 answered yes for abstract unions.
   - On master an inline `Int | Rational` annotation is a concrete union (`f(1)` returns `(1 :: Rational) :: Type(Int | Rational)`), and the type-model draft lists raw patterns in type positions as a future goal (`2026-11-17-refined-type-model.md:753-758`).
3. **`:210-217` is a behaviour change.** With `abstract Int | Float64` standing in for `Number`, `assert i != f` is `E_INCOMPARABLE_TYPES` on master. Only two abstract-typed operands compare as unequal today.
4. **Ordering across members of `Number` is undefined, and today it is structural.**
   - With both operands held in an abstract union, `(1 :: Int) > (3 :: Float64)` is `True` on master, because the concrete type is compared first.
   - `:204-205` lists the signature decision but not this existing behaviour. `:201-203` leaves magnitude versus fit open for `n > 0.5`.
5. **Rows the reader rejects.**
   - `:43-46` and `:193-197` are wholly parenthesized subjects ("a keyword operand cannot be a single parenthesized group").
   - `:45-46` and `:196-197` also contain `=#=`, which is a comment today. The whole file is rejected, so these cannot be stored as todos before the lexer change.
6. **Boolean style.** `:45-46`, `:170-180`, `:186-187` and `:195-197` use `expect … is True/False`.
7. **Diagnostics.**
   - `:232` expects "overflow", but the definition at `:90` fails through `:: Int` designation, which today says "expected Int, got …".
   - The inbox test expects "does not designate" (`:15`).
   - `:220` `fails "ambiguous"` matches both `E_AMBIGUOUS_CALL` and the designator error.
8. **`:230-234`.** `:231` fails in setup today (the bootstrap Int stops at safe integers), so the case needs a whole-test todo. `:233` tests truncating division under a title about overflow.
9. **Aliases and primitives.**
   - `Float` and `Float64` are distinct types on master (`Float == Float64` is `False`), so `:14` merges two existing types.
   - Moving numeric names to the prelude (`:23`) decides where `E_QUOTED_PRIMITIVE` still applies. Approved `specs/approved/type-values.md:42-44` uses `Int` and `:Int`.
10. **Gaps.**
    - `-(n)` is negation today (`-(5)(3)` is `2`), so the saved-partial rule at `:64` cannot hold for `-`.
    - Only `+` is defined. A literal on the left of `-` or `/` cannot delegate by swapping operands.
    - With truncation, `1 / n` for an Int `n` of 2 would be `0 :: Int`, while `1 / 2` is `0.5`.
    - String `+` is native today (`tests/specification/named-function-values.test:66`) and has no prelude definition.
    - A third-party fixed type cannot add a left-literal case, because each first pack selects one definition (`:76`).
11. **`tests/inbox/mixed-addition-partial-application.test`.**
    - `:8` is a syntax error today: after `expect`, `+(n)(one)` reads `+` as infix. Put the subject on its own indented line, as `tests/numeric/minus.test` does.
    - `:14` fails on the unbound name `ExactRational`, not on behaviour.

## Number-literals — needs decisions

The decision at `:66-91` matches master for `==`. The first fenced case (`:228-233`) and the examples at `:196-202` and `:212-213` already pass, so they can be ordinary tests now.

1. **The priority rule is not marked as decided.** `:145-155` (labelled "OPTION 2") says a value's own type wins over a type it could designate, and of two nested types the inner wins. It turns existing errors into successes: `foo(5)` and `foo(5 :: Rational)` with Int and Rational overloads are both `E_AMBIGUOUS_CALL` on master, as are `:239-240`.
2. **Reach into unions is unstated.**
   - For the concrete union at `:159-164`, master already picks the direct arm.
   - For abstract unions, master and #80 report ambiguity. #80 pins it in "Interpretations beyond the second are counted", which uses `abstract Int | Float | Rational`.
3. **`:15-21` describes a change as existing coverage.**
   - Comparability is defined by static types, which the bootstrap does not have.
   - The cited test (`test/abstract-values.test.ts:25-40`) compares two abstract values, or an abstract value with a concrete value of the same type. A different concrete member is an error today.
   - `2026-11-17-refined-type-model.md:244` expects an error by member type instead.
4. **Overload rules are incomplete.**
   - No rule covers several parameters where each overload is the inner one in a different position.
   - `:103-105` says overlapping overloads "cannot coexist" but not when that is reported or with which code. Approved `specs/approved/type-values.md:219-224` expects `E_AMBIGUOUS_CALL` at the call.
   - Adding an overload silently changes existing calls (`:155`), while `named-function-value-tests.md:82` says no specificity fallback.
5. **Diagnostics.** `:211` expects "Ambiguous foo(String?) and foo(Int?)"; today's message is "ambiguous call: 2 applicable functions named foo". `:84` `fails "ambiguous"` cannot tell the two candidate codes apart.
6. **Wrong expected results.**
   - `:162` and `:164` give `x` the member's type, but `x` has type `t`.
   - `:185` uses the parked angle syntax and puts the local name `Id` in global text.
   - `:185` omits the inner layer, while `2026-11-17-refined-type-model.md:300` prints it.
7. **Not valid source.**
   - `:31-32`: `def … = …`.
   - `:33`, `:126`: `&&` is undefined, and neither grouping rule reads `:33` as intended.
   - `:136-137`: `assert … is`.
   - `:168-169`: `when` arms.
   - `:179`: `def Id concrete`, a form retired by `specs/approved/retire-legacy-type-definition-syntax.md:30-36`.
   - `:73-79`: the labels "INCOMPARABLE" and "NO" for the same outcome.
8. **`:5-13`.** The substitution rule should exclude unevaluated positions, which includes macro operands as well as quotations.
9. **Before approval.** Reduce the discarded options (`:37-63`, `:112-143`) to a short rationale, and add a check of the value received to the fenced cases.

## Type-model — needs decisions; I recommend splitting it

The second fenced case (`:682-689`) passes on master as written. The first (`:664-680`) passes once `pattern` is spelled `abstract`. The abstract union over two enums (`:272-283`) also behaves as described today.

Reversals of approved or implemented records:

1. **Vocabulary (`:1-20`).** `pattern`, `Concrete`, `Pattern` and `Predicate` replace `abstract`, the `refinement` keyword, and the constructors approved in `specs/approved/type-values.md`. [#77](https://github.com/johnwarden/pattern-language/pull/77) adds 79 test lines naming the old constructors, and the kind-patterns draft is built on them.
2. **Wrapping.**
   - `pattern Int == Int` (`:29`) and `concrete Int` as a new type (`:360-361`, also `:213`) reverse "A lone primitive is not wrapped … rejected rather than normalized" (`specs/approved/type-values.md:153-181`). On [#78](https://github.com/johnwarden/pattern-language/pull/78) both are `E_TYPE_DESCRIPTION`.
   - Nested `concrete` not collapsing (`:35-38`, `:291-294`) differs from master and #78, where `concrete PrimaryColor == PrimaryColor` is `True`.
3. **No raw values (`:53-61`, `:209-220`).** This reverses `specs/implemented/raw-expression-values.md` and the intrinsic symbol classes (`README.md:110`, C01). The migration note (`:738-751`) names only the first.
4. **Destructuring.** `:445`, `:448`, `:525-530` and `:617` let a binding or parameter open a concrete struct. D09 and the accepted todo at `tests/specification/raw-expressions.test:12-20` say it must not, and so does the draft itself at `:623-624`. Master currently allows it.
5. **Concrete open pattern (`:484`).** `specs/approved/retire-legacy-type-definition-syntax.md:65-70` forbids it, and the draft is undecided at `:496-513`.
6. **Spread syntax (`:76-104`).** The aside reverses approved `anonymous-repeated-patterns.md`, rewrites a passing test, and would touch about 160 lines. The draft still uses the old form at `:457`, `:475`, `:484` and `:517`.

Internal contradictions:

7. **Refinement descriptor.** `:19-20` uses `Predicate(…)`, with `n > 0` for a predicate named `nonZero` at `:7`. `:411` and `:424` use `Pattern(Int .where …)` and `Concrete(Int .where …)`.
8. **Text of a wrapped value.** `:300` prints the inner layer; `:734` omits it.
9. **Observed type of a refined value.** `:551` and `:555` say `Int .where isNonZero`; `:414` and `:280` use the member's own type.
10. **Number fields.** Bare literals against `Number`-typed fields (`:459`, `:463`, `:616`) are ambiguous designators under the numeric drafts. `:487` and `:489` ascribe `:Red :: Color` to an abstract type, which is `E_ABSTRACT_ASCRIPTION` today.
11. **Missing keyword.** `:455-457` and `:724` omit `concrete`/`pattern`, which `:753-790` calls a future goal. `:126` contradicts `:69`.

Examples that are not test-ready:

12. **Rows the reader rejects.**
    - Binding-only subjects and blocks with no result row fail with "must end with a result pack" before the intended error: `:57`, `:193`, `:207`, `:211`, `:233`, `:242`, `:260`, `:519`, `:344-346`, `:367-369`, `:416-418`, `:430-432`.
    - `assert … fails/is`: `:61`, `:189`, `:244`, `:734`.
    - Wholly parenthesized subjects: `:268`, `:729`, `:446`.
    - `:638` lacks `is`; `:196` uses `=` for `is`; `:186-187` use `==` for `=`.
13. **Messages.** Placeholders or unquoted text appear at `:207`, `:233`, `:418`, `:432`, `:715`. Each error has several wordings (for example `:327` "no method" against `:329`), none matching today's text. Pin `E_INCOMPARABLE_TYPES`, `E_NO_METHOD`, `E_PATTERN_MISMATCH` and `E_ABSTRACT_ASCRIPTION`.
14. **Undeclared syntax.**
    - `func` (`:285`).
    - `when`/`else` and `case` arms, and postfix `x match` (`:634`, `:698-701`, `:711`).
    - `match s c :: Color` (`:338`).
    - `hasType` (`:134`).
    - `_(…)` head patterns (`:576`).
    - `def … =` (`:448`).
    - `T+` (`:475`).
    - Angle generics (`:230`, `:548`).
    - Retired `def Status concrete` (`:291`).
15. **Slips that change meaning.**
    - Wrong or undefined names: `:109`, `:145`, `:189`, `:220`, `:346`, `:601`.
    - `:355-356`: `5 :: String`.
    - `:390`: `type Option(Int)`.
    - `:472-474`: `UInt`/`Uint`, against `Uint64` at `:37`.
    - `:477-480`: an untyped value, and `Rectangle(3,5)` used as a constructor.
    - `:552`: missing `::`.
    - `:584`: `Rectangle` for `Rectangular`.
    - `:701`: `:Blue` is not a `TrafficLight`.
    - `:717`: `IntRectangle(5, 5)`.

## Rational-literals — needs decisions

Three cases already pass on master (`:77-80`, `:100-105`, `:157-162`).

1. **Spelling conflict.**
   - `:7`, `:91-92` and `:120` make bare `1/3` a syntax error. The ruling as given to me, and [#76](https://github.com/johnwarden/pattern-language/pull/76), make it the literal. Both approved Rational records use `(n/d)` (`specs/approved/rational-canonical-text.md:20`, `:46`).
   - The choice changes canonical text: with bare `1/8` at three characters, the approved result `"0.125"` (`:96-98` there) would become `"1/8"`.
   - #76 also still prints with the 16-place cutoff that the approved record replaced.
2. **Rows the reader rejects.**
   - `:73-74` are wholly parenthesized division subjects.
   - Every live `(1/3)` makes its file a syntax error today, so these cases, and the approved canonical-text examples, cannot be stored as todos until the reader accepts the literal.
   - `:28` works only if `(1/3)` is one lexer token. Say so.
3. **Housekeeping.** The spacing and typed-text content (`:9-15`, `:130-136`) is already approved. Trim the draft to the open lexical questions at `:165-174`.

## Kind-patterns — needs decisions

All six fenced cases load; on master they stop at the unbound kind names.

1. The vocabulary at `:12-15` and `:59-61` is what the type-model draft would replace. Decide which stands before either is approved.
2. #78 implements the kinds as native matchers, the opposite of `:12-15`. On #78 the payload match at `:205-214` is "no matching arm".
3. `:60` needs the unimplemented `refinement` declaration, and `:14` needs the undecided `Function` domain (`:113`).
4. The five decisions at `:226-232` are still open. `:240` can go: I ran the cases.

## Function-value tests — needs decisions

1. This is a test plan and a list of open decisions (`:75-88`), not a record that can be approved.
2. `:82` (no specificity fallback) conflicts with the number-literals priority rule.
3. `:11` hard-codes case and todo counts. They are accurate today (15 and 17).
4. The case at `:57-68` depends on evaluated-Code `assert` and a `Function` type, as `:71` says.

## Libraries — needs decisions

1. All three cases use the retired `value` clause and fail to load (`:25`, `:47`, `:61`). `:47` has a stray parenthesis.
2. A library value is a first-class overload set, which ROADMAP and `TODO.md:61` list as not accepted.
3. Overloaded constants (`:22-23`) need selection by expected type, which `fixed-precision-numbers.md:65` rules out.
4. `:47` and `:61` put local names in global `toString(Type)` text. Under the precedence draft, the text at `:61` reads back as a lambda.

## Questions for Jonathan

Numbers and literals:

1. Is the priority rule the decision: a value's own type wins over a type it could designate, and the inner of two nested types wins? Does it apply inside unions, including abstract ones?
2. For peer overloads such as `sqrt(2)` and `foo(:None)`, which error: `E_AMBIGUOUS_CALL` as today, or `E_AMBIGUOUS_VALUE_DESIGNATOR` with interpretations listed?
3. Is `Rational` renamed `ExactRational`? Which names stay primitive once the numeric types move to the prelude? Do `Float` and `Float64` merge?
4. Comparing an abstract-typed value with a concrete value of a different member type: an error as today, or `False`?
5. Ordering:
   - Magnitude or fit for `n > 0.5`?
   - Numeric, error or structural across different members of `Number`?
   - Is it acceptable that `a <= b` and `b <= a` can hold while `a == b` is an error?
6. Arithmetic policy: checked overflow, round to nearest even, truncating `/`. I recommend a named integer quotient beside the still-unnamed remainder, leaving `/` exact or undefined on integers.
7. Keep `=#=` and `!#=`, or choose a spelling without `#`?
8. In `match`, does a typed arm on an abstract value test the member's own type before trying projection?

Precedence:

9. Confirm the consequences: defaults regroup; `T .where x -> …` needs parentheses or is rejected; comparisons bind more weakly than dot-infix names; `^` and `%` sit in the middle tier.
10. Approve the draft now, or restore the deleted record until it is approved?

Type model:

11. Does the new vocabulary replace the approved one? If so, do #77 and #78 merge first as a baseline, or get reworked? What becomes of the kind-patterns draft?
12. Are `pattern Int == Int`, `concrete Int` as a new type, and non-collapsing nested `concrete` approved?
13. Are raw symbols and raw expressions both disallowed as values?
14. May an ordinary binding or parameter destructure a concrete struct?
15. May `concrete` wrap an open pattern?
16. Canonical text of a wrapped value: `5 :: Id` or `(5 :: Int64) :: Id`? Observed type of a refined value: base or refinement?
17. Is the spread rewrite a separate proposal, and which match syntax is intended?

Other:

18. Is the fraction literal bare `1/3` or `(1/3)`?
19. Do overloaded constants and library values proceed, given question 1 and the standing decision against first-class overload sets?

## Recommended order

1. **#80 first.** It implements an approved record, sits on `e3921e8`, and GitHub reports it mergeable. I did not re-review its code. If question 1 is answered yes, its case "Interpretations beyond the second are counted" stops being ambiguous; using three peer option types there would make it independent of the numeric decisions.
2. **#79 stays closed.** Its surviving content is `fixed-precision-numbers.md:157-205`. #77 still explains the same todos by operand designation (`tests/specification/expected-type-context.test:43-47` on that branch) and uses the old error name at `:9`, `:20` and `:40`.
3. **Precedence next**, after its edits. The numeric drafts' cases use `=#=` and unparenthesized `x :: T = v`.
4. **Type-model questions 11 to 15, before merging #77.** Besides the 79 lines in finding 1, #77 adds ten `E_TYPE_DESCRIPTION` assertions that the draft would reverse. The alternative is to merge #77 and #78 as the baseline and migrate later, at the cost of a second pass over the same lines.
5. **Number-literals, then fixed-precision**, which depends on steps 3 and 4 and on question 1.
6. **#76 waits on question 18.**

## How I checked

- **Tooling.** The VM came up without `just` and with Node 22, so I installed the pinned `just` 1.58.0 (checksum matches `.cursor/Dockerfile`) and Node 24.22.3 locally and ran `npm ci`.
- **Baseline.** `just test-language` passed on master at `e3921e8`; `90b9377` changes only one draft.
- **Draft cases.** I copied each fenced `pattern` block to a scratch `.test` file outside the repo, keeping line numbers, and ran it with `just test`. [#74](https://github.com/johnwarden/pattern-language/pull/74) would make that a supported run.
- **Probes.** I ran individual programs with `just run` on master and on exported copies of the heads of #78, #79 and #80.
- **Not done.** I did not run the full `just check` or re-review the open PRs. Program strings inside host tests are not in the grouping count.
