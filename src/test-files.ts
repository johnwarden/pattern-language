import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { decodeSource } from "./source-encoding.ts";

export const TEST_ROOT = fileURLToPath(new URL("../tests/", import.meta.url));
/** Stable keys; inbox is opt-in by a direct path. No symlinks or duplicates. */
export function collectTestFiles(
  paths: string[] = [TEST_ROOT],
  root?: string,
): Record<string, string> {
  const inputs = paths.map((p) => resolve(p));
  if (!inputs.length) return {};
  const insideTestRoot = inputs.every((path) => {
    const name = relative(TEST_ROOT, path);
    return name !== ".." && !name.startsWith(".." + sep);
  });
  if (!root && insideTestRoot) root = TEST_ROOT;
  if (!root) {
    root =
      inputs.length === 1
        ? statSync(inputs[0]).isDirectory()
          ? inputs[0]
          : dirname(inputs[0])
        : dirname(inputs[0]);
    while (
      inputs.some(
        (p) =>
          relative(root!, p) === ".." ||
          relative(root!, p).startsWith(".." + sep),
      )
    )
      root = dirname(root);
  }
  const inbox = join(root, "inbox");
  const includeInbox = inputs.some((path) => {
    const name = relative(inbox, path);
    return name !== ".." && !name.startsWith(".." + sep);
  });
  const found = new Map<string, string>();
  const visit = (path: string) => {
    if (path === inbox && !includeInbox) return;
    const info = statSync(path);
    if (info.isDirectory()) {
      for (const entry of readdirSync(path, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name, "en"),
      )) {
        if (
          entry.isDirectory() ||
          (entry.isFile() && extname(entry.name) === ".test")
        )
          visit(join(path, entry.name));
      }
    } else if (info.isFile() && extname(path) === ".test") {
      const real = realpathSync(path);
      if (!found.has(real)) found.set(real, path);
    } else throw new Error("test files must use .test: " + basename(path));
  };
  inputs.forEach(visit);
  return Object.fromEntries(
    [...found.values()]
      .map((path) => [
        relative(root!, path).split(sep).join("/"),
        decodeSource(readFileSync(path), path),
      ])
      .sort(([a], [b]) => a.localeCompare(b, "en")),
  );
}
