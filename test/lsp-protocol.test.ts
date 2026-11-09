import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  createProtocolConnection,
  CancellationTokenSource,
  LSPErrorCodes,
  type PublishDiagnosticsParams,
  type InitializeResult,
  type DocumentSymbol,
  type SymbolInformation,
  type Hover,
} from "vscode-languageserver/node.js";
import { AnalysisQueue, runAnalysis } from "../src/lsp/jobs.ts";

const root = new URL("../", import.meta.url);
const server = new URL("../dist/pattern-language-lsp.mjs", import.meta.url);
const unresponsive = new URL("data:text/javascript,while(true)%7B%7D");
const snapshot = { uri: "file:///queued.pattern", version: 1, text: "1" };

async function client(hierarchical = true) {
  const child = spawn(process.execPath, [server.pathname, "--stdio"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", (text: string) => {
    stderr += text;
  });
  const connection = createProtocolConnection(child.stdout, child.stdin);
  const diagnostics: PublishDiagnosticsParams[] = [];
  const waiters = new Set<() => void>();
  connection.onNotification(
    "textDocument/publishDiagnostics",
    (params: PublishDiagnosticsParams) => {
      diagnostics.push(params);
      for (const waiter of waiters) waiter();
    },
  );
  connection.listen();
  const initialized = await connection.sendRequest<InitializeResult>(
    "initialize",
    {
      processId: null,
      rootUri: null,
      capabilities: {
        general: { positionEncodings: ["utf-16"] },
        textDocument: {
          publishDiagnostics: { versionSupport: true },
          documentSymbol: { hierarchicalDocumentSymbolSupport: hierarchical },
          hover: { contentFormat: ["markdown"] },
        },
      },
    },
  );
  await connection.sendNotification("initialized", {});
  return {
    child,
    connection,
    diagnostics,
    initialized,
    async waitDiagnostic(
      predicate: (params: PublishDiagnosticsParams) => boolean,
    ): Promise<PublishDiagnosticsParams> {
      return new Promise((resolve, reject) => {
        const check = () => {
          const value = diagnostics.find(predicate);
          if (value) {
            clearTimeout(timer);
            waiters.delete(check);
            resolve(value);
          }
        };
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(new Error("Timed out waiting for diagnostics: " + stderr));
        }, 10000);
        waiters.add(check);
        check();
      });
    },
    open(uri: string, text: string, version = 1) {
      return connection.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: "pattern-language", version, text },
      });
    },
    async finish() {
      const exited = once(child, "exit");
      await connection.sendRequest("shutdown");
      await connection.sendNotification("exit");
      const [code] = await exited;
      connection.dispose();
      assert.equal(code, 0, stderr);
      assert.equal(stderr, "");
    },
    dispose() {
      connection.dispose();
      child.kill();
    },
  };
}

test(
  "stdio LSP lifecycle uses unsaved buffers, incremental UTF-16 edits and clears stale diagnostics",
  { timeout: 20000 },
  async (t) => {
    const c = await client();
    t.after(() => c.dispose());
    assert.equal(c.initialized.capabilities.positionEncoding, "utf-16");
    assert.equal(c.initialized.capabilities.documentSymbolProvider, true);
    const uri = "untitled:Unseen.pattern";
    await c.open(uri, '\uFEFF"😀"\r\nbroken(');
    const invalid = await c.waitDiagnostic(
      (value) => value.uri === uri && value.version === 1,
    );
    assert.equal(invalid.diagnostics.length, 1);
    assert.deepEqual(invalid.diagnostics[0].range, {
      start: { line: 1, character: 6 },
      end: { line: 1, character: 7 },
    });
    await c.connection.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [
        {
          range: {
            start: { line: 1, character: 7 },
            end: { line: 1, character: 7 },
          },
          text: ")",
        },
      ],
    });
    await c.connection.sendNotification("textDocument/didSave", {
      textDocument: { uri },
    });
    const valid = await c.waitDiagnostic(
      (value) => value.uri === uri && value.version === 2,
    );
    assert.deepEqual(valid.diagnostics, []);
    const hover = await c.connection.sendRequest<Hover>("textDocument/hover", {
      textDocument: { uri },
      position: { line: 1, character: 0 },
    });
    assert.match(JSON.stringify(hover), /Semantic analysis unavailable/u);
    await c.connection.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: 1 },
      contentChanges: [{ text: "(" }],
    });
    await c.connection.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    assert.equal(
      c.diagnostics.filter((value) => value.uri === uri && value.version === 1)
        .length,
      1,
    );
    await c.connection.sendNotification("textDocument/didClose", {
      textDocument: { uri },
    });
    await c.waitDiagnostic(
      (value) => value.uri === uri && value.version === undefined,
    );
    assert.deepEqual(
      await c.connection.sendRequest("textDocument/documentSymbol", {
        textDocument: { uri },
      }),
      [],
    );
    await c.finish();
  },
);

