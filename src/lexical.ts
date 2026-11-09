/** Shared punctuation-token boundaries for the reader and canonical formatter. */
export const punctuation = new Set("#$+-*/=<>!&|^%~?@\\…");

/** A tight # belongs to punctuation; a separated # starts a line comment. */
export function isCommentStart(source: string, position: number): boolean {
  return (
    source[position] === "#" &&
    (position === 0 || /\s/.test(source[position - 1]))
  );
}

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
  /^[a-zA-Z][a-zA-Z0-9]*$/.test(name) ||
  upperSnakeName(name);
export const upperSnakeName = (name: string): boolean =>
  /^(?:[A-Z]{1,2}_|[A-Z]{3,}[A-Z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z][A-Z0-9]*)+)$/.test(
    name,
  );
export const labelName = (name: string): boolean =>
  /^[a-z]/.test(name) && identifierName(name);

/** Intrinsic surface symbol classes; constructor heads use the same spelling rules. */
export function symbolCategory(
  name: string,
):
  | "LowerCamelSymbol"
  | "UpperCamelSymbol"
  | "UpperSnakeSymbol"
  | "PunctuationSymbol"
  | undefined {
  if (!identifierName(name))
    return name.length &&
      [...name].every((c) => punctuation.has(c) || ":.[]{}".includes(c))
      ? "PunctuationSymbol"
      : undefined;
  if (upperSnakeName(name)) return "UpperSnakeSymbol";
  if (/^[a-z]/.test(name)) return "LowerCamelSymbol";
  if (/^[A-Z]/.test(name)) return "UpperCamelSymbol";
  return ["[]", "{}", "_"].includes(name) || /^_\d+$/.test(name)
    ? "PunctuationSymbol"
    : undefined;
}
