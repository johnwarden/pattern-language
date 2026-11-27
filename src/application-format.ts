import type { Field } from "./syntax.ts";

/** One application/pack formatting rule for syntax and evaluated expression data. */
export interface ApplicationNotation<T> {
  application: (node: T) => { head: T; body: Field<T>[] } | undefined;
  punctuation: (node: T) => string | undefined;
  render: (node: T) => string;
  fields: (body: Field<T>[]) => string;
  needsGrouping?: (node: T) => boolean;
  /** Wrap a right infix child when printing it next to its parent would be rejected. */
  rejectedAdjacent?: (parent: string, child: string) => boolean;
}

function binaryParts<T>(node: T, notation: ApplicationNotation<T>) {
  const outer = notation.application(node);
  const inner = outer && notation.application(outer.head);
  const operator = inner && notation.punctuation(inner.head);
  return outer && inner && operator
    ? { operator, left: inner.body, right: outer.body }
    : undefined;
}

/** True when the node is a binary infix application under the shared notation. */
export function isInfixApplication<T>(
  node: T,
  notation: ApplicationNotation<T>,
): boolean {
  return !!binaryParts(node, notation);
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
    const child = binaryParts(value, notation);
    const rejectedRight =
      !left &&
      !!child &&
      !!notation.rejectedAdjacent?.(parts.operator, child.operator);
    return (left && (child || notation.punctuation(value))) ||
      rejectedRight ||
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
