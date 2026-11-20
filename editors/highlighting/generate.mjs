import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const root = new URL("./", import.meta.url);
export const lexical = JSON.parse(await readFile(new URL("lexical.json", root), "utf8"));
const p = lexical.patterns;
const suffix = ".pattern-language";
const s = (scope) => scope + suffix;
const word = (pattern) => `(?<![\\p{L}\\p{N}_])(?:${pattern})(?![\\p{L}\\p{N}_])`;
const words = (items) => word(items.join("|"));
const capture = (name) => ({ name });
const match = (regex, name, captures) => ({ match: regex, ...(name ? { name: s(name) } : {}), ...(captures ? { captures } : {}) });
const include = (name) => ({ include: `#${name}` });

// These expressions describe lexical spelling, not typing, dispatch, or validity.
// Keep the spelling tables aligned with src/lexical.ts and src/rational.ts.
const numeric = `(?<![\\p{L}\\p{N}_])(?:0[fF]${p.decimal}|${p.hex}|${p.binary}|${p.decimal})(?![\\p{L}\\p{N}_])`;
const escape = String.raw`\\(?:[nrtvbf0"\\]|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})`;
// A reader's tight name' consumes the rest of the line, so it must not be
// mistaken for a closed inline string when locating a later block opener.
const closedSingle = String.raw`(?<![A-Za-z0-9_])(?<![A-Za-z0-9_]\$)'[^'\n]*'`;
const beforeBlock = String.raw`(?:[^#"'\n]|"(?:\\[^\n]|[^"\\\n])*"|${closedSingle})*?`;
const typedHead = word(p.identifier);
const quoteScope = s("punctuation.definition.string.begin");

const atoms = [
  match("(:)(::)", undefined, { 1: capture(s("punctuation.definition.symbol")), 2: capture(s("constant.other.symbol")) }),
  match("::", "keyword.operator.type"),
  match("\\.\\.\\.|…", "keyword.operator.rest"),
  match(`(?<![\\p{L}\\p{N}_])(:)((?:${p.identifier}|${p.wildcard})(?![\\p{L}\\p{N}_])|\\[\\]|\\{\\}|${p.operators})`, undefined, {
    1: capture(s("punctuation.definition.symbol")),
    2: capture(s("constant.other.symbol")),
  }),
  match(":(?=\\()", "punctuation.definition.quotation"),
  match(numeric, "constant.numeric"),
  match(words(lexical.declarations), "storage.type"),
  match(words(lexical.control), "keyword.control"),
  match(words(lexical.testDsl), "keyword.other.test"),
  match(words(lexical.constants), "constant.language"),
  match(words(lexical.intrinsicTypes), "support.type"),
  match(`${word("[a-z][A-Za-z0-9]*")}(?=:(?!:))`, "entity.name.tag"),
  match(word(p.upperSnake), "constant.other.symbol.upper-snake"),
  // A tight UpperCamel call head is a lexical constructor-like shape. Built-in
  // names above retain their roles; resolving user type factories is semantic.
  match(`${word("[A-Z][A-Za-z0-9]*")}(?=\\()`, "constant.other.symbol.constructor"),
  match(word("[A-Z][A-Za-z0-9]*"), "entity.name.type"),
  match(word(p.wildcard), "variable.language.wildcard"),
  match(word("[a-z][A-Za-z0-9]*"), "variable.other"),
  match(p.operators, "keyword.operator"),
  match("[.,:]", "punctuation.separator"),
];
const comment = match("(#).*$", "comment.line.number-sign", { 1: capture(s("punctuation.definition.comment")) });
const holes = [
  { begin: "(\\$+)(\\()", beginCaptures: { 1: capture(s("punctuation.definition.interpolation")), 2: capture(s("punctuation.section.interpolation.begin")) }, end: "\\)", endCaptures: { 0: capture(s("punctuation.section.interpolation.end")) }, contentName: s("meta.embedded.expression"), patterns: [include("code")] },
  match(`(\\$+)(${p.identifier}|${p.wildcard})`, undefined, { 1: capture(s("punctuation.definition.interpolation")), 2: capture(s("variable.other.interpolation")) }),
  match("\\$\\$", "constant.character.escape.dollar"),
];

