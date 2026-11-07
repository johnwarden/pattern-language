import { operator, LanguageError } from "./syntax.ts";
import type { Syntax, Field, Span } from "./syntax.ts";
import { validateLanguageBlock } from "./elaboration.ts";

/** Core block operations. Pattern and expression trees keep their source provenance. */
export type Core =
  | { kind: "done" }
  | {
      kind: "let";
      pattern: Field<Syntax>[];
      value: Field<Syntax>[];
      next: Core;
      span?: Span;
    }
  | { kind: "then"; expression: Syntax; next: Core; span?: Span };
export const done: Core = { kind: "done" };

export function lowerStatement(form: Syntax, next: Core = done): Core {
  const binding = operator(form, "=");
  return binding
    ? {
        kind: "let",
        pattern: binding[0],
        value: binding[1],
        next,
        span: form.span,
      }
    : { kind: "then", expression: form, next, span: form.span };
}

/** Only invoke after grammatical interpretation; declarations need staged processing. */
export function lowerBlock(
  block: Extract<Syntax, { kind: "block" }>,
  repl = false,
): Core {
  validateLanguageBlock(block.lines, repl);
  if (
    block.lines.some(
      (n) =>
        n.kind === "sequence" ||
        (n.kind === "form" &&
          ["Definition", "MacroRegistration"].includes(n.name)),
    )
  )
    throw new LanguageError(
      "block lowering requires interpreted, definition-free forms",
      block.span,
      { code: "E_LOWERING_STAGE", phase: "declaration" },
    );
  return block.lines.reduceRight(
    (next, form) => lowerStatement(form, next),
    done,
  );
}
