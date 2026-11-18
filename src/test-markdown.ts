import { LanguageError } from "./diagnostics.ts";

const openingFence = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const closingFence = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/** Read top-level fenced tests while preserving Markdown line numbers. */
export function* markdownTestSources(
  name: string,
  source: string,
): Generator<string> {
  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  let fence:
    { marker: string; indent: number; line: number; test: boolean } | undefined;
  const body: string[] = [];
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
        fence = {
          marker: opener[2],
          indent: opener[1].length,
          line: index,
          test: /^pattern[ \t]+test$/.test(opener[3].trim()),
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
      if (fence.test) {
        const code = body.join("\n");
        if (!code.trim())
          throw fenceError(
            "empty pattern test fence",
            fence.line,
            fence.indent,
          );
        yield "\n".repeat(fence.line + 1) + code + "\n";
        body.length = 0;
      }
      fence = undefined;
    } else if (fence.test) {
      const spaces = line.length - line.replace(/^ +/, "").length;
      body.push(line.slice(Math.min(spaces, fence.indent)));
    }
  }
  if (fence?.test)
    throw fenceError("unclosed pattern test fence", fence.line, fence.indent);
}
