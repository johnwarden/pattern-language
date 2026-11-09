import { Worker } from "node:worker_threads";
import { unavailable, type Analysis, type Snapshot } from "./analysis.ts";

const workerURL = new URL(
  import.meta.url.endsWith(".ts")
    ? "./worker.ts"
    : "./pattern-language-lsp-worker.mjs",
  import.meta.url,
);

export interface JobOptions {
  timeoutMs?: number;
  workerURL?: URL;
}

/** A synchronous reader cannot honor a cancellation token; terminate its worker. */
export function runAnalysis(
  snapshot: Snapshot,
  signal: AbortSignal,
  options: JobOptions = {},
): Promise<Analysis | undefined> {
  if (signal.aborted) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const worker = new Worker(options.workerURL ?? workerURL, {
      workerData: snapshot,
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (result?: Analysis) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      void worker.terminate().then(
        () => resolve(result),
        () => resolve(result),
      );
    };
    const abort = () => finish();
    const timer = setTimeout(
      () =>
        finish(
          unavailable(
            snapshot,
            "Syntax analysis unavailable: the analysis worker exceeded its time budget.",
          ),
        ),
      options.timeoutMs ?? 3000,
    );
    signal.addEventListener("abort", abort, { once: true });
    worker.on("message", (result: Analysis) => finish(result));
    worker.on("error", () =>
      finish(
        unavailable(
          snapshot,
          "Syntax analysis unavailable: the analysis worker failed.",
        ),
      ),
    );
    worker.on("exit", () =>
      finish(
        unavailable(
          snapshot,
          "Syntax analysis unavailable: the analysis worker exited without a result.",
        ),
      ),
    );
    // Nothing from a worker may reach the protocol stream. Drain incidental logs.
    worker.stdout?.resume();
    worker.stderr?.resume();
  });
}

interface Job {
  snapshot: Snapshot;
  signal: AbortSignal;
  resolve(value?: Analysis): void;
}
/** One worker at a time across documents; superseded queued jobs are removed. */
export class AnalysisQueue {
  private pending: Job[] = [];
  private active = false;
  private options: JobOptions;

  constructor(options: JobOptions = {}) {
    this.options = options;
  }

  enqueue(
    snapshot: Snapshot,
    signal: AbortSignal,
  ): Promise<Analysis | undefined> {
    if (signal.aborted) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const job: Job = { snapshot, signal, resolve };
      const remove = () => {
        const index = this.pending.indexOf(job);
        if (index >= 0) {
          this.pending.splice(index, 1);
          resolve(undefined);
        }
      };
      signal.addEventListener("abort", remove, { once: true });
      job.resolve = (value) => {
        signal.removeEventListener("abort", remove);
        resolve(value);
      };
      this.pending.push(job);
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      let job: Job | undefined;
      while ((job = this.pending.shift())) {
        try {
          job.resolve(
            await runAnalysis(job.snapshot, job.signal, this.options),
          );
        } catch {
          job.resolve(
            unavailable(
              job.snapshot,
              "Syntax analysis unavailable: the analysis worker could not start.",
            ),
          );
        }
      }
    } finally {
      this.active = false;
    }
  }
}
