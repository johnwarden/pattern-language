import { LanguageError } from "./diagnostics.ts";
import type { Syntax } from "./syntax.ts";

/** Exact ratio in lowest terms, with a positive denominator. */
export type Rational = { n: bigint; d: bigint };
export const isRational = (
  value: string | number | Rational,
): value is Rational =>
  typeof value === "object" &&
  value !== null &&
  typeof value.n === "bigint" &&
  typeof value.d === "bigint";
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
};
export function reduceRational(n: bigint, d: bigint): Rational {
  if (d === 0n) throw new LanguageError("malformed numeric source literal");
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  if (n === 0n) return { n: 0n, d: 1n };
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
export function float64ToRational(x: number): Rational {
  if (Object.is(x, -0)) x = 0;
  if (!Number.isFinite(x))
    throw new LanguageError("number exceeds safe numeric range");
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const sign = bits >> 63n ? -1n : 1n;
  const exp = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  if (exp === 0) return reduceRational(sign * frac, 2n ** 1074n);
  const mantissa = (1n << 52n) | frac;
  const power = BigInt(exp - 1023 - 52);
  return power >= 0n
    ? reduceRational(sign * mantissa * 2n ** power, 1n)
    : reduceRational(sign * mantissa, 2n ** -power);
}
export const float32ToRational = (x: number): Rational =>
  float64ToRational(Math.fround(x));
const bitLength = (n: bigint): number => (n === 0n ? 0 : n.toString(2).length);
/** Round n/d to nearest integer, ties to even. n and d must be non-negative. */
const roundQuotient = (n: bigint, d: bigint): bigint => {
  const q = n / d,
    rem = n % d;
  if (rem === 0n) return q;
  const twice = rem * 2n;
  if (twice > d || (twice === d && (q & 1n) === 1n)) return q + 1n;
  return q;
};
const float64FromBits = (sign: number, biasedExp: bigint, frac: bigint) => {
  const view = new DataView(new ArrayBuffer(8));
  view.setBigUint64(0, (sign < 0 ? 1n << 63n : 0n) | (biasedExp << 52n) | frac);
  return view.getFloat64(0);
};
/** Correctly rounded binary64 conversion. */
export function rationalToNumber(r: Rational): number {
  if (r.n === 0n) return 0;
  const sign = r.n < 0n ? -1 : 1,
    n = r.n < 0n ? -r.n : r.n,
    d = r.d;
  let e = bitLength(n) - bitLength(d);
  const cmp =
    e >= 0
      ? n === d << BigInt(e)
        ? 0
        : n < d << BigInt(e)
          ? -1
          : 1
      : n << BigInt(-e) === d
        ? 0
        : n << BigInt(-e) < d
          ? -1
          : 1;
  if (cmp < 0) e -= 1;
  if (e > 1023) return sign * Infinity;
  if (e < -1022) {
    const q = roundQuotient(n << 1074n, d);
    if (q === 0n) return 0;
    if (q >= 1n << 52n) return float64FromBits(sign, 1n, 0n);
    return float64FromBits(sign, 0n, q);
  }
  const scale = 52n - BigInt(e);
  let mantissa =
    scale >= 0n ? roundQuotient(n << scale, d) : roundQuotient(n, d << -scale);
  let exp = e;
  if (mantissa === 1n << 53n) {
    mantissa >>= 1n;
    exp += 1;
  }
  if (exp > 1023) return sign * Infinity;
  return float64FromBits(
    sign,
    BigInt(exp + 1023),
    mantissa & ((1n << 52n) - 1n),
  );
}
export function isExactFloat32(r: Rational): boolean {
  const x = Math.fround(rationalToNumber(r));
  if (!Number.isFinite(x)) return false;
  const back = float32ToRational(x);
  return back.n * r.d === back.d * r.n;
}
export function isExactFloat64(r: Rational): boolean {
  const x = rationalToNumber(r);
  if (!Number.isFinite(x)) return false;
  const back = float64ToRational(x);
  return back.n * r.d === back.d * r.n;
}
export function compareRationals(a: Rational, b: Rational): number {
  const left = a.n * b.d,
    right = b.n * a.d;
  return left === right ? 0 : left < right ? -1 : 1;
}
const stripNumericUnderscores = (text: string): string =>
  text.replace(/_/g, "");
const digits = (digit: string) => `${digit}(?:_?${digit})*`;
const decimalDigits = digits("[0-9]");
const decimalInteger = "(?:[1-9](?:_?[0-9])*|0)";
const decimalExponent = `[eE]([+-]?${decimalInteger})`;
const decimal = `(${decimalInteger})(?:\\.(${decimalDigits}))?(?:${decimalExponent})?`;
const fraction = `\\((-?${decimalInteger})/(${decimalInteger})\\)(?:${decimalExponent})?`;
const significand = (digit: string) => {
  const run = digits(digit);
  return `${run}(?:\\.${run})?`;
};
// Binary `p` exponents share decimal-integer digit rules with `e` (no leading zeros).
const binaryExponent = `[+-]?${decimalInteger}`;
const binary = significand("[01]");
const hex = significand("[0-9a-fA-F]");
const decimalSpelling = new RegExp(`^${decimal}$`);
const fractionSpelling = new RegExp(`^${fraction}$`);
const hexSpelling = new RegExp(`^${hex}$`);
const bitSpelling = new RegExp(`^${binary}$`);
const exponentSpelling = new RegExp(`^${binaryExponent}$`);
const numericPrefix = new RegExp(
  `${fraction}|0[fF]${decimal}|0[xX]${hex}(?:[pP]${binaryExponent})?|0[bB]${binary}(?:[pP]${binaryExponent})?|${decimal}`,
  "y",
);

/**
 * Cap on the magnitude of a written decimal `e` or binary `p` exponent.
 * Float64 needs at most 308 decimal / 1023 binary; 10000 leaves headroom for
 * exact Rationals beyond that range while keeping `10n ** power` / `2n ** power`
 * fast. Larger written exponents are rejected before any bigint exponentiation.
 */
export const MAX_NUMERIC_EXPONENT = 10000;

function checkWrittenExponent(raw: string): void {
  const digitsOnly = stripNumericUnderscores(raw).replace(/^[+-]/, "");
  // Digit-length gate rejects 1e999999999 without building a bigint power.
  if (
    digitsOnly.length > 5 ||
    Number(digitsOnly) > MAX_NUMERIC_EXPONENT
  ) {
    throw new LanguageError(
      `numeric exponent exceeds ${MAX_NUMERIC_EXPONENT}`,
      undefined,
      { code: "E_SYNTAX", phase: "parse" },
    );
  }
}

export function matchNumericSource(
  source: string,
  start: number,
): string | undefined {
  numericPrefix.lastIndex = start;
  return numericPrefix.exec(source)?.[0];
}
function parseDecimalExact(spelling: string): Rational | undefined {
  const match = decimalSpelling.exec(spelling);
  if (!match) return;
  if (match[3] !== undefined) checkWrittenExponent(match[3]);
  const frac = stripNumericUnderscores(match[2] ?? "");
  const combined = BigInt(stripNumericUnderscores(match[1]) + frac);
  const scale =
    BigInt(frac.length) - BigInt(stripNumericUnderscores(match[3] ?? "0"));
  return scale >= 0n
    ? reduceRational(combined, 10n ** scale)
    : reduceRational(combined * 10n ** -scale, 1n);
}
function parseBinaryPower(
  significand: string,
  base: 2 | 16,
  exp?: string,
): Rational | undefined {
  const pattern = base === 16 ? hexSpelling : bitSpelling;
  const written = exp ?? "0";
  if (!pattern.test(significand) || !exponentSpelling.test(written)) return;
  if (exp !== undefined) checkWrittenExponent(exp);
  const clean = stripNumericUnderscores(significand);
  const [int, frac = ""] = clean.split(".");
  const combined = BigInt((base === 16 ? "0x" : "0b") + int + frac);
  const power =
    BigInt(stripNumericUnderscores(written)) -
    BigInt(frac.length * (base === 16 ? 4 : 1));
  return power >= 0n
    ? reduceRational(combined * 2n ** power, 1n)
    : reduceRational(combined, 2n ** -power);
}
/** Source spelling of an exact Rational, including 0f as Float64 rounding. */
export function parseNumericSpelling(text: string): Rational | undefined {
  const spelling = text.trim();
  const parts = fractionSpelling.exec(spelling);
  if (parts) {
    const n = BigInt(stripNumericUnderscores(parts[1]));
    const d = BigInt(stripNumericUnderscores(parts[2]));
    if (d === 0n) return;
    if (parts[3] !== undefined) checkWrittenExponent(parts[3]);
    const power = BigInt(stripNumericUnderscores(parts[3] ?? "0"));
    return power >= 0n
      ? reduceRational(n * 10n ** power, d)
      : reduceRational(n, d * 10n ** -power);
  }
  const negative = spelling.startsWith("-");
  const magnitude = parseUnsignedNumeric(
    negative ? spelling.slice(1) : spelling,
  );
  return negative && magnitude
    ? { n: -magnitude.n, d: magnitude.d }
    : magnitude;
}

function parseUnsignedNumeric(t: string): Rational | undefined {
  if (/^0[fF]/.test(t)) {
    const rest = t.slice(2);
    const match = decimalSpelling.exec(rest);
    if (!match) return;
    if (match[3] !== undefined) checkWrittenExponent(match[3]);
    const rounded = Number(stripNumericUnderscores(rest));
    if (!Number.isFinite(rounded)) return;
    return float64ToRational(rounded);
  }
  if (/^0[xX]/.test(t)) {
    const body = t.slice(2);
    const split = body.split(/[pP]/);
    if (split.length > 2) return;
    return parseBinaryPower(split[0], 16, split[1]);
  }
  if (/^0[bB]/.test(t)) {
    const body = t.slice(2);
    const split = body.split(/[pP]/);
    if (split.length > 2) return;
    return parseBinaryPower(split[0], 2, split[1]);
  }
  return parseDecimalExact(t);
}
export function rationalFromSyntax(
  n: Extract<Syntax, { kind: "literal" }>,
): Rational | undefined {
  if (typeof n.value === "string") return;
  if (isRational(n.value)) return n.value;
  if (n.spelling) {
    const parsed = parseNumericSpelling(n.spelling);
    if (parsed) return parsed;
  }
  if (
    n.span?.source &&
    n.span.start !== undefined &&
    n.span.end !== undefined
  ) {
    const spelling = n.span.source.text.slice(n.span.start, n.span.end);
    const parsed = parseNumericSpelling(spelling);
    if (parsed) return parsed;
  }
  if (typeof n.value === "number" && Number.isFinite(n.value))
    return float64ToRational(n.value);
}
const trailingTwos = (n: bigint) => bitLength(n & -n) - 1;

function splitFives(value: bigint): { core: bigint; fives: number } {
  const powers: { divisor: bigint; exponent: number }[] = [];
  let fives = 0;
  for (
    let divisor = 5n, exponent = 1;
    value % divisor === 0n;
    divisor *= divisor, exponent *= 2
  ) {
    value /= divisor;
    fives += exponent;
    powers.push({ divisor, exponent });
  }
  for (const { divisor, exponent } of powers.reverse()) {
    if (value % divisor === 0n) {
      value /= divisor;
      fives += exponent;
    }
  }
  return { core: value, fives };
}

const families = ["", "0f", "0x", "0b", "fraction"] as const;
type NumericFamily = (typeof families)[number];
type Spelling = { text: string; family: NumericFamily; exponent: boolean };

function preferred(candidate: Spelling, best: Spelling): boolean {
  if (candidate.text.length !== best.text.length)
    return candidate.text.length < best.text.length;
  if (candidate.family !== best.family)
    return families.indexOf(candidate.family) < families.indexOf(best.family);
  if (candidate.exponent !== best.exponent) return !candidate.exponent;
  return candidate.text < best.text;
}

function exponentText(power: number, marker: string): string {
  return power === 0 ? "" : marker + power;
}

/** Place the radix point in a coefficient with no redundant leading or trailing zeros. */
function positionalSpelling(
  coefficient: string,
  power: number,
  family: Exclude<NumericFamily, "fraction">,
  limit: number,
): Spelling | undefined {
  const count = coefficient.length;
  if (count + family.length > limit) return;
  const marker = family === "0x" || family === "0b" ? "p" : "e";
  const step = family === "0x" ? 4 : 1;
  let best: { point: number; exponent: string; length: number } | undefined;
  // The integer coefficient with its exponent bounds the number of zeros
  // worth considering on either side of the significant digits.
  const available = Math.min(
    limit - family.length,
    count + exponentText(power, marker).length,
  );
  for (
    let point = Math.min(1, count + 2 - available);
    point <= available;
    point++
  ) {
    const placedExponent = power + (count - point) * step;
    // Printer candidates must stay within the reader exponent cap so text round-trips.
    if (Math.abs(placedExponent) > MAX_NUMERIC_EXPONENT) continue;
    const exponent = exponentText(placedExponent, marker);
    const length =
      (point <= 0 ? count + 2 - point : point < count ? count + 1 : point) +
      exponent.length;
    if (length > available) continue;
    if (best && length >= best.length) {
      if (length > best.length) continue;
      if (!!exponent !== !!best.exponent) {
        if (exponent) continue;
      } else {
        // A point before the end sorts before the first differing digit.
        // An extra whole zero sorts before either exponent marker.
        const earlier =
          point < count || best.point < count
            ? point < best.point
            : point > best.point;
        if (!earlier) continue;
      }
    }
    best = { point, exponent, length };
  }
  if (!best) return;
  const { point, exponent } = best;
  const placed =
    point <= 0
      ? "0." + "0".repeat(-point) + coefficient
      : point < count
        ? coefficient.slice(0, point) + "." + coefficient.slice(point)
        : coefficient + "0".repeat(point - count);
  return { text: family + placed + exponent, family, exponent: !!exponent };
}

function midpoint(a: Rational, b: Rational): Rational {
  return reduceRational(a.n * b.d + b.n * a.d, 2n * a.d * b.d);
}

function roundedSpellings(
  r: Rational,
  offer: (candidate: Spelling | undefined) => void,
  limit: () => number,
): void {
  const x = rationalToNumber(r);
  if (!Number.isFinite(x) || compareRationals(float64ToRational(x), r) !== 0)
    return;
  const shortest = x.toString().replace("e+", "e");
  offer({
    text: "0f" + shortest,
    family: "0f",
    exponent: shortest.includes("e"),
  });
  // Decimal coefficients in this exact interval round to x. At each scale,
  // the first coefficient is the lexicographically first shortest choice.
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const inclusive = (bits & 1n) === 0n;
  view.setBigUint64(0, bits - 1n);
  const previous = float64ToRational(view.getFloat64(0));
  view.setBigUint64(0, bits + 1n);
  const next = view.getFloat64(0);
  const lower = midpoint(previous, r);
  const upper = midpoint(
    r,
    Number.isFinite(next)
      ? float64ToRational(next)
      : subRationals(addRationals(r, r), previous),
  );
  const order = Math.floor(Math.log10(x));
  for (let power = order + 2; power >= order - limit(); power--) {
    const positive = power >= 0;
    const scale = 10n ** BigInt(Math.abs(power));
    const n = positive ? lower.n : lower.n * scale;
    const d = positive ? lower.d * scale : lower.d;
    const coefficient = n / d + (inclusive && n % d === 0n ? 0n : 1n);
    const capped = coefficient * upper.d * (positive ? scale : 1n);
    const maximum = upper.n * (positive ? 1n : scale);
    if (capped > maximum || (!inclusive && capped === maximum)) continue;
    // A trailing zero is the same decimal at a scale already searched.
    if (coefficient % 10n === 0n) continue;
    offer(positionalSpelling(coefficient.toString(), power, "0f", limit()));
  }
}

const logTwo = Math.log10(2);
const logFive = Math.log10(5);

/** Choose the shortest source spelling that reconstructs the exact Rational. */
export function formatRational({ n, d }: Rational): string {
  const negative = n < 0n;
  if (negative) n = -n;
  if (n === 0n || (d === 1n && n < 1000n)) return (negative ? "-" : "") + n;

  const selection: { best?: Spelling } = {};
  const offer = (candidate: Spelling | undefined) => {
    if (candidate && (!selection.best || preferred(candidate, selection.best)))
      selection.best = candidate;
  };
  const limit = () => selection.best?.text.length ?? Infinity;

  const nTwos = trailingTwos(n),
    dTwos = trailingTwos(d);
  const odd = n >> BigInt(nTwos);
  const twos = nTwos - dTwos;
  const oddBits = bitLength(odd);
  const dyadic = d === 1n << BigInt(dTwos);
  const numerator = splitFives(odd);
  const denominator = splitFives(d >> BigInt(dTwos));
  const fives = numerator.fives - denominator.fives;
  const significantDigits = numerator.core.toString().length;

  const power = Math.min(twos, fives);
  const logCoefficient =
    significantDigits - 1 + (twos - power) * logTwo + (fives - power) * logFive;
  const offerDecimal = () => {
    if (denominator.core !== 1n || logCoefficient - 1 >= limit()) return;
    const coefficient =
      (numerator.core << BigInt(twos - power)) * 5n ** BigInt(fives - power);
    offer(positionalSpelling(coefficient.toString(), power, "", limit()));
  };
  // Establish a short bound before converting any very wide coefficient.
  const decimalFirst = logCoefficient < Math.ceil(oddBits / 4);
  if (decimalFirst) offerDecimal();
  if (dyadic) {
    for (let shift = 0; shift < 4; shift++) {
      if (Math.ceil((oddBits + shift) / 4) + 2 > limit()) continue;
      const coefficient = (odd << BigInt(shift)).toString(16).toUpperCase();
      offer(positionalSpelling(coefficient, twos - shift, "0x", limit()));
    }
    if (oddBits + 2 <= limit())
      offer(positionalSpelling(odd.toString(2), twos, "0b", limit()));
  }
  if (!decimalFirst) offerDecimal();
  if (dyadic && limit() >= 5) roundedSpellings({ n, d }, offer, limit);

  const coreLogLowerBound =
    significantDigits + denominator.core.toString().length - 2;
  const fractionAt = (power: number) => {
    if (Math.abs(power) > MAX_NUMERIC_EXPONENT) return;
    const a = twos - power,
      b = fives - power;
    const exponent = exponentText(power, "e");
    // Estimate only to discard candidates certainly longer than the winner.
    const lengthLowerBound =
      coreLogLowerBound +
      Math.abs(a) * logTwo +
      Math.abs(b) * logFive +
      3 +
      exponent.length;
    if (lengthLowerBound - 1 > limit()) return;
    const num =
      power === 0
        ? n
        : (numerator.core << BigInt(Math.max(0, a))) *
          5n ** BigInt(Math.max(0, b));
    const den =
      power === 0
        ? d
        : (denominator.core << BigInt(Math.max(0, -a))) *
          5n ** BigInt(Math.max(0, -b));
    if (den > 1n)
      offer({
        text: `(${num}/${den})${exponent}`,
        family: "fraction",
        exponent: !!exponent,
      });
  };
  fractionAt(fives);
  if (fives !== 0) fractionAt(0);
  // The product of the reduced coefficient's numerator and denominator is
  // smallest at power=fives. Every step away grows it by at least 5/2.
  const minimum = coreLogLowerBound + Math.abs(twos - fives) * logTwo + 3;
  for (
    let distance = 1;
    minimum + distance * (logFive - logTwo) - 1 <= limit();
    distance++
  ) {
    if (fives - distance !== 0) fractionAt(fives - distance);
    if (fives + distance !== 0) fractionAt(fives + distance);
  }
  if (!selection.best) throw new Error("Rational has no valid spelling");
  const { text, family } = selection.best;
  if (!negative) return text;
  return family === "fraction" ? "(-" + text.slice(1) : "-" + text;
}

/** Syntax number literal whose payload is the exact Rational. */
export function syntaxNumber(
  r: Rational,
  spelling?: string,
): Extract<Syntax, { kind: "literal" }> {
  return {
    kind: "literal",
    value: r,
    spelling: spelling ?? formatRational(r),
  };
}
export function syntaxFromNumeric(
  value: number | Rational,
  spelling?: string,
): Extract<Syntax, { kind: "literal" }> {
  return syntaxNumber(
    typeof value === "number" ? float64ToRational(value) : value,
    spelling,
  );
}
export function addRationals(a: Rational, b: Rational): Rational {
  return reduceRational(a.n * b.d + b.n * a.d, a.d * b.d);
}
export function subRationals(a: Rational, b: Rational): Rational {
  return reduceRational(a.n * b.d - b.n * a.d, a.d * b.d);
}
export function mulRationals(a: Rational, b: Rational): Rational {
  return reduceRational(a.n * b.n, a.d * b.d);
}
export function divRationals(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new LanguageError("result exceeds safe numeric range");
  return reduceRational(a.n * b.d, a.d * b.n);
}
export function remRationals(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new LanguageError("result exceeds safe numeric range");
  const q = (a.n * b.d) / (a.d * b.n);
  return subRationals(a, mulRationals(reduceRational(q, 1n), b));
}
export function powRationals(a: Rational, b: Rational): Rational {
  if (b.d !== 1n || b.n < 0n)
    throw new LanguageError("result exceeds safe numeric range");
  let n = 1n,
    d = 1n;
  for (let i = 0n; i < b.n; i++) {
    n *= a.n;
    d *= a.d;
  }
  return reduceRational(n, d);
}
