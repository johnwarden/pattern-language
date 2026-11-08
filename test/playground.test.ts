import { loadTests, runTest } from "../src/test-suite.ts";
import { sourceFiles } from "./source-files.ts";
const suiteFiles = sourceFiles(new URL("../tests/examples/", import.meta.url));
const initialExample = loadTests(suiteFiles).find(
  (value) => value.name === "DSL: Recursive expression grammar",
)!.id;
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { Interpreter, displayResults } from "../src/index.ts";
import { DEFAULT_GRAMMAR } from "../src/grammar.ts";
import { TYPE_SCHEMA } from "../src/type-schema.ts";
const html = readFileSync(
  new URL("../index.html", import.meta.url),
  "utf8",
).replace('<script src="dist/playground.js"></script>', "");
const bundle = readFileSync(
  new URL("../dist/playground.js", import.meta.url),
  "utf8",
);
const key = "pattern-language:61dbcd9af4c0:editor-v1";
function mount(saved?: string, blocked = false) {
  const dom = new JSDOM(html, {
    url: "https://playground.test",
    runScripts: "outside-only",
  });
  if (saved) dom.window.localStorage.setItem(key, saved);
  if (blocked)
    Object.defineProperty(dom.window, "localStorage", {
      get() {
        throw new Error("blocked");
      },
    });
  dom.window.eval(bundle);
  const el = <T extends HTMLElement>(name: string) =>
    dom.window.document.getElementById("pl-" + name) as T;
  return {
    dom,
    el,
    click: (name: string) => el(name).click(),
    edit: (name: string, text: string) => {
      const input = el<HTMLTextAreaElement>(name);
      input.value = text;
      input.dispatchEvent(new dom.window.Event("input"));
    },
  };
}
const oldDefaultGrammar = DEFAULT_GRAMMAR.replace(
  "def UnionTypeExpression type :unionType pattern :: PatternBody\n",
  "",
);
for (const state of ["fresh", "restored old grammar"]) {
  test(`all playground examples execute against the shared Test corpus: ${state}`, () => {
    const saved =
      state === "fresh"
        ? undefined
        : JSON.stringify({
            version: 4,
            source: "my unfinished draft",
            grammar: oldDefaultGrammar,
            mode: "program",
            example: "draft",
            draft: "my unfinished draft",
            history: [],
            output: { error: "cached old failure" },
          });
    const { dom, el } = mount(saved);
    assert.equal(el("result").textContent, "");
    assert.equal(el("error").textContent, "");
    assert.equal(
      el("status").textContent,
      saved ? "Draft restored · examples load their bundled grammar" : "Ready",
    );
    assert.equal(el("type-schema").textContent, TYPE_SCHEMA);
    const tests = loadTests(suiteFiles).filter((value) => value.program);
    assert.equal(
      tests.length,
      76,
      "migration assertions must not hide existing examples",
    );
    const select = el<HTMLSelectElement>("example");
    assert.equal(select.options.length, tests.length + 1);
    assert.equal(select.options[0].value, "draft");
    const names = [...select.options]
      .slice(1)
      .map((option) => option.textContent!);
    assert.deepEqual(
      names,
      names.toSorted((a, b) =>
        a.localeCompare(b, "en", { sensitivity: "base" }),
      ),
    );
    assert.equal(select.value, saved ? "draft" : initialExample);
    assert.deepEqual(
      [...select.options]
        .slice(1)
        .map((option) => option.value)
        .sort(),
      tests.map((value) => value.id).sort(),
    );
    for (const option of [...select.options].slice(1)) {
      const value = tests.find((value) => value.id === option.value)!;
      assert.equal(option?.textContent, value.name);
      select.value = value.id;
      select.dispatchEvent(new dom.window.Event("change"));
      assert.equal(el<HTMLTextAreaElement>("grammar").value, DEFAULT_GRAMMAR);
      assert.equal(el<HTMLTextAreaElement>("source").value, value.source);
      assert.equal(el("result").textContent, "");
      assert.equal(el("error").textContent, "");
      assert.equal(el("status").textContent, "Example loaded");
      el("run").click();
      const report = runTest(value);
      assert.equal(report.passed, true, value.id + ": " + report.message);
      if (report.expectedError)
        assert.ok(
          el("error").textContent!.includes(report.expectedError),
          value.id,
        );
      else {
        assert.equal(el("error").textContent, "", value.id);
        const interpreter = new Interpreter();
        const results = interpreter.run(value.source);
        assert.equal(
          displayResults(results),
          displayResults(report.results!),
          value.id,
        );
        assert.equal(
          el("result").textContent,
          interpreter.inspect(results),
          value.id,
        );
      }
    }
    if (saved) {
      select.value = "draft";
      select.dispatchEvent(new dom.window.Event("change"));
      assert.equal(
        el<HTMLTextAreaElement>("source").value,
        "my unfinished draft",
      );
      assert.equal(el<HTMLTextAreaElement>("grammar").value, oldDefaultGrammar);
    }
    dom.window.close();
  });
}
test("example grammar stays separate from the saved custom draft across remounts", () => {
  const app = mount();
  const customGrammar = DEFAULT_GRAMMAR.replace(":if ", ":when ");
  app.edit("grammar", customGrammar);
  app.edit("source", "when True 1 else 2");
  const select = app.el<HTMLSelectElement>("example");
  select.value = initialExample;
  select.dispatchEvent(new app.dom.window.Event("change"));
  assert.equal(app.el<HTMLTextAreaElement>("grammar").value, DEFAULT_GRAMMAR);
  app.click("run");
  assert.equal(app.el("error").textContent, "");
  const saved = app.dom.window.localStorage.getItem(key)!;
  app.dom.window.close();
  const restored = mount(saved);
  const restoredSelect = restored.el<HTMLSelectElement>("example");
  assert.equal(restoredSelect.value, initialExample);
  restoredSelect.value = "draft";
  restoredSelect.dispatchEvent(new restored.dom.window.Event("change"));
  assert.equal(
    restored.el<HTMLTextAreaElement>("grammar").value,
    customGrammar,
  );
  assert.equal(
    restored.el<HTMLTextAreaElement>("source").value,
    "when True 1 else 2",
  );
  restored.click("run");
  assert.equal(restored.el("error").textContent, "");
  assert.equal(restored.el("result").textContent, "1 :: Rational");
  restored.dom.window.close();
});
test("program Run displays concrete and meta-type annotations", () => {
  const app = mount();
  app.edit(
    "source",
    "def Rect type Rect(Float,Float)\nr = Rect(3,4) :: Rect\n(r,Rect,Int)",
  );
  app.click("run");
  assert.equal(app.el("error").textContent, "");
  assert.equal(
    app.el("result").textContent,
    "(Rect(3, 4) :: Rect, Type(Rect(Float, Float)) :: Type, Int :: Type)",
  );
  app.dom.window.close();
});
test("unsent draft and grammar survive remount", () => {
  const a = mount();
  a.edit("source", "unfinished =");
  a.edit("grammar", "custom grammar draft");
  const saved = a.dom.window.localStorage.getItem(key)!;
  a.dom.window.close();
  const b = mount(saved);
  assert.equal(b.el<HTMLTextAreaElement>("source").value, "unfinished =");
  assert.equal(
    b.el<HTMLTextAreaElement>("grammar").value,
    "custom grammar draft",
  );
  b.dom.window.close();
});
test("REPL replays committed history without running current draft", () => {
  const a = mount();
  const mode = a.el<HTMLSelectElement>("mode");
  mode.value = "repl";
  mode.dispatchEvent(new a.dom.window.Event("change"));
  a.edit("source", "x = 9");
  a.click("run");
  a.edit("source", "x + 1");
  const saved = a.dom.window.localStorage.getItem(key)!;
  a.dom.window.close();
  const b = mount(saved);
  assert.equal(b.el("result").textContent, "9 :: Rational");
  b.click("run");
  assert.equal(b.el("result").textContent, "10 :: Rational");
  b.dom.window.close();
});
test("Parse and Run reject the same invalid block", () => {
  const a = mount();
  a.edit("source", "def f(x)\n  y = x\nend\n0");
  a.click("parse");
  const error = a.el("error").textContent;
  assert.match(error!, /must end with/);
  a.click("run");
  assert.equal(a.el("error").textContent, error);
  a.dom.window.close();
});
test("Run honors editable grammar", () => {
  const a = mount();
  a.edit(
    "grammar",
    a.el<HTMLTextAreaElement>("grammar").value.replace(":if ", ":when "),
  );
  a.edit("source", "when True 1 else 2");
  a.click("run");
  assert.equal(a.el("result").textContent, "1 :: Rational");
  a.dom.window.close();
});
test("blocked storage has an honest fallback", () => {
  const a = mount(undefined, true);
  assert.match(a.el("storage").textContent!, /Autosave unavailable/);
  assert.equal(a.el("result").textContent, "");
  a.edit("source", "3 :: Int");
  a.click("run");
  assert.equal(a.el("result").textContent, "3 :: Int");
  a.dom.window.close();
});
test("old editor draft is preserved without silently rewriting syntax", () => {
  const old = {
    version: 1,
    source: "def Vector<T> type [xs... :: T+]\nVector<Int>",
    grammar: "type FunctionSignature Signature",
    mode: "program",
    history: [],
    draft: "",
    output: {},
    example: "draft",
  };
  const a = mount(JSON.stringify(old));
  assert.equal(a.el<HTMLTextAreaElement>("source").value, old.source);
  assert.match(
    a.el<HTMLTextAreaElement>("grammar").value,
    /def Definition type/,
  );
  assert.match(a.el("status").textContent!, /factories.*ordinary/);
  a.dom.window.close();
});
test("version-two quote drafts are preserved with an explicit migration warning", () => {
  const source = 'name = "Jo"\n"Hello, $name"';
  const app = mount(
    JSON.stringify({
      version: 2,
      source,
      grammar: DEFAULT_GRAMMAR,
      mode: "program",
      history: [],
      draft: "",
    }),
  );
  assert.equal(app.el<HTMLTextAreaElement>("source").value, source);
  assert.equal(app.el("result").textContent, "");
  assert.match(app.el("status").textContent!, /quotes are raw.*\$/i);
  app.dom.window.close();
});
test("version-three drafts keep their source and upgrade only the untouched default grammar", () => {
  const source = "x = :a\nx";
  const oldGrammar = DEFAULT_GRAMMAR.replace(
    "def UnionTypeExpression type :unionType pattern :: PatternBody\n",
    "",
  );
  const app = mount(
    JSON.stringify({
      version: 3,
      source,
      grammar: oldGrammar,
      mode: "program",
      history: [],
      draft: "",
      output: { result: ":a :: Expression" },
    }),
  );
  assert.equal(app.el<HTMLTextAreaElement>("source").value, source);
  assert.equal(app.el<HTMLTextAreaElement>("grammar").value, DEFAULT_GRAMMAR);
  assert.equal(app.el("result").textContent, "");
  assert.match(app.el("status").textContent!, /disjoint syntax/);
  app.click("run");
  assert.equal(app.el("result").textContent, "a :: LowerCamelSymbol");
  app.dom.window.close();
});
test("a corrupt saved draft is not overwritten during mounting", () => {
  const a = mount("{broken");
  assert.equal(a.dom.window.localStorage.getItem(key), "{broken");
  assert.match(a.el("storage").textContent!, /original copy retained/);
  a.edit("source", "42");
  assert.match(a.dom.window.localStorage.getItem(key)!, /42/);
  a.dom.window.close();
});

