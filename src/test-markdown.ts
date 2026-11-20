import { LanguageError } from "./diagnostics.ts";

const openingFence = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const closingFence = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

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
        if (/^pattern[ \t]+test$/.test(info))
          throw fenceError(
            "Use an unlabeled fence or label it pattern.",
            index,
            opener[1].length,
          );
        fence = {
          marker: opener[2],
          indent: opener[1].length,
          line: index,
          runnable: info === "" || info === "pattern",
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
      fence = undefined;
      continue;
    }
    const nested = openingFence.exec(line);
    if (
      nested &&
      nested[2][0] === fence.marker[0] &&
      nested[2].length >= fence.marker.length &&
      nested[3].trim() === "pattern"
    )
      throw fenceError(
        "Pattern fence starts before the previous Markdown fence closes",
        index,
        nested[1].length,
      );
    if (!fence.runnable) continue;
    const spaces = line.length - line.replace(/^ +/, "").length;
    const indent = Math.min(spaces, fence.indent);
    code[index] = line.slice(indent);
    offsets[index + 1] = indent;
  }
  if (fence)
    throw fenceError("unclosed Markdown fence", fence.line, fence.indent);
  return {
    code: code.join("\n"),
    offset: (line: number) => offsets[line] ?? 0,
  };
}