const stringKinds = [
  { id: "double-interpolated", delimiter: String.raw`\$"`, closing: '"', scope: "string.quoted.double.interpolated", escaped: true, holes: true },
  { id: "single-interpolated", delimiter: String.raw`\$'`, closing: "'", scope: "string.quoted.single.interpolated", escaped: false, holes: true },
  { id: "double", delimiter: '"', closing: '"', scope: "string.quoted.double", escaped: true, holes: false },
  { id: "single", delimiter: "'", closing: "'", scope: "string.quoted.single", escaped: false, holes: false },
];
const typedKinds = [
  { id: "typed-interpolated", delimiter: String.raw`\$` + "`", holes: true },
  { id: "typed", delimiter: "`", holes: false },
];

export function textmateGrammar() {
  const repository = {
    code: { patterns: [include("comments"), include("blocks"), include("readers"), include("strings"), include("typed-quotes"), include("groups"), include("atoms")] },
    comments: { patterns: [comment] },
    atoms: { patterns: atoms },
    holes: { patterns: holes },
    escapes: { patterns: [match(escape, "constant.character.escape")] },
    groups: { patterns: [
      ...[["\\(", "\\)", "parens"], ["\\[", "\\]", "brackets"], ["\\{", "\\}", "braces"]].map(([begin, end, name]) => ({
        begin, end, beginCaptures: { 0: capture(s(`punctuation.section.${name}.begin`)) }, endCaptures: { 0: capture(s(`punctuation.section.${name}.end`)) }, patterns: [include("code")],
      })),
      match("[)\\]}]", "punctuation.section.group.end"),
    ] },
    "template-code": { patterns: [include("holes"), include("template-groups"), include("code")] },
    "template-groups": { patterns: [
      ...[["\\(", "\\)", "parens"], ["\\[", "\\]", "brackets"], ["\\{", "\\}", "braces"]].map(([begin, end, name]) => ({
        begin, end, beginCaptures: { 0: capture(s(`punctuation.section.${name}.begin`)) }, endCaptures: { 0: capture(s(`punctuation.section.${name}.end`)) }, patterns: [include("template-code")],
      })),
    ] },
    readers: { patterns: [
      ...[true, false].map((interpolate) => ({
        begin: `(${typedHead})(${interpolate ? "\\$" : ""}')`, beginCaptures: { 1: capture(s("entity.name.function.reader")), 2: capture(quoteScope) },
        end: "(?=$)", contentName: s("string.unquoted.reader.raw"), patterns: interpolate ? [include("holes")] : [],
      })),
      match(`${typedHead}(?=\\$?\")`, "entity.name.function.reader"),
    ] },
    strings: { patterns: stringKinds.map((kind) => ({
      begin: kind.delimiter, beginCaptures: { 0: capture(quoteScope) },
      end: `${kind.closing}|(?=$)`, endCaptures: { 0: capture(s("punctuation.definition.string.end")) },
      name: s(kind.scope), patterns: [...(kind.escaped ? [include("escapes")] : []), ...(kind.holes ? [include("holes")] : [])],
    })) },
    "typed-quotes": { patterns: typedKinds.map((kind) => ({
      begin: `(${typedHead})(${kind.delimiter})`, beginCaptures: { 1: capture(s("entity.name.type.quotation")), 2: capture(s("punctuation.definition.quotation")) },
      end: "(?=$)", contentName: s(kind.holes ? "meta.quotation.interpolated" : "meta.quotation.inert"), patterns: [include(kind.holes ? "template-code" : "code")],
    })) },
    blocks: { patterns: [
      ...stringKinds.map((kind) => ({
        begin: `^([ \\t]*)(${beforeBlock})(${typedHead})?(${kind.delimiter})(?=\\n)`,
        beginCaptures: { 2: { patterns: [include("inline-code")] }, 3: capture(s("entity.name.function.reader")), 4: capture(quoteScope) },
        end: "^\\1(end)[ \\t]*(?=#|$)", endCaptures: { 1: capture(s("keyword.control")) },
        contentName: s(kind.scope + ".block"), patterns: [...(kind.escaped ? [include("escapes")] : []), ...(kind.holes ? [include("holes")] : [])],
      })),
      ...typedKinds.map((kind) => ({
        begin: `^([ \\t]*)(${beforeBlock})(${typedHead})(${kind.delimiter})(?=\\n)`,
        beginCaptures: { 2: { patterns: [include("inline-code")] }, 3: capture(s("entity.name.type.quotation")), 4: capture(s("punctuation.definition.quotation")) },
        end: "^\\1(end)[ \\t]*(?=#|$)", endCaptures: { 1: capture(s("keyword.control")) },
        contentName: s(kind.holes ? "meta.quotation.interpolated" : "meta.quotation.inert"), patterns: [include(kind.holes ? "template-code" : "code")],
      })),
    ] },
  };
  repository["inline-code"] = { patterns: repository.code.patterns.filter((rule) => rule.include !== "#blocks") };
  return { $schema: "https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json", name: lexical.name, scopeName: lexical.scope, fileTypes: lexical.extensions, patterns: [include("code")], repository };
}