test("playground highlights the diagnostic source range", () => {
  const a = mount();
  a.edit("source", "x = 1\nx + unknown");
  a.click("run");
  assert.match(a.el("error").textContent!, /E_UNBOUND_NAME.*program:2:5/);
  const editor = a.el<HTMLTextAreaElement>("source");
  assert.equal(editor.selectionStart, 10);
  assert.equal(editor.selectionEnd, 17);
  assert.equal(a.dom.window.document.activeElement, editor);
  a.dom.window.close();
});

test("playground reports declaration locations for missing labeled arguments", () => {
  const a = mount();
  a.edit("source", "def f(size: Int) size\nf()");
  a.click("run");
  const error = a.el("error").textContent!;
  assert.match(error, /E_MISSING_FIELD/);
  assert.match(error, /missing required labeled argument `size`/);
  assert.match(error, /Candidate.*program:1:5/);
  a.dom.window.close();
});

test("user macros survive a saved REPL session and Parse does not register them twice", () => {
  const app = mount();
  app.el<HTMLSelectElement>("mode").value = "repl";
  app.edit("source", "macro :answer x :: Expression Code$` $(x)");
  app.click("parse");
  app.click("run");
  assert.equal(app.el("error").textContent, "");
  const saved = app.dom.window.localStorage.getItem(key)!;
  app.dom.window.close();
  const restored = mount(saved);
  restored.edit("source", "answer 42");
  restored.click("run");
  assert.equal(restored.el("error").textContent, "");
  assert.equal(restored.el("result").textContent, "42 :: Rational");
  restored.dom.window.close();
});

test("Run stages generated grammar while Parse form stays non-executing", () => {
  const { dom, el, edit, click } = mount();
  edit(
    "source",
    "macro :install Args() Code` macro :answer x :: Expression Code$` $(x)\n(install Args())\nanswer 42",
  );
  click("run");
  assert.equal(el("result").textContent, "42 :: Rational");
  assert.equal(el("status").textContent, "Evaluated");
  dom.window.close();
});
