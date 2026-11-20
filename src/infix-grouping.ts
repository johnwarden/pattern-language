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

/** One infix operand: prefer source slice when spanned, else its printed form. */
export interface InfixOperandText {
  start?: number;
  end?: number;
  printed: string;
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
      ? [...operators.slice(0, pairIndex), ...operators.slice(pairIndex + 1)]
      : [
          ...operators.slice(0, pairIndex + 1),
          ...operators.slice(pairIndex + 2),
        ];
  return chainHasGroupingConflict(next);
}

function operandText(source: string, operand: InfixOperandText): string {
  if (operand.start === undefined || operand.end === undefined)
    return operand.printed;
  return source.slice(operand.start, operand.end);
}

/** Render an infix chain, optionally wrapping one inclusive operand range. */
function formatChain(
  source: string,
  operands: InfixOperandText[],
  operators: InfixOperatorSpelling[],
  wrapFrom?: number,
  wrapTo?: number,
): string {
  let out = "";
  for (let i = 0; i < operands.length; i++) {
    if (wrapFrom !== undefined && i === wrapFrom) out += "(";
    out += operandText(source, operands[i]!);
    if (wrapTo !== undefined && i === wrapTo) out += ")";
    if (i < operators.length) out += " " + operators[i]!.display + " ";
  }
  return out;
}

/**
 * Build the Write / Mixing-or-Repeating diagnostic for the first rejected pair.
 * Suggestions cover only this infix expression node, never the surrounding
 * call, statement, or buffer. Prefer source slices; fall back to printed forms.
 */
export function parenthesesRequiredMessage(
  source: string,
  operands: InfixOperandText[],
  operators: InfixOperatorSpelling[],
  pairIndex: number,
): string {
  const first = operators[pairIndex]!;
  const second = operators[pairIndex + 1]!;
  const texts = operators.map((op) => op.text);
  const leftClears = !remainingConflict(texts, pairIndex, "left");
  const rightClears = !remainingConflict(texts, pairIndex, "right");
  // Suggestions start at the rejected pair's left operand so a free binding,
  // call, or earlier chain prefix is never reprinted.
  const fragment = leftClears && rightClears
    ? {
        operands: operands.slice(pairIndex),
        operators: operators.slice(pairIndex),
      }
    : {
        operands: operands.slice(pairIndex, pairIndex + 3),
        operators: operators.slice(pairIndex, pairIndex + 2),
      };
  const leftText = formatChain(
    source,
    fragment.operands,
    fragment.operators,
    0,
    1,
  );
  const rightText = formatChain(
    source,
    fragment.operands,
    fragment.operators,
    1,
    2,
  );
  const rule =
    first.display === second.display
      ? `Repeating ${first.display} requires parentheses.`
      : `Mixing ${first.display} and ${second.display} requires parentheses.`;
  return (
    `Syntax error. Write \`${leftText}\` or \`${rightText}\`.\n` + rule
  );
}