// Sublime's contexts remain explicit. Only lexical spelling and small rule
// fragments are shared; this is not a general grammar conversion framework.
export function sublimeGrammar() {
  const plain = (rule) => {
    if (rule.include) return { include: rule.include.slice(1) };
    const result = { match: rule.match };
    if (rule.name) result.scope = rule.name;
    if (rule.captures) result.captures = Object.fromEntries(Object.entries(rule.captures).map(([key, value]) => [key, value.name]));
    return result;
  };
  const inc = (name) => ({ include: name });
  const contexts = {
    main: [inc("comments"), inc("blocks"), inc("inline-code")],
    comments: [plain(comment)],
    "inline-code": [inc("comments"), inc("readers"), inc("strings"), inc("typed-quotes"), inc("groups"), inc("atoms")],
    atoms: atoms.map(plain),
    escapes: [plain(match(escape, "constant.character.escape"))],
    holes: [
      { match: "(\\$+)(\\()", captures: { 1: s("punctuation.definition.interpolation"), 2: s("punctuation.section.interpolation.begin") }, push: "hole-expression" },
      ...holes.slice(1).map(plain),
    ],
    "hole-expression": [
      { meta_scope: s("meta.embedded.expression") },
      { match: "\\)", scope: s("punctuation.section.interpolation.end"), pop: true },
      inc("main"),
    ],
    "template-code": [inc("holes"), inc("template-groups"), inc("main")],
    blocks: [], readers: [], strings: [], "typed-quotes": [], groups: [], "template-groups": [],
  };
  for (const kind of stringKinds) {
    contexts.strings.push({ match: kind.delimiter, scope: quoteScope, push: kind.id });
    contexts[kind.id] = [
      { meta_scope: s(kind.scope) }, { meta_include_prototype: false },
      { match: kind.closing, scope: s("punctuation.definition.string.end"), pop: true },
      { match: "$", pop: true },
      ...(kind.escaped ? [inc("escapes")] : []), ...(kind.holes ? [inc("holes")] : []),
    ];
    contexts.blocks.push({ match: `^([ \\t]*)(?=${beforeBlock}${kind.delimiter}\\n)`, push: [`block-${kind.id}`, `open-${kind.id}`] });
    contexts[`open-${kind.id}`] = [
      { match: `(${typedHead})(${kind.delimiter})(?=\\n)`, captures: { 1: s("entity.name.function.reader"), 2: quoteScope }, pop: true },
      { match: `${kind.delimiter}(?=\\n)`, scope: quoteScope, pop: true }, inc("inline-code"),
    ];
    const special = `${kind.escaped ? "\\\\" : ""}${kind.holes ? "$" : ""}`;
    contexts[`block-${kind.id}`] = [
      { meta_include_prototype: false },
      { match: "^\\1(end)[ \\t]*(?=#|$)", captures: { 1: s("keyword.control") }, pop: true },
      ...(kind.escaped ? [inc("escapes")] : []), ...(kind.holes ? [inc("holes")] : []),
      { match: special ? `[^${special}\\n]+` : "[^\\n]+", scope: s(kind.scope + ".block") },
      ...(special ? [{ match: `[${special}]`, scope: s(kind.scope + ".block") }] : []),
    ];
  }
  for (const kind of typedKinds) {
    const opening = `(${typedHead})(${kind.delimiter})`;
    const captures = { 1: s("entity.name.type.quotation"), 2: s("punctuation.definition.quotation") };
    contexts["typed-quotes"].push({ match: opening, captures, push: kind.id });
    contexts[kind.id] = [
      { meta_content_scope: s(kind.holes ? "meta.quotation.interpolated" : "meta.quotation.inert") },
      { match: "$", pop: true }, ...(kind.holes ? [inc("holes"), inc("template-groups")] : []), inc("inline-code"),
    ];
    contexts.blocks.push({ match: `^([ \\t]*)(?=${beforeBlock}${typedHead}${kind.delimiter}\\n)`, push: [`block-${kind.id}`, `open-${kind.id}`] });
    contexts[`open-${kind.id}`] = [{ match: `${opening}(?=\\n)`, captures, pop: true }, inc("inline-code")];
    contexts[`block-${kind.id}`] = [
      { meta_content_scope: s(kind.holes ? "meta.quotation.interpolated" : "meta.quotation.inert") },
      { match: "^\\1(end)[ \\t]*(?=#|$)", captures: { 1: s("keyword.control") }, pop: true },
      ...(kind.holes ? [inc("holes"), inc("template-groups")] : []), inc("main"),
    ];
  }
  for (const interpolate of [true, false]) {
    const id = interpolate ? "raw-reader-interpolated" : "raw-reader";
    contexts.readers.push({ match: `(${typedHead})(${interpolate ? "\\$" : ""}')`, captures: { 1: s("entity.name.function.reader"), 2: quoteScope }, push: id });
    contexts[id] = [{ meta_content_scope: s("string.unquoted.reader.raw") }, { meta_include_prototype: false }, { match: "$", pop: true }, ...(interpolate ? [inc("holes")] : [])];
  }
  contexts.readers.push(plain(match(`${typedHead}(?=\\$?\")`, "entity.name.function.reader")));
  for (const [begin, end, name] of [["\\(", "\\)", "parens"], ["\\[", "\\]", "brackets"], ["\\{", "\\}", "braces"]]) {
    contexts.groups.push({ match: begin, scope: s(`punctuation.section.${name}.begin`), push: name });
    contexts[name] = [{ match: end, scope: s(`punctuation.section.${name}.end`), pop: true }, inc("main")];
    contexts["template-groups"].push({ match: begin, scope: s(`punctuation.section.${name}.begin`), push: `template-${name}` });
    contexts[`template-${name}`] = [{ match: end, scope: s(`punctuation.section.${name}.end`), pop: true }, inc("template-code")];
  }
  contexts.groups.push(plain(match("[)\\]}]", "punctuation.section.group.end")));
  return { name: lexical.name, file_extensions: lexical.extensions, scope: lexical.scope, version: 2, contexts };
}


