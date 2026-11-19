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
const SPEC_ROOT = fileURLToPath(new URL("../specs/", import.meta.url));
const SPEC_ARCHIVE = join(SPEC_ROOT, "archive");

function isWithin(root: string, path: string): boolean {
  const name = relative(root, path);
  return name !== ".." && !name.startsWith(".." + sep);
}

function isTestFile(path: string): boolean {
  const extension = extname(path);
  return extension === ".test" || extension === ".md";
}

/** Stable keys. No symlinks or duplicates. */
export function collectTestFiles(
  paths: string[] = [TEST_ROOT, SPEC_ROOT],
  root?: string,
): Record<string, string> {
  const inputs = paths.map((p) => resolve(p));
  if (!inputs.length) return {};
  let sharedRoot =
    root ??
    (inputs.length === 1 && statSync(inputs[0]).isDirectory()
      ? inputs[0]
      : dirname(inputs[0]));
  if (!root) {
    while (inputs.some((path) => !isWithin(sharedRoot, path)))
      sharedRoot = dirname(sharedRoot);
  }
  const found = new Map<string, string>();
  const visit = (path: string) => {
    const info = statSync(path);
    if (info.isDirectory()) {
      const inTestDirectory = isWithin(TEST_ROOT, path);
      for (const entry of readdirSync(path, { withFileTypes: true }).sort(
        (a, b) => a.name.localeCompare(b.name, "en"),
      )) {
        const child = join(path, entry.name);
        if (child === SPEC_ARCHIVE) continue;
        if (
          entry.isDirectory() ||
          (entry.isFile() &&
            (inTestDirectory ? extname(child) === ".test" : isTestFile(child)))
        )
          visit(child);
      }
    } else if (info.isFile() && isTestFile(path)) {
      const real = realpathSync(path);
      if (!found.has(real)) found.set(real, path);
    } else throw new Error("test files must use .test or .md: " + basename(path));
  };
  inputs.forEach(visit);
  const key = (path: string) => {
    if (root) return relative(root, path);
    if (isWithin(TEST_ROOT, path)) return relative(TEST_ROOT, path);
    if (isWithin(SPEC_ROOT, path)) return join("specs", relative(SPEC_ROOT, path));
    return relative(sharedRoot, path);
  };
  return Object.fromEntries(
    [...found.values()]
      .map((path) => [
        key(path).split(sep).join("/"),
        decodeSource(readFileSync(path), path),
      ])
      .sort(([a], [b]) => a.localeCompare(b, "en")),
  );
}
