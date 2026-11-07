import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
import { TYPE_SCHEMA } from "./src/type-schema.ts";
import { LANGUAGE_SCHEMA, SYNTAX_SCHEMA } from "./src/language-description.ts";
import { CODE_SCHEMA } from "./src/code-schema.ts";
import { TEST_SCHEMA } from "./src/test-schema.ts";
import { collectTestFiles, TEST_ROOT } from "./src/test-files.ts";
import { join } from "node:path";
await writeFile("examples/test-schema.pattern", TEST_SCHEMA);
await writeFile("examples/type-descriptions.pattern", TYPE_SCHEMA);
await writeFile("examples/language-description.pattern", LANGUAGE_SCHEMA);
await writeFile("examples/syntax-tree.pattern", SYNTAX_SCHEMA + "SyntaxNode\n");
await writeFile("examples/code-grammar.pattern", CODE_SCHEMA);
await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "iife",
  globalName: "PatternLanguage",
  platform: "browser",
  target: "es2022",
  outfile: "dist/language.js",
  sourcemap: true,
});
await build({
  entryPoints: ["src/playground.ts"],
  plugins: [
    {
      name: "source-test-suite",
      setup(build) {
        build.onResolve({ filter: /^test-suite:examples$/ }, () => ({
          path: "examples",
          namespace: "source-test-suite",
        }));
        build.onLoad(
          { filter: /.*/, namespace: "source-test-suite" },
          async () => {
            const files = collectTestFiles(
              [join(TEST_ROOT, "examples")],
              TEST_ROOT,
            );
            return {
              contents: "export default " + JSON.stringify(files),
              loader: "js",
            };
          },
        );
      },
    },
  ],
  bundle: true,
  format: "iife",
  globalName: "PatternLanguage",
  platform: "browser",
  target: "es2022",
  outfile: "dist/playground.js",
  sourcemap: true,
});
console.log(
  "Built browser bundles from the same TypeScript modules used by the CLI.",
);
