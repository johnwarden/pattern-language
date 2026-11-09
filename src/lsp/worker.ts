import { parentPort, workerData } from "node:worker_threads";
import { analyze, type Snapshot } from "./analysis.ts";

if (!parentPort) throw new Error("The analysis worker requires a parent port");
parentPort.postMessage(analyze(workerData as Snapshot));
