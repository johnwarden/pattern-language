/** Leading tabs and spaces of a physical line. No visual tabstop width. */
export function lineIndent(text: string): string {
  return text.match(/^[ \t]*/)![0];
}

/** Compare indent prefixes. Nested means a strict string-prefix extension. */
export type IndentRelation = "same" | "nested" | "dedented" | "incompatible";

export function indentRelation(line: string, base: string): IndentRelation {
  if (line === base) return "same";
  if (line.startsWith(base)) return "nested";
  if (base.startsWith(line)) return "dedented";
  return "incompatible";
}

export function hasLinePrefix(text: string, prefix: string): boolean {
  return text.startsWith(prefix);
}

export function stripLinePrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : "";
}

export function indentBeyond(prefix: string, opener: string): boolean {
  return indentRelation(prefix, opener) === "nested";
}