// Inherit Markdown's prose, containers and other languages. This entry context
// exists in build 4166 as well as newer bundled Markdown syntaxes.
export function sublimeMarkdownGrammar() {
  return {
    name: "Markdown (Pattern Language)",
    scope: "text.html.markdown.pattern-language",
    version: 2,
    extends: "Packages/Markdown/Markdown.sublime-syntax",
    contexts: {
      "indented-code-blocks": [
        {
          // Keep Pattern's multiline state until Markdown resumes at a dedented line.
          match: "^(?={{indented_code_block}})",
          embed: "Packages/PatternLanguage/PatternLanguage.sublime-syntax",
          embed_scope: "markup.raw.block.markdown source.pattern-language",
          escape: "^(?!{{indented_code_block}}|[ \\t]*\\r?$)",
        },
        {
          // Inside a quote, return control to Markdown for each container prefix.
          match: "{{indented_code_block}}",
          embed: "Packages/PatternLanguage/PatternLanguage.sublime-syntax",
          embed_scope: "markup.raw.block.markdown source.pattern-language",
          escape: "\\r?\\n",
        },
      ],
      "code-spans": [{ meta_prepend: true }, { include: "pattern-inline" }],
      "table-cell-code-spans": [{ meta_prepend: true }, { include: "pattern-inline" }],
      "pattern-inline": [{
        // Leave unmatched delimiters and paragraph-spanning code to stock Markdown.
        match: "(?<!`)(`+)(?!`)(?=[^\\n]*?(?<!`)\\1(?!`))",
        scope: "punctuation.definition.raw.begin.markdown",
        embed: "Packages/PatternLanguage/PatternLanguage.sublime-syntax",
        embed_scope: "markup.raw.inline.markdown source.pattern-language",
        escape: "(?<!`)\\1(?!`)",
        escape_captures: { 0: "punctuation.definition.raw.end.markdown" },
      }],
      "fenced-code-blocks": [
        { meta_prepend: true },
        ...["`", "~"].map((marker) => ({
          // CommonMark allows at most 3 spaces of indent before a fence; 4+ is an
          // indented code block. Stock Sublime Markdown uses ^[ \\t]* (any indent),
          // which is broader than CommonMark — we follow the spec so Pattern
          // embedding does not treat indented-code lines as fences.
          match:
            "^[ ]{0,3}(" + marker + "{3,})[ \\t]*(?:(?i:(pattern(?:-language)?))(?=[ \\t\\r\\n]|$)" +
            (marker === "`" ? "([^`\\r\\n]*)" : "([^\\r\\n]*)") +
            ")?(\\r?$)\\n?",
          captures: {
            0: "meta.code-fence.definition.begin.pattern-language.markdown-gfm",
            1: "punctuation.definition.raw.code-fence.begin.markdown",
            2: "constant.other.language-name.markdown",
            3: "comment.line.infostring.markdown",
            4: "meta.fold.code-fence.begin.markdown",
          },
          embed: "Packages/PatternLanguage/PatternLanguage.sublime-syntax",
          embed_scope: "markup.raw.code-fence.pattern-language.markdown-gfm source.pattern-language",
          escape: "^[ ]{0,3}(\\1" + marker + "*)[ \\t]*(\\r?$)\\n?",
          escape_captures: {
            0: "meta.code-fence.definition.end.pattern-language.markdown-gfm",
            1: "punctuation.definition.raw.code-fence.end.markdown",
            2: "meta.fold.code-fence.end.markdown",
          },
        })),
      ],
    },
  };
}

