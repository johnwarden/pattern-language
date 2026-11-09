# Language server plan

The syntax-first MVP is implemented in this PR; native Sublime Text **4166**
verification remains pending. See the [installation and coverage guide](../editors/lsp/README.md).
One TypeScript/Node server supplies editor diagnostics and an outline. Static highlighting
lives in the [separate editor package](../editors/highlighting/README.md); use LSP for diagnostics,
an outline, and progressively better navigation. Opening or editing a file must
not run its program, tests, macro implementations, or refinement predicates.

## Existing hooks and their limits

| Hook                                                                         | Useful now                                                                             | Missing boundary                                                                                                                                                 |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [parser.ts](../src/parser.ts): `tokenize`, `parseSurface`, `parseExpression` | Surface trees, layout/string errors, spans                                             | Fail-fast parsing; no recovery tree or complete binding/reference index                                                                                          |
| [grammar.ts](../src/grammar.ts): `Grammar.parse`, `clone`, `layoutForms`     | Syntax recognition and source-declared structural/sidefix registration                 | Recognition alone does not provide runtime grammar staging, macro expansion, or type checking                                                                    |
| [runtime.ts](../src/runtime.ts): `Interpreter.parse`                         | Clones its Grammar and calls its parser; it does **not** execute the submitted program | A normal Interpreter constructor runs the trusted prelude/schema bootstrap; `run` evaluates the submitted program. Do not treat the runtime as a static analyzer |
| [test-suite.ts](../src/test-suite.ts): `loadTests`                           | Reads `.test` structure without executing user setup or subjects                       | It bootstraps the trusted Test schema; discovery success is not proof that future/todo operands execute successfully                                             |
| [diagnostics.ts](../src/diagnostics.ts), [syntax.ts](../src/syntax.ts)       | Codes, phases, primary/related spans, notes, causes; source metadata                   | Offsets/endpoints are optional and parser source is normalized; src/lsp/positions.ts now maps these to exact editor text                                         |
| [highlighting lexical data](../editors/highlighting/lexical.json)            | Shared spellings and conservative completion vocabulary                                | Regex coloring is not a grammar, scope resolver, or semantic checker                                                                                             |

The [roadmap](../ROADMAP.md) still separates preparation (6) from checking (7).
There is no complete prepare-only/check-only service to wrap. Start with an audited
syntax-only adapter over the existing readers, rather than duplicating their
grammar or extracting diagnostics by running `src/cli.ts`.

## Server and first client

