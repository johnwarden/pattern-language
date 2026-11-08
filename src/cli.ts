#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { stdin, stdout, argv } from "node:process";
import { Interpreter } from "./runtime.ts";
import { DEFAULT_GRAMMAR } from "./grammar.ts";
import { renderDiagnostic } from "./diagnostics.ts";
import { normal } from "./syntax.ts";
import { decodeSource } from "./source-encoding.ts";
import { applyReplLine, replEntryReady } from "./repl.ts";
export function main(args = argv.slice(2)): void {
  let grammar = DEFAULT_GRAMMAR,
    file: string | undefined,
    repl = false,
    parseOnly = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--grammar") {
      const path = args[++i];
      if (!path) throw new Error("--grammar requires a file");
      grammar = decodeSource(readFileSync(path), path);
    } else if (args[i] === "--repl") repl = true;
    else if (args[i] === "--parse") parseOnly = true;
    else if (args[i] === "--help") {
      console.log(
        "node src/cli.ts [--grammar FILE] [--parse] [FILE|-]\nnode src/cli.ts [--grammar FILE] --repl\nREPL: a finished grammar form runs on its last line; a blank line still submits. :quit exits.",
      );
      return;
    } else if (args[i].startsWith("--"))
      throw new Error("unknown option " + args[i]);
    else if (file) throw new Error("only one source file allowed");
    else file = args[i];
  }
  const interpreter = new Interpreter(grammar);
  let entryNumber = 0;
  const run = (source: string, mode: "program" | "repl") => {
    const sourceName =
      mode === "repl"
        ? "repl#" + ++entryNumber
        : file && file !== "-"
          ? file
          : "stdin";
    if (parseOnly) {
      const tree = interpreter.parse(source, mode, sourceName);
      console.log(
        tree.kind === "block"
          ? tree.lines.map((n) => normal(n)).join("\n")
          : normal(tree),
      );
    } else {
      const values = interpreter.run(source, mode, sourceName);
      console.log(interpreter.inspect(values));
    }
  };
  if (!repl) {
    run(
      decodeSource(
        readFileSync(!file || file === "-" ? 0 : file),
        file ?? "stdin",
      ),
      "program",
    );
    return;
  }
  const rl = createInterface({
    input: stdin,
    output: stdout,
    terminal: !!stdin.isTTY,
  });
  let pending = "";
  const ready = (source: string) =>
    replEntryReady(source, (text) => interpreter.parse(text, "repl"));
  const submit = (source: string) => {
    try {
      run(source, "repl");
    } catch (e) {
      console.error(renderDiagnostic(e));
    }
  };
  const prompt = () => {
    if (stdin.isTTY) {
      rl.setPrompt(pending ? "… " : "> ");
      rl.prompt();
    }
  };
  rl.on("line", (line) => {
    const step = applyReplLine(pending, line, ready);
    pending = step.pending;
    if (step.quit) {
      rl.close();
      return;
    }
    if (step.submit) submit(step.submit);
    prompt();
  });
  rl.on("close", () => {
    if (pending)
      try {
        run(pending, "repl");
      } catch (e) {
        console.error(renderDiagnostic(e));
      }
  });
  prompt();
}
try {
  main();
} catch (e) {
  console.error(renderDiagnostic(e));
  process.exitCode = 1;
}
