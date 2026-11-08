import { LanguageError } from "./syntax.ts";

/** Layout/grammar incompleteness, not a finished invalid statement. */
export function isIncompleteReplEntry(error: unknown): boolean {
  if (!(error instanceof LanguageError)) return false;
  const code = error.diagnostic.code;
  if (code === "E_BLOCK_END" || code === "E_QUOTE_END") return true;
  const message = error.diagnostic.message;
  return (
    /unclosed delimiter/.test(message) ||
    /^incomplete or invalid /.test(message) ||
    /unknown or incomplete macro form/.test(message)
  );
}

/** True when the surface grammar can accept this buffer as a finished REPL entry. */
export function replEntryReady(
  source: string,
  parse: (source: string) => unknown,
): boolean {
  if (!source.trim()) return false;
  try {
    parse(source);
    return true;
  } catch (error) {
    return !isIncompleteReplEntry(error);
  }
}

export interface ReplStep {
  pending: string;
  submit?: string;
  quit?: boolean;
}

/** Consume one physical line. A blank line still force-submits a pending buffer. */
export function applyReplLine(
  pending: string,
  line: string,
  ready: (source: string) => boolean,
): ReplStep {
  if (!pending && line.trim() === ":quit") return { pending: "", quit: true };
  if (!line.trim())
    return pending ? { pending: "", submit: pending } : { pending: "" };
  const next = pending + line + "\n";
  return ready(next) ? { pending: "", submit: next } : { pending: next };
}
