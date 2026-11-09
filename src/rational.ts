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
  view.setBigUint64(
    0,
    (sign < 0 ? 1n << 63n : 0n) | (biasedExp << 52n) | frac,
  );
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
const stripNumericUnderscores = (text: string): string => text.replace(/_/g, "");
const decimalSpelling =
  /^[0-9](?:_?[0-9])*(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?$/;
const hexSpelling =
  /^[0-9a-fA-F](?:_?[0-9a-fA-F])*(?:\.[0-9a-fA-F](?:_?[0-9a-fA-F])*)?$/;
const bitSpelling = /^[01](?:_?[01])*(?:\.[01](?:_?[01])*)?$/;
const exponentSpelling = /^[+-]?[0-9](?:_?[0-9])*$/;
function parseDecimalExact(spelling: string): Rational | undefined {
  if (!decimalSpelling.test(spelling)) return;
  const clean = stripNumericUnderscores(spelling);
  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(clean);
  if (!match) return;
  const frac = match[2] ?? "";
  const combined = BigInt(match[1] + frac);
  const scale = BigInt(frac.length) - (match[3] ? BigInt(match[3]) : 0n);
  return scale >= 0n
    ? reduceRational(combined, 10n ** scale)
    : reduceRational(combined * 10n ** -scale, 1n);
}
function parseBinaryPower(
  significand: string,
  base: 2 | 16,
  exp = "0",
): Rational | undefined {
  const pattern = base === 16 ? hexSpelling : bitSpelling;
  if (!pattern.test(significand) || !exponentSpelling.test(exp)) return;
  const clean = stripNumericUnderscores(significand);
  const [int, frac = ""] = clean.split(".");
  const combined = BigInt((base === 16 ? "0x" : "0b") + int + frac);
  const power =
    BigInt(stripNumericUnderscores(exp)) -
    BigInt(frac.length * (base === 16 ? 4 : 1));
  return power >= 0n
    ? reduceRational(combined * 2n ** power, 1n)
    : reduceRational(combined, 2n ** -power);
}
/** Source spelling of an exact Rational, including 0f as Float64 rounding. */
export function parseNumericSpelling(text: string): Rational | undefined {
  const t = text.trim();
  if (/^0[fF]/.test(t)) {
    const rest = t.slice(2);
    if (!decimalSpelling.test(rest)) return;
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
  if (n.span?.source && n.span.start !== undefined && n.span.end !== undefined) {
    const spelling = n.span.source.text.slice(n.span.start, n.span.end);
    const parsed = parseNumericSpelling(spelling);
    if (parsed) return parsed;
  }
  if (typeof n.value === "number" && Number.isFinite(n.value))
    return float64ToRational(n.value);
}
function finiteDecimal(r: Rational): string | undefined {
  let d = r.d,
    twos = 0n,
    fives = 0n;
  while (d % 2n === 0n) {
    d /= 2n;
    twos++;
  }
  while (d % 5n === 0n) {
    d /= 5n;
    fives++;
  }
  if (d !== 1n) return;
  const scale = twos > fives ? twos : fives;
  if (scale > 16n) return;
  let num = r.n;
  if (scale > twos) num *= 2n ** (scale - twos);
  if (scale > fives) num *= 5n ** (scale - fives);
  const sign = num < 0n ? "-" : "";
  if (num < 0n) num = -num;
  const digits = num.toString();
  if (scale === 0n) return sign + digits;
  const pad = Number(scale);
  const whole =
    digits.length > pad ? digits.slice(0, digits.length - pad) : "0";
  let frac =
    digits.length > pad
      ? digits.slice(digits.length - pad)
      : digits.padStart(pad, "0");
  frac = frac.replace(/0+$/, "");
  return frac ? sign + whole + "." + frac : sign + whole;
}
function formatFloat64Hex(x: number): string {
  if (Object.is(x, -0) || x === 0) return "0x0p0";
  const sign = x < 0 ? "-" : "";
  x = Math.abs(x);
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, x);
  const bits = view.getBigUint64(0);
  const exp = Number((bits >> 52n) & 0x7ffn);
  const frac = bits & 0xfffffffffffffn;
  if (exp === 0) {
    let mantissa = frac;
    let exponent = -1022;
    while (mantissa && mantissa < 1n << 52n) {
      mantissa <<= 1n;
      exponent--;
    }
    const hex = mantissa.toString(16).toUpperCase();
    const rest = hex.slice(1).replace(/0+$/, "");
    return sign + "0x" + hex[0] + (rest ? "." + rest : "") + "p" + exponent;
  }
  const mantissa = ((1n << 52n) | frac).toString(16).toUpperCase();
  const rest = mantissa.slice(1).replace(/0+$/, "");
  return (
    sign +
    "0x" +
    mantissa[0] +
    (rest ? "." + rest : "") +
    "p" +
    (exp - 1023)
  );
}
/** Canonical text for a supported Rational; unsupported spellings stay uninvented. */
export function formatRational(r: Rational): string {
  const decimal = finiteDecimal(r);
  if (decimal !== undefined) return decimal;
  const x = rationalToNumber(r);
  if (Number.isFinite(x)) {
    const back = float64ToRational(x);
    if (back.n * r.d === back.d * r.n) return formatFloat64Hex(x);
  }
  throw new LanguageError(
    "value has no structural representation yet",
    undefined,
    { code: "E_VALUE_SERIALIZATION" },
  );
}
export function tryFormatRational(r: Rational): string | undefined {
  try {
    return formatRational(r);
  } catch (error) {
    if (
      error instanceof LanguageError &&
      error.diagnostic.code === "E_VALUE_SERIALIZATION"
    )
      return;
    throw error;
  }
}
/** Syntax number literal whose payload is the exact Rational, with canonical spelling when one exists. */
export function syntaxNumber(
  r: Rational,
  spelling?: string,
): Extract<Syntax, { kind: "literal" }> {
  return {
    kind: "literal",
    value: r,
    spelling: spelling ?? tryFormatRational(r),
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
