import { LanguageError } from "./diagnostics.ts";

/** Source and String adapters admit Unicode scalars, never lone surrogates. */
export function scalarText(value: string): string {
  for (const character of value) {
    const point = character.codePointAt(0)!;
    if (point >= 0xd800 && point <= 0xdfff)
      throw new LanguageError("unpaired Unicode surrogate", undefined, {
        code: "E_UNICODE_SCALAR",
        phase: "parse",
      });
  }
  return value;
}
export const lineSeparator = (character: string): boolean =>
  /[\n\r\v\f\u0085\u2028\u2029]/u.test(character);
const named: Record<string, string> = {
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\v": "\\v",
  "\b": "\\b",
  "\f": "\\f",
  "\0": "\\0",
  '"': '\\"',
  "\\": "\\\\",
};
/** Literal template fragments cannot manufacture later holes. */
export function escapedText(value: string, template = false): string {
  scalarText(value);
  let result = "";
  for (const character of value) {
    const point = character.codePointAt(0)!;
    result +=
      template && character === "$"
        ? "\\u0024"
        : (named[character] ??
          (point < 0x20 ||
          (point >= 0x7f && point <= 0x9f) ||
          lineSeparator(character)
            ? "\\u" + point.toString(16).toUpperCase().padStart(4, "0")
            : character));
  }
  return result;
}
/** Readable display and canonical String source have the same spelling. */
export const stringSource = (value: string, _indent = 0): string =>
  '"' + escapedText(value) + '"';
export const displayString = stringSource;
