import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import oniguruma from "vscode-oniguruma";
import { parseDocument } from "yaml";
import { generatedFiles, sublimeMarkdownGrammar } from "../generate.mjs";

const root = new URL("../", import.meta.url);
await oniguruma.loadWASM(await readFile(new URL("node_modules/vscode-oniguruma/release/onig.wasm", root)));
const syntax = sublimeMarkdownGrammar();
const rules = syntax.contexts["fenced-code-blocks"].slice(1);

function opening(line) {
  const scanner = new oniguruma.OnigScanner(rules.map((rule) => rule.match));
  try {
    const match = scanner.findNextMatchSync(line, 0);
    return match && {
      rule: rules[match.index],
      fence: line.slice(match.captureIndices[1].start, match.captureIndices[1].end),
      language: line.slice(match.captureIndices[2].start, match.captureIndices[2].end),
    };
  } finally {
    scanner.dispose();
  }
}

function closes(open, line) {
  const scanner = new oniguruma.OnigScanner([open.rule.escape.replaceAll("\\1", open.fence)]);
  try {
    return scanner.findNextMatchSync(line, 0) !== null;
  } finally {
    scanner.dispose();
  }
}

test("Markdown inherits stock rules and embeds the packaged Pattern grammar", async () => {
  const path = "sublime/PatternLanguage/Markdown.sublime-syntax";
  const files = await generatedFiles();
  const document = parseDocument(files.get(path), { strict: true, uniqueKeys: true });
  assert.deepEqual(document.errors, []);
  assert.deepEqual(document.toJS(), syntax);
  assert.equal(syntax.extends, "Packages/Markdown/Markdown.sublime-syntax");
  assert.equal(syntax.version, 2);
  assert.equal(syntax.scope, "text.html.markdown.pattern-language");
  assert.equal("file_extensions" in syntax, false);
  assert.deepEqual(syntax.contexts["fenced-code-blocks"][0], { meta_prepend: true });
  for (const rule of rules) {
    assert.equal(rule.embed, "Packages/PatternLanguage/PatternLanguage.sublime-syntax");
    assert.ok(rule.embed_scope.split(" ").includes("source.pattern-language"));
    assert.equal(rule.escape_captures[1], "punctuation.definition.raw.code-fence.end.markdown");
  }
  assert.equal(await readFile(new URL(path, root), "utf8"), files.get(path));
});

test("both requested fence labels, aliases and normal fence whitespace are recognized", () => {
  for (const source of [
    "```pattern\n",
    "```pattern test\n",
    "````pattern test\n",
    "  ~~~pattern\n",
    "```pattern-language test\n",
    "```PATTERN TEST\n",
  ]) {
    const result = opening(source);
    assert.ok(result, source);
    assert.match(result.language, /^pattern(?:-language)?$/i);
  }
  for (const source of [
    "```python\n", "```patterned\n", "```pattern-tests\n",
    "``pattern\n", "~~~python\n", "text ```pattern\n",
    "```pattern test `\n",
  ]) assert.equal(opening(source), null, source);
});

test("CommonMark fence indent: 0-3 spaces open a fence; 4 spaces or a tab do not", () => {
  for (const spaces of [0, 1, 2, 3]) {
    for (const marker of ["```", "~~~"]) {
      const source = " ".repeat(spaces) + marker + "pattern\n";
      assert.ok(opening(source), JSON.stringify(source));
    }
  }
  for (const source of [
    "    ```pattern\n",
    "    ~~~pattern\n",
    "\t```pattern\n",
    "\t~~~pattern\n",
    " \t```pattern\n",
  ]) assert.equal(opening(source), null, JSON.stringify(source));
});

test("only a matching fence of sufficient length exits embedded code", () => {
  for (const marker of ["`", "~"]) {
    const open = opening(marker.repeat(4) + "pattern test\n");
    assert.ok(open);
    assert.equal(closes(open, marker.repeat(3) + "\n"), false);
    assert.equal(closes(open, (marker === "`" ? "~" : "`").repeat(4) + "\n"), false);
    assert.equal(closes(open, marker.repeat(4) + " trailing text\n"), false);
    assert.equal(closes(open, "x " + marker.repeat(4) + "\n"), false);
    assert.equal(closes(open, marker.repeat(4) + "\n"), true);
    assert.equal(closes(open, "  " + marker.repeat(6) + "\r\n"), true);
  }
});

test("automatic Markdown syntax selection and archive contents", () => {
  const result = spawnSync("python3", [fileURLToPath(new URL("markdown_plugin_test.py", import.meta.url))], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("empty info strings embed Pattern", () => {
  for (const source of ["```\n", "  ~~~~  \t\r\n"]) {
    const open = opening(source);
    assert.ok(open);
    assert.ok(closes(open, open.fence + "\n"));
  }
});

test("inline delimiters pair only with a whole run of matching length", () => {
  const [rule] = syntax.contexts["pattern-inline"];
  const scanner = new oniguruma.OnigScanner([rule.match]);
  try {
    for (const [line, delimiter, end] of [
      ["Use `Int`.", "`", 8],
      ["Use ``Code` x``.", "``", 13],
    ]) {
      const open = scanner.findNextMatchSync(line, 0);
      assert.equal(open.captureIndices[1].length, delimiter.length);
      const close = new oniguruma.OnigScanner([rule.escape.replace("\\1", delimiter)]);
      try {
        assert.equal(close.findNextMatchSync(line, open.captureIndices[0].end).captureIndices[0].start, end);
      } finally {
        close.dispose();
      }
    }
    assert.equal(scanner.findNextMatchSync("An unmatched ` here", 0), null);
  } finally {
    scanner.dispose();
  }
});

test("indented blocks continue across blank lines and release dedented prose", () => {
  const [block, nested] = syntax.contexts["indented-code-blocks"];
  const indent = "(?:[ ]{4}|[ ]{0,3}\\t)";
  const compile = (regex) => new RegExp(regex.replaceAll("{{indented_code_block}}", indent));
  for (const line of ["    Some(Int)", "\t42", "  \tx"]) {
    assert.ok(compile(block.match).test(line));
    assert.equal(compile(block.escape).test(line), false);
  }
  for (const line of ["", "  ", "\r"]) assert.equal(compile(block.escape).test(line), false);
  for (const line of ["   prose", "> quoted prose", "# Heading"]) {
    assert.equal(compile(block.match).test(line), false);
    assert.ok(compile(block.escape).test(line));
  }
  assert.ok(compile(nested.escape).test("\n"));
});