test(
  "stdio LSP outlines whole-test todo and nested definitions under inbox without execution",
  { timeout: 20000 },
  async (t) => {
    const c = await client();
    t.after(() => c.dispose());
    const uri = "file:///does-not-exist/tests/inbox/changed.test";
    await c.open(
      uri,
      'todo test "Unimplemented"\n  def bomb() 1 / 0\n  expect missing() result None :: MissingType\nend',
    );
    const symbols = await c.connection.sendRequest<DocumentSymbol[]>(
      "textDocument/documentSymbol",
      { textDocument: { uri } },
    );
    assert.equal(symbols[0].name, "Unimplemented");
    assert.equal(symbols[0].detail, "todo test · not executed");
    assert.equal(symbols[0].children?.[0].name, "bomb()");
    assert.deepEqual(symbols[0].range, {
      start: { line: 0, character: 0 },
      end: { line: 3, character: 3 },
    });
    const report = await c.waitDiagnostic(
      (value) => value.uri === uri && value.version === 1,
    );
    assert.deepEqual(report.diagnostics, []);
    await c.finish();
  },
);

test(
  "stdio LSP drops superseded jobs and close races, supports request cancellation",
  { timeout: 20000 },
  async (t) => {
    const c = await client();
    t.after(() => c.dispose());
    const uri = "untitled:Race.pattern";
    await c.open(uri, "(");
    const token = new CancellationTokenSource();
    const cancelled = c.connection.sendRequest(
      "textDocument/documentSymbol",
      { textDocument: { uri } },
      token.token,
    );
    token.cancel();
    await assert.rejects(
      cancelled,
      (error: { code?: number }) =>
        error.code === LSPErrorCodes.RequestCancelled,
    );
    token.dispose();
    await c.connection.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: 2 },
      contentChanges: [{ text: ")" }],
    });
    await c.connection.sendNotification("textDocument/didChange", {
      textDocument: { uri, version: 3 },
      contentChanges: [{ text: "def current() 1\ncurrent()" }],
    });
    const symbols = await c.connection.sendRequest<DocumentSymbol[]>(
      "textDocument/documentSymbol",
      { textDocument: { uri } },
    );
    assert.equal(symbols[0].name, "current()");
    await c.waitDiagnostic((value) => value.uri === uri && value.version === 3);
    assert.equal(
      c.diagnostics.some((value) => value.uri === uri && value.version === 2),
      false,
    );
    await c.open("untitled:Closing.pattern", "(");
    await c.connection.sendNotification("textDocument/didClose", {
      textDocument: { uri: "untitled:Closing.pattern" },
    });
    await c.waitDiagnostic(
      (value) =>
        value.uri === "untitled:Closing.pattern" && value.version === undefined,
    );
    await c.finish();
    assert.deepEqual(
      c.diagnostics
        .filter((value) => value.uri === "untitled:Closing.pattern")
        .map((value) => value.diagnostics),
      [[]],
    );
    const lastVersioned = c.diagnostics
      .filter((value) => value.uri === uri && value.version !== undefined)
      .at(-1)!;
    assert.equal(lastVersioned.version, 3);
  },
);

test(
  "stdio LSP negotiates a flat outline and accepts named-language untitled buffers",
  { timeout: 20000 },
  async (t) => {
    const c = await client(false);
    t.after(() => c.dispose());
    const uri = "untitled:Untitled-1";
    await c.open(uri, "def outer()\n  def inner() 1\n  inner()\nend\nouter()");
    const symbols = await c.connection.sendRequest<SymbolInformation[]>(
      "textDocument/documentSymbol",
      { textDocument: { uri } },
    );
    assert.deepEqual(
      symbols.map((symbol) => [symbol.name, symbol.containerName]),
      [
        ["outer()", undefined],
        ["inner()", "outer()"],
      ],
    );
    assert.equal(symbols[0].location.uri, uri);
    await c.finish();
  },
);

test(
  "analysis worker deadlines terminate synchronous loops and mark analysis unavailable",
  { timeout: 5000 },
  async () => {
    const result = await runAnalysis(snapshot, new AbortController().signal, {
      workerURL: unresponsive,
      timeoutMs: 50,
    });
    assert.equal(result?.status, "unavailable");
    assert.deepEqual(result?.diagnostics, []);
    assert.match(result!.unknown[0].reason, /time budget/u);
  },
);

test(
  "analysis queue cancels active and queued work before continuing with current text",
  { timeout: 5000 },
  async () => {
    const queue = new AnalysisQueue({ workerURL: unresponsive, timeoutMs: 50 });
    const active = new AbortController(),
      waiting = new AbortController();
    const first = queue.enqueue(snapshot, active.signal);
    const second = queue.enqueue({ ...snapshot, version: 2 }, waiting.signal);
    waiting.abort();
    active.abort();
    assert.equal(await first, undefined);
    assert.equal(await second, undefined);
    const last = await queue.enqueue(
      { ...snapshot, version: 3 },
      new AbortController().signal,
    );
    assert.equal(last?.version, 3);
    assert.equal(last?.status, "unavailable");
  },
);
