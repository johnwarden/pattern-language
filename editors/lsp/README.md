# Pattern language server

A reusable Node 24+ stdio language server for `.pattern` and `.test` files. The
first client configuration targets Sublime Text **4166** with the existing LSP
package. Static syntax highlighting remains a separate package using the
`source.pattern-language` scope; install that package first. This server does not
provide coloring or alter the highlighter.

## Build and run

From the repository root:

```sh
npm ci
just build
just lsp
```

Without `just`, use `npm run build`, then `npm run lsp`. An editor should launch
Node directly rather than invoke npm: npm prints non-protocol output. The built
entry point is `dist/pattern-language-lsp.mjs`; keep the adjacent
`dist/pattern-language-lsp-worker.mjs` file and the installed `node_modules`.
Both bundles are Node-only; LSP packages are not imported by the browser entry
points. Start a new server after changing compiler/parser code and rebuilding.

For source development, `node --disable-warning=ExperimentalWarning
src/lsp/server.ts --stdio` also works on Node 24. The source server starts the
adjacent TypeScript analysis worker. Stdout is reserved for framed JSON-RPC;
server-side worker output is drained, not forwarded into the protocol.

## Sublime Text 4166

1. Install Sublime's **LSP** package through Package Control. The published client
   minimum is build 4132, which includes 4166.
2. Open **Preferences → Browse Packages…** and put the settings from
   [LanguageServers.sublime-settings](LanguageServers.sublime-settings) in
   `User/LanguageServers.sublime-settings`. Merge the `pattern-language` key into
   an existing file rather than replacing its other clients.
3. Replace both absolute paths: the Node executable must be version 24 or newer,
   and the second path must point at this checkout's built server. Explicit paths
   avoid a GUI app depending on the shell's PATH.
4. Open a file with the Pattern Language syntax selected. Diagnostics use the
   normal LSP panels; **Goto Symbol** shows recognized definitions/macros and test
   blocks. Hover explains the current analysis coverage, including unknowns.

The same stdio entry point can be configured in Neovim, Vim LSP clients or VS Code;
this PR does not ship editor-specific clients or a VS Code extension. Markdown
rendering continues to use the separate highlighting grammar.

## What gets checked

- The existing surface reader supplies lexical, delimiter, text and layout
  diagnostics. Only the first certain reader failure is reported.
- A fresh syntax-only `Grammar(DEFAULT_GRAMMAR)` recognizes ordinary Code forms
  and source registrations without running them. Outlines show recognized
  definitions and macros; quoted code/text does not create declarations.
- `.test` files use the specification surface reader. Only the shared `Test` and
  `TodoTest` envelope declarations are selected from `TEST_SCHEMA` and recognized
  structurally. Assertions, setup, expected values/types and todo operands remain
  inert source data. A file containing a single `todo test` works. Open inbox
  files are analyzed directly, independent of default test discovery.
- Programs, tests, macro implementations and refinement predicates are never
  executed. The analysis graph has no runtime/test-runner import and does not
  bootstrap an Interpreter. There is no type inference or type-safety claim.
- Grammar-dependent/incomplete forms remain **unknown**, without guessed errors
  or types. In particular, some local macro clause layouts need a staged reader;
  an uncertain clause boundary is unknown. Certain independent delimiter errors
  still appear. A failed recognizer may omit the remaining outline. Definitions
  appearing after unrecognized Test DSL steps may be omitted.

Hover reports `syntax checked`, partial syntax coverage, or analysis unavailable;
semantic analysis is always unavailable in this slice. Empty diagnostics do not
mean the program or test passes. There are no run commands, renames, formatting,
cross-file resolution, module semantics or public reflection APIs.

## Buffers, ranges and budgets

Open buffers are authoritative; the server never reads them from disk. Incremental
UTF-16 edits produce a new immutable analysis snapshot. Untitled buffers work
when the client uses language id `pattern-language`; the optional
`pattern-language-test` id selects Test syntax before a filename exists. Saved
`.test` names select Test syntax regardless of language id.

Edits are debounced for 80 ms. One worker runs at a time across documents;
superseded/closed jobs are aborted and queued replacements supersede old work.
The worker is terminated after three seconds, including startup, or if cancelled.
A failed/over-budget worker produces **analysis unavailable**, not an invalid
program diagnostic. Source length is limited to the reader's existing 100000
UTF-16 code units; larger documents receive unavailable status without parsing.

Positions are zero-based, UTF-16 and end-exclusive. The adapter maps the parser's
BOM-free/LF-normalized offsets back to the exact buffer, including CRLF. Optional
endpoints fall back to one Unicode scalar or zero-width EOF. The server never
uses display columns as character offsets. Results carry document versions when
the client supports them; stale results are suppressed even otherwise. Closing a
document clears its diagnostics. Request cancellation rejects the request while
shared document analysis can continue; edits and close cancel the analysis job.

## Validation and remaining release check

`just check` includes the LSP unit and spawned-stdio protocol tests. For focused
checks, build first, then run:

```sh
npm run check
npm run build
node --disable-warning=ExperimentalWarning --test test/lsp*.test.ts
```

The tests cover lifecycle, incremental unsaved edits, parse-error clearing,
version supersession, close/cancel races, workers that cannot respond to a token,
capability negotiation, authored outlines, inbox/whole-test todo, ranges and
runtime canaries. They exercise the built server, not Sublime's Python client.

**Native Sublime 4166 smoke verification is pending.** On that actual build:
open `.pattern` and `.test` files, create and fix an unmatched delimiter, check
nested Goto Symbol entries, edit an unsaved buffer, close/reopen, and restart the
server after rebuilding. Record that native result separately from server tests.
A second-client smoke is also pending.

References: [LSP 3.17 protocol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/),
[Microsoft server libraries](https://github.com/microsoft/vscode-languageserver-node),
[Sublime LSP](https://github.com/sublimelsp/LSP),
[client configuration](https://lsp.sublimetext.io/client_configuration/).
