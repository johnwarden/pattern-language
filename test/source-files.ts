import { fileURLToPath } from "node:url";
import { collectTestFiles, TEST_ROOT } from "../src/test-files.ts";
export function sourceFiles(directory: URL): Record<string, string> {
  return collectTestFiles([fileURLToPath(directory)], TEST_ROOT);
}
