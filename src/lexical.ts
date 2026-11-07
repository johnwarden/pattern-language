/** Shared punctuation-token boundaries for the reader and canonical formatter. */
export const punctuation = new Set("$+-*/=<>!&|^%~?@\\…");

export function punctuationEnd(
  source: string,
  start: number,
  _quoted = false,
): number {
  let end = start + 1;
  while (punctuation.has(source[end])) end++;

  return end;
}

export function infixPunctuation(name: string): boolean {
  // The lexer merges adjacent punctuation in prefix position.
  // Infix output has spaces, so arrows and other multi-character operators merge.
  return (
    name === "::" ||
    (name.length > 0 &&
      name[0] !== "…" &&
      [...name].every((c) => punctuation.has(c)))
  );
}

export const identifierName = (name: string): boolean =>
  ["[]", "{}", "_"].includes(name) ||
  /^_\d+$/.test(name) ||
  /^(?:(?:\p{Ll}\p{M}*)+[\p{N}]*|\p{Lu}\p{M}*(?:\p{Ll}\p{M}*)*[\p{N}]*)(?:\p{Lu}\p{M}*(?:\p{Ll}\p{M}*)+[\p{N}]*)*$/u.test(
    name,
  );
export const labelName = (name: string): boolean =>
  /^\p{Ll}/u.test(name) && identifierName(name);

/** Intrinsic surface symbol classes; constructor heads use the same spelling rules. */
export function symbolCategory(
  name: string,
): "SentenceCaseSymbol" | "TitleCaseSymbol" | "PunctuationSymbol" | undefined {
  if (!identifierName(name))
    return name.length &&
      [...name].every((c) => punctuation.has(c) || ":.[]{}".includes(c))
      ? "PunctuationSymbol"
      : undefined;
  if (/^\p{Ll}/u.test(name)) return "SentenceCaseSymbol";
  if (/^\p{Lu}/u.test(name)) return "TitleCaseSymbol";
  return ["[]", "{}", "_"].includes(name) || /^_\d+$/.test(name)
    ? "PunctuationSymbol"
    : undefined;
}
