import { parseSurface } from "./parser.ts";
import { isName, LanguageError } from "./syntax.ts";
import type { Syntax } from "./syntax.ts";

export interface BootstrapDeclaration {
  name: Extract<Syntax, { kind: "symbol" }>;
  pattern: Syntax[];
}

/** A one-line indented pattern is the same operand as the inline line. */
function unwrapGrammarPattern(pattern: Syntax[]): Syntax[] {
  if (pattern.length !== 1 || pattern[0].kind !== "block") return pattern;
  const block = pattern[0];
  if (block.lines.length !== 1) return pattern;
  const line = block.lines[0];
  const inner =
    line.kind === "sequence" && line.items.length === 1 ? line.items[0] : line;
  if (inner.kind === "symbol" && inner.name === "…") return pattern;
  return inner.kind === "sequence" ? inner.items : [inner];
}

/** Host seed reader. It uses only surface syntax, never the grammar it installs. */
export function readBootstrap(source: string): BootstrapDeclaration[] {
  const root = parseSurface(source, "grammar");
  if (root.kind !== "block")
    throw new LanguageError("expected grammar declarations");
  return root.lines.map((line) => {
    if (
      line.kind !== "sequence" ||
      line.items.length < 4 ||
      !isName(line.items[0], "def") ||
      !isName(line.items[2], "type")
    )
      throw new LanguageError(
        "grammar declarations use def Name type Pattern",
        line.span,
      );
    const name = line.items[1];
    if (name.kind !== "symbol" || name.quoted || !/^\p{Lu}/u.test(name.name))
      throw new LanguageError("expected a type name", name.span);
    return { name, pattern: unwrapGrammarPattern(line.items.slice(3)) };
  });
}
