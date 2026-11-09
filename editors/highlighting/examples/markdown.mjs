import { readFile } from "node:fs/promises";
import { createHighlighter } from "shiki";

export const patternLanguage = {
  ...JSON.parse(await readFile(new URL("../textmate/pattern-language.tmLanguage.json", import.meta.url), "utf8")),
  name: "pattern-language",
  aliases: ["pattern"],
};

// Pass this callback to a Markdown renderer that accepts a highlight callback
// (for example, markdown-it). Returning "" leaves other fences to the caller.
// The host renderer still owns Markdown parsing and unhighlighted-code escaping.
export async function createPatternFenceHighlighter(theme = "github-light") {
  const highlighter = await createHighlighter({ themes: [theme], langs: [patternLanguage] });
  return {
    highlight(code, info) {
      const language = info.trim().split(/\s+/, 1)[0];
      return ["pattern", "pattern-language"].includes(language)
        ? highlighter.codeToHtml(code, { lang: "pattern-language", theme })
        : "";
    },
    dispose() {
      highlighter.dispose();
    },
  };
}
