/** Adjacent-pair checks for explicit infix grouping around bindings. */

const ADDITIVE = new Set(["+", "-"]);
const MULTIPLICATIVE = new Set(["*", "/", "%"]);
const COMPARISON = new Set([
  "<",
  "<=",
  ">",
  ">=",
  "==",
  "!=",
  "===",
  "!==",
]);
const LOGICAL = new Set(["&&", "||"]);

export function isArithmetic(op: string): boolean {
  return ADDITIVE.has(op) || MULTIPLICATIVE.has(op);
}

export function isComparison(op: string): boolean {
  return COMPARISON.has(op);
}

export function isLogical(op: string): boolean {
  return LOGICAL.has(op);
}

/** Operators that cannot sit unparenthesized directly left of `=`. */
export function isBindingLeftSensitive(op: string): boolean {
  return isArithmetic(op) || isComparison(op) || isLogical(op);
}

/**
 * True when adjacent infix operators at one expression level need parentheses.
 * Right operands of `=` stay free. An arithmetic, comparison, or logical
 * operator directly left of `=` must be grouped. Further pair checks from the
 * arithmetic-grouping proposal are not enforced here yet.
 */
export function requiresParentheses(first: string, second: string): boolean {
  return second === "=" && isBindingLeftSensitive(first);
}

export const INFIX_GROUPING_CODE = "E_INFIX_GROUPING";

export function parenthesesRequiredMessage(
  first: string,
  second: string,
): string {
  return `Parentheses required between \`${first}\` and \`${second}\``;
}