Use Node 24+, matching the repository, with Microsoft's
[`vscode-languageserver` and `vscode-languageserver-textdocument`](https://github.com/microsoft/vscode-languageserver-node).
Use JSON-RPC over **stdio**; stdout carries protocol messages and stderr carries
logs. Keep analysis functions independent of the connection and Sublime settings.
Use a conservative **3.17-era feature subset**, negotiated through capabilities;
[3.18 is the current protocol specification](https://microsoft.github.io/language-server-protocol/).
Start with push diagnostics; pull diagnostics and semantic tokens are later work.

Use the existing Sublime **LSP** client, not a new Python client. Its published
[minimum is build 4132](https://github.com/sublimelsp/LSP), so 4166 meets the
requirement; native testing on 4166 is still a release gate. Supply a config using
the highlighting package's `source.pattern-language` scope. The
[current client configuration](https://lsp.sublimetext.io/client_configuration/)
uses `Packages/User/LanguageServers.sublime-settings`, for example:

```json
{
  "pattern-language": {
    "enabled": true,
    "command": [
      "/absolute/path/to/node",
      "/absolute/path/to/repo/dist/pattern-language-lsp.mjs",
      "--stdio"
    ],
    "selector": "source.pattern-language"
  }
}
```

This is the built entry point after `just build`. Explicit paths avoid
depending on a GUI editor's shell setup. The same server can later serve Neovim,
a Vim LSP client, and VS Code through client configuration or a thin extension.
TextMate/Shiki remains the Markdown-rendering path; it does not need an LSP server.

## MVP behavior

1. Handle initialize/shutdown/exit and open/change/save/close for `.pattern` and
   `.test`, including unsaved buffers. Advertise incremental text synchronization
   but initially reanalyze the whole current document; incremental parsing is not
   required. Open files under `tests/inbox/` receive the same editor analysis even
   though inbox discovery is optional in the default suite.
2. Read `.pattern` with an isolated `Grammar(DEFAULT_GRAMMAR)` syntax snapshot;
   audit its registration path before exposing it. Use the Test reader for `.test`
   structure and preserve its specification-reader distinction. Never call
   `runTest`, evaluate setup, or reinterpret todo/future syntax as supported Code.
3. Publish precise reader/grammar diagnostics and a document outline: recognized
   definitions/macros and named test blocks, preserving nesting and source ranges.
   Begin with the first real parse failure; add recovery later. On an incomplete
   document, omit unavailable symbols rather than inventing declarations.
4. Expose bounded coverage in a hover/status explanation: **syntax checked**,
   **semantic analysis unavailable**, or **grammar-dependent region unknown**.
   Unknown is not an error and an empty diagnostics list is not a type-safety claim.

Source-defined grammar and clause ownership must come from the reader's active
grammar, not the highlighter's fixed keyword list. Recognize supported syntax-only
registrations in their existing lexical scopes. If interpreting a reader/type or
macro-dependent region would require execution, leave that region unknown and
avoid cascaded errors caused by guessing a grammar. Preserve independently certain
lexical/layout errors. Do not select an overload or run a predicate to improve a
hover. Plain Code-returning functions do not become registered macros.

## Positions, snapshots, and responsiveness

- Retain the exact editor text and immutable `{uri, version, text, grammarRevision}`
  analysis snapshots. Open buffers override disk. An edit to a grammar declaration
  invalidates dependent analysis within that document; workspace invalidation waits
  for an explicit dependency model, not presumed module semantics.
- Use LSP zero-based, end-exclusive UTF-16 positions initially. The parser removes
  one leading BOM and normalizes CRLF to LF; map its normalized offsets back to
  editor text before constructing ranges. Test astral characters and tabs; display
  columns are not UTF-16 offsets. Prefer complete offsets, then complete line/column
  endpoints. With only a start, highlight one Unicode scalar, or use a zero-width
  EOF range. Clamp malformed locations; never fabricate a full expression range.
- Map diagnostic code/message and related locations directly; append notes and
  relevant expected/actual information without parsing rendered CLI messages.
  Treat nested causes as explanations, not duplicate diagnostics by default.
- Debounce edits, tag jobs with the document version, and discard stale completions.
  Publish diagnostics with a version when supported; always reject stale jobs
  server-side. Clear diagnostics on close. Implement `$/cancelRequest` for requests;
  notifications such as didChange need job supersession, not cancellation replies.
- Keep the reader's existing size limit. Bound analysis work and preserve protocol
  responsiveness: cancellation tokens do not interrupt synchronous parsing. Use
  a terminable analysis worker when deadlines are enforced, and report analysis
  unavailable after a budget failure rather than mislabeling the program invalid.

## Follow-up slices

| Slice                   | Deliverable and prerequisite                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lexical navigation      | Local definitions, references, completion, and signature text from a real scope/binding index; preserve quoted symbols, labels, captures, shadowing, postfix heads, and macro hygiene |
| Editing assistance      | Safe templates for `test`/`todo test`, folding and completion from known grammar snapshots; no automatic result evaluation or guessed types                                           |
| Preparation integration | Reuse milestone 6's future non-runtime preparation API, expansion origins, read-only environment and explicit budgets; keep unsupported regions unknown                               |
| Checked assistance      | Add inferred-type hovers, call diagnostics and semantic tokens when milestone 7 supplies checking evidence; negotiate each capability independently                                   |

Defer rename until references and hygiene are reliable. Defer formatting until
round-trip tests cover the accepted whitespace/grammar safety contract. Workspace
symbols may index files independently; imports, cross-file resolution, declaration
equivalence, and accessor collision policy must not be invented by the server.
Keep the current duplicate-declaration error until the language chooses otherwise.
The public inspection/decoding boundary, MemberOf/family recovery, and constructedBy
remain outside this plan; an internal editor index need not freeze a public API.

## Implementation and validation

The first implementation supplies an isolated stdio entry point, immutable document store, diagnostic/range
adapter, syntax-only analysis with basic document symbols, and a Sublime config
example. Keep protocol dependencies out of the browser bundle and analyzer logic
outside the editor package. No runtime semantics, automatic test execution, rename,
formatter, or new public reflection API. Use existing build/test conventions.

The spawned-server tests cover: initialize → open invalid
source → change to valid → diagnostics clear → close → shutdown. Cover stale jobs,
cancel/close races, optional span endpoints, BOM/CRLF/astral ranges, unsaved files,
inbox tests, raw/typed quotes, custom clauses, and malformed/incomplete declarations.
Use a canary fixture whose setup/macro/runtime body would fail if executed; assert
analysis never invokes those paths. Check outlines against authored source ranges.
Native diagnostics, outline, edits and restart still need smoke verification on actual
Sublime 4166; record that separately from server-side tests, then try a second client.

The first implementation settles only the internal analyzer contract and failure/recovery
policy. Open product choices are how prominently to show unknown coverage, whether
later explicit preparation should be opt-in, and the workspace configuration model
once source modules/dependencies exist. None blocks parse diagnostics and an outline.

Protocol references: [3.17 specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/),
[official position types](https://github.com/microsoft/vscode-languageserver-node/blob/main/types/src/main.ts),
[official cancellation implementation](https://github.com/microsoft/vscode-languageserver-node/blob/main/jsonrpc/src/common/connection.ts).