export async function generatedFiles() {
  const cases = JSON.parse(await readFile(new URL("test/cases.json", root), "utf8"));
  const nativeTests = ['# SYNTAX TEST "Packages/PatternLanguage/PatternLanguage.sublime-syntax"', "# Generated from test/cases.json; expectations are authored, not recorded output."];
  for (const fixture of cases) {
    nativeTests.push("", `# ${fixture.name}`);
    for (const [lineNumber, line] of fixture.source.split("\n").entries()) {
      nativeTests.push(line);
      for (const check of fixture.checks.filter((item) => item.line === lineNumber)) {
        const found = line.indexOf(check.text, check.from ?? 0);
        if (found < 0) throw new Error(`${fixture.name}: missing ${check.text}`);
        const start = found + (check.offset ?? 0);
        const length = check.length ?? check.text.length - (check.offset ?? 0);
        const selector = [check.scope ?? lexical.scope, ...(check.not ?? []).map((scope) => `- ${scope}`)].join(" ");
        if (start === 0) nativeTests.push(`# <- ${selector}`);
        const caretStart = Math.max(start, 1);
        const caretLength = start + length - caretStart;
        if (caretLength > 0) nativeTests.push("#" + " ".repeat(caretStart - 1) + "^".repeat(caretLength) + " " + selector);
      }
    }
  }
  return new Map([
    ["sublime/PatternLanguage/Markdown.sublime-syntax", "%YAML 1.2\n---\n# Generated by ../../generate.mjs. Edit the generator.\n" + stringify(sublimeMarkdownGrammar(), { lineWidth: 0 })],
    ["sublime/PatternLanguage/PatternLanguage.sublime-syntax", "%YAML 1.2\n---\n# Generated by ../../generate.mjs. Edit the generator or lexical.json.\n" + stringify(sublimeGrammar(), { lineWidth: 0 })],
    ["textmate/pattern-language.tmLanguage.json", JSON.stringify(textmateGrammar(), null, 2) + "\n"],
    ["sublime/PatternLanguage/syntax_test_pattern-language.pattern", nativeTests.join("\n") + "\n"],
  ]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [path, content] of await generatedFiles()) {
    if (process.argv.includes("--check")) {
      if (await readFile(new URL(path, root), "utf8") !== content) throw new Error(`${path} is out of date; run npm run generate`);
    } else {
      await writeFile(new URL(path, root), content);
    }
  }
}
