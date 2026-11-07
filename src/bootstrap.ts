import { parseSurface } from "./parser.ts";
import { isName, LanguageError } from "./syntax.ts";
import type { Syntax } from "./syntax.ts";

export interface BootstrapDeclaration {
  name: Extract<Syntax, { kind: "symbol" }>;
  pattern: Syntax[];
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
    return { name, pattern: line.items.slice(3) };
  });
}
