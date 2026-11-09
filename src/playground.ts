import suiteFiles from "test-suite:examples";
import { loadTests } from "./test-suite.ts";
import { Interpreter } from "./runtime.ts";
import { DEFAULT_GRAMMAR } from "./grammar.ts";
import { TYPE_SCHEMA } from "./type-schema.ts";
import { LANGUAGE_SCHEMA } from "./language-description.ts";
import { renderDiagnostic, LanguageError } from "./diagnostics.ts";
import { normal } from "./syntax.ts";
import { decodeSource } from "./source-encoding.ts";
export * from "./index.ts";
const root = document.getElementById("typescript-pattern-playground");
if (root) {
  const get = <T extends HTMLElement>(name: string) => {
    const el = root.querySelector<T>("#pl-" + name);
    if (!el) throw new Error("missing control " + name);
    return el;
  };
  const source = get<HTMLTextAreaElement>("source"),
    grammar = get<HTMLTextAreaElement>("grammar"),
    mode = get<HTMLSelectElement>("mode"),
    example = get<HTMLSelectElement>("example");
  get("infix").textContent = `a .f b → f(a)(b)
All infix operators require spaces, have equal precedence, and associate right.
There are no reserved infix words.

T .where predicate      → where(T)(predicate)
value .matches pattern  → matches(value)(pattern)

# Subsets keep their base type's concrete space
Number .where (n -> isInt64(n))
Int? .where (v -> v .matches :None)

# Pattern test returns True or False
Some(3) .matches (type :Some(Int))`;
  const key = "pattern-language:61dbcd9af4c0:editor-v1";
  const cases = loadTests(suiteFiles)
    .filter((value) => value.program)
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
        a.id.localeCompare(b.id, "en"),
    );
  const examples: Record<string, string> = Object.fromEntries(
    cases.map((value) => [value.id, value.source]),
  );
  for (const value of cases) {
    const option = document.createElement("option");
    option.value = value.id;
    option.textContent = value.name;
    example.appendChild(option);
  }
  interface Session {
    version: number;
    source: string;
    grammar: string;
    mode: string;
    example: string;
    draft: string;
    draftGrammar: string;
    history: string[];
    output: Record<string, string>;
  }
  const initialExample =
    cases.find((value) => value.name === "DSL: Recursive expression grammar")
      ?.id ?? cases[0].id;
  let draft = examples[initialExample],
    draftGrammar = DEFAULT_GRAMMAR,
    history: string[] = [],
    session: Interpreter | undefined,
    lastGrammar = "",
    restored = false,
    unusableSaved = false;
  const outputNames = ["result", "error", "normal", "tree", "status"];
  const output = () =>
    Object.fromEntries(outputNames.map((k) => [k, get(k).textContent ?? ""]));
  const clear = () =>
    outputNames.forEach((k) => {
      get(k).textContent = "";
    });
  const snapshot = (): Session => ({
    version: 6,
    source: source.value,
    grammar: grammar.value,
    mode: mode.value,
    example: example.value,
    draft,
    draftGrammar,
    history,
    output: output(),
  });
  const save = () => {
    if (unusableSaved) return;
    try {
      const text = JSON.stringify(snapshot());
      localStorage.setItem(key, text);
      if (localStorage.getItem(key) !== text)
        throw new Error("storage verification failed");
      get("storage").textContent = "Saved in this browser";
    } catch {
      get("storage").textContent = "Autosave unavailable · use Save session";
    }
  };
  function restore(data: unknown) {
    if (!data || typeof data !== "object") throw new Error("invalid session");
    const s = data as Partial<Session>;
    if (
      typeof s.source !== "string" ||
      s.source.length > 100000 ||
      typeof s.grammar !== "string" ||
      s.grammar.length > 100000 ||
      !Array.isArray(s.history) ||
      s.history.length > 100 ||
      s.history.some((x) => typeof x !== "string" || x.length > 100000) ||
      s.history.join("").length > 200000 ||
      (typeof s.draft === "string" && s.draft.length > 100000) ||
      (s.draftGrammar !== undefined &&
        (typeof s.draftGrammar !== "string" || s.draftGrammar.length > 100000))
    )
      throw new Error("invalid session fields");
    const savedGrammar =
      s.version === 1 && s.grammar.includes("type FunctionSignature Signature")
        ? DEFAULT_GRAMMAR
        : s.version! <= 3 &&
            s.grammar ===
              DEFAULT_GRAMMAR.replace(
                "def UnionTypeExpression type :unionType (pattern :: PatternBody)\n",
                "",
              )
          ? DEFAULT_GRAMMAR
          : s.grammar;
    // Preserve the draft even if an older REPL or grammar no longer parses.
    source.value = s.source;
    grammar.value = savedGrammar;
    mode.value = s.mode === "repl" ? "repl" : "program";
    const savedExample =
      typeof s.example === "string" && examples[s.example] === s.source
        ? s.example
        : cases.find((value) => value.source === s.source)?.id;
    example.value =
      typeof savedExample === "string" &&
      examples[savedExample] === s.source &&
      savedGrammar === DEFAULT_GRAMMAR
        ? savedExample
        : "draft";
    draft =
      example.value !== "draft" && typeof s.draft === "string"
        ? s.draft
        : s.source;
    draftGrammar = s.draftGrammar ?? savedGrammar;
    history = s.history.slice();
    session = undefined;
    lastGrammar = "";
    clear();
    if (s.output && typeof s.output === "object")
      for (const name of outputNames)
        if (typeof s.output[name] === "string")
          get(name).textContent = s.output[name];
    if (s.version !== 5 && s.version !== 6) {
      get("status").textContent =
        s.version === 1
          ? "Draft restored · factories use ordinary () packs; $ enables interpolation"
          : s.version === 3
            ? "Draft restored · union members must have disjoint syntax"
            : s.version === 4
              ? "Draft restored · examples load their bundled grammar"
              : "Draft restored · quotes are raw; $ enables interpolation";
      get("result").textContent = "";
      get("error").textContent = "";
    }
    get("clear").hidden = mode.value !== "repl";
  }
  function runner() {
    if (mode.value !== "repl") return new Interpreter(grammar.value);
    if (!session || lastGrammar !== grammar.value) {
      const fresh = new Interpreter(grammar.value);
      history.forEach((entry, i) =>
        fresh.run(entry, "repl", "repl#" + (i + 1)),
      );
      session = fresh;
      lastGrammar = grammar.value;
    }
    return session;
  }
  function showTree(tree: ReturnType<Interpreter["parse"]>) {
    get("normal").textContent =
      tree.kind === "block"
        ? tree.lines.map((n) => normal(n)).join("\n")
        : normal(tree);
    get("tree").textContent = JSON.stringify(
      tree,
      (_k, v) =>
        typeof v === "bigint"
          ? v.toString()
          : v instanceof Map
            ? Object.fromEntries(v)
            : v,
      2,
    );
  }
  function run(parseOnly = false) {
    clear();
    try {
      const interpreter = parseOnly ? new Interpreter(grammar.value) : runner();
      const evaluationMode = mode.value === "repl" ? "repl" : "program";
      const sourceName =
        evaluationMode === "repl" ? "repl#" + (history.length + 1) : "program";
      if (parseOnly) {
        showTree(interpreter.parse(source.value, evaluationMode, sourceName));
        get("result").textContent = get("normal").textContent;
        get("status").textContent = "Parsed";
      } else {
        if (
          evaluationMode === "repl" &&
          (history.length >= 100 ||
            history.join("").length + source.value.length > 200000)
        )
          throw new Error(
            "REPL session limit reached; save it, then clear the REPL",
          );
        const result = interpreter.run(
          source.value,
          evaluationMode,
          sourceName,
        );
        if (interpreter.lastTree) showTree(interpreter.lastTree);
        if (evaluationMode === "repl") history.push(source.value);
        get("result").textContent = interpreter.inspect(result);
        get("status").textContent = "Evaluated";
      }
    } catch (e) {
      get("error").textContent = renderDiagnostic(e);
      if (e instanceof LanguageError) {
        const range = e.diagnostic.primary;
        const editor = range?.source?.name === "grammar" ? grammar : source;
        if (range?.source?.text === editor.value && range.start !== undefined) {
          editor.focus();
          editor.setSelectionRange(range.start, range.end ?? range.start + 1);
        }
      }
      get("status").textContent = ":Error";
    }
    save();
  }
  source.value = examples[initialExample];
  example.value = initialExample;
  grammar.value = DEFAULT_GRAMMAR;
  get("type-schema").textContent = TYPE_SCHEMA;
  get("language-schema").textContent = LANGUAGE_SCHEMA;
  try {
    const data = localStorage.getItem(key);
    if (data) {
      unusableSaved = true;
      restore(JSON.parse(data));
      unusableSaved = false;
      restored = true;
    }
  } catch {
    get("storage").textContent =
      "Saved draft could not be restored · original copy retained";
  }
  source.addEventListener("input", () => {
    unusableSaved = false;
    draft = source.value;
    draftGrammar = grammar.value;
    example.value = "draft";
    save();
  });
  grammar.addEventListener("input", () => {
    unusableSaved = false;
    draft = source.value;
    draftGrammar = grammar.value;
    example.value = "draft";
    save();
  });
  mode.addEventListener("change", () => {
    get("clear").hidden = mode.value !== "repl";
    save();
  });
  example.addEventListener("change", () => {
    unusableSaved = false;
    source.value = example.value === "draft" ? draft : examples[example.value];
    grammar.value = example.value === "draft" ? draftGrammar : DEFAULT_GRAMMAR;
    mode.value = "program";
    get("clear").hidden = true;
    clear();
    get("status").textContent = "Example loaded";
    save();
  });
  get("run").addEventListener("click", () => run());
  get("parse").addEventListener("click", () => run(true));
  get("clear").addEventListener("click", () => {
    history = [];
    session = undefined;
    clear();
    get("status").textContent = "REPL cleared";
    save();
  });
  get("default").addEventListener("click", () => {
    grammar.value = DEFAULT_GRAMMAR;
    if (example.value === "draft") draftGrammar = grammar.value;
    save();
  });
  get("save").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot(), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pattern-language-session.json";
    root.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  get<HTMLInputElement>("load").addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file) return;
    if (file.size > 2000000) {
      get("error").textContent = "Session file is too large";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = decodeSource(
          new Uint8Array(reader.result as ArrayBuffer),
          file.name,
        );
        if (file.name.endsWith(".json")) restore(JSON.parse(text));
        else {
          if (text.length > 100000) throw new Error("Source is too large");
          source.value = text;
          draft = text;
          draftGrammar = grammar.value;
          example.value = "draft";
          clear();
          get("status").textContent = "Source loaded";
        }
        save();
      } catch (e) {
        get("error").textContent = e instanceof Error ? e.message : String(e);
      }
    };
    reader.readAsArrayBuffer(file);
  });
  document.addEventListener("visibilitychange", save);
  window.addEventListener("pagehide", save);
  if (!restored) {
    clear();
    get("status").textContent = "Ready";
  }
  save();
}
