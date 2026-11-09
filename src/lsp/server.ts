import {
  createConnection,
  TextDocumentSyncKind,
  ResponseError,
  LSPErrorCodes,
  ErrorCodes,
  type CancellationToken,
  type DocumentSymbol,
  type SymbolInformation,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { AnalysisQueue } from "./jobs.ts";
import {
  type Analysis,
  type Snapshot,
  MAX_SOURCE_LENGTH,
  unavailable,
} from "./analysis.ts";

// Explicit streams make this entry point stdio-only; stdout is never a log sink.
const connection = createConnection(process.stdin, process.stdout);
const queue = new AnalysisQueue();
interface DocumentState {
  document: TextDocument;
  snapshot: Snapshot;
  controller: AbortController;
  timer?: ReturnType<typeof setTimeout>;
  result?: Analysis;
  pending: Promise<Analysis | undefined>;
  resolve(result?: Analysis): void;
  started: boolean;
}
const documents = new Map<string, DocumentState>();
let shutdown = false;
let versionedDiagnostics = false;
let relatedDiagnostics = false;
let hierarchicalSymbols = false;
let markdownHover = false;

const supported = (uri: string, languageId: string) =>
  /\.(?:pattern|test)(?:[?#]|$)/u.test(uri) ||
  ["pattern-language", "pattern-language-test"].includes(languageId);
function cancel(state: DocumentState): void {
  if (state.timer) clearTimeout(state.timer);
  state.controller.abort();
  state.resolve(undefined);
}
function start(state: DocumentState): void {
  if (state.started || state.controller.signal.aborted || shutdown) return;
  state.started = true;
  if (state.timer) clearTimeout(state.timer);
  const work =
    state.snapshot.text.length > MAX_SOURCE_LENGTH
      ? Promise.resolve(
          unavailable(
            state.snapshot,
            "Syntax analysis unavailable: source exceeds the reader's 100000-character limit.",
          ),
        )
      : queue.enqueue(state.snapshot, state.controller.signal);
  void work.then((result) => {
    if (
      !result ||
      documents.get(state.snapshot.uri) !== state ||
      state.controller.signal.aborted ||
      shutdown
    ) {
      state.resolve(undefined);
      return;
    }
    state.result = result;
    state.resolve(result);
    void connection.sendDiagnostics({
      uri: state.snapshot.uri,
      ...(versionedDiagnostics ? { version: state.snapshot.version } : {}),
      diagnostics: result.diagnostics.map(
        ({ relatedInformation, ...diagnostic }) =>
          relatedDiagnostics
            ? { ...diagnostic, relatedInformation }
            : diagnostic,
      ),
    });
  });
}
function update(document: TextDocument, immediate = false): void {
  const previous = documents.get(document.uri);
  if (previous) cancel(previous);
  let resolve!: DocumentState["resolve"];
  const state: DocumentState = {
    document,
    snapshot: Object.freeze({
      uri: document.uri,
      version: document.version,
      text: document.getText(),
      languageId: document.languageId,
    }),
    controller: new AbortController(),
    started: false,
    pending: new Promise((done) => {
      resolve = done;
    }),
    resolve: (result) => resolve(result),
  };
  documents.set(document.uri, state);
  if (immediate) start(state);
  else state.timer = setTimeout(() => start(state), 80);
}

async function current(
  uri: string,
  token: CancellationToken,
): Promise<Analysis | undefined> {
  const state = documents.get(uri);
  if (!state || shutdown) return;
  if (token.isCancellationRequested)
    throw new ResponseError(
      LSPErrorCodes.RequestCancelled,
      "Request cancelled",
    );
  start(state);
  const result = await new Promise<Analysis | undefined>((resolve, reject) => {
    const subscription = token.onCancellationRequested(() => {
      subscription.dispose();
      reject(
        new ResponseError(LSPErrorCodes.RequestCancelled, "Request cancelled"),
      );
    });
    void state.pending.then((analysis) => {
      subscription.dispose();
      resolve(analysis);
    });
  });
  if (documents.get(uri) !== state)
    throw new ResponseError(
      LSPErrorCodes.ContentModified,
      "Document changed during analysis",
    );
  return result;
}

connection.onInitialize((params) => {
  versionedDiagnostics =
    params.capabilities.textDocument?.publishDiagnostics?.versionSupport ===
    true;
  relatedDiagnostics =
    params.capabilities.textDocument?.publishDiagnostics?.relatedInformation ===
    true;
  hierarchicalSymbols =
    params.capabilities.textDocument?.documentSymbol
      ?.hierarchicalDocumentSymbolSupport === true;
  markdownHover =
    params.capabilities.textDocument?.hover?.contentFormat?.includes(
      "markdown",
    ) === true;
  return {
    serverInfo: { name: "pattern-language-lsp", version: "0.1.1" },
    capabilities: {
      positionEncoding: "utf-16",
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
        save: { includeText: false },
      },
      documentSymbolProvider: true,
      hoverProvider: true,
    },
  };
});
connection.onDidOpenTextDocument(({ textDocument }) => {
  if (!shutdown && supported(textDocument.uri, textDocument.languageId))
    update(
      TextDocument.create(
        textDocument.uri,
        textDocument.languageId,
        textDocument.version,
        textDocument.text,
      ),
      true,
    );
});
connection.onDidChangeTextDocument(({ textDocument, contentChanges }) => {
  const state = documents.get(textDocument.uri);
  if (
    shutdown ||
    !state ||
    textDocument.version <= state.document.version ||
    !contentChanges.length
  )
    return;
  const copy = TextDocument.create(
    state.document.uri,
    state.document.languageId,
    state.document.version,
    state.document.getText(),
  );
  update(TextDocument.update(copy, contentChanges, textDocument.version));
});
connection.onDidSaveTextDocument(({ textDocument }) => {
  const state = documents.get(textDocument.uri);
  if (state && !shutdown) start(state);
});
connection.onDidCloseTextDocument(({ textDocument }) => {
  const state = documents.get(textDocument.uri);
  if (!state) return;
  cancel(state);
  documents.delete(textDocument.uri);
  void connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
});
function flatten(
  symbols: DocumentSymbol[],
  uri: string,
  containerName?: string,
): SymbolInformation[] {
  return symbols.flatMap((symbol) => [
    {
      name: symbol.name,
      kind: symbol.kind,
      location: { uri, range: symbol.selectionRange },
      ...(containerName ? { containerName } : {}),
    },
    ...flatten(symbol.children ?? [], uri, symbol.name),
  ]);
}
connection.onDocumentSymbol(async ({ textDocument }, token) => {
  if (shutdown)
    throw new ResponseError(ErrorCodes.InvalidRequest, "Server is shut down");
  const result = await current(textDocument.uri, token);
  return hierarchicalSymbols
    ? (result?.symbols ?? [])
    : flatten(result?.symbols ?? [], textDocument.uri);
});
connection.onHover(async ({ textDocument }, token) => {
  if (shutdown)
    throw new ResponseError(ErrorCodes.InvalidRequest, "Server is shut down");
  const result = await current(textDocument.uri, token);
  if (!result) return null;
  const summary =
    result.status === "syntax-checked"
      ? "Syntax checked with the surface reader and recognized grammar."
      : result.status === "partial"
        ? "Syntax partially checked."
        : "Syntax analysis unavailable.";
  const unknown = [...new Set(result.unknown.map((item) => item.reason))];
  return {
    contents: {
      kind: markdownHover ? "markdown" : "plaintext",
      value: [
        summary,
        "Semantic analysis unavailable. Programs, tests, macros and predicates are never executed.",
        ...unknown,
      ].join("\n\n"),
    },
  };
});
connection.onShutdown(() => {
  shutdown = true;
  for (const state of documents.values()) cancel(state);
});
connection.onExit(() => process.exit(shutdown ? 0 : 1));
process.on("SIGTERM", () => {
  for (const state of documents.values()) cancel(state);
  process.exit(0);
});
connection.listen();
