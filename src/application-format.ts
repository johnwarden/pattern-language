import type { Field } from "./syntax.ts";

/** One application/pack formatting rule for syntax and evaluated expression data. */
export interface ApplicationNotation<T> {
  application: (node: T) => { head: T; body: Field<T>[] } | undefined;
  punctuation: (node: T) => string | undefined;
  render: (node: T) => string;
  fields: (body: Field<T>[]) => string;
  needsGrouping?: (node: T) => boolean;
}

function binaryParts<T>(node: T, notation: ApplicationNotation<T>) {
  const outer = notation.application(node);
  const inner = outer && notation.application(outer.head);
  const operator = inner && notation.punctuation(inner.head);
  return outer && inner && operator
    ? { operator, left: inner.body, right: outer.body }
    : undefined;
}

export function applicationHead<T>(
  node: T,
  notation: ApplicationNotation<T>,
): string {
  const text = notation.render(node);
  return binaryParts(node, notation) || notation.needsGrouping?.(node)
    ? "(" + text + ")"
    : text;
}

export function infixApplication<T>(
  node: T,
  notation: ApplicationNotation<T>,
): string | undefined {
  const parts = binaryParts(node, notation);
  if (!parts) return;
  const operand = (body: Field<T>[], left: boolean) => {
    if (body.length !== 1 || body[0].label !== "_1")
      return "(" + notation.fields(body) + ")";
    const value = body[0].value;
    const text = notation.render(value);
    return (left &&
      (binaryParts(value, notation) || notation.punctuation(value))) ||
      notation.needsGrouping?.(value)
      ? "(" + text + ")"
      : text;
  };
  return (
    operand(parts.left, true) +
    " " +
    parts.operator +
    " " +
    operand(parts.right, false)
  );
}
