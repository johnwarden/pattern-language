import { LanguageError } from "./diagnostics.ts";

const openingFence = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const closingFence = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const patternTestInfo = /^pattern[ \t]+test$/;

function isPatternTestInfo(info: string): boolean {
  return patternTestInfo.test(info.trim());
}

/** Collect Pattern fences into one source while preserving document coordinates. */
export function markdownTestSource(name: string, source: string) {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  const code = lines.map(() => "");
  const offsets: number[] = [];
  let fence:
    | {
        marker: string;
        indent: number;
        line: number;
        explicitTest: boolean;
        runnable: boolean;
      }
    | undefined;
  const fenceError = (message: string, line: number, indent: number) =>
    new LanguageError(
      message,
      { line: line + 1, column: indent + 1, source: { name, text: source } },
      { code: "E_TEST_FILE", phase: "parse" },
    );

  for (const [index, line] of lines.entries()) {
    if (!fence) {
      const opener = openingFence.exec(line);
      if (opener && !(opener[2][0] === "`" && opener[3].includes("`"))) {
        const info = opener[3].trim();
        const explicitTest = isPatternTestInfo(info);
        fence = {
          marker: opener[2],
          indent: opener[1].length,
          line: index,
          explicitTest,
          runnable: explicitTest || info === "" || info === "pattern",
        };
      }
      continue;
    }
    const closer = closingFence.exec(line);
    if (
      closer &&
      closer[1][0] === fence.marker[0] &&
      closer[1].length >= fence.marker.length
    ) {
      if (
        fence.explicitTest &&
        !code.slice(fence.line + 1, index).some((line) => line.trim())
      )
        throw fenceError("empty pattern test fence", fence.line, fence.indent);
      fence = undefined;
      continue;
    }
    if (!fence.explicitTest) {
      const nested = openingFence.exec(line);
      if (
        nested &&
        !(nested[2][0] === "`" && nested[3].includes("`")) &&
        isPatternTestInfo(nested[3])
      )
        throw fenceError(
          "pattern test fence nested inside another fence",
          index,
          nested[1].length,
        );
    }
    if (!fence.runnable) continue;
    const spaces = line.length - line.replace(/^ +/, "").length;
    const indent = Math.min(spaces, fence.indent);
    code[index] = line.slice(indent);
    offsets[index + 1] = indent;
  }
  if (fence)
    throw fenceError(
      fence.explicitTest
        ? "unclosed pattern test fence"
        : "unclosed Markdown fence",
      fence.line,
      fence.indent,
    );
  return {
    code: code.join("\n"),
    offset: (line: number) => offsets[line] ?? 0,
  };
}
