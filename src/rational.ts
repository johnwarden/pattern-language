import { LanguageError } from "./diagnostics.ts";
import type { Syntax } from "./syntax.ts";

/** Exact ratio in lowest terms, with a positive denominator. */
export type Rational = { n: bigint; d: bigint };
export type ExactNumeric = Rational | { real: Rational; imaginary: Rational };
export const isRational = (value: unknown): value is Rational =>
  typeof value === "object" &&
  value !== null &&
  "n" in value &&
  "d" in value &&
  typeof value.n === "bigint" &&
  typeof value.d === "bigint";

export const isNumeric = (value: unknown): value is ExactNumeric =>
  isRational(value) ||
  (typeof value === "object" &&
    value !== null &&
    "real" in value &&
    "imaginary" in value &&
    isRational(value.real) &&
    isRational(value.imaginary));

const zero: Rational = { n: 0n, d: 1n };
const realPart = (value: ExactNumeric) =>
  isRational(value) ? value : value.real;
const imaginaryPart = (value: ExactNumeric) =>
  isRational(value) ? zero : value.imaginary;
function complex(real: Rational, imaginary: Rational): ExactNumeric {
  return imaginary.n === 0n ? real : { real, imaginary };
}

export function compareNumeric(a: ExactNumeric, b: ExactNumeric): number {
  return (
    compareRationals(realPart(a), realPart(b)) ||
    compareRationals(imaginaryPart(a), imaginaryPart(b))
  );
}

