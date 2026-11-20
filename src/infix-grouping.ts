/** Adjacent-pair checks for explicit infix grouping. */

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
/** Non-associative operators whose infix right operand must be grouped. */
const RIGHT_GROUPING = new Set(["-", "/", "%"]);

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
 * Accepted chains keep equal precedence and right association.
 */
export function requiresParentheses(first: string, second: string): boolean {
  if (ADDITIVE.has(first) && MULTIPLICATIVE.has(second)) return true;
  if (MULTIPLICATIVE.has(first) && ADDITIVE.has(second)) return true;
  if (RIGHT_GROUPING.has(first)) return true;
  if (isArithmetic(first) && isComparison(second)) return true;
  if (isComparison(first) && isArithmetic(second)) return true;
  if (isLogical(first)) {
    if (isArithmetic(second) || isComparison(second)) return true;
    if (isLogical(second) && first !== second) return true;
  }
  if (isLogical(second)) {
    if (isArithmetic(first) || isComparison(first)) return true;
  }
  if (second === "=" && isBindingLeftSensitive(first)) return true;
  return false;
}

/**
 * Printer wrap for a right infix child next to its parent.
 * Rejected pairs need parentheses; so do mixed arithmetic spellings such as
 * `a + (b - c)`, which reparse without parentheses.
 */
export function needsPrintGrouping(parent: string, child: string): boolean {
  return (
    requiresParentheses(parent, child) ||
    (isArithmetic(parent) && isArithmetic(child) && parent !== child)
  );
}

export const INFIX_GROUPING_CODE = "E_INFIX_GROUPING";

export interface InfixOperatorSpelling {
  text: string;
  display: string;
}

export interface SourceRange {
  start: number;
  end: number;
}

/** True when the operator list still has a rejected adjacent pair. */
export function chainHasGroupingConflict(operators: string[]): boolean {
  for (let i = 0; i < operators.length - 1; i++)
    if (requiresParentheses(operators[i]!, operators[i + 1]!)) return true;
  return false;
}

function remainingConflict(
  operators: string[],
  pairIndex: number,
  side: "left" | "right",
): boolean {
  // Left groups operators[pairIndex]; right groups operators[pairIndex + 1].
  const next =
    side === "left"
      ? [
          ...operators.slice(0, pairIndex),
          ...operators.slice(pairIndex + 1),
        ]
      : [
          ...operators.slice(0, pairIndex + 1),
          ...operators.slice(pairIndex + 2),
        ];
  return chainHasGroupingConflict(next);
}

function spliceParens(
  source: string,
  from: number,
  to: number,
): string {
  return source.slice(0, from) + "(" + source.slice(from, to) + ")" + source.slice(to);
}

/**
 * Build the Write / Mixing-or-Repeating diagnostic for the first rejected pair.
 * `operands` and `operators` are parallel chain slots; ranges slice `source`.
 */
export function parenthesesRequiredMessage(
  source: string,
  operands: SourceRange[],
  operators: InfixOperatorSpelling[],
  pairIndex: number,
): string {
  const left = operands[pairIndex]!;
  const mid = operands[pairIndex + 1]!;
  const right = operands[pairIndex + 2]!;
  const first = operators[pairIndex]!;
  const second = operators[pairIndex + 1]!;
  const leftOption = spliceParens(source, left.start, mid.end);
  const rightOption = spliceParens(source, mid.start, right.end);
  const leftClears = !remainingConflict(
    operators.map((op) => op.text),
    pairIndex,
    "left",
  );
  const rightClears = !remainingConflict(
    operators.map((op) => op.text),
    pairIndex,
    "right",
  );
  let leftText: string;
  let rightText: string;
  if (leftClears && rightClears) {
    leftText = leftOption;
    rightText = rightOption;
  } else {
    const a = source.slice(left.start, left.end);
    const b = source.slice(mid.start, mid.end);
    const c = source.slice(right.start, right.end);
    leftText = `(${a} ${first.display} ${b}) ${second.display} ${c}`;
    rightText = `${a} ${first.display} (${b} ${second.display} ${c})`;
  }
  const rule =
    first.display === second.display
      ? `Repeating ${first.display} requires parentheses.`
      : `Mixing ${first.display} and ${second.display} requires parentheses.`;
  return (
    `Syntax error. Write \`${leftText}\` or \`${rightText}\`.\n` + rule
  );
}
