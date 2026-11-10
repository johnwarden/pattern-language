/** Markdown test sources: the content of each ```pattern fence is a `.test` file. */

export interface PatternFence {
  /** 1-based Markdown line of the opening fence. */
  line: number;
  /**
   * The Markdown text with every line outside this fence's content replaced by an
   * empty line, so the `.test` reader reports real Markdown lines and columns.
   */
  source: string;
  /** Spaces of fence indentation removed from each content line; add to reported columns. */
  indent: number;
  /** Whether a top-level `test`, `todo test` or `legacy test` declaration is present. */
  hasTests: boolean;
}

export class UnterminatedFence extends Error {
  line: number;
  column: number;
  constructor(line: number, column: number) {
    super("unterminated pattern fence opened at line " + line);
    this.name = "UnterminatedFence";
    this.line = line;
    this.column = column;
  }
}

/** Length of the run of spaces at the start of `line`, at most `max`. */
function leading(line: string, max: number): number {
  let n = 0;
  while (n < max && line[n] === " ") n++;
  return n;
}
const OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const TEST_DECLARATION = /^(?:(?:todo|legacy)[ \t]+)?test(?:[ \t]|$)/;

/**
 * Fenced blocks whose info string starts with the word `pattern`. Follows the CommonMark
 * fence rules for backtick and tilde fences opened with up to three spaces of indentation;
 * fences nested in list items or block quotes are not recognized. Other fences are skipped
 * whole, so a `pattern` fence shown inside a longer ```text fence is not a test source.
 */
export function patternFences(markdown: string): PatternFence[] {
  const lines = markdown.split("\n");
  const fences: PatternFence[] = [];
  for (let i = 0; i < lines.length; i++) {
    const open = OPEN.exec(lines[i].replace(/\r$/, ""));
    if (!open) continue;
    const [, indent, marker, info] = open;
    if (marker[0] === "`" && info.includes("`")) continue;
    const closing = new RegExp(
      "^ {0,3}" + (marker[0] === "`" ? "`" : "~") + "{" + marker.length + ",}[ \\t]*$",
    );
    let end = -1;
    for (let j = i + 1; j < lines.length; j++)
      if (closing.test(lines[j].replace(/\r$/, ""))) {
        end = j;
        break;
      }
    const isPattern = info.trim().split(/\s+/)[0] === "pattern";
    if (end < 0) {
      if (isPattern) throw new UnterminatedFence(i + 1, indent.length + 1);
      break;
    }
    if (isPattern) {
      const content = lines.slice(i + 1, end);
      const base = content.find((line) => line.trim());
      const baseIndent = base === undefined ? 0 : base.length - base.trimStart().length;
      fences.push({
        line: i + 1,
        indent: indent.length,
        source: lines
          .map((line, index) =>
            index > i && index < end ? line.slice(leading(line, indent.length)) : "",
          )
          .join("\n"),
        hasTests: content.some(
          (line) =>
            line.length - line.trimStart().length === baseIndent &&
            TEST_DECLARATION.test(line.trimStart()),
        ),
      });
    }
    i = end;
  }
  return fences;
}