export function numericKey(value: ExactNumeric): string[] {
  const key = (r: Rational) => [r.n.toString(), r.d.toString()];
  return isRational(value)
    ? key(value)
    : [...key(value.real), ...key(value.imaginary)];
}
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
const decimalDigits = "(?:[0-9]{1,3}(?:_[0-9]{3})+|[0-9]+)";
const decimalInteger = "(?:[1-9][0-9]{0,2}(?:_[0-9]{3})+|[1-9][0-9]*|0)";
const decimalExponent = `[eE]([+-]?${decimalInteger})`;
const decimal = `(${decimalInteger})(?:\\.(${decimalDigits}))?(?:${decimalExponent})?`;
const byteDigits = (digit: string, width: number) => {
  const bytes = `(?:${digit}{${width}})+`;
  return `(?:${bytes}(?:_${bytes})+|${digit}+)`;
};
// Binary `p` exponents share decimal-integer digit rules with `e` (no leading zeros).
const binaryExponent = `[+-]?${decimalInteger}`;
const binDigits = byteDigits("[01]", 8);
const hexDigits = byteDigits("[0-9a-fA-F]", 2);
const binary = `${binDigits}(?:\\.${binDigits})?`;
const hex = `${hexDigits}(?:\\.${hexDigits})?`;
const decimalSpelling = new RegExp(`^${decimal}$`);
const hexSpelling = new RegExp(`^${hex}$`);
const bitSpelling = new RegExp(`^${binary}$`);
const exponentSpelling = new RegExp(`^${binaryExponent}$`);
const pExponent = `(?:[pP]${binaryExponent})?`;
const eExponent = `(?:[eE][+-]?${decimalInteger})?`;
const integer = `(?:0[xX]${hexDigits}|0[bB]${binDigits}|${decimalInteger})`;
const scaled = `(?:0[xX]${hexDigits}${pExponent}|0[bB]${binDigits}${pExponent}|${decimalInteger}${eExponent})`;
const scalar = `(?:0[fF]${decimal}|0[xX]${hex}${pExponent}|0[bB]${binary}${pExponent}|${decimal})`;
const real = `(?:${scaled}/${integer}|${scalar})`;
const imaginary = `(?:${scaled}i/${integer}|${scalar}i)`;
const numericPrefix = new RegExp(
  `(?:(?<mixedReal>${real})(?<sign>[+-])(?<mixedImag>${imaginary})|(?<imag>${imaginary})|(?<real>${real}))`,
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
  if (digitsOnly.length > 5 || Number(digitsOnly) > MAX_NUMERIC_EXPONENT) {
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

export function isCompoundNumericSpelling(spelling: string): boolean {
  numericPrefix.lastIndex = 0;
  const match = numericPrefix.exec(spelling);
  return (
    match?.[0] === spelling &&
    !!(match.groups?.mixedReal || spelling.includes("/"))
  );
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
/** Source spelling of an exact number, including 0f as Float64 rounding. */
export function parseNumericSpelling(text: string): ExactNumeric | undefined {
  const spelling = text.trim();
  const start = Number(spelling.startsWith("-"));
  numericPrefix.lastIndex = start;
  const match = numericPrefix.exec(spelling);
  if (!match?.groups || match[0].length + start !== spelling.length) return;
  const { mixedReal, sign, mixedImag, real, imag } = match.groups;
  if (real) return parsePart(real, !!start);
  if (imag) {
    const imaginary = parsePart(imag, !!start);
    return imaginary && complex(zero, imaginary);
  }
  const re = parsePart(mixedReal, !!start);
  const im = parsePart(mixedImag, sign === "-");
  if (re && im) return complex(re, im);
}

function parsePart(part: string, negative: boolean): Rational | undefined {
  const [numerator, denominator] = part.split("/");
  const n = parseUnsignedNumeric(numerator.replace(/i$/, ""));
  if (!n) return;
  const signed = negative ? { n: -n.n, d: n.d } : n;
  if (!denominator) return signed;
  const d = parseUnsignedNumeric(denominator);
  if (!d || d.n === 0n) return;
  return divRationals(signed, d);
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
export function numericFromSyntax(
  n: Extract<Syntax, { kind: "literal" }>,
): ExactNumeric | undefined {
  if (typeof n.value === "string") return;
  if (isNumeric(n.value)) return n.value;
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
  // When the raw power is a legal exponent, the integer coefficient with that
  // exponent bounds how many zeros are worth trying. Past the reader cap that
  // form is illegal, so absorb overflow into coefficient digits and search up
  // to the shorter of the caller's limit and a finite expanded/capped length.
  const uncappedLength = count + exponentText(power, marker).length;
  let available: number;
  if (Math.abs(power) <= MAX_NUMERIC_EXPONENT) {
    available = Math.min(limit - family.length, uncappedLength);
  } else {
    const overflow = Math.abs(power) - MAX_NUMERIC_EXPONENT;
    const overflowDigits = Math.ceil(overflow / step);
    const cappedLength =
      count +
      overflowDigits +
      exponentText(
        power < 0 ? -MAX_NUMERIC_EXPONENT : MAX_NUMERIC_EXPONENT,
        marker,
      ).length;
    const expandedLength =
      count + Math.ceil(Math.abs(power) / step) + (power < 0 ? 2 : 0);
    available = Math.min(
      limit - family.length,
      Math.max(cappedLength, expandedLength),
    );
  }
  if (!Number.isFinite(available) || available < 1) return;
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

  // Seed a finite, reader-accepted spelling before any search. Without this,
  // limit() stays Infinity, capped-exponent skips can leave no positional
  // candidate, and the fraction distance loop grows 5n**b until OOM.
  if (d === 1n) {
    offer({ text: n.toString(), family: "", exponent: false });
  } else {
    offer({
      text: `${n}/${d}`,
      family: "fraction",
      exponent: false,
    });
  }

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

  const shortestInteger = (value: bigint) => {
    const decimal = value.toString();
    const hex = "0x" + value.toString(16).toUpperCase();
    return hex.length < decimal.length ||
      (hex.length === decimal.length && hex < decimal)
      ? hex
      : decimal;
  };
  // The digit bound uses base 16, the most compact allowed radix. The bound
  // grows monotonically away from the scale that minimizes numerator × denominator.
  const coreBound =
    (bitLength(numerator.core) + bitLength(denominator.core) - 2) / 4;
  const searchFractions = (marker: "e" | "p", ideal: number) => {
    const center = Math.max(
      -MAX_NUMERIC_EXPONENT,
      Math.min(MAX_NUMERIC_EXPONENT, ideal),
    );
    const visit = (power: number): boolean => {
      if (Math.abs(power) > MAX_NUMERIC_EXPONENT) return false;
      const a = twos - power;
      const b = fives - (marker === "e" ? power : 0);
      const bound =
        coreBound + (Math.abs(a) + Math.abs(b) * Math.log2(5)) / 4 + 1;
      if (bound - 1 > limit()) return false;
      const exponent = exponentText(power, marker);
      if (bound + exponent.length - 1 > limit()) return true;
      if (denominator.core === 1n && a >= 0 && b >= 0) return true;
      const num =
        (numerator.core << BigInt(Math.max(0, a))) *
        5n ** BigInt(Math.max(0, b));
      const den =
        (denominator.core << BigInt(Math.max(0, -a))) *
        5n ** BigInt(Math.max(0, -b));
      const head =
        power === 0
          ? shortestInteger(num)
          : marker === "e"
            ? num.toString()
            : num === 1n
              ? "0b1"
              : "0x" + num.toString(16).toUpperCase();
      offer({
        text: head + exponent + "/" + shortestInteger(den),
        family: "fraction",
        exponent: power !== 0,
      });
      return true;
    };
    if (!visit(center)) return;
    for (let power = center - 1; visit(power); power--) {
      /* advance away from the optimum */
    }
    for (let power = center + 1; visit(power); power++) {
      /* advance away from the optimum */
    }
  };
  searchFractions("e", fives);
  searchFractions("p", twos);
  if (!selection.best) throw new Error("Rational has no valid spelling");
  return (negative ? "-" : "") + selection.best.text;
}

export function formatNumeric(value: ExactNumeric): string {
  if (isRational(value)) return formatRational(value);
  const negative = value.imaginary.n < 0n;
  const imag = formatRational({
    n: negative ? -value.imaginary.n : value.imaginary.n,
    d: value.imaginary.d,
  });
  const slash = imag.indexOf("/");
  const coefficient =
    slash < 0 ? imag + "i" : imag.slice(0, slash) + "i" + imag.slice(slash);
  if (value.real.n === 0n) return (negative ? "-" : "") + coefficient;
  return formatRational(value.real) + (negative ? "-" : "+") + coefficient;
}

/** Syntax number literal whose payload is an exact numeric value. */
export function syntaxNumber(
  value: ExactNumeric,
  spelling?: string,
): Extract<Syntax, { kind: "literal" }> {
  return {
    kind: "literal",
    value,
    spelling: spelling ?? formatNumeric(value),
  };
}
export function syntaxFromNumeric(
  value: number | ExactNumeric,
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

/** Fixed-width integer formats in the initial prelude. */
export type FixedIntegerKind = "int32" | "int64" | "uint64";
export const INT32_MIN = -(2n ** 31n);
export const INT32_MAX = 2n ** 31n - 1n;
export const INT64_MIN = -(2n ** 63n);
export const INT64_MAX = 2n ** 63n - 1n;
export const UINT64_MAX = 2n ** 64n - 1n;

export function fitsFixedInteger(
  value: Rational,
  kind: FixedIntegerKind,
): boolean {
  if (value.d !== 1n) return false;
  switch (kind) {
    case "int32":
      return value.n >= INT32_MIN && value.n <= INT32_MAX;
    case "int64":
      return value.n >= INT64_MIN && value.n <= INT64_MAX;
    case "uint64":
      return value.n >= 0n && value.n <= UINT64_MAX;
  }
}

/** Integer + - * / % over fixed formats; / truncates toward zero. */
export function fixedIntegerArithmetic(
  op: string,
  left: Rational,
  right: Rational,
): Rational {
  if (left.d !== 1n || right.d !== 1n)
    throw new LanguageError("expected an integer");
  switch (op) {
    case "+":
      return { n: left.n + right.n, d: 1n };
    case "-":
      return { n: left.n - right.n, d: 1n };
    case "*":
      return { n: left.n * right.n, d: 1n };
    case "/":
      if (right.n === 0n)
        throw new LanguageError("result exceeds safe numeric range");
      return { n: left.n / right.n, d: 1n };
    case "%":
      if (right.n === 0n)
        throw new LanguageError("result exceeds safe numeric range");
      return { n: left.n % right.n, d: 1n };
    default:
      throw new LanguageError("expected an integer operation");
  }
}

export function negateNumeric(value: ExactNumeric): ExactNumeric {
  const neg = (part: Rational) => ({ n: -part.n, d: part.d });
  return isRational(value)
    ? neg(value)
    : complex(neg(value.real), neg(value.imaginary));
}

export function exactArithmetic(
  op: string,
  a: ExactNumeric,
  b: ExactNumeric,
): ExactNumeric {
  if (op === "^") {
    if (!isRational(b))
      throw new LanguageError("expected a real exponent for ^");
    return isRational(a) ? powRationals(a, b) : powComplex(a, b);
  }
  if (isRational(a) && isRational(b)) {
    switch (op) {
      case "+":
        return addRationals(a, b);
      case "-":
        return subRationals(a, b);
      case "*":
        return mulRationals(a, b);
      case "/":
        return divRationals(a, b);
      case "%":
        return remRationals(a, b);
    }
  }
  const re = realPart(a),
    im = imaginaryPart(a);
  const rhsReal = realPart(b),
    rhsImag = imaginaryPart(b);
  switch (op) {
    case "+":
      return complex(addRationals(re, rhsReal), addRationals(im, rhsImag));
    case "-":
      return complex(subRationals(re, rhsReal), subRationals(im, rhsImag));
    case "*":
      return complex(
        subRationals(mulRationals(re, rhsReal), mulRationals(im, rhsImag)),
        addRationals(mulRationals(re, rhsImag), mulRationals(im, rhsReal)),
      );
    case "/": {
      const norm = addRationals(
        mulRationals(rhsReal, rhsReal),
        mulRationals(rhsImag, rhsImag),
      );
      return complex(
        divRationals(
          addRationals(mulRationals(re, rhsReal), mulRationals(im, rhsImag)),
          norm,
        ),
        divRationals(
          subRationals(mulRationals(im, rhsReal), mulRationals(re, rhsImag)),
          norm,
        ),
      );
    }
    default:
      throw new LanguageError("expected real operands for " + op);
  }
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
  const exponent = nonnegativeIntegerExponent(b);
  let n = 1n,
    d = 1n;
  for (let i = 0n; i < exponent; i++) {
    n *= a.n;
    d *= a.d;
  }
  return reduceRational(n, d);
}

function powComplex(base: ExactNumeric, exponent: Rational): ExactNumeric {
  let power = nonnegativeIntegerExponent(exponent);
  let result: ExactNumeric = { n: 1n, d: 1n };
  while (power > 0n) {
    if (power % 2n === 1n) result = exactArithmetic("*", result, base);
    power /= 2n;
    if (power > 0n) base = exactArithmetic("*", base, base);
  }
  return result;
}

function nonnegativeIntegerExponent(exponent: Rational): bigint {
  if (exponent.d !== 1n || exponent.n < 0n)
    throw new LanguageError("result exceeds safe numeric range");
  return exponent.n;
}
