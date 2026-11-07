import { LanguageError, operator, isName } from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import type { Match } from "./pattern.ts";

/** The recognizer and declaration environment belong to the caller, not the surface reader. */
export interface BlockElaboration {
  read(items: Field<Syntax>[], position: number): Match<Syntax>[];
  /** Runs before the next form is recognized; may extend the scoped grammar. */
  accept(form: Syntax): Syntax | void;
  finish?(forms: Syntax[]): void;
}

/** Interpret surface lines in order, allowing clauses to cross line boundaries. */
export function elaborateBlock(
  block: Extract<Syntax, { kind: "block" }>,
  context: BlockElaboration,
): Syntax {
  const items: Field<Syntax>[] = [];
  const boundaries = new Set<number>();
  for (const line of block.lines) {
    const parts = line.kind === "sequence" ? line.items : [line];
    items.push(...parts.map((value) => ({ label: "_1", value })));
    boundaries.add(items.length);
  }
  const lines: Syntax[] = [];
  let pos = 0;
  while (pos < items.length) {
    const matches = context
      .read(items, pos)
      .filter((match) => match.end > pos && boundaries.has(match.end));
    if (matches.length !== 1)
      throw new LanguageError(
        matches.length ? "ambiguous form" : "form does not match the grammar",
        items[pos].value.span,
      );
    const match = matches[0];
    if (match.fields.length !== 1)
      throw new LanguageError(
        "a form recognizer must produce one syntax tree",
        items[pos].value.span,
      );
    const form = match.fields[0].value;
    const interpreted = context.accept(form);
    lines.push(interpreted ?? form);
    pos = match.end;
  }
  context.finish?.(lines);
  return { ...block, lines };
}

/** Policy of the prototype language, not a restriction on surface blocks or DSLs. */
export function validateLanguageBlock(lines: Syntax[], repl: boolean): void {
  if (repl) return;
  if (!lines.length)
    throw new LanguageError(
      "a program/block needs a final result pack",
      undefined,
      { code: "E_SYNTAX", phase: "parse" },
    );
  const tail = lines.at(-1)!;
  const last =
    tail.kind === "sequence" && tail.items.length === 1 ? tail.items[0] : tail;
  if (
    operator(last, "=") ||
    (last.kind === "form" &&
      ["Definition", "MacroRegistration"].includes(last.name)) ||
    (last.kind === "sequence" &&
      !!last.items[0] &&
      (isName(last.items[0], "def") || isName(last.items[0], "macro")))
  )
    throw new LanguageError(
      "a program/block must end with a result pack, not a binding or definition",
      last.span,
      { code: "E_SYNTAX", phase: "parse" },
    );
}
