/** Adjacent-pair checks for explicit infix grouping. */

/**
 * Operators that may repeat without parentheses.
 * `|` is the associative union constructor (defined right association).
 */
const ASSOCIATIVE = new Set(["+", "*", "&&", "||", "and", "or", "|"]);

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
const LOGICAL = new Set(["&&", "||", "and", "or"]);

/**
 * Operators the associative-chain rule covers. `^` and `::` are included and
 * are not associative. Dotted word operators such as `.plus` / `.div` /
 * `.times`, and arrow `->`, stay outside.
 */
const GROUPING_SENSITIVE = new Set([
  ...ADDITIVE,
  ...MULTIPLICATIVE,
  ...COMPARISON,
  ...LOGICAL,
  "|",
  "^",
  "::",
]);

export function isArithmetic(op: string): boolean {
  return ADDITIVE.has(op) || MULTIPLICATIVE.has(op);
}

export function isComparison(op: string): boolean {
  return COMPARISON.has(op);
}

export function isLogical(op: string): boolean {
  return LOGICAL.has(op);
}

export function isAssociative(op: string): boolean {
  return ASSOCIATIVE.has(op);
}

export function isGroupingSensitive(op: string): boolean {
  return GROUPING_SENSITIVE.has(op);
}

/**
 * True when adjacent infix operators at one expression level need parentheses.
 * The associative-chain rule applies only when both operators are grouping-
 * sensitive (`+ - * / % ^`, comparisons, `&&`/`||`/`and`/`or`, `|`, and `::`).
 * A chain of those may omit parentheses only when it repeats one associative
 * operator. `^` and `::` are sensitive and non-associative, so mixes and
 * repetitions need parentheses — including a sensitive operator next to `::`.
 * Binding `=` is parsed at lowest precedence (not via this check). Arrow `->`
 * keeps a free right-hand side. Every other pair keeps its previous
 * unconstrained reading.
 */
export function requiresParentheses(first: string, second: string): boolean {
  if (first === "=" || first === "->") return false;
  if (!isGroupingSensitive(first) || !isGroupingSensitive(second)) return false;
  return !(first === second && ASSOCIATIVE.has(first));
}

/**
 * Printer wrap for a right infix child next to its parent. Because `=` is
 * lowest precedence, any non-`=` parent with `=` as its right child needs
 * parentheses (`a + (b = c)`), or else `a + b = c` would re-read as
 * `(a + b) = c`. The right-hand side of `=` itself stays free.
 */
export function needsPrintGrouping(parent: string, child: string): boolean {
  if (child === "=" && parent !== "=") return true;
  return requiresParentheses(parent, child);
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
  const fragment =
    leftClears && rightClears
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
