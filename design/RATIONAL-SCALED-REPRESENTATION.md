# Scaled Rational representation (design note)

Jonathan's direction after #93: exact Rationals should eventually be stored as
`(n, d, base, exp)` meaning `n/d * base^exp`, not only as a fully expanded
reduced numerator/denominator. This note reviews the current bootstrap and what
that change would touch. **No implementation in this note.**

## Current representation

`src/rational.ts` defines `Rational = { n: bigint; d: bigint }`:

- Exact ratio in lowest terms, positive denominator, sign in `n`, zero as
  `{ n: 0n, d: 1n }` via `reduceRational`.
- Readers (`parseNumericSpelling`) fold decimal `e` and binary `p` exponents
  into `n`/`d` with `10n ** power` / `2n ** power` before reducing.
- Arithmetic (`add`/`sub`/`mul`/`div`/`rem`/`pow`) cross-multiplies `n`/`d` and
  reduces again.
- Equality uses `compareRationals` (`a.n * b.d` vs `b.n * a.d`). Syntax and type
  description keys stringify `n` and `d` only (`syntaxKey`, `descriptionKey`).
- `formatRational` factorizes the reduced fraction (trailing twos/fives) to
  choose shortest exact text; it assumes `n`/`d` already carry the full value.
- Integer predicates (`Int`, `Int64`, grammar Int patterns) treat `d === 1n` as
  “this value is an integer” in expanded form.

`isRational` is structural duck-typing on bigint `n` and `d` only.

## Why scale factors help

Literals such as `1e10000` and `0x1p10000` are cheap to *name* but expand into
large bigints under the current form. A scaled tuple can keep a small mantissa
and leave the power unevaluated until an operation needs it (or forever, for
print/read). That is the long-term answer to huge-but-sparse magnitudes; the
literal exponent cap in the Rational literals spec is a short-term guard so the
expanded representation cannot hang the reader.

## What a change would touch

| Area | Files / entry points | Likely work |
| --- | --- | --- |
| Core type + normalize | `src/rational.ts` (`Rational`, `reduceRational`, `isRational`) | New fields; define canonicalization |
| Reader | `parseNumericSpelling`, `parseDecimalExact`, `parseBinaryPower`, fraction+`e` | Keep `base`/`exp` instead of expanding |
| Printer | `formatRational`, `positionalSpelling`, fraction candidates | Prefer emitting the stored scale; still compete across families |
| Arithmetic | `addRationals` … `powRationals`, runtime `exactOps` | Align scales or expand selectively |
| Equality / keys | `compareRationals`, `src/values.ts` `equal`/`compare`, `src/syntax.ts` `syntaxKey`, `src/type-data.ts` `descriptionKey` | Exact *value* equality, not tuple identity |
| Integer tests | `src/runtime.ts`, `src/grammar.ts`, `src/union-disjointness.ts` | `d === 1n` is insufficient if `2^k` sits in `exp` |
| Serialization | `src/value-text.ts`, `src/syntax-values.ts`, `src/language-description.ts`, `src/parser.ts` | Payload shape + round trips |
| Host / suite helpers | `test/rational-primitives.test.ts`, `src/test-suite.ts`, `src/values.ts` `valRational` | Construct/compare through helpers |

## Normalization and equality questions

Equality must remain **exact value equality**, not “same tuple”. Open choices:

1. **Which bases?** Minimum useful set is `10` (decimal `e`) and `2` (binary `p` /
   hex). A single base (only 2, with decimal expanded) simplifies ops but loses
   the point of cheap decimal literals. Allowing arbitrary bases increases
   alignment cost.
2. **When to reduce?** Options: (a) always expand to `{n,d}` at the storage
   boundary (status quo, no win); (b) keep scale lazily and canonicalize only for
   compare/hash/print; (c) normalize after every op into a chosen canonical
   scaled form (e.g. odd mantissa, preferred base).
3. **Canonical form for keys.** Today keys assume one reduced `{n,d}`. Scaled
   storage needs either expansion for keys or a unique normal form
   `(n, d, base, exp)` so `1e3` and `1000` key alike.
4. **Sign and zero.** Keep sign in `n`; define `0` as a single canonical tuple
   regardless of `base`/`exp`.
5. **Cross-base arithmetic.** Adding `1e10` and `0x1p10` forces a common
   representation; naive expansion reintroduces large bigints for mixed ops.

Recommendation to explore first: bases `{2, 10}` only; canonicalize for
equality by converting to a preferred base or by comparing cross-multiplied
expanded values with short-circuit when scales already match; print using the
stored scale when it yields a legal shortest candidate.

## Performance benefits

- Read/print of `1e100000`-class magnitudes without allocating `10^100000`.
- Cheaper multiplication/division by powers of the stored base (adjust `exp`).
- Smaller memory for sparse integers that are pure powers or power-scaled
  fractions such as `(1/3)e20`.

Benefits shrink once values are combined across incompatible scales or need
Float64 rounding intervals, which still require significant magnitude.

## Risks

- Silent breakage if `isRational` ignores new fields and old `{n,d}` values mix
  with scaled ones.
- `syntaxKey` / `descriptionKey` mismatches if two encodings of one value are
  stored.
- Integer and dyadic checks that read raw `d` become wrong.
- Shortest-text search and Float64 interval logic are written around expanded
  fractions; a partial migration could desync printer and reader.
- Test surface across `tests/numeric/` and host rational primitives is broad.

## Effort estimate

**Large.**

Not a localized refactor: the expanded `{n,d}` invariant is assumed throughout
the numeric pipeline. A credible slice is still multi-file.

Rough file list for a full cutover:

- `src/rational.ts` (type, normalize, read, print, arithmetic)
- `src/values.ts`, `src/runtime.ts`, `src/grammar.ts`
- `src/syntax.ts`, `src/type-data.ts`, `src/union-disjointness.ts`
- `src/value-text.ts`, `src/parser.ts`, `src/syntax-values.ts`
- `src/language-description.ts`, `src/test-suite.ts`
- `test/rational-primitives.test.ts` and `tests/numeric/*`
- [Numeric literals and canonical text](../specs/numeric-literals-and-text.md)

A smaller spike (medium) could introduce an internal scaled form only inside
the reader/printer while still expanding before leaving `rational.ts`; that
proves the literal performance win without rewriting equality and arithmetic,
but does not deliver the representation Jonathan described as the destination.
