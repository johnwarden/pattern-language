import { LanguageError } from "./diagnostics.ts";
/** Preserve BOM for the parser's exactly-one-BOM rule. */
export function decodeSource(bytes: Uint8Array, name = "source"): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new LanguageError("invalid UTF-8 in " + name, undefined, {
      code: "E_SOURCE_ENCODING",
      phase: "parse",
    });
  }
}
