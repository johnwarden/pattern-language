import { DEFAULT_PRELUDE } from "./prelude.ts";
import { postfixMethodName } from "./syntax.ts";
import { punctuation } from "./lexical.ts";
import {
  primitiveNames,
  constantNames,
  bootstrapTypeNames,
  isSelfEvaluating,
  ordinarySymbolCategory,
} from "./primitive-names.ts";
import {
  runtimeDependency,
  requireAvailable,
  requirePatternAvailable,
  patternExpressions,
} from "./availability.ts";
import { lowerBlock, lowerStatement } from "./lowering.ts";
import type { Core } from "./lowering.ts";
import { addLayoutKeywords, emptyLayoutForms, parseSurface } from "./parser.ts";
import type { LayoutForms } from "./parser.ts";
import {
  quote,
  syntaxData,
  dataSyntax,
  lexicalScopes,
  hasLexicalOrigins,
} from "./macros.ts";
import {
  PatternCompiler,
  validatePatternCaptures,
} from "./pattern-compiler.ts";
import { typeIdentity, constructingTypes } from "./type-descriptor.ts";
import {
  isOpenPattern,
  patternCaptures,
  explicitPatternCaptures,
} from "./pattern-captures.ts";
import { dispatchSignature } from "./dispatch-domain.ts";
import { TYPE_SCHEMA } from "./type-schema.ts";
import { CODE_SCHEMA } from "./code-schema.ts";
import { readCode } from "./syntax-values.ts";
import {
  LANGUAGE_SCHEMA,
  SYNTAX_SCHEMA,
  encodeSyntax,
  decodeSyntax,
} from "./language-description.ts";
import {
  typeDescription,
  typeData,
  descriptionPattern,
  descriptionKey,
  term,
} from "./type-data.ts";
import { valueText, parseValueText } from "./value-text.ts";
import type { TextDomain } from "./value-text.ts";
import { Grammar, DEFAULT_GRAMMAR, syntaxGrammars } from "./grammar.ts";
import {
  annotatedPatternTypes,
  elaborateSequenceGrammar,
  regroupAssignmentLine,
  sequenceGrammarParts,
} from "./expected-grammar.ts";
import {
  LanguageError,
  isCapture,
  isTypeCapture,
  binary,
  operator,
  spread,
  positional,
  canonicalFields,
  normal,
  apply,
  symbol,
  packOf,
  listLayer,
  isTypeSpecification,
  isName,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import { Matcher, Mismatch, any } from "./pattern.ts";
import type { Pattern, Match, Capture } from "./pattern.ts";
import {
  Scope,
  unwrap,
  single,
  singleton,
  valSymbol,
  valLiteral,
  valRational,
  display,
  displayResults,
  equal,
  compare,
  concreteSpace,
  slotValue,
  inspectResults,
  syntaxOrigins,
  textValue,
  asRational,
  integerValue,
  isExactFloat32,
  isExactFloat64,
  parseNumericSpelling,
  rationalFromSyntax,
  rationalToNumber,
  isRational,
  syntaxNumber,
  addRationals,
  subRationals,
  mulRationals,
  divRationals,
  remRationals,
  powRationals,
} from "./values.ts";
import type {
  Value,
  TypeValue,
  TypeDeclaration,
  TypeDefinition,
  Candidate,
  Closure,
  Native,
  Accessor,
  Binding,
} from "./values.ts";
let nextId = 1;
const schemaCache = new Map<
  string,
  { type: TypeValue; interpreter: Interpreter }
>();
const loadingSchemas = new Set<string>();
/** Executable schemas run in isolated scopes; caller bindings cannot alter them. */
function schema(source: string) {
  let cached = schemaCache.get(source);
  if (!cached) {
    if (loadingSchemas.has(source))
      throw new Error("recursive schema bootstrap");
    loadingSchemas.add(source);
    try {
      const interpreter = new Interpreter(DEFAULT_GRAMMAR, true);
      const type = unwrap(single(interpreter.run(source)));
      if (type.kind !== "type") throw new Error("schema must return a type");
      cached = { type, interpreter };
      schemaCache.set(source, cached);
    } finally {
      loadingSchemas.delete(source);
    }
  }
  return cached;
}
function validateSchema(source: string, value: Value, code: string): void {
  const loaded = schema(source);
  loaded.interpreter.steps = 0;
  try {
    valueMatcher().match(loaded.type.pattern(), singleton(value));
  } catch (error) {
    if (!(error instanceof Mismatch)) throw error;
    throw new LanguageError(
      "invalid " +
        ({
          E_TYPE_DESCRIPTION: "type-description",
          E_LANGUAGE_DESCRIPTION: "language-description",
          E_SYNTAX_TREE: "syntax-tree",
        }[code] ?? "schema") +
        " shape: " +
        error.message,
      undefined,
      { code, phase: "declaration", notes: ["Received: " + display(value)] },
    );
  }
}
function validateDescription(value: Value): void {
  validateSchema(TYPE_SCHEMA, term("Type", value), "E_TYPE_DESCRIPTION");
}
function validateLanguage(value: Value): void {
  validateSchema(LANGUAGE_SCHEMA, value, "E_LANGUAGE_DESCRIPTION");
}
const valueMatcher = () =>
  new Matcher<Value>({
    equal,
    describe: display,
    collection: (body) => ({ kind: "term", head: valSymbol("[]"), body }),
    row: (value) => {
      let raw = unwrap(value);
      if (
        raw.kind === "term" &&
        raw.head.kind === "symbol" &&
        raw.head.name === "syntaxBlock"
      )
        return undefined;
      if (
        raw.kind === "term" &&
        raw.head.kind === "symbol" &&
        raw.head.name === "syntaxSequence" &&
        raw.body.length === 1
      )
        raw = unwrap(raw.body[0].value);
      return (raw.kind === "pack" ? raw.body : singleton(raw)).map((field) => ({
        ...field,
        span: field.span ?? syntaxOrigins.get(unwrap(field.value))?.span,
      }));
    },
    decompose: (v) => {
      v = unwrap(v);
      if (v.kind === "code") v = syntaxData(v.tree);
      if (v.kind === "type") v = typeData(v);
      return v.kind === "term" ? { head: v.head, body: v.body } : undefined;
    },
    postfix: (v) => {
      v = unwrap(v);
      return v.kind === "postfix"
        ? { operator: v.operator, operand: v.operand }
        : undefined;
    },
    rebuildPostfix: (v, operator, operand) => {
      const input = unwrap(v);
      if (input.kind === "code") return v;
      const base = { kind: "postfix" as const, operator, operand };
      const origin = syntaxOrigins.get(input);
      if (origin) syntaxOrigins.set(base, origin);
      const value = slotValue(v);
      const rebuilt = value.kind === "view" ? { ...value, base } : base;
      return v.kind === "slot" ? { ...v, value: rebuilt } : rebuilt;
    },
    rebuildRow: (value, fields) => {
      const raw = unwrap(value);
      if (
        raw.kind === "term" &&
        raw.head.kind === "symbol" &&
        raw.head.name === "syntaxSequence" &&
        raw.body.length === 1
      ) {
        const child = unwrap(raw.body[0].value);
        return {
          ...raw,
          body: singleton(
            child.kind === "pack"
              ? { kind: "pack", body: fields }
              : fields[0].value,
          ),
        };
      }
      return raw.kind === "pack" ? { ...raw, body: fields } : fields[0].value;
    },
    rebuild: (v, head, body) => {
      const input = unwrap(v);
      // Matching interprets captures; it must not rewrite the stored program.
      if (input.kind === "code") return v;
      if (unwrap(v).kind === "type") return v;
      const base = { kind: "term", head, body } as Value;
      const origin = syntaxOrigins.get(input);
      if (origin) syntaxOrigins.set(base, origin);
      const value = slotValue(v);
      const rebuilt = value.kind === "view" ? { ...value, base } : base;
      return v.kind === "slot" ? { ...v, value: rebuilt } : rebuilt;
    },
  });
const test = (
  name: string,
  predicate: (value: Value) => boolean,
): Extract<Pattern<Value>, { kind: "test" }> => ({
  kind: "test",
  name,
  test: (v) => predicate(unwrap(v)),
});
const literalPattern = (value: Value): Pattern<Value> => {
  const v = unwrap(value);
  return {
    kind: "test",
    name: display(v),
    test: (input) => {
      let x = unwrap(input);
      if (x.kind === "code" && (v.kind === "symbol" || v.kind === "literal")) {
        const tree = x.tree;
        if (tree.kind === "symbol") x = valSymbol(tree.name);
        else if (tree.kind === "literal") x = valLiteral(tree.value);
      }
      return equal(v, x);
    },
    identity: ["literal", v],
  };
};
/** Rest always denotes one list value, independently of its cardinality. */
const captureValue = (capture: Capture<Value>, name: string): Value => {
  const value: Value = capture.rest
    ? {
        kind: "term",
        head: valSymbol("[]"),
        body: canonicalFields(capture.fields),
      }
    : single(capture.fields, "capture " + name);
  return capture.wrap ? capture.wrap(value) : value;
};
const positionalPattern = (patterns: Pattern<Value>[]): Pattern<Value> => ({
  kind: "fields",
  parts: patterns.map((pattern, i) => ({
    kind: "label",
    label: "_" + (i + 1),
    pattern,
  })),
});
const captureNames = (node: Syntax): Set<string> =>
  validatePatternCaptures([node]);
export class Interpreter {
  grammar: Grammar;
  lastTree?: Syntax;
  private expandedForms = new WeakMap<Syntax, Syntax>();
  env: Scope;
  steps = 0;
  private expansionDepth = 0;
  private compileTimeDepth = 0;
  private buildingTypes = 0;
  private inlineTypeDepth = 0;
  private parsingDataDepth = 0;
  private interpretingDepth = 0;
  private types = new Map<string, TypeValue>();
  private primitives = new Map<string, TypeValue>();
  private definitionProducts = new WeakMap<TypeValue, TypeDefinition>();
  private evaluatedDefinitions = new WeakMap<
    Scope,
    WeakMap<TypeValue, TypeDefinition>
  >();
  private pendingDefinitions = new Map<TypeValue, TypeDeclaration>();
  private scopeChanges = new Map<
    Scope,
    {
      functions: Map<string, Candidate[]>;
      typeDefinitions: Map<string, TypeDefinition>;
    }
  >();
  private evaluatedTypes = new WeakMap<Scope, WeakMap<Syntax, TypeValue>>();
  private codeType?: TypeValue;
  private evaluationObserver?: (tree: Syntax, result: Field<Value>[]) => void;
  private deferringDeclarations = false;
  private deferredUnions: TypeValue[] = [];
  private aliasTargets = new WeakMap<TypeValue, TypeValue>();
  constructor(
    grammar = DEFAULT_GRAMMAR,
    schemaBootstrap = false,
    prelude = DEFAULT_PRELUDE,
  ) {
    this.grammar = new Grammar(grammar);
    this.env = this.builtins(schemaBootstrap);
    if (!schemaBootstrap) {
      const type = schema(CODE_SCHEMA).type;
      this.codeType = type;
      this.env.bindings.set("Code", type);
      this.env.bindings.set("SyntaxNode", type.treeGrammar!);
      this.env.typeDefinitions.set(typeIdentity(type), {
        type,
        name: "Code",
        capturePattern: type.pattern(),
        accessors: [],
      });
      if (prelude) this.run(prelude, "repl", "prelude");
    }
  }
  inspect(results: Field<Value>[]): string {
    const local = this.textDomain(this.env);
    return inspectResults(
      results,
      local,
      (type) => valueText(type, local),
      (type) => valueText(type, local, undefined, true),
    );
  }
  private tick() {
    if (++this.steps > 50000)
      throw new LanguageError("evaluation step limit exceeded");
  }
  parse(
    source: string,
    mode: "program" | "repl" = "program",
    sourceName = "program",
    commitGrammar = false,
  ): Syntax {
    try {
      const grammar = commitGrammar ? this.grammar : this.grammar.clone();
      grammar.deferBlocks = false;
      return grammar.parse(source, mode, sourceName);
    } catch (error) {
      if (error instanceof LanguageError) {
        if (error.diagnostic.code === "E_LANGUAGE") {
          error.diagnostic.phase = "parse";
          error.diagnostic.code = "E_SYNTAX";
        }
      }
      throw error;
    }
  }
  run(
    source: string,
    mode: "program" | "repl" = "program",
    sourceName = "program",
  ): Field<Value>[] {
    return this.transaction((env) => {
      const tree = parseSurface(source, sourceName, {
        layoutForms: this.grammar.layoutForms(),
      });
      return this.evaluateBlock(tree, env, false, mode === "repl");
    });
  }
  /** Execute an explicit lowering result, with the same session transaction as Run. */
  runCore(core: Core): Field<Value>[] {
    return this.transaction((env) => this.evaluateCore(core, env));
  }
  /** Host embedding API; not an operation installed in the source language.
   * Evaluate stored Code in an isolated child of this interpreter's session.
   */
  evaluateCode(
    value: Value,
    observe?: (tree: Syntax, result: Field<Value>[]) => void,
  ): Field<Value>[] {
    const previous = this.evaluationObserver;
    this.evaluationObserver = observe;
    try {
      return this.transaction((env) => {
      const code = unwrap(value);
      if (
        code.kind !== "code" ||
        !this.codeType ||
        typeIdentity(code.type.baseType ?? code.type) !==
          typeIdentity(this.codeType)
      )
        throw new LanguageError(
          "evaluateCode requires a value interpreted as Code",
          undefined,
          { code: "E_EXPECTED_CODE" },
        );
      const tree =
        code.tree.kind === "block"
          ? code.tree
          : {
              kind: "block" as const,
              lines: [code.tree],
              span: code.tree.span,
            };
        return this.evaluateBlock(tree, env);
      });
    } finally {
      this.evaluationObserver = previous;
    }
  }
  /** Interpret inert surface data using an ordinary type/grammar. */
  interpretSyntax(type: TypeValue, tree: Syntax): Value {
    try {
      return single(
        this.transaction(() =>
          this.check(type, syntaxData(this.grammarInput(type, tree))),
        ),
      );
    } catch (error) {
      if (error instanceof LanguageError)
        error.at(
          tree.span ??
            (tree.kind === "block" ? tree.lines[0]?.span : undefined),
        );
      throw error;
    }
  }
  /** Read canonical data, optionally resolving type names in the host session. */
  readValue(type: TypeValue, text: string, local = false): Value {
    return single(
      this.transaction((env) =>
        this.readValueInScope(type, text, local ? env : undefined),
      ),
    );
  }
  /** Call a source operation with complete packs, without making it a value. */
  call(name: string, ...packs: Field<Value>[][]): Field<Value>[] {
    if (!packs.length)
      throw new LanguageError(
        "host calls require an argument pack; use [] for an empty call",
      );
    return this.transaction((env) => {
      const local = new Scope(env);
      let expression: Syntax = symbol(name);
      let index = 0;
      for (const pack of packs)
        expression = apply(
          expression,
          pack.map((field) => {
            const name = "\0hostArgument" + index++;
            local.bindings.set(name, field.value);
            return { label: field.label, value: symbol(name) };
          }),
        );
      return this.evaluate(expression, local);
    });
  }
  /** Sidefix keywords from this type's own sequence, not the default language. */
  private layoutFormsFromPattern(pattern: Pattern<Value>): LayoutForms {
    const forms = emptyLayoutForms();
    const seen = new Set<unknown>();
    const unwrapRef = (p: Pattern<Value>): Pattern<Value> => {
      while (p.kind === "ref" || p.kind === "map" || p.kind === "capture") {
        if (p.kind === "ref") {
          if (seen.has(p.key)) return p;
          seen.add(p.key);
          p = p.resolve();
        } else p = p.pattern;
      }
      return p;
    };
    const literalName = (p: Pattern<Value>): string | undefined => {
      p = unwrapRef(p);
      if (p.kind === "label" || p.kind === "row" || p.kind === "repeat")
        return literalName(p.pattern);
      if (
        p.kind === "test" &&
        Array.isArray(p.identity) &&
        p.identity[0] === "literal"
      ) {
        const v = unwrap(p.identity[1] as Value);
        if (v.kind === "symbol") return v.name;
      }
      return undefined;
    };
    const addFrom = (p: Pattern<Value>): void => {
      p = unwrapRef(p);
      if (p.kind === "union") {
        for (const choice of p.choices) addFrom(choice);
        return;
      }
      if (p.kind === "node") {
        const head = literalName(p.head);
        const body = unwrapRef(p.body);
        if (head === "syntaxSequence" || head === "syntaxBlock") {
          forms.structural = true;
          const parts =
            body.kind === "sequence" || body.kind === "fields"
              ? body.parts
              : [body];
          const chain: string[] = [];
          for (const part of parts) {
            const name = literalName(part);
            if (name && !["syntaxSequence", "syntaxBlock"].includes(name))
              chain.push(name);
          }
          addLayoutKeywords(forms, chain);
        }
        addFrom(p.head);
        addFrom(body);
        return;
      }
      if (p.kind === "row" || p.kind === "repeat" || p.kind === "label") {
        addFrom(p.pattern);
        return;
      }
      if (p.kind === "postfix") {
        addFrom(p.operator);
        addFrom(p.operand);
        return;
      }
      if (p.kind === "fields") {
        for (const part of p.parts) addFrom(part);
        return;
      }
      if (p.kind === "sequence") {
        const chain: string[] = [];
        for (const part of p.parts) {
          const name = literalName(part);
          if (name) chain.push(name);
          addFrom(part);
        }
        addLayoutKeywords(forms, chain);
      }
    };
    addFrom(pattern);
    return forms;
  }
  private grammarInput(type: TypeValue, tree: Syntax): Syntax {
    if (tree.kind !== "block" || type.treeGrammar || type.baseType?.treeGrammar)
      return tree;
    const seen = new Set<unknown>();
    const blockPattern = (p: Pattern<Value>): boolean => {
      if (p.kind === "ref") {
        if (seen.has(p.key)) return false;
        seen.add(p.key);
        return blockPattern(p.resolve());
      }
      if (["map", "capture"].includes(p.kind))
        return blockPattern(
          (p as Extract<Pattern<Value>, { kind: "map" }>).pattern,
        );
      return (
        p.kind === "node" &&
        p.body.kind === "sequence" &&
        p.body.parts.every(
          (x) => x.kind === "row" || (x.kind === "repeat" && x.collect),
        )
      );
    };
    if (blockPattern(type.pattern())) return tree;
    const items = tree.lines.flatMap((line) =>
      line.kind === "sequence" ? line.items : [line],
    );
    return items.length === 1
      ? items[0]
      : { kind: "sequence", items, span: tree.span };
  }
  private readValueInScope(
    type: TypeValue,
    text: string,
    env?: Scope,
  ): Field<Value>[] {
    this.parsingDataDepth++;
    try {
      return this.check(
        type,
        type.treeGrammar || type.baseType?.treeGrammar
          ? syntaxData(readCode(text))
          : parseValueText(
              text,
              this.textDomain(env),
              typeIdentity(type) === typeIdentity(this.primitives.get("Type")!),
              this.layoutFormsFromPattern(type.pattern()),
            ),
      );
    } finally {
      this.parsingDataDepth--;
    }
  }
  private transaction(action: (env: Scope) => Field<Value>[]): Field<Value>[] {
    this.steps = 0;
    const previousGrammar = this.grammar;
    this.grammar = previousGrammar.clone();
    const env = new Scope(this.env);
    const previousTypes = new Map(this.types);
    this.scopeChanges = new Map();
    try {
      this.grammar.deferBlocks = true;
      const result = action(env);
      this.env = env;
      return result;
    } catch (e) {
      this.grammar = previousGrammar;
      this.types = previousTypes;
      this.evaluatedTypes = new WeakMap();
      this.pendingDefinitions.clear();
      this.deferredUnions = [];
      for (const [scope, previous] of this.scopeChanges) {
        scope.functions = previous.functions;
        scope.typeDefinitions = previous.typeDefinitions;
      }
      if (e instanceof RangeError)
        throw new LanguageError("evaluation nesting limit exceeded");
      throw e;
    }
  }
  private recordScopeChange(scope: Scope) {
    if (!this.scopeChanges.has(scope))
      this.scopeChanges.set(scope, {
        functions: new Map(scope.functions),
        typeDefinitions: new Map(scope.typeDefinitions),
      });
  }
  private native(
    name: string,
    arities: number[],
    fn: (xs: Value[], scope?: Scope) => Value | Field<Value>[],
    predicate = (_xs: Field<Value>[]) => true,
  ): Native {
    return {
      kind: "native",
      id: nextId++,
      name,
      arities,
      test: (xs) =>
        xs.length === arities[0] &&
        xs.every((e, i) => e.label === "_" + (i + 1)) &&
        predicate(xs),
      invoke: (xs, env) => {
        const result = fn(
          xs.map((e) => e.value),
          env,
        );
        return Array.isArray(result) ? result : singleton(result);
      },
    };
  }
  private builtins(schemaBootstrap = false): Scope {
    const scope = new Scope();
    for (const [name, predicate] of Object.entries({
      Rational: (v: Value): boolean => !!asRational(v),
      Num: (v: Value): boolean => {
        const r = asRational(v);
        return !!r && isExactFloat64(r);
      },
      Int: (v: Value): boolean => {
        const r = asRational(v);
        if (r)
          return (
            r.d === 1n &&
            r.n >= BigInt(Number.MIN_SAFE_INTEGER) &&
            r.n <= BigInt(Number.MAX_SAFE_INTEGER)
          );
        return (
          v.kind === "literal" &&
          typeof v.value === "number" &&
          Number.isSafeInteger(v.value)
        );
      },
      String: (v: Value): boolean =>
        v.kind === "literal" && typeof v.value === "string",
      LowerCamelSymbol: (v: Value): boolean =>
        v.kind === "symbol" &&
        ordinarySymbolCategory(v.name) === "LowerCamelSymbol",
      UpperCamelSymbol: (v: Value): boolean =>
        v.kind === "symbol" &&
        ordinarySymbolCategory(v.name) === "UpperCamelSymbol",
      UpperSnakeSymbol: (v: Value): boolean =>
        v.kind === "symbol" &&
        ordinarySymbolCategory(v.name) === "UpperSnakeSymbol",
      PunctuationSymbol: (v: Value): boolean =>
        v.kind === "symbol" &&
        ordinarySymbolCategory(v.name) === "PunctuationSymbol",
      Expression: (_v: Value): boolean => true,
      Body: (_v: Value): boolean => true,
      Any: (_v: Value): boolean => true,
      Type: (v: Value): boolean => !!this.materializeType(v),
      Bool: (v: Value): boolean =>
        v.kind === "symbol" && ["True", "False"].includes(v.name),
      Float: (v: Value): boolean => {
        const r = asRational(v);
        return !!r && isExactFloat64(r);
      },
      Float64: (v: Value): boolean => {
        const r = asRational(v);
        return !!r && isExactFloat64(r);
      },
      Float32: (v: Value): boolean => {
        const r = asRational(v);
        return !!r && isExactFloat32(r);
      },
      Int64: (v: Value): boolean => {
        const r = asRational(v);
        if (r)
          return (
            r.d === 1n &&
            r.n >= BigInt(Number.MIN_SAFE_INTEGER) &&
            r.n <= BigInt(Number.MAX_SAFE_INTEGER)
          );
        return (
          v.kind === "literal" &&
          typeof v.value === "number" &&
          Number.isSafeInteger(v.value)
        );
      },
      ReservedSymbol: (v: Value): boolean =>
        v.kind === "symbol" && primitiveNames.has(v.name),
    })) {
      const numericKind = ["Num", "Float", "Float64"].includes(name)
        ? "float64"
        : ["Int", "Int64"].includes(name)
          ? "int64"
          : name === "Float32"
            ? "float32"
            : name === "Rational"
              ? "rational"
              : undefined;
      scope.bindings.set(name, {
        kind: "type",
        name,
        key: "primitive:" + name,
        transparent: ["Expression", "Body", "Any", "Type"].includes(name),
        packaged: name === "Any",
        numeric: numericKind,
        pattern: () => ({
          ...test(name, predicate),
          identity: [
            "primitive",
            name === "Float64" ? "Float64" : (numericKind ?? name),
          ],
        }),
      });
      this.primitives.set(name, scope.bindings.get(name) as TypeValue);
    }
    if (schemaBootstrap) {
      // Schema evaluation skips the prelude, so install the same four-class
      // Symbol union the prelude defines. Do not treat the name as reserved.
      const symbol = this.unionType(
        [
          "LowerCamelSymbol",
          "UpperCamelSymbol",
          "UpperSnakeSymbol",
          "PunctuationSymbol",
        ].map((name) => this.primitives.get(name)!),
      );
      symbol.name = "Symbol";
      scope.bindings.set("Symbol", symbol);
    }
    // Canonical primitive atoms have fixed language meanings.
    for (const alias of ["Num", "Int64"]) scope.bindings.delete(alias);
    for (const name of constantNames)
      scope.bindings.set(name, this.boolean(name === "True"));
    for (const [name, value] of scope.bindings) {
      if (!("kind" in value) || value.kind !== "type") continue;
      scope.typeDefinitions.set(typeIdentity(value), {
        type: value,
        name,
        capturePattern: value.pattern(),
        accessors: [],
      });
    }
    scope.functions.set("language", [
      this.native("language", [0], () => this.grammar.description()),
    ]);
    scope.functions.set("languageSchema", [
      this.native("languageSchema", [0], () => schema(LANGUAGE_SCHEMA).type),
    ]);
    scope.functions.set("syntaxSchema", [
      this.native(
        "syntaxSchema",
        [0],
        () => schema(SYNTAX_SCHEMA + "SyntaxNode\n").type,
      ),
    ]);
    scope.functions.set("syntaxTree", [
      this.native("syntaxTree", [1], ([value]) => {
        const tree = encodeSyntax(dataSyntax(value));
        return this.check(schema(SYNTAX_SCHEMA + "SyntaxNode\n").type, tree);
      }),
    ]);
    scope.functions.set("syntaxExpression", [
      this.native("syntaxExpression", [1], ([tree]) => {
        // Shape recognition always uses the public source schema. The decoder
        // checks field-order/binder invariants; neither operation executes code.
        validateSchema(SYNTAX_SCHEMA + "SyntaxNode\n", tree, "E_SYNTAX_TREE");
        return syntaxData(decodeSyntax(tree));
      }),
    ]);
    scope.functions.set("TreeGrammar", [
      this.native("TreeGrammar", [1], ([value]) => {
        const type = this.materializeType(value);
        if (!type)
          throw new LanguageError("TreeGrammar requires a tree schema type");
        return this.treeGrammar(type);
      }),
    ]);
    // Compatibility factory: unlike a symbolic :Code(...) application, this
    // ordinary operation interprets its input using the source-defined grammar.
    scope.functions.set("Code", [
      this.native("Code", [1], ([value]) => {
        if (!this.codeType)
          throw new LanguageError("Code is unavailable in schema bootstrap");
        return this.check(this.codeType, value);
      }),
    ]);
    scope.functions.set("parseSyntax", [
      this.native("parseSyntax", [1, 1], ([description, source]) => {
        const value = unwrap(source);
        if (value.kind !== "literal" || typeof value.value !== "string")
          throw new LanguageError("parseSyntax requires source text");
        return encodeSyntax(
          Grammar.fromDescription(description, validateLanguage).parse(
            value.value,
          ),
        );
      }),
    ]);
    const reservedAction = this.native("!", [0], () => {
      throw new LanguageError(
        "postfix ! is reserved for future action types",
        undefined,
        { code: "E_RESERVED_OPERATOR" },
      );
    });
    reservedAction.test = () => true;
    scope.functions.set("!", [reservedAction]);
    const numeric = (v: Value): number => {
      const r = asRational(v);
      if (!r) throw new LanguageError("expected a number");
      const n = rationalToNumber(r);
      if (!Number.isFinite(n)) throw new LanguageError("expected a number");
      return n;
    };
    const exactOps: Record<
      string,
      (
        a: NonNullable<ReturnType<typeof asRational>>,
        b: NonNullable<ReturnType<typeof asRational>>,
      ) => NonNullable<ReturnType<typeof asRational>>
    > = {
      "+": addRationals,
      "-": subRationals,
      "*": mulRationals,
      "/": divRationals,
      "%": remRationals,
      "^": powRationals,
    };
    const checked = (n: number) => {
      if (
        !Number.isFinite(n) ||
        (Number.isInteger(n) && !Number.isSafeInteger(n))
      )
        throw new LanguageError("result exceeds safe numeric range");
      return valLiteral(n);
    };
    const ops: Record<string, (a: number, b: number) => number> = {
      "+": (a, b) => a + b,
      "-": (a, b) => a - b,
      "*": (a, b) => a * b,
      "/": (a, b) => a / b,
      "%": (a, b) => ((a % b) + b) % b,
      "^": (a, b) => a ** b,
    };
    for (const [name, op] of Object.entries(ops))
      scope.bindings.set(
        name,
        this.native(
          name,
          [1, 1],
          ([a, b]) => {
            const space = concreteSpace(a) ?? concreteSpace(b);
            const other = concreteSpace(b);
            if (
              concreteSpace(a) &&
              other &&
              typeIdentity(concreteSpace(a)!) !== typeIdentity(other)
            )
              throw new LanguageError(
                "arithmetic requires the same concrete numeric type; use an explicit conversion",
                undefined,
                { code: "E_INCOMPARABLE_TYPES" },
              );
            a = unwrap(a);
            b = unwrap(b);
            if (
              name === "+" &&
              a.kind === "literal" &&
              b.kind === "literal" &&
              typeof a.value === "string" &&
              typeof b.value === "string"
            ) {
              if (a.value.length + b.value.length > 100000)
                throw new LanguageError("string size limit exceeded");
              return this.ascribeString(valLiteral(a.value + b.value));
            }
            if (!space || space.numeric === "rational") {
              const left = asRational(a),
                right = asRational(b);
              if (!left || !right) throw new LanguageError("expected a number");
              const result = exactOps[name](left, right);
              const value = valRational(result.n, result.d);
              return space
                ? this.check(space, value)
                : single(this.ascribeRational(value));
            }
            let result = op(numeric(a), numeric(b));
            if (space?.numeric === "int64" && name === "/")
              result = Math.trunc(result);
            if (space?.numeric === "float32") result = Math.fround(result);
            const value = checked(result);
            return space ? this.check(space, value) : value;
          },
          (xs) => !this.materializeType(xs[0].value),
        ),
      );
    for (const name of ["==", "!=", "<", ">", "<=", ">="])
      scope.bindings.set(
        name,
        this.native(name, [1, 1], ([a, b]) => {
          const c =
            name === "==" || name === "!=" ? equal(a, b) : compare(a, b);
          const yes =
            name === "=="
              ? c
              : name === "!="
                ? !c
                : name === "<"
                  ? Number(c) < 0
                  : name === ">"
                    ? Number(c) > 0
                    : name === "<="
                      ? Number(c) <= 0
                      : Number(c) >= 0;
          return this.boolean(!!yes);
        }),
      );
    scope.bindings.set(
      "negate",
      this.native("negate", [1], ([v]) => this.negateValue(v)),
    );
    for (const [method, target] of [
      ["toInt", "Int"],
      ["toFloat", "Float"],
      ["toFloat32", "Float32"],
    ])
      scope.bindings.set(
        method,
        this.native(method, [1], ([v]) => {
          const n = numeric(v);
          return this.check(
            this.primitives.get(target)!,
            checked(target === "Int" ? Math.trunc(n) : n),
          );
        }),
      );
    scope.bindings.set(
      "float32",
      this.native("float32", [1], ([v]) => {
        const r = asRational(v);
        if (!r) throw new LanguageError("expected a number");
        const n = Math.fround(rationalToNumber(r));
        if (!Number.isFinite(n))
          throw new LanguageError("result exceeds safe numeric range");
        return this.check(this.primitives.get("Float32")!, valLiteral(n));
      }),
    );
    scope.bindings.set(
      "float64",
      this.native("float64", [1], ([v]) => {
        const r = asRational(v);
        if (!r) throw new LanguageError("expected a number");
        const n = rationalToNumber(r);
        if (!Number.isFinite(n))
          throw new LanguageError("result exceeds safe numeric range");
        return this.check(this.primitives.get("Float64")!, valLiteral(n));
      }),
    );
    scope.bindings.set(
      "isInt64",
      this.native("isInt64", [1], ([v]) =>
        this.boolean(Number.isSafeInteger(numeric(v))),
      ),
    );
    scope.bindings.set(
      "where",
      this.native("where", [1, 1], ([base, predicate], env) =>
        this.refine(base, predicate, env),
      ),
    );
    scope.bindings.set(
      "matches",
      this.native("matches", [1, 1], ([value, pattern]) => {
        const p = this.materializeType(pattern);
        // Canonical type trees compile on demand. No user code is evaluated.
        // Other ordinary trees remain literal matching values.
        const compiled = p
          ? this.typePattern(p)
          : {
              kind: "test" as const,
              name: display(pattern),
              test: (candidate: Value) => {
                try {
                  return pattern.kind === "view" && pattern.provisional
                    ? equal(unwrap(candidate), unwrap(pattern))
                    : equal(candidate, pattern);
                } catch (error) {
                  if (
                    error instanceof LanguageError &&
                    error.diagnostic.code === "E_INCOMPARABLE_TYPES"
                  )
                    return false;
                  throw error;
                }
              },
            };
        try {
          valueMatcher().match(compiled, singleton(value));
          return this.boolean(true);
        } catch (error) {
          if (error instanceof Mismatch) return this.boolean(false);
          throw error;
        }
      }),
    );
    scope.functions.set("Type", [
      this.native("Type", [1], ([pattern]) => {
        const type = this.materializeType(pattern);
        return type && typeDescription(type).kind !== "symbol"
          ? type
          : this.structuralType(term("Type", unwrap(pattern)));
      }),
    ]);
    scope.bindings.set(
      "|",
      this.native("|", [1, 1], ([left, right]) => ({
        kind: "term",
        head: term("|", left),
        body: singleton(right),
      })),
    );
    scope.functions.set("Facet", [
      this.native("Facet", [1], ([pattern], env) => {
        const type = this.materializeType(pattern);
        if (type) {
          if (type.facet) return type;
          const products = env && this.definitionEvaluation(env).get(type);
          if (products && env && !type.baseType && !type.unionMembers)
            return this.patternType(
              products.capturePattern,
              env,
              "facet " + type.name,
              undefined,
              true,
            );
          pattern = typeDescription(type);
        }
        return this.structuralType(term("Facet", pattern));
      }),
    ]);
    const unionConstructor = this.native("UnionType", [1], (members) =>
      this.unionType(members),
    );
    unionConstructor.test = (xs) =>
      xs.length > 0 && xs.every((e, i) => e.label === "_" + (i + 1));
    scope.functions.set("UnionType", [unionConstructor]);
    scope.functions.set("String", [
      this.native("String", [1], ([codes]) => {
        const value = unwrap(codes);
        if (
          value.kind !== "term" ||
          value.head.kind !== "symbol" ||
          value.head.name !== "[]"
        )
          throw new LanguageError(
            "String requires a list of Unicode code points",
          );
        const numbers = value.body.map((f) => integerValue(f.value));
        if (
          numbers.some(
            (n) =>
              n === undefined ||
              !Number.isInteger(n) ||
              n < 0 ||
              n > 0x10ffff ||
              (n >= 0xd800 && n <= 0xdfff),
          )
        )
          throw new LanguageError("String requires Unicode code points");
        return this.ascribeString(
          valLiteral(
            numbers.map((n) => String.fromCodePoint(n as number)).join(""),
          ),
        );
      }),
    ]);
    scope.functions.set("Node", [
      this.native("Node", [2], ([head, body]) => {
        body = unwrap(body);
        if (
          body.kind !== "term" ||
          body.head.kind !== "symbol" ||
          body.head.name !== "{}"
        )
          throw new LanguageError("Node requires a braced argument body");
        return { kind: "term", head, body: body.body };
      }),
    ]);
    for (const name of ["parse", "toString", "parseLocal", "toStringLocal"]) {
      const factory = this.native(name, [1, 1], ([type, value], env) => {
        type = this.materializeType(type) ?? unwrap(type);
        if (type.kind !== "type")
          throw new LanguageError("expected a type argument");
        const domain = this.textDomain(
          name.endsWith("Local") ? env : undefined,
        );
        if (name.startsWith("parse")) {
          value = unwrap(value);
          if (value.kind !== "literal" || typeof value.value !== "string")
            throw new LanguageError("parse requires a string");
          return this.readValueInScope(
            type,
            value.value,
            name.endsWith("Local") ? env : undefined,
          );
        }
        const checked = single(this.check(type, value));
        return this.ascribeString(valLiteral(valueText(checked, domain, type)));
      });
      const accepts = factory.test;
      factory.test = (xs) => accepts(xs) && !!this.materializeType(xs[0].value);
      scope.functions.set(name, [factory]);
    }
    scope.functions.get("toString")!.push(
      this.native(
        "toString",
        [1],
        ([value]) =>
          this.ascribeString(
            valLiteral(
              valueText(
                value,
                this.textDomain(),
                value.kind === "slot" ? value.type : concreteSpace(value),
              ),
            ),
          ),
        (xs) => !this.materializeType(xs[0].value),
      ),
    );
    scope.bindings.set(
      "len",
      this.native("len", [1], ([v]) => {
        v = unwrap(v);
        if (v.kind === "literal" && typeof v.value === "string")
          return valLiteral([...v.value].length);
        if (v.kind === "term" || v.kind === "pack")
          return valLiteral(v.body.length);
        throw new LanguageError("len requires a string or argument body");
      }),
    );
    for (const [name, value] of scope.bindings) {
      if ("kind" in value && value.kind === "native") {
        scope.functions.set(name, [
          ...(scope.functions.get(name) ?? []),
          value,
        ]);
        scope.bindings.delete(name);
      }
    }
    return scope;
  }
  private bind(env: Scope, name: string, value: Binding) {
    if (constantNames.has(name))
      throw new LanguageError(
        "self-evaluating constants are reserved: " + name,
        undefined,
        { code: "E_RESERVED_CONSTANT", phase: "declaration" },
      );
    if (primitiveNames.has(name) && !bootstrapTypeNames.has(name))
      throw new LanguageError(
        "primitive type names are reserved: " + name,
        undefined,
        { code: "E_RESERVED_PRIMITIVE", phase: "declaration" },
      );
    if (env.bindings.has(name))
      throw new LanguageError("name already bound in this scope: " + name);
    if (
      "kind" in value &&
      ["closure", "native", "overload", "accessor"].includes(
        unwrap(value).kind,
      ) &&
      env.visible(name).some((c) => c.kind === "closure" && c.macro)
    )
      throw new LanguageError(
        "a callable variable cannot share a macro name: " + name,
        undefined,
        { code: "E_MACRO_FUNCTION_CONFLICT", phase: "declaration" },
      );
    env.bindings.set(
      name,
      "kind" in value && value.kind === "view" && value.provisional
        ? { ...value, provisional: false }
        : value,
    );
  }
  /** Execute lowered block operations; no surface binding operator is interpreted here. */
  private evaluateCore(core: Core, env: Scope): Field<Value>[] {
    let result: Field<Value>[] = [];
    for (let node = core; node.kind !== "done"; node = node.next) {
      this.tick();
      try {
        if (node.kind === "then") result = this.evaluate(node.expression, env);
        else {
          const values = this.evaluateFields(
            node.value,
            env,
            this.expectedFieldsFromPattern(node.pattern, env),
          );
          const matched = this.matchParameters(node.pattern, values, env);
          // Same block scope deliberately preserves duplicate-name errors and REPL bindings.
          const runtime = [
            ...node.value.map((e) => e.value),
            ...patternExpressions({ kind: "pack", body: node.pattern }),
          ].some((e) => runtimeDependency(e, env, captureNames));
          for (const [name, capture] of matched.captures) {
            this.bind(env, name, captureValue(capture, name));
            if (runtime) env.runtimeBindings.add(name);
          }
          result = matched.fields;
        }
      } catch (error) {
        if (error instanceof LanguageError) error.at(node.span);
        throw error;
      }
    }
    return result;
  }
  /** Only lower a whole block when recognition does not require staged grammar changes. */
  private canLowerWithoutStaging(n: Syntax, env: Scope): boolean {
    if (
      n.kind === "quote" ||
      n.kind === "typedQuote" ||
      n.kind === "template" ||
      n.kind === "block" ||
      n.kind === "literal"
    )
      return true;
    if (n.kind === "sequence" || n.kind === "form") return false;
    if (n.kind === "symbol") {
      if (!n.quoted && this.grammar.keywords.has(n.name)) return false;
      const scope = lexicalScopes.get(n) ?? env;
      return (
        n.quoted ||
        !scope.visible(n.name).some((c) => c.kind === "closure" && c.macro)
      );
    }
    if (n.kind === "pack")
      return n.body.every((e) => this.canLowerWithoutStaging(e.value, env));
    if (n.kind === "postfix")
      return this.canLowerWithoutStaging(n.operand, env);
    return (
      this.canLowerWithoutStaging(n.head, env) &&
      n.body.every((e) => this.canLowerWithoutStaging(e.value, env))
    );
  }
  private evaluateBlock(
    n: Syntax,
    env: Scope,
    local = true,
    repl = false,
  ): Field<Value>[] {
    if (n.kind !== "block") return this.evaluate(n, env);
    const outerGrammar = this.grammar;
    if (local) {
      env = new Scope(env);
      this.grammar = this.grammar.clone();
    }
    this.grammar.deferBlocks = true;
    let result: Field<Value>[] = [];
    try {
      const microLines = n.lines.map((line) =>
        line.kind === "sequence" && line.items.length === 1
          ? line.items[0]
          : line,
      );
      if (microLines.every((line) => this.canLowerWithoutStaging(line, env))) {
        const tree = { ...n, lines: microLines };
        const result = this.evaluateCore(lowerBlock(tree, repl), env);
        if (!local) this.lastTree = tree;
        return result;
      }
      const pending: Extract<Syntax, { kind: "form" }>[] = [];
      const flush = () => {
        if (pending.length) {
          result = this.defineGroup(pending.splice(0), env);
        }
      };
      const tree = this.grammar.elaborate(
        n,
        (line) => {
          try {
            if (line.kind === "form" && line.name === "Definition") {
              this.grammar.registerDefinition(line);
              pending.push(line);
              return line;
            }
            flush();
            result = this.evaluateCore(lowerStatement(line), env);
            let expanded = line;
            while (this.expandedForms.has(expanded))
              expanded = this.expandedForms.get(expanded)!;
            return expanded;
          } catch (error) {
            if (error instanceof LanguageError) error.at(line.span);
            throw error;
          }
        },
        repl,
        (input) => {
          flush();
          return this.completeExpectedGrammarLine(input, env);
        },
      );
      flush();
      if (!local) this.lastTree = tree;
      return result;
    } finally {
      if (local) this.grammar = outerGrammar;
    }
  }
  private capture(n: Extract<Syntax, { kind: "form" }>, name: string): Syntax {
    const xs = n.captures.get(name)?.fields;
    if (!xs || xs.length !== 1)
      throw new LanguageError(n.name + " requires one " + name);
    return xs[0].value;
  }
  private evaluate(n: Syntax, env: Scope): Field<Value>[] {
    try {
      const result = this.evaluateNode(n, env);
      this.evaluationObserver?.(n, result);
      return result;
    } catch (error) {
      if (error instanceof LanguageError) error.at(n.span);
      throw error;
    }
  }
  private evaluateNode(n: Syntax, env: Scope): Field<Value>[] {
    this.tick();
    if (n.kind === "template") {
      const fragments = [""],
        values: Value[] = [];
      for (const part of n.parts) {
        if (part.kind === "text") fragments[fragments.length - 1] += part.value;
        else if (part.protection)
          fragments[fragments.length - 1] +=
            part.spelling ??
            "$".repeat(part.protection) + "(" + normal(part.value) + ")";
        else {
          values.push(
            single(
              this.evaluate(this.grammar.resolve(part.value), env),
              "text interpolation",
            ),
          );
          fragments.push("");
        }
      }
      if (n.reader) {
        const local = new Scope(env),
          list = (xs: Value[]): Value => ({
            kind: "term",
            head: valSymbol("[]"),
            body: xs.map((value, i) => ({ label: "_" + (i + 1), value })),
          });
        local.bindings.set(
          "\0readerFragments",
          list(fragments.map((fragment) => this.stringValue(fragment))),
        );
        local.bindings.set("\0readerValues", list(values));
        return this.evaluate(
          apply(n.reader, [
            { label: "_1", value: symbol("\0readerFragments") },
            { label: "_2", value: symbol("\0readerValues") },
          ]),
          local,
        );
      }
      const result = fragments
        .map(
          (fragment, i) =>
            fragment + (i < values.length ? textValue(values[i]) : ""),
        )
        .join("");
      if (result.length > 100000)
        throw new LanguageError("string size limit exceeded", n.span);
      return this.ascribeString(valLiteral(result));
    }
    if (n.kind === "typedQuote") {
      const type = this.typeFromSyntax(n.grammar, env);
      const syntaxType = type.treeGrammar
        ? type
        : type.baseType?.treeGrammar
          ? type.baseType
          : undefined;
      const content = this.grammarInput(type, n.value);
      const value = quote(
        content,
        this.snapshot(env),
        (x) => single(this.evaluate(this.grammar.resolve(x), env), "unquote"),
        this.expansionDepth > 0,
        syntaxType
          ? (value) => {
              const space = concreteSpace(value);
              const raw = unwrap(value);
              let literal = dataSyntax(raw);
              const magnitude = asRational(raw);
              const negative = !!magnitude && magnitude.n < 0n;
              if (negative) {
                literal = apply(
                  symbol("negate"),
                  packOf(syntaxNumber({ n: -magnitude.n, d: magnitude.d })),
                );
              }
              if (
                raw.kind === "literal" &&
                typeof raw.value === "string" &&
                (!space ||
                  typeIdentity(space) ===
                    typeIdentity(this.primitives.get("String")!))
              )
                return {
                  kind: "code" as const,
                  type: syntaxType,
                  tree: literal,
                  portable: true,
                };
              if (!space || space.numeric === "rational")
                return negative ||
                  (raw.kind === "literal" && isRational(raw.value))
                  ? {
                      kind: "code" as const,
                      type: syntaxType,
                      tree: literal,
                      portable: true,
                    }
                  : value;
              if (typeIdentity(space) === typeIdentity(type.baseType ?? type))
                return value;
              const primitive = [...this.primitives.values()].some(
                (p) => typeIdentity(p) === typeIdentity(space),
              );
              if (primitive) {
                // Symbols are the syntax atoms themselves (including binder and
                // callable names), not an ascribed expression around that atom.
                if (
                  raw.kind === "symbol" &&
                  ordinarySymbolCategory(raw.name) === space.name
                )
                  return {
                    kind: "code" as const,
                    type: syntaxType,
                    tree: dataSyntax(raw),
                    portable: true,
                  };
                if (raw.kind === "symbol")
                  literal = symbol(raw.name, space.name !== "Bool");
                const tree = apply(
                  apply(symbol("::"), packOf(literal)),
                  packOf(dataSyntax(typeData(space))),
                );
                return {
                  kind: "code" as const,
                  type: syntaxType,
                  tree,
                  portable: !hasLexicalOrigins(tree),
                };
              }
              throw new LanguageError(
                "incompatible quotation splice: expected " +
                  type.name +
                  ", received " +
                  space.name,
                n.span,
                {
                  code: "E_QUOTE_GRAMMAR",
                  notes: [
                    "Use the explicit syntaxTree/syntaxExpression bridge to reinterpret another grammar.",
                  ],
                },
              );
            }
          : undefined,
        !!n.interpolate,
      );
      return this.check(type, value, env);
    }
    if (n.kind === "quote") {
      const value = quote(
        n.value,
        this.snapshot(env),
        (x) => single(this.evaluate(this.grammar.resolve(x), env), "unquote"),
        this.expansionDepth > 0,
      );
      return singleton(
        value.kind === "symbol" ? this.symbolValue(value.name) : value,
      );
    }
    if (
      n.kind === "apply" &&
      n.head.kind === "symbol" &&
      ["[]", "{}"].includes(n.head.name) &&
      n.body.length === 1 &&
      n.body[0].value.kind === "block"
    ) {
      const rows: Field<Value>[] = [];
      const appendRow = (fields: Field<Value>[], packed = false) => {
        const value: Value =
          packed || fields.length !== 1
            ? { kind: "pack", body: fields }
            : fields[0].value;
        rows.push({
          label: "_" + (rows.length + 1),
          value: term("syntaxSequence", value),
        });
      };
      const lines = n.body[0].value.lines.map((line) =>
        line.kind === "sequence" && line.items.length === 1
          ? line.items[0]
          : line,
      );
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index],
          next = lines[index + 1];
        if (line.kind === "symbol" && !line.quoted && line.name === "…")
          throw new LanguageError(
            "vertical ... requires a preceding horizontal spread row",
            line.span,
            { code: "E_VERTICAL_SPREAD" },
          );
        if (next?.kind === "symbol" && !next.quoted && next.name === "…") {
          const operand = spread(line);
          if (!operand)
            throw new LanguageError(
              "vertical value spreading currently requires a single horizontal spread row",
              line.span,
              { code: "E_VERTICAL_SPREAD" },
            );
          const list = (value: Value) => {
            const raw = unwrap(value);
            if (
              raw.kind !== "term" ||
              raw.head.kind !== "symbol" ||
              raw.head.name !== "[]" ||
              raw.body.some((field) => !positional(field.label))
            )
              throw new LanguageError(
                "vertical spreading requires a positional list of row lists",
                operand.span,
                { code: "E_VERTICAL_SPREAD" },
              );
            return raw.body;
          };
          const captured = single(
            this.evaluate(operand, env),
            "vertical spread",
          );
          for (const row of list(captured)) appendRow(list(row.value));
          index++;
          continue;
        }
        appendRow(this.evaluateFields(packOf(line), env), line.kind === "pack");
      }
      return singleton({
        kind: "term",
        head: valSymbol(n.head.name),
        body: [
          {
            label: "_1",
            value: {
              kind: "term",
              head: valSymbol("syntaxBlock"),
              body: rows,
            },
          },
        ],
      });
    }
    if (n.kind === "block") return this.evaluateBlock(n, env);
    if (n.kind === "pack") return this.evaluateFields(n.body, env);
    if (n.kind === "literal") {
      if (typeof n.value === "string")
        return this.ascribeString(valLiteral(n.value));
      const r = rationalFromSyntax(n);
      if (!r)
        throw new LanguageError("malformed numeric source literal", n.span);
      return this.ascribeRational(valRational(r.n, r.d));
    }
    if (n.kind === "symbol") {
      if (n.quoted) {
        if (isSelfEvaluating(n.name)) throw this.quotedPrimitive(n);
        return singleton(this.symbolValue(n.name));
      }
      const primitive = primitiveNames.get(n.name);
      if (
        primitive &&
        !(
          bootstrapTypeNames.has(n.name) &&
          (lexicalScopes.get(n) ?? env).get(n.name)
        )
      )
        return this.reserved(n.name);
      if (constantNames.has(n.name))
        return singleton(this.boolean(n.name === "True"));
      const lookup = lexicalScopes.get(n) ?? env;
      const candidates = lookup.visible(n.name),
        bound = lookup.get(n.name);
      if (bound && !("kind" in bound)) {
        if (bound.parameterized)
          throw new LanguageError(
            "type factory " + n.name + " requires an argument pack",
            n.span,
            { code: "E_TYPE_FACTORY_VALUE" },
          );
        return singleton(this.instantiate(bound, []));
      }
      if (bound && "kind" in bound) {
        if (this.compileTimeDepth && lookup.isRuntime(n.name))
          requireAvailable(n, lookup, captureNames);
        return singleton(bound);
      }
      if (candidates.length)
        throw new LanguageError(
          "defined function " + n.name + " cannot be used as a value",
          n.span,
          {
            code: "E_FUNCTION_NOT_VALUE",
            notes: [
              "Call it directly, or wrap the call in an anonymous function.",
            ],
          },
        );
      throw new LanguageError("unbound name: " + n.name, n.span, {
        code: "E_UNBOUND_NAME",
      });
    }
    if (n.kind === "form") {
      if (n.name.startsWith("User:")) {
        const name = n.name.slice(5);
        const lookup = lexicalScopes.get(n.items[0]) ?? env;
        const candidates = lookup
          .visible(name)
          .filter(
            (c): c is Closure =>
              c.kind === "closure" && !!c.macro && !!c.sidefix,
          );
        if (candidates.length !== 1)
          throw new LanguageError(
            "sidefix macro is not available: " + name,
            n.span,
            { code: "E_MACRO_SCOPE", phase: "expand" },
          );
        const local = new Scope(candidates[0].env);
        for (const [name, capture] of n.captures) {
          if (!capture.rest && capture.fields.length !== 1) {
            local.bindings.set(
              name,
              syntaxData({
                kind: "sequence",
                items: capture.fields.map((e) => e.value),
              }),
            );
          } else
            local.bindings.set(
              name,
              captureValue(
                {
                  rest: capture.rest,
                  fields: capture.fields.map((e) => ({
                    ...e,
                    value: syntaxData(e.value),
                  })),
                },
                name,
              ),
            );
        }
        return this.expandMacro(candidates[0], local, n, env);
      }
      switch (n.name) {
        case "MacroRegistration":
        case "Definition":
          this.grammar.registerDefinition(n);
          return this.define(
            this.capture(n, "signature"),
            this.capture(n, "body"),
            env,
            n.name === "MacroRegistration",
          );
        case "TypeExpression":
          return singleton(this.anonymousType(this.capture(n, "pattern"), env));
        case "UnionTypeExpression": {
          const alternatives = (pattern: Syntax): TypeValue[] => {
            const parts = binary(pattern, "|");
            return parts
              ? [...alternatives(parts[0]), ...alternatives(parts[1])]
              : [this.typeFromSyntax(pattern, env)];
          };
          return singleton(
            this.unionType(alternatives(this.capture(n, "pattern"))),
          );
        }
        case "IfExpression": {
          const cond = unwrap(
            single(
              this.evaluate(this.capture(n, "condition"), env),
              "condition",
            ),
          );
          if (cond.kind !== "symbol" || !["True", "False"].includes(cond.name))
            throw new LanguageError("condition must be True or False");
          return this.evaluate(
            this.capture(
              n,
              cond.name === "True" ? "consequent" : "alternative",
            ),
            env,
          );
        }
        case "MatchExpression": {
          const subject = this.capture(n, "subject"),
            values = this.evaluate(subject, env),
            arms = this.capture(n, "arms");
          if (arms.kind !== "block")
            throw new LanguageError("expected match arms");
          for (const arm of arms.lines) {
            const pair = operator(arm, "->");
            if (!pair)
              throw new LanguageError(
                "match arm requires pattern -> expression",
                arm.span,
                { code: "E_MATCH_ARM", phase: "parse" },
              );
            validatePatternCaptures([{ kind: "pack", body: pair[0] }]);
            let matched: Match<Value>;
            try {
              matched = this.matchParameters(pair[0], values, env, true);
            } catch (e) {
              if (e instanceof Mismatch) continue;
              throw e;
            }
            const local = new Scope(env);
            const runtime = [
              subject,
              ...patternExpressions({ kind: "pack", body: pair[0] }),
            ].some((e) => runtimeDependency(e, env, captureNames));
            for (const [name, capture] of matched.captures) {
              this.bind(local, name, captureValue(capture, name));
              if (runtime) local.runtimeBindings.add(name);
            }
            const expression: Syntax =
              pair[1].length === 1 && pair[1][0].label === "_1"
                ? pair[1][0].value
                : { kind: "pack", body: pair[1] };
            return this.evaluate(expression, local);
          }
          throw new Mismatch("no matching arm");
        }
        default:
          throw new LanguageError(
            "no evaluation rule registered for macro " + n.name,
          );
      }
    }
    if (n.kind === "postfix") {
      const methods = (lexicalScopes.get(n) ?? env).visible(
        postfixMethodName(n.operator),
      );
      const operand = single(this.evaluate(n.operand, env), "postfix operand");
      if (methods.length)
        return this.invoke(
          { kind: "overload", name: normal(n), candidates: methods },
          singleton(operand),
          env,
        );
      const type = this.materializeType(operand);
      if (type && (n.operator === "*" || n.operator === "^"))
        return singleton(this.modifiedType(n.operator, type));
      return singleton({
        kind: "postfix",
        operator: valSymbol(n.operator),
        operand,
      });
    }
    if (n.kind === "sequence")
      throw new LanguageError("unknown or incomplete macro form", n.span);
    if (n.kind !== "apply")
      throw new LanguageError("unresolved syntax reached evaluator");
    if (n.head.kind === "symbol" && !n.head.quoted && n.head.name === "$")
      throw new LanguageError("$ is only valid inside quotation", n.span, {
        code: "E_UNQUOTE_CONTEXT",
        phase: "expand",
      });
    const arrow = operator(n, "->");
    if (arrow) {
      validatePatternCaptures([{ kind: "pack", body: arrow[0] }]);
      return singleton({
        kind: "closure",
        id: nextId++,
        grammar: this.grammar.clone(),
        parameters: [arrow[0]],
        body:
          arrow[1].length === 1 && arrow[1][0].label === "_1"
            ? arrow[1][0].value
            : { kind: "pack", body: arrow[1] },
        env: this.snapshot(env),
      });
    }
    const annotation = binary(n, "::");
    if (annotation) {
      const v = single(this.evaluate(annotation[0], env), "annotation"),
        typ = this.typeFromSyntax(annotation[1], env);
      if (typ.packaged)
        throw new LanguageError(
          "value-expression :: requires a concrete or refinement type; put abstract types in binding patterns",
          annotation[1].span,
          { code: "E_ABSTRACT_ASCRIPTION", phase: "match" },
        );
      return this.check(typ, v, env);
    }
    const subtraction = binary(n, "-");
    if (subtraction) {
      const lookup =
        (n.head.kind === "apply"
          ? lexicalScopes.get(n.head.head)
          : undefined) ?? env;
      const minus = {
        kind: "overload" as const,
        name: "-",
        candidates: lookup.visible("-"),
      };
      if (minus.candidates.length) {
        const left = singleton(
          single(this.evaluate(subtraction[0], env), "subtraction"),
        );
        const partial = single(this.invoke(minus, left, env));
        const right = singleton(
          single(this.evaluate(subtraction[1], env), "subtraction"),
        );
        return this.invoke(partial, right, env);
      }
    }
    if (isName(n.head, "-")) {
      const args = this.evaluateFields(n.body, env);
      if (args.length === 1 && positional(args[0].label))
        return this.negateValue(args[0].value);
    }
    if (
      n.head.kind === "symbol" &&
      !n.head.quoted &&
      ["[]", "{}"].includes(n.head.name)
    )
      return singleton({
        kind: "term",
        head: valSymbol(n.head.name),
        body: this.evaluateFields(n.body, env),
      });
    if (n.head.kind === "symbol" && n.head.quoted) {
      if (isSelfEvaluating(n.head.name)) throw this.quotedPrimitive(n.head);
      if (n.head.name === "NumericSource") {
        const args = this.evaluateFields(n.body, env);
        const spelling = unwrap(args[0]?.value);
        if (
          args.length !== 1 ||
          spelling.kind !== "literal" ||
          typeof spelling.value !== "string"
        )
          throw new LanguageError("malformed numeric source literal", n.span);
        const r = parseNumericSpelling(spelling.value);
        if (!r)
          throw new LanguageError("malformed numeric source literal", n.span);
        return this.ascribeRational(valRational(r.n, r.d));
      }
    }
    const lookup = lexicalScopes.get(n.head) ?? env;
    const methods =
      n.head.kind === "symbol" && !n.head.quoted
        ? lookup.visible(n.head.name)
        : [];
    if (methods.some((c) => c.kind === "closure" && c.macro))
      throw new LanguageError(
        "registered macros use sidefix syntax, not function-call syntax",
        n.span,
        { code: "E_MACRO_CALL_SYNTAX", phase: "parse" },
      );
    if (methods.length && n.head.kind === "symbol") {
      const binding = lookup.get(n.head.name);
      const local = binding && "kind" in binding ? unwrap(binding) : undefined;
      if (local?.kind === "overload") methods.push(...local.candidates);
      else if (
        local?.kind === "closure" ||
        local?.kind === "native" ||
        local?.kind === "accessor"
      )
        methods.push(local);
    }
    if (!methods.length && n.head.kind === "symbol" && !n.head.quoted) {
      const binding = lookup.get(n.head.name);
      if (binding && !("kind" in binding) && binding.parameterized) {
        const args = this.evaluateFields(n.body, env);
        let matched = false;
        try {
          valueMatcher().recognize(
            this.compiler(binding.env, false).fields(binding.parameters),
            args,
          );
          matched = true;
        } catch (error) {
          if (!(error instanceof Mismatch)) throw error;
        }
        if (matched) return singleton(this.instantiate(binding, args));
        return singleton({
          kind: "term",
          head: valSymbol(n.head.name),
          body: args,
        });
      }
      if (
        ordinarySymbolCategory(n.head.name) &&
        (/^\p{Lu}/u.test(n.head.name) ||
          [...n.head.name].every((c) => punctuation.has(c)))
      ) {
        const value: Value = {
          kind: "term",
          head: valSymbol(n.head.name),
          body: this.evaluateFields(n.body, env),
        };
        return singleton(value);
      }
    }
    const fn = methods.length
      ? {
          kind: "overload" as const,
          name: (n.head as Extract<Syntax, { kind: "symbol" }>).name,
          candidates: methods,
        }
      : single(this.evaluate(n.head, env), "function head");
    const unique = this.uniqueClosure(fn);
    return this.invoke(
      fn,
      this.evaluateFields(
        n.body,
        env,
        unique
          ? this.expectedFieldsFromPattern(
              unique.parameters[0] ?? [],
              unique.env,
            )
          : [],
      ),
      env,
    );
  }
  private snapshot(env: Scope): Scope {
    const copy = new Scope(env.parent);
    copy.bindings = new Map(env.bindings);
    copy.functions = new Map(env.functions);
    copy.typeDefinitions = new Map(env.typeDefinitions);
    copy.runtimeBindings = new Set(env.runtimeBindings);
    return copy;
  }
  private uniqueClosure(fn: Value): Closure | undefined {
    const value = unwrap(fn);
    if (value.kind === "closure" && !value.macro) return value;
    if (value.kind === "overload") {
      const closures = value.candidates.filter(
        (c): c is Closure => c.kind === "closure" && !c.macro,
      );
      if (value.candidates.length === 1 && closures.length === 1)
        return closures[0];
    }
  }
  private expectedFieldsFromPattern(
    pattern: Field<Syntax>[],
    env: Scope,
  ): { label: string; type?: TypeValue }[] {
    return annotatedPatternTypes(pattern).length
      ? pattern.map((field) => {
          const annotation = binary(field.value, "::");
          return {
            label: field.label,
            type: annotation
              ? this.typeFromSyntax(annotation[1], env)
              : undefined,
          };
        })
      : [];
  }
  private expectedTypeForArgument(
    arg: Field<Syntax>,
    expected: { label: string; type?: TypeValue }[],
    used: Set<number>,
  ): TypeValue | undefined {
    const index = !positional(arg.label)
      ? expected.findIndex((field) => field.label === arg.label)
      : expected.findIndex(
          (field, i) => !used.has(i) && positional(field.label),
        );
    if (index < 0) return;
    used.add(index);
    return expected[index].type;
  }
  private completeExpectedGrammarLine(
    input: Syntax,
    env: Scope,
  ): Syntax | undefined {
    if (input.kind !== "sequence") return;
    const regrouped = regroupAssignmentLine(input.items);
    const assignment = regrouped && operator(regrouped, "=");
    if (!assignment) return;
    const fields = this.expectedFieldsFromPattern(assignment[0], env);
    if (
      fields.length !== 1 ||
      !fields[0].type ||
      !sequenceGrammarParts(fields[0].type)
    )
      return;
    return regrouped;
  }
  private evaluateExpectedGrammar(
    n: Syntax,
    type: TypeValue,
    env: Scope,
  ): Field<Value>[] | undefined {
    const parts = sequenceGrammarParts(type);
    if (!parts) return;
    const data = elaborateSequenceGrammar(n, parts, (tree) =>
      single(this.evaluate(tree, env)),
    );
    return data && this.check(type, data, env);
  }
  private evaluateFields(
    xs: Field<Syntax>[],
    env: Scope,
    expected: { label: string; type?: TypeValue }[] = [],
  ): Field<Value>[] {
    const out: Field<Value>[] = [];
    let index = 0,
      named = false;
    const labels = new Set<string>();
    const used = new Set<number>();
    for (const e of xs) {
      if (
        e.label === "**" ||
        (e.value.kind === "symbol" && !e.value.quoted && e.value.name === "…")
      )
        throw new LanguageError(
          "rest/ignore markers belong in patterns; labeled capture/spread is not implemented",
          e.span ?? e.value.span,
          { code: "E_PATTERN_MARKER" },
        );
      const rest = spread(e.value);
      let values: Field<Value>[];
      if (rest) {
        const v = unwrap(single(this.evaluate(rest, env), "spread"));
        if (v.kind !== "term" && v.kind !== "pack")
          throw new LanguageError("spread requires an argument body");
        values = v.body;
      } else {
        const type = this.expectedTypeForArgument(e, expected, used);
        values =
          (type && this.evaluateExpectedGrammar(e.value, type, env)) ??
          this.evaluate(e.value, env);
        this.evaluationObserver?.(e.value, values);
        if (!positional(e.label)) {
          if (values.length !== 1)
            throw new LanguageError(
              "named argument requires exactly one result",
            );
          values = [{ label: e.label, value: values[0].value }];
        }
      }
      for (const item of values) {
        const pos = positional(item.label);
        if (pos && named)
          throw new LanguageError(
            "positional arguments must precede named arguments",
          );
        named ||= !pos;
        const label = pos ? "_" + ++index : item.label;
        if (labels.has(label))
          throw new LanguageError("duplicate label: " + label);
        labels.add(label);
        out.push({
          label,
          value: item.value,
          span: item.span ?? e.value.span ?? e.span,
        });
      }
    }
    return canonicalFields(out);
  }
  /** A maximal consecutive group of ordinary defs shares only its declared names.
   * Other lexical bindings retain source-order snapshot semantics. */
  private callableSignature(signature: Syntax): Syntax {
    return signature.kind === "postfix"
      ? apply(
          symbol(postfixMethodName(signature.operator)),
          packOf(signature.operand),
        )
      : signature;
  }
  private defineGroup(
    forms: Extract<Syntax, { kind: "form" }>[],
    env: Scope,
  ): Field<Value>[] {
    const declarations: TypeDeclaration[] = [],
      functions: Closure[] = [];
    const groupBindings = new Map<string, Binding>();
    const methodNames = new Set<string>();
    const previous = this.deferringDeclarations;
    this.deferringDeclarations = true;
    let result: Field<Value>[] = [];
    try {
      for (const form of forms) {
        const signature = this.capture(form, "signature");
        let head = this.callableSignature(signature);
        while (head.kind === "apply") head = head.head;
        if (head.kind !== "symbol" || head.quoted) {
          result = this.define(signature, this.capture(form, "body"), env);
          continue;
        }
        const before = new Set(
          (env.functions.get(head.name) ?? []).map((f) => f.id),
        );
        result = this.define(signature, this.capture(form, "body"), env);
        const binding = env.bindings.get(head.name);
        if (binding) {
          groupBindings.set(head.name, binding);
          if (!("kind" in binding)) declarations.push(binding);
        }
        const added = (env.functions.get(head.name) ?? []).filter(
          (f) => !before.has(f.id),
        );
        for (const fn of added) if (fn.kind === "closure") functions.push(fn);
        if (added.length) methodNames.add(head.name);
      }
      for (const declaration of [...declarations, ...functions]) {
        for (const [name, value] of groupBindings)
          declaration.env.bindings.set(name, value);
        for (const name of methodNames)
          declaration.env.functions.set(name, env.functions.get(name)!);
      }
      let tail = this.callableSignature(
        this.capture(forms.at(-1)!, "signature"),
      );
      while (tail.kind === "apply") tail = tail.head;
      for (const declaration of declarations)
        if (!declaration.parameterized) {
          const type = this.instantiate(declaration, []);
          if (tail.kind === "symbol" && declaration.name === tail.name)
            result = singleton(type);
        }
      for (const fn of functions) {
        let name = this.callableSignature(fn.signature!);
        while (name.kind === "apply") name = name.head;
        if (name.kind === "symbol")
          this.validateOverloads(
            name.name,
            fn,
            env.visible(name.name).filter((other) => other.id !== fn.id),
          );
      }
      const group = new Set(declarations);
      for (const declaration of [...declarations, ...functions])
        for (const [identity, definition] of env.typeDefinitions)
          if (definition.declaration && group.has(definition.declaration))
            declaration.env.typeDefinitions.set(identity, definition);
      return result;
    } finally {
      this.deferringDeclarations = previous;
    }
  }
  private define(
    signature: Syntax,
    body: Syntax,
    env: Scope,
    isMacro = false,
  ): Field<Value>[] {
    if (isMacro && signature.kind !== "sequence")
      throw new LanguageError(
        "macro registration requires a sidefix signature; functions use micro syntax",
        signature.span,
        { code: "E_MACRO_SIGNATURE", phase: "declaration" },
      );
    if (isMacro) {
      requirePatternAvailable(signature, env, captureNames);
      requireAvailable(body, env, captureNames, captureNames(signature));
    }
    if (signature.kind === "sequence") {
      const first = signature.items[0];
      if (first?.kind !== "symbol" || !first.quoted || !isMacro)
        throw new LanguageError(
          "sidefix signatures require explicit macro registration",
          signature.span,
          { code: "E_MACRO_REGISTRATION", phase: "declaration" },
        );
      const local = this.snapshot(env);
      const fn: Closure = {
        kind: "closure",
        id: nextId++,
        signature,
        macro: true,
        sidefix: true,
        grammar: syntaxGrammars.get(signature) ?? this.grammar.clone(),
        parameters: [],
        body,
        env: local,
      };
      this.registerMethod(first.name, fn, env);
      local.functions.set(first.name, env.functions.get(first.name)!);
      return [];
    }
    const packs: Field<Syntax>[][] = [];
    let head: Syntax = this.callableSignature(signature);
    while (head.kind === "apply") {
      packs.unshift(head.body);
      head = head.head;
    }
    if (head.kind !== "symbol" || head.quoted)
      throw new LanguageError("definition requires a name");
    let parameterNames: Set<string>;
    try {
      parameterNames = validatePatternCaptures(
        packs.map((body) => ({ kind: "pack", body })),
      );
    } catch (error) {
      if (error instanceof LanguageError) {
        error.diagnostic.phase = "declaration";
        error.at(signature.span);
      }
      throw error;
    }
    if (/^\p{Lu}/u.test(head.name)) {
      if (primitiveNames.has(head.name) && !bootstrapTypeNames.has(head.name))
        throw new LanguageError(
          "primitive type names are reserved: " + head.name,
          head.span,
          { code: "E_RESERVED_PRIMITIVE", phase: "declaration" },
        );
      if (packs.length > 1)
        throw new LanguageError(
          "a type factory takes one argument pack; return another factory explicitly",
          signature.span,
        );
      const references = new Set(parameterNames);
      for (let s: Scope | undefined = env; s; s = s.parent)
        for (const name of s.bindings.keys()) references.add(name);
      let declaredCaptures = new Set<string>();
      if (body.kind === "form" && body.name === "TypeExpression") {
        const pattern = body.captures.get("pattern")?.fields[0]?.value;
        if (pattern)
          declaredCaptures = validatePatternCaptures(
            [pattern],
            true,
            references,
          );
      }
      const local = this.snapshot(env),
        decl: TypeDeclaration = {
          id: nextId++,
          name: head.name,
          parameters: packs[0] ?? [],
          parameterized: packs.length > 0,
          body,
          env: local,
          captures: declaredCaptures,
          scope: env,
        };
      local.bindings.set(head.name, decl);
      this.bind(env, head.name, decl);
      for (const name of packs.length ? decl.captures : []) {
        if (env.visible(name).some((c) => c.kind === "closure" && c.macro))
          throw new LanguageError(
            "accessor conflicts with macro " + name,
            signature.span,
            { code: "E_MACRO_FUNCTION_CONFLICT", phase: "declaration" },
          );
        const accessor: Accessor = {
          kind: "accessor",
          id: nextId++,
          name,
          declaration: decl,
        };
        env.functions.set(name, [...(env.functions.get(name) ?? []), accessor]);
        local.functions.set(name, [
          ...(local.functions.get(name) ?? []),
          accessor,
        ]);
      }
      if (packs.length || this.deferringDeclarations) return [];
      const value = this.instantiate(decl, []);
      return singleton(value);
    }
    if (!packs.length) {
      const value = single(this.evaluate(body, env), "definition");
      this.bind(env, head.name, value);
      return singleton(value);
    }
    const local = this.snapshot(env),
      fn: Closure = {
        kind: "closure",
        signature,
        grammar: syntaxGrammars.get(signature) ?? this.grammar.clone(),
        id: nextId++,
        parameters: packs,
        body,
        env: local,
      };
    this.registerMethod(head.name, fn, env);
    local.functions.set(head.name, env.functions.get(head.name)!);
    return singleton(fn);
  }
  private registerMethod(name: string, fn: Closure, env: Scope) {
    const existing = env.visible(name);
    if (!this.deferringDeclarations) this.validateOverloads(name, fn, existing);
    const binding = env.get(name);
    if (
      fn.macro &&
      binding &&
      "kind" in binding &&
      ["closure", "native", "overload", "accessor"].includes(
        unwrap(binding).kind,
      )
    )
      throw new LanguageError(
        "a macro cannot share a callable variable name: " + name,
        fn.signature?.span,
        { code: "E_MACRO_FUNCTION_CONFLICT", phase: "declaration" },
      );
    if (
      existing.some((c) => !!(c.kind === "closure" && c.macro) !== !!fn.macro)
    )
      throw new LanguageError(
        "cannot mix macros and ordinary functions named " + name,
        fn.signature?.span,
        { code: "E_MACRO_FUNCTION_CONFLICT", phase: "declaration" },
      );
    env.functions.set(name, [...(env.functions.get(name) ?? []), fn]);
  }
  private validateOverloads(
    name: string,
    fn: Closure,
    existing: Candidate[],
  ): void {
    if (!fn.macro && existing.some((c) => c.kind === "closure" && !c.macro)) {
      const domain = this.methodDomain(fn);
      for (const prior of existing) {
        if (prior.kind !== "closure" || prior.macro) continue;
        const other = this.methodDomain(prior);
        if ((domain.refined || other.refined) && domain.key === other.key)
          throw new LanguageError(
            "overloads cannot differ only by refinements: " + name,
            fn.signature?.span,
            {
              code: "E_REFINED_OVERLOAD",
              phase: "declaration",
              notes: [
                "Refinements validate the selected function; they cannot select an overload.",
              ],
              related: [
                {
                  message: "Conflicting overload",
                  span: prior.signature?.span,
                },
              ],
            },
          );
      }
    }
  }
  private methodDomain(fn: Closure) {
    return dispatchSignature(
      fn.parameters.map((pack) => this.compiler(fn.env, false).fields(pack)),
    );
  }
  private expandMacro(
    fn: Closure,
    local: Scope,
    call: Syntax,
    caller: Scope,
  ): Field<Value>[] {
    if (++this.expansionDepth > 100) {
      this.expansionDepth--;
      throw new LanguageError(
        "macro expansion depth limit exceeded",
        call.span,
        { code: "E_MACRO_LIMIT", phase: "expand" },
      );
    }
    try {
      const callerGrammar = this.grammar;
      let result: Value;
      this.grammar = (fn.grammar ?? callerGrammar).clone();
      this.compileTimeDepth++;
      try {
        result = unwrap(single(this.evaluate(fn.body, local), "macro result"));
      } finally {
        this.compileTimeDepth--;
        this.grammar = callerGrammar;
      }
      if (
        result.kind !== "code" ||
        !this.codeType ||
        typeIdentity(result.type.baseType ?? result.type) !==
          typeIdentity(this.codeType)
      )
        throw new LanguageError(
          "macro must return a value interpreted as Code",
          fn.body.span,
          { code: "E_MACRO_RESULT", phase: "expand" },
        );
      const expanded = (fn.grammar ?? this.grammar)
        .clone()
        .resolve(result.tree);
      this.expandedForms.set(call, expanded);
      return this.evaluate(expanded, caller);
    } catch (error) {
      if (error instanceof LanguageError) {
        error.diagnostic.related.push(
          { message: "while expanding this macro call", span: call.span },
          { message: "macro defined here", span: fn.signature?.span },
        );
      }
      throw error;
    } finally {
      this.expansionDepth--;
    }
  }
  private executeClosure(fn: Closure, m: Match<Value>): Field<Value>[] {
    const local = new Scope(fn.env);
    for (const [name, xs] of m.captures) {
      local.bindings.set(name, captureValue(xs, name));
      if (!this.compileTimeDepth) local.runtimeBindings.add(name);
    }
    if (fn.parameters.length > 1)
      return singleton({
        ...fn,
        id: nextId++,
        parameters: fn.parameters.slice(1),
        env: local,
      });
    const outerGrammar = this.grammar;
    this.grammar = (fn.grammar ?? this.grammar).clone();
    try {
      return this.evaluate(fn.body, local);
    } finally {
      this.grammar = outerGrammar;
    }
  }
  private invoke(fn: Value, args: Field<Value>[], env?: Scope): Field<Value>[] {
    this.tick();
    const head = slotValue(fn);
    if (head.kind === "term")
      return singleton({ kind: "term", head, body: args });
    fn = unwrap(fn);
    const candidates =
      fn.kind === "overload"
        ? fn.candidates
        : ["closure", "native", "accessor"].includes(fn.kind)
          ? [fn as Candidate]
          : [];
    const applicable: {
      candidate: Candidate;
      fields?: Field<Value>[];
    }[] = [];
    const rejected: { candidate: Candidate; error: Mismatch }[] = [];
    const describe = (candidate: Candidate) =>
      candidate.kind === "closure"
        ? candidate.signature
          ? normal(candidate.signature)
          : "anonymous function " +
            normal({ kind: "pack", body: candidate.parameters[0] })
        : candidate.kind === "accessor"
          ? candidate.name +
            "(" +
            (candidate.declaration?.name ?? candidate.type?.name) +
            ")"
          : candidate.name;
    const definition = (candidate: Candidate) =>
      candidate.kind === "closure"
        ? (candidate.signature?.span ?? candidate.body.span)
        : candidate.kind === "accessor"
          ? candidate.declaration?.body.span
          : undefined;
    const positionalArgs = args.filter((e) => positional(e.label));
    for (const candidate of candidates) {
      if (candidate.kind === "native") {
        if (candidate.test(positionalArgs)) applicable.push({ candidate });
        else
          rejected.push({
            candidate,
            error: new Mismatch(
              "expected " +
                candidate.arities[0] +
                " positional arguments, received " +
                positionalArgs.length,
            ),
          });
      } else if (candidate.kind === "closure") {
        try {
          const pattern = this.compiler(candidate.env, false).fields(
            candidate.parameters[0],
          );
          valueMatcher().recognize(pattern, args);
          applicable.push({ candidate });
        } catch (e) {
          if (!(e instanceof Mismatch)) throw e;
          rejected.push({ candidate, error: e });
        }
      } else if (positionalArgs.length === 1) {
        const input = positionalArgs[0].value;
        const value = slotValue(input);
        const code = unwrap(value);
        if (value.kind !== "view" && code.kind !== "code") continue;
        const cachedViews = value.kind === "view" ? value.views : new Map();
        const space = concreteSpace(value);
        let view = candidate.type
          ? cachedViews.get(candidate.type.key)
          : [...cachedViews.values()].find(
              (v) => v.type.declaration === candidate.declaration,
            );
        if (view && !view.captures.has(candidate.name)) view = undefined;
        if (!view && space) {
          try {
            const target =
              candidate.type ??
              this.instantiate(candidate.declaration!, space.arguments ?? []);
            if (
              target.facet ||
              typeIdentity(target.baseType ?? target) === typeIdentity(space)
            ) {
              if (target.baseType) this.check(target, value);
              const pattern =
                candidate.pattern ??
                this.definitionProducts.get(target)?.capturePattern;
              if (pattern)
                view = {
                  type: target,
                  captures: valueMatcher().match(
                    pattern,
                    singleton(unwrap(value)),
                  ).captures,
                };
            }
          } catch (error) {
            if (!(error instanceof Mismatch)) throw error;
          }
        }
        if (view?.captures.has(candidate.name))
          applicable.push({
            candidate,
            fields: singleton(
              captureValue(view.captures.get(candidate.name)!, candidate.name),
            ),
          });
      }
    }
    if (!applicable.length) {
      const reasons = rejected.slice(0, 8);
      if (!candidates.length)
        throw new LanguageError(
          "value " + display(fn) + " is not callable",
          undefined,
          { code: "E_NOT_CALLABLE" },
        );
      throw new Mismatch(
        "no applicable function" +
          (fn.kind === "overload" ? " " + fn.name : "") +
          (reasons.length === 1
            ? ": " + reasons[0].error.diagnostic.message
            : " for " + args.length + " arguments"),
        reasons.length === 1 ? reasons[0].error.diagnostic.primary : undefined,
        {
          code:
            reasons.length === 1 &&
            reasons[0].error.diagnostic.code === "E_MISSING_FIELD"
              ? "E_MISSING_FIELD"
              : "E_NO_METHOD",
          causes: reasons.map((r) => r.error.diagnostic),
          notes: reasons.map(
            (r) => describe(r.candidate) + ": " + r.error.diagnostic.message,
          ),
          related: reasons.flatMap((r) => [
            {
              message: "Candidate " + describe(r.candidate),
              span: definition(r.candidate),
            },
            ...r.error.diagnostic.related,
          ]),
        },
      );
    }
    if (applicable.length !== 1)
      throw new LanguageError(
        "ambiguous call: " +
          applicable.length +
          " applicable functions" +
          (fn.kind === "overload" ? " named " + fn.name : ""),
        undefined,
        {
          code: "E_AMBIGUOUS_CALL",
          phase: "match",
          related: applicable.slice(0, 8).map((a) => ({
            message: "Matching candidate " + describe(a.candidate),
            span: definition(a.candidate),
          })),
        },
      );
    const { candidate, fields } = applicable[0];
    if (candidate.kind === "accessor") return fields!;
    if (candidate.kind === "closure")
      return this.executeClosure(
        candidate,
        this.matchParameters(candidate.parameters[0], args, candidate.env),
      );
    if (candidate.arities.length > 1) {
      const prior = candidate;
      const next: Native = {
        ...candidate,
        id: nextId++,
        arities: candidate.arities.slice(1),
        test: (xs) =>
          xs.length === candidate.arities[1] &&
          xs.every((e, i) => e.label === "_" + (i + 1)),
        invoke: (xs, callEnv) =>
          prior.invoke(positionalArgs.concat(xs), env ?? callEnv),
      };
      return singleton(next);
    }
    return candidate.invoke(positionalArgs, env);
  }
  private matchParameters(
    patterns: Field<Syntax>[],
    values: Field<Value>[],
    env: Scope,
    allowProjection = false,
  ): Match<Value> {
    // Projection is a property of this compiled pattern, not interpreter-wide
    // match state. Dispatch, defaults and bindings keep the default false.
    const pattern = this.compiler(env, false, 0, allowProjection).fields(
      patterns,
    );
    return this.interpretMatch(pattern, values);
  }
  private interpretMatch(
    pattern: Pattern<Value>,
    values: Field<Value>[],
  ): Match<Value> {
    this.interpretingDepth++;
    try {
      return valueMatcher().match(pattern, values);
    } finally {
      this.interpretingDepth--;
    }
  }
  private compiler(
    env: Scope,
    typeMode: boolean,
    dimensions = 0,
    allowProjection = false,
  ): PatternCompiler<Value> {
    const phase = typeMode ? "declaration" : "match";
    const lookup = (n: Syntax) =>
      lexicalScopes.get(n) ??
      (n.kind === "apply"
        ? lexicalScopes.get(n.head)
        : n.kind === "postfix"
          ? lexicalScopes.get(n.operand)
          : undefined) ??
      env;
    const peelListLayers = (n: Syntax, dimensions: number): Syntax => {
      for (let i = 0; i < dimensions; i++) {
        const layer = listLayer(n);
        if (!layer)
          throw new LanguageError(
            "capture annotation needs one list layer per spread dimension",
            n.span,
            { code: "E_SPREAD_DIMENSION", phase: "declaration" },
          );
        n = layer.operand;
      }
      return n;
    };
    const listType = (n: Syntax): TypeValue => {
      let layers = 0,
        element = n;
      while (listLayer(element)) {
        layers++;
        element = listLayer(element)!.operand;
      }
      let type = this.typeFromSyntax(element, env);
      for (let i = 0; i < layers; i++) type = this.modifiedType("*", type);
      return type;
    };
    const reference = (n: Syntax, dimensions = 0): Pattern<Value> => {
      if (typeMode) this.inlineTypeDepth++;
      try {
        const peeled = peelListLayers(n, dimensions);
        return this.typePattern(
          listLayer(peeled)
            ? listType(peeled)
            : this.typeFromSyntax(peeled, env),
          !typeMode,
          allowProjection,
        );
      } finally {
        if (typeMode) this.inlineTypeDepth--;
      }
    };
    return new PatternCompiler<Value>(
      {
        bareCaptures: true,
        captureWrapper: (annotation) => {
          const type = listType(annotation);
          return (value) => single(this.check(type, value));
        },
        validateTypedCapture: (name, annotation) => {
          if (
            isTypeCapture(name) &&
            typeIdentity(this.typeFromSyntax(annotation, env)) !==
              typeIdentity(this.primitives.get("Type")!)
          )
            throw new LanguageError(
              "TitleCase capture " + name + " must be annotated with Type",
              annotation.span,
              { code: "E_CAPTURE_TYPE", phase: "declaration" },
            );
        },
        expression: (n, depth = 0) => {
          if (
            n.kind === "sequence" &&
            n.items[0]?.kind === "symbol" &&
            n.items[0].quoted
          )
            return {
              kind: "node",
              head: literalPattern(valSymbol("syntaxSequence")),
              body: positionalPattern(
                n.items.map((x) =>
                  this.compiler(env, typeMode, depth, allowProjection).compile(
                    x,
                  ),
                ),
              ),
            };
          if (
            typeMode &&
            n.kind === "symbol" &&
            !n.quoted &&
            lookup(n).get(n.name)
          ) {
            const value = single(this.evaluate(n, env), "type pattern");
            const type = this.materializeType(value);
            return type ? this.typePattern(type) : literalPattern(value);
          }
          if (
            n.kind === "postfix" &&
            isTypeSpecification(n.operand) &&
            (this.isTypeCall(n, lookup(n)) ||
              n.operator === "*" ||
              n.operator === "^")
          )
            return reference(n);
          if (n.kind === "apply") {
            const binding =
              n.head.kind === "symbol" && !n.head.quoted
                ? lookup(n.head).get(n.head.name)
                : undefined;
            if (binding && !("kind" in binding) && binding.parameterized) {
              if (
                [...validatePatternCaptures(n.body.map((f) => f.value))].some(
                  (name) => !lookup(n).get(name),
                )
              )
                return undefined;
              let value: Value;
              value = single(this.evaluate(n, env), "type factory");
              const type = this.materializeType(value);
              return type
                ? this.typePattern(type, !typeMode, allowProjection)
                : undefined;
            }
            // Reserved names are never quoted, so a reserved head in a type
            // pattern names the constructor rather than calling the primitive.
            if (
              typeMode &&
              n.head.kind === "symbol" &&
              !n.head.quoted &&
              isSelfEvaluating(n.head.name)
            )
              return undefined;
            if (
              typeMode &&
              this.isTypeCall(n, lookup(n)) &&
              (n.head.kind !== "symbol" ||
                isCapture(n.head.name) ||
                lookup(n.head).visible(n.head.name).length > 0)
            )
              return reference(n);
          }
          return undefined;
        },
        allowIgnoredCaptures: !typeMode,
        requireCaptureTypes: typeMode,
        allowDefaults: !typeMode,
        defaultValue: (n) => single(this.evaluate(n, env), "default value"),
        defaultIdentity: (n) => this.expressionIdentity(n, env),
        head: (n, depth = 0) => {
          if (n.kind === "symbol") {
            if (n.quoted && isSelfEvaluating(n.name))
              throw this.quotedPrimitive(n, phase);
            return literalPattern(valSymbol(n.name));
          }
          // Application heads are structural patterns, not unary type-factory
          // calls: the head of (a :* b) is the partial tree *(a).
          if (
            (n.kind === "apply" && !binary(n, "::") && !binary(n, "|")) ||
            (n.kind === "postfix" &&
              !(
                typeMode &&
                (this.isTypeCall(n, lookup(n)) ||
                  n.operator === "*" ||
                  n.operator === "^")
              ))
          ) {
            if (n.kind === "postfix")
              return {
                kind: "postfix",
                operator: this.compiler(
                  env,
                  typeMode,
                  depth,
                  allowProjection,
                ).domain.head(symbol(n.operator), depth),
                operand: this.compiler(
                  env,
                  typeMode,
                  depth,
                  allowProjection,
                ).compile(n.operand),
              };
            const compiler = this.compiler(
              env,
              typeMode,
              depth,
              allowProjection,
            );
            return {
              kind: "node",
              head: compiler.domain.head(n.head, depth),
              body: compiler.fields(n.body, false),
            };
          }
          return this.compiler(env, typeMode, depth, allowProjection).compile(
            n,
          );
        },
        annotation: reference,
        repeatedElement: (n, dimensions = 0) => reference(n, dimensions + 1),
        expand: (n) => {
          if (
            typeMode &&
            n.kind === "symbol" &&
            !n.quoted &&
            lookup(n).get(n.name)
          ) {
            const v = lookup(n).get(n.name);
            if (
              !v ||
              !("kind" in v) ||
              !["pack", "term"].includes(unwrap(v).kind)
            )
              throw new LanguageError(
                "type spread requires a type argument pack",
              );
            const pack = unwrap(v);
            if (pack.kind !== "pack" && pack.kind !== "term")
              throw new LanguageError("expected argument pack");
            return pack.body.map((e) => {
              const type = this.materializeType(e.value);
              if (!type) throw new LanguageError("expected type argument");
              return this.typePattern(type, !typeMode, allowProjection);
            });
          }
          return undefined;
        },
        atom: (n) => {
          if (n.kind === "symbol") {
            if (n.quoted && isSelfEvaluating(n.name))
              throw this.quotedPrimitive(n, phase);
            const binding = lookup(n).get(n.name);
            if (!n.quoted && primitiveNames.has(n.name)) return reference(n);
            if (!n.quoted && constantNames.has(n.name))
              return literalPattern(valSymbol(n.name));
            if (
              !n.quoted &&
              binding &&
              (!("kind" in binding) || !!this.materializeType(binding))
            )
              return reference(n);
            if (!binding && !n.quoted && /^\p{Lu}/u.test(n.name))
              throw new LanguageError("unbound type name: " + n.name, n.span, {
                code: "E_UNBOUND_TYPE",
                phase: "declaration",
                notes: [
                  "Quote literal tags with a colon. The numeric prelude names are Int, Float, and Float32.",
                ],
              });
            return literalPattern(valSymbol(n.name));
          }
          if (n.kind === "literal") return literalPattern(valLiteral(n.value));
          if (
            n.kind === "sequence" ||
            (n.kind === "form" && n.name === "TypeExpression")
          )
            return reference(n);
          throw new LanguageError("invalid pattern: " + normal(n), n.span);
        },
      },
      dimensions,
    );
  }
  private compilePattern(
    n: Syntax,
    env: Scope,
    typeMode: boolean,
  ): Pattern<Value> {
    return this.compiler(env, typeMode).compile(n);
  }
  /** An unevaluated constraint includes the identity of its lexical dependencies. */
  private expressionIdentity(n: Syntax, env: Scope): string {
    const dependencies: unknown[] = [];
    const walk = (x: Syntax) => {
      if (x.kind === "quote") return;
      if (
        x.kind === "symbol" &&
        !x.quoted &&
        (isCapture(x.name) || isTypeCapture(x.name))
      ) {
        const scope = lexicalScopes.get(x) ?? env;
        const value = scope.get(x.name);
        if (value && "kind" in value) {
          const v = unwrap(value);
          dependencies.push([
            x.name,
            "id" in v ? v.id : display(v),
            concreteSpace(value) ? typeIdentity(concreteSpace(value)!) : null,
          ]);
        }
        for (const fn of scope.visible(x.name))
          dependencies.push([x.name, fn.kind === "native" ? fn.name : fn.id]);
      } else if (x.kind === "apply") {
        walk(x.head);
        x.body.forEach((f) => walk(f.value));
      } else if (x.kind === "postfix") walk(x.operand);
      else if (x.kind === "pack") x.body.forEach((f) => walk(f.value));
      else if (x.kind === "sequence") x.items.forEach(walk);
      else if (x.kind === "block") x.lines.forEach(walk);
    };
    walk(n);
    return JSON.stringify([normal(n), dependencies]);
  }
  private anonymousType(pattern: Syntax, env: Scope): TypeValue {
    if (
      (pattern.kind === "form" && pattern.name === "TypeExpression") ||
      (pattern.kind === "symbol" && !pattern.quoted && env.get(pattern.name))
    )
      return this.typeFromSyntax(pattern, env);
    const captured = this.snapshot(env),
      key = "anonymous:" + nextId++;
    const compiled = this.compilePattern(pattern, captured, true);
    if (this.inlineTypeDepth && patternCaptures(compiled).size)
      throw new LanguageError(
        "an inline nested type cannot declare captures; define a named type separately",
        pattern.span,
        { code: "E_NESTED_TYPE_DECLARATION", phase: "declaration" },
      );
    if (!this.buildingTypes && explicitPatternCaptures(compiled).size)
      throw new LanguageError(
        "ordinary type construction cannot declare captures/accessors",
        pattern.span,
        { code: "E_PLAIN_TYPE_CAPTURE", phase: "declaration" },
      );
    return this.patternType(compiled, env, "type " + normal(pattern), key);
  }
  private patternType(
    compiled: Pattern<Value>,
    env: Scope,
    name: string,
    key = "anonymous:" + nextId++,
    forceFacet = false,
  ): TypeValue {
    const type: TypeValue = {
      kind: "type",
      name,
      key,
      pattern: () => compiled,
      facet: forceFacet || isOpenPattern(compiled),
      packaged: forceFacet || isOpenPattern(compiled),
      transparent: forceFacet || isOpenPattern(compiled),
    };
    const accessors: Accessor[] = this.buildingTypes
      ? [...patternCaptures(compiled)].map((name) => ({
          kind: "accessor",
          id: nextId++,
          name,
          type,
          pattern: compiled,
        }))
      : [];
    // Validate completed ordinary type construction immediately. Recursive named
    // groups are validated after all references in the group have been completed.
    // Named declaration bodies record accessor products here; registerTypeDefinition
    // installs them. Plain construction never installs accessors.
    if (!this.buildingTypes) typeIdentity(type);
    this.definitionEvaluation(env).set(type, {
      type,
      capturePattern: compiled,
      accessors,
    });
    return type;
  }
  private definitionEvaluation(env: Scope): WeakMap<TypeValue, TypeDefinition> {
    let products = this.evaluatedDefinitions.get(env);
    if (!products)
      this.evaluatedDefinitions.set(env, (products = new WeakMap()));
    return products;
  }
  private installAccessors(definition: TypeDefinition, env: Scope) {
    this.recordScopeChange(env);
    for (const produced of definition.accessors) {
      const accessor: Accessor = produced.declaration?.parameterized
        ? {
            kind: "accessor",
            id: produced.id,
            name: produced.name,
            declaration: produced.declaration,
          }
        : produced;
      if (
        env
          .visible(accessor.name)
          .some(
            (candidate) =>
              candidate.id === accessor.id ||
              (candidate.kind === "accessor" &&
                candidate.declaration &&
                candidate.declaration === accessor.declaration),
          )
      )
        continue;
      if (
        env.visible(accessor.name).some((c) => c.kind === "closure" && c.macro)
      )
        throw new LanguageError(
          "accessor conflicts with macro " + accessor.name,
          undefined,
          { code: "E_MACRO_FUNCTION_CONFLICT", phase: "declaration" },
        );
      env.functions.set(accessor.name, [
        ...(env.functions.get(accessor.name) ?? []),
        accessor,
      ]);
    }
  }
  private visibleTypeDefinition(
    type: TypeValue,
    env?: Scope,
  ): TypeDefinition | undefined {
    if (!env) return undefined;
    const identity = typeIdentity(type);
    for (let scope: Scope | undefined = env; scope; scope = scope.parent) {
      const definition = scope.typeDefinitions.get(identity);
      if (definition) return definition;
    }
    // A lexical snapshot retains a declaration even when a generic specialization
    // is first produced later. Passing a Type value alone does not import it.
    if (
      type.declaration &&
      env.get(type.declaration.name) === type.declaration
    ) {
      const definition = this.definitionProducts.get(type);
      if (definition?.declaration) return definition;
    }
    return undefined;
  }
  private registerTypeDefinition(type: TypeValue, decl: TypeDeclaration): void {
    const prior = this.visibleTypeDefinition(type, decl.scope);
    if (prior && prior.declaration !== decl)
      throw new LanguageError(
        "type " +
          decl.name +
          " has the same structural identity as visible type " +
          prior.name,
        decl.body.span,
        {
          code: "E_DUPLICATE_TYPE",
          phase: "declaration",
          notes: [
            "Use the existing type name. A type reference or generic parameter does not create another declaration.",
          ],
          related: prior.declaration
            ? [
                {
                  message: "Existing type declared here",
                  span: prior.declaration.body.span,
                },
              ]
            : [],
        },
      );
    const produced = this.definitionProducts.get(type);
    const definition: TypeDefinition = {
      type,
      name: type.name,
      declaration: decl,
      capturePattern: produced?.capturePattern ?? type.pattern(),
      accessors: (produced?.accessors ?? []).map((a) => ({
        ...a,
        type,
        declaration: decl,
      })),
    };
    this.definitionProducts.set(type, definition);
    const identity = typeIdentity(type);
    this.recordScopeChange(decl.scope);
    this.recordScopeChange(decl.env);
    decl.scope.typeDefinitions.set(identity, definition);
    decl.env.typeDefinitions.set(identity, definition);
    this.installAccessors(definition, decl.scope);
    this.installAccessors(definition, decl.env);
  }
  /** Compile an ordinary type-value tree on demand, without changing its value. */
  private materializeType(value: Value): TypeValue | undefined {
    value = unwrap(value);
    if (value.kind === "type") return value;
    if (value.kind === "symbol" && primitiveNames.has(value.name))
      return this.primitives.get(primitiveNames.get(value.name)!)!;
    if (
      value.kind !== "term" ||
      value.head.kind !== "symbol" ||
      !["Type", "UnionType", "Facet", "TreeGrammar"].includes(value.head.name)
    )
      return undefined;
    try {
      const compiled = this.structuralType(value);
      return equal(compiled, value) ? compiled : undefined;
    } catch (error) {
      if (
        !(error instanceof LanguageError) ||
        ![
          "E_TYPE_DESCRIPTION",
          "E_EXPECTED_TYPE",
          "E_TYPE_UNION_SYNTAX",
          "E_TYPE_SERIALIZATION",
          "E_VALUE_REPRESENTATION",
        ].includes(error.diagnostic.code)
      )
        throw error;
      return undefined;
    }
  }
  /** Metadata follows the decoded root, including aliases of recursive unions. */
  private descriptionType(
    pattern: () => Pattern<Value>,
    facet = false,
    wrappedPrimitive = false,
  ): TypeValue {
    const findUnion = (
      p: Pattern<Value>,
      active = new Set<unknown>(),
    ): Extract<Pattern<Value>, { kind: "union" }> | undefined => {
      if (p.kind === "union") return p.preserveSpace ? p : undefined;
      if (p.kind === "map" || p.kind === "capture")
        return findUnion(p.pattern, active);
      if (p.kind !== "ref" || active.has(p.key)) return;
      return findUnion(p.resolve(), new Set(active).add(p.key));
    };
    let members: TypeValue[] | undefined;
    const rootMembers = () => {
      const union = findUnion(pattern());
      if (!union) return;
      return (members ??= union.choices.map((choice) =>
        this.descriptionType(() => choice),
      ));
    };
    return {
      kind: "type",
      key: "description:" + nextId++,
      name: "structural type",
      pattern,
      facet,
      wrappedPrimitive,
      get unionMembers() {
        return rootMembers();
      },
      get packaged() {
        return facet || (rootMembers()?.length ?? 0) > 1;
      },
      get transparent() {
        return facet || !!rootMembers();
      },
    };
  }
  private structuralType(description: Value): TypeValue {
    description = unwrap(description);
    if (description.kind === "type") return description;
    if (description.kind === "symbol" && primitiveNames.has(description.name))
      return this.primitives.get(primitiveNames.get(description.name)!)!;
    const pattern = descriptionPattern(description, {
      validate: validateDescription,
      primitive: (name) => this.primitives.get(name),
      reference: (type) => this.typePattern(type),
      union: (members) => this.unionType(members),
      treeGrammar: (value) => this.treeGrammar(this.structuralType(value)),
      define: (pattern, facet, wrappedPrimitive) =>
        this.descriptionType(pattern, facet, wrappedPrimitive),
      literal: literalPattern,
    });
    if (
      isOpenPattern(pattern) &&
      !(
        description.kind === "term" &&
        description.head.kind === "symbol" &&
        description.head.name === "Facet"
      )
    )
      throw new LanguageError(
        "open patterns describe a Facet, not a concrete Type",
        undefined,
        { code: "E_TYPE_DESCRIPTION", phase: "declaration" },
      );
    const flags = {
      kind: "type",
      key: "structural:" + nextId++,
      name: "structural type",
      wrappedPrimitive:
        description.kind === "term" &&
        description.head.kind === "symbol" &&
        description.head.name === "Type" &&
        description.body.length === 1 &&
        (() => {
          const t = this.materializeType(description.body[0].value);
          return !!t && typeDescription(t).kind === "symbol";
        })(),
      facet:
        description.kind === "term" &&
        description.head.kind === "symbol" &&
        description.head.name === "Facet",
      packaged:
        description.kind === "term" &&
        description.head.kind === "symbol" &&
        description.head.name === "Facet",
      transparent:
        description.kind === "term" &&
        description.head.kind === "symbol" &&
        description.head.name === "Facet",
    };
    const type = this.descriptionType(
      () => pattern,
      flags.facet,
      flags.wrappedPrimitive,
    );
    // Re-encoding validates and normalizes recursion, labels, and aliases.
    const normalized = typeDescription(type);
    if (
      normalized.kind === "term" &&
      normalized.head.kind === "symbol" &&
      normalized.head.name === "TreeGrammar"
    )
      return this.treeGrammar(this.structuralType(normalized.body[0].value));
    if (
      normalized.kind === "term" &&
      normalized.head.kind === "symbol" &&
      normalized.head.name === "UnionType"
    )
      return this.unionType(normalized.body.map((f) => f.value));
    if (normalized.kind === "symbol" && primitiveNames.has(normalized.name))
      return this.primitives.get(primitiveNames.get(normalized.name)!)!;
    if (
      normalized.kind === "term" &&
      normalized.head.kind === "symbol" &&
      normalized.head.name === "Facet" &&
      !type.facet
    )
      return this.structuralType(normalized);
    const key = "structural:" + descriptionKey(normalized);
    const cached = this.types.get(key);
    if (cached) return cached;
    type.key = key;
    type.name = valueText(type, {
      type: (d) => this.structuralType(d),
      check: (t, v) => single(this.check(t, v)),
    });
    this.types.set(key, type);
    return type;
  }
  private unionType(values: Value[]): TypeValue {
    if (!values.length)
      throw new LanguageError(
        "UnionType requires at least one type",
        undefined,
        { code: "E_EXPECTED_TYPE" },
      );
    const members = values.map((value) => {
      value = this.materializeType(value) ?? unwrap(value);
      if (value.kind === "type") return value;
      if (
        value.kind === "term" &&
        value.head.kind === "symbol" &&
        ["Type", "UnionType", "Facet"].includes(value.head.name)
      )
        return this.structuralType(value);
      throw new LanguageError(
        "UnionType members must be type values; use a primitive type name or type Pattern",
        undefined,
        { code: "E_EXPECTED_TYPE" },
      );
    });
    if (this.buildingTypes) {
      // Member identities may traverse unfinished siblings. Retain their finite
      // graph now and validate/sort only after the outer recursive group closes.
      const choices = [...members];
      const type: TypeValue = {
        kind: "type",
        name: "recursive union",
        key: "recursive-union:" + nextId++,
        transparent: true,
        packaged: choices.length > 1,
        unionMembers: choices,
        pattern: () => ({
          kind: "union",
          preserveSpace: true,
          choices: choices.map((t) => this.typePattern(t)),
        }),
      };
      this.deferredUnions.push(type);
      return type;
    }
    const flat = members.flatMap((t) => t.unionMembers ?? [t]);
    const entries = [
      ...new Map(flat.map((t) => [typeIdentity(t), t])).entries(),
    ].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const spaces = new Map<string, TypeValue>();
    const bases = (t: TypeValue): TypeValue[] =>
      t.baseType
        ? bases(t.baseType)
        : t.unionMembers
          ? t.unionMembers.flatMap(bases)
          : [t];
    for (const [, member] of entries) {
      for (const base of bases(member)) {
        const id = typeIdentity(base),
          prior = spaces.get(id);
        if (prior && prior !== member)
          throw new LanguageError(
            "UnionType cannot contain multiple members of the same concrete space: " +
              base.name,
            undefined,
            {
              code: "E_REFINED_UNION",
              phase: "declaration",
              notes: [
                "Use one refinement with a combined predicate; refinement-union normalization is not supported.",
              ],
            },
          );
        spaces.set(id, member);
      }
    }
    const key = "type-union:" + JSON.stringify(entries.map(([id]) => id));
    const cached = this.types.get(key);
    if (cached) return cached;
    const normalized = entries.map(([, t]) => t);
    const type: TypeValue = {
      kind: "type",
      key,
      name: "UnionType(" + normalized.map((t) => t.name).join(", ") + ")",
      transparent: true,
      unionMembers: normalized,
      packaged: normalized.length > 1,
      pattern: () => ({
        kind: "union",
        preserveSpace: true,
        choices: normalized.map((t) => this.typePattern(t)),
      }),
    };
    this.types.set(key, type);
    return type;
  }
  private textDomain(env?: Scope): TextDomain {
    const aliases = new Map<string, TypeValue>();
    const available = (type: TypeValue): boolean =>
      type.declaration
        ? env?.get(type.declaration.name) === type.declaration &&
          (type.arguments ?? []).every((f) => {
            const t = this.materializeType(f.value);
            return !t || available(t);
          })
        : env?.get(type.name) === type;
    if (env) {
      const seen = new Set<string>();
      for (let scope: Scope | undefined = env; scope; scope = scope.parent)
        for (const [name, binding] of scope.bindings) {
          if (seen.has(name)) continue;
          seen.add(name);
          if (
            !isTypeCapture(name) &&
            !("kind" in binding && unwrap(binding).kind === "type")
          )
            continue;
          if ("kind" in binding) {
            const type = this.materializeType(binding);
            if (type) aliases.set(name, type);
          } else
            for (const type of this.types.values())
              if (type.declaration === binding && available(type))
                aliases.set(type.name, type);
        }
    }
    const references = new Map<unknown, string>();
    for (const [name, type] of [...aliases]
      .filter(([name]) => isTypeCapture(name))
      .sort(([a], [b]) => b.length - a.length || (a < b ? 1 : -1)))
      references.set(type.key, name);
    return {
      type: (d) => this.structuralType(d),
      check: (t, v) => single(this.check(t, v)),
      localReferences: env ? references : undefined,
      localName: env
        ? (type) => {
            if (type.declaration && available(type)) return type.name;
            const exact = [...aliases]
              .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : 1))
              .filter(([, t]) => typeIdentity(t) === typeIdentity(type));
            const typeName = exact.find(([name]) => isTypeCapture(name))?.[0];
            if (typeName) return typeName;
            // Ordinary bindings can stand for a nonportable whole type in this
            // same scope. Keep structural output for representable types.
            try {
              typeDescription(type);
            } catch (error) {
              if (
                error instanceof LanguageError &&
                error.diagnostic.code === "E_TYPE_SERIALIZATION"
              )
                return exact[0]?.[0];
              throw error;
            }
            return undefined;
          }
        : undefined,
      localType: env ? (name) => aliases.get(name) : undefined,
    };
  }
  /** A type computation uses ordinary micro calls; constructor patterns remain data.
   * The `type` form explicitly introduces a pattern, including lowercase heads.
   */
  private isTypeCall(n: Syntax, env?: Scope): boolean {
    if (n.kind === "postfix")
      return !!env?.visible(postfixMethodName(n.operator)).length;
    if (n.kind !== "apply") return false;
    let head: Syntax = n.head;
    while (head.kind === "apply") head = head.head;
    return (
      head.kind !== "symbol" ||
      (!head.quoted &&
        (isCapture(head.name) ||
          !!env?.visible(head.name).length ||
          !!(
            env?.get(head.name) &&
            !("kind" in env.get(head.name)!) &&
            (env.get(head.name) as TypeDeclaration).parameterized
          )))
    );
  }
  private refine(
    baseValue: Value,
    predicateValue: Value,
    env?: Scope,
  ): TypeValue {
    const base = this.materializeType(baseValue) ?? unwrap(baseValue),
      predicate = unwrap(predicateValue);
    if (base.kind !== "type")
      throw new LanguageError(
        "where requires a type value as its first argument",
        undefined,
        {
          code: "E_EXPECTED_TYPE",
          notes: [
            "Outside a type expression, use (type Float64) to obtain a type value.",
          ],
        },
      );
    if (!["closure", "native", "accessor", "overload"].includes(predicate.kind))
      throw new LanguageError(
        "where requires a predicate function as its second argument",
        undefined,
        {
          code: "E_EXPECTED_PREDICATE",
          notes: ["Pass a closure such as n -> isInt64(n)."],
        },
      );
    const identity =
      predicate.kind === "overload"
        ? predicate.candidates.map((c) => c.id)
        : (predicate as Candidate).id;
    const description =
      predicate.kind === "closure"
        ? "(" +
          normal(
            apply(
              apply(symbol("->"), predicate.parameters[0]),
              packOf(predicate.body),
            ),
          ) +
          ")"
        : "<predicate>";
    const refined: TypeValue = {
      kind: "type",
      name: base.name + " .where " + description,
      key: "subset:" + nextId++,
      baseType: base.baseType ?? base,
      transparent: base.transparent,
      packaged: base.packaged,
      facet: base.facet,
      numeric: base.numeric,
      pattern: () => ({
        kind: "map",
        localCaptures: true,
        identity: ["predicate", identity],
        pattern: this.typePattern(base),
        validate: (fields) =>
          fields.every((f) => {
            const result = unwrap(
              single(
                this.invoke(predicate, singleton(f.value)),
                "subset predicate",
              ),
            );
            if (
              result.kind !== "symbol" ||
              !["True", "False"].includes(result.name)
            )
              throw new LanguageError(
                "subset predicate must return True or False",
                undefined,
                { code: "E_PREDICATE_RESULT" },
              );
            return result.name === "True";
          }),
        failure: "value does not satisfy subset " + description,
        transform: (fields) => fields,
      }),
    };
    const products =
      env &&
      (this.definitionEvaluation(env).get(base) ??
        this.visibleTypeDefinition(base, env));
    if (products && env) {
      this.definitionEvaluation(env).set(refined, {
        ...products,
        declaration: undefined,
        type: refined,
      });
    }
    return refined;
  }
  /** A single syntax-domain adapter; accepted tree shapes come from ordinary types. */
  private treeGrammar(treeSchema: TypeValue): TypeValue {
    const key = "tree-grammar:" + typeIdentity(treeSchema);
    const cached = this.types.get(key);
    if (cached) return cached;
    const type: TypeValue = {
      kind: "type",
      key,
      name: "TreeGrammar(" + treeSchema.name + ")",
      treeGrammar: treeSchema,
      pattern: () => ({
        kind: "test",
        name: "syntax matching " + treeSchema.name,
        identity: ["treeGrammar", typeData(treeSchema)],
        test: (value) => {
          try {
            valueMatcher().match(
              treeSchema.pattern(),
              singleton(encodeSyntax(dataSyntax(value))),
            );
            return true;
          } catch (error) {
            if (error instanceof Mismatch) return false;
            throw error;
          }
        },
      }),
    };
    this.types.set(key, type);
    return type;
  }
  private typePattern(
    type: TypeValue,
    requireConcrete = false,
    allowProjection = false,
  ): Pattern<Value> {
    return {
      kind: "ref",
      key: type.key,
      name: type.name,
      get facet() {
        return type.facet;
      },
      get wrappedPrimitive() {
        return type.wrappedPrimitive;
      },
      dispatchBase: type.baseType
        ? () => this.typePattern(type.baseType!, requireConcrete)
        : undefined,
      dispatchIdentity: () => typeIdentity(type.baseType ?? type),
      resolve: () => {
        let original: Value | undefined;
        let selected: Pattern<Value> | undefined;
        let projected = false;
        return {
          kind: "map",
          localCaptures: true,
          input: (v) => {
            if (selected) return original!;
            if (projected) return unwrap(original!);
            if (type.transparent) return v;
            const raw = unwrap(v),
              tree = syntaxOrigins.get(raw);
            return tree?.kind === "block"
              ? syntaxData(this.grammarInput(type, tree))
              : raw;
          },
          accept: (v) => {
            const space = concreteSpace(v);
            projected = !!(
              allowProjection &&
              space &&
              this.uniqueMatchUnionMember(space, v, type)
            );
            const candidate = projected && v.kind === "view" ? v.base : v;
            const candidateSpace = concreteSpace(candidate);
            const same =
              candidateSpace &&
              typeIdentity(candidateSpace) === typeIdentity(type);
            const stored = slotValue(candidate);
            original = same && stored.kind === "view" ? stored.base : candidate;
            selected = this.concreteUnionSelection(type, original);
            if (
              this.parsingDataDepth &&
              type.packaged &&
              !type.unionMembers &&
              !concreteSpace(v)
            )
              throw new LanguageError(
                "a serialized abstract value requires an explicit concrete :: type tag",
                undefined,
                { code: "E_MISSING_TYPE_TAG", phase: "parse" },
              );
            const prior =
              (v.kind === "view" && v.provisional && !type.packaged
                ? undefined
                : concreteSpace(v)) ??
              ((requireConcrete || this.interpretingDepth) &&
              type.packaged &&
              this.materializeType(v)
                ? this.primitives.get("Type")
                : undefined);
            if (
              (requireConcrete || this.interpretingDepth) &&
              type.packaged &&
              !type.unionMembers &&
              !prior
            )
              throw new LanguageError(
                "an abstract position requires an explicit concrete interpretation",
                undefined,
                {
                  code: "E_CONCRETE_TYPE_REQUIRED",
                  phase: "match",
                  notes: [
                    "Use value :: ConcreteType before assigning to " +
                      type.name +
                      ". Type inference is not implemented.",
                  ],
                },
              );
            return (
              type.transparent ||
              !!selected ||
              !prior ||
              typeIdentity(prior) === typeIdentity(type.baseType ?? type) ||
              (prior.numeric === "rational" && type.numeric !== "rational") ||
              projected
            );
          },
          get pattern() {
            return selected ?? type.pattern();
          },
          transform: (fields, captures) => {
            // Type is the public descriptor protocol: compiling an exact value
            // tree is a cache operation, not a new interpretation of its data.
            if (type === this.primitives.get("Type"))
              return fields.map((e) => ({
                ...e,
                value: {
                  kind: "view" as const,
                  base: this.materializeType(e.value)!,
                  space: type,
                  views: new Map(),
                },
              }));
            if (type.treeGrammar)
              return fields.map((e) => {
                const tree = dataSyntax(original ?? e.value);
                return {
                  ...e,
                  value: {
                    kind: "code" as const,
                    type,
                    tree,
                    portable: !hasLexicalOrigins(tree),
                  },
                };
              });
            if (type.transparent) {
              if (!type.packaged)
                return fields.map((e) => ({ ...e, value: slotValue(e.value) }));
              return fields.map((e) => {
                let payload = slotValue(
                  type.facet && original ? original : e.value,
                );
                if (
                  !concreteSpace(payload) &&
                  !requireConcrete &&
                  !this.interpretingDepth
                )
                  return e;
                if (!concreteSpace(payload)) {
                  const typeValue = this.materializeType(payload);
                  if (typeValue)
                    payload = {
                      kind: "view",
                      base: typeValue,
                      space: this.primitives.get("Type"),
                      views: new Map(),
                    };
                }
                if (!concreteSpace(payload)) {
                  if (!requireConcrete && !this.interpretingDepth) return e; // shape-only membership/schema recognition
                  throw new LanguageError(
                    "an abstract position requires an explicit concrete interpretation",
                    undefined,
                    { code: "E_CONCRETE_TYPE_REQUIRED", phase: "match" },
                  );
                }
                return {
                  ...e,
                  value: { kind: "slot" as const, type, value: payload },
                };
              });
            }
            return fields.map((e) => {
              const previous =
                e.value.kind === "view" ? e.value.views : new Map();
              const views = new Map(previous);
              views.set(type.key, { type, captures });
              return {
                label: e.label,
                value: {
                  kind: "view",
                  base: this.concreteUnionMember(type, e.value)
                    ? slotValue(e.value)
                    : this.numericPayload(type, e.value),
                  views,
                  space: type.baseType ?? type,
                },
              };
            });
          },
        };
      },
    };
  }
  private quotedPrimitive(
    n: Extract<Syntax, { kind: "symbol" }>,
    phase: "evaluate" | "declaration" | "match" = "evaluate",
  ): LanguageError {
    return new LanguageError(
      "quoted " + n.name + " is not a symbol; " + n.name + " is a primitive",
      n.span,
      { code: "E_QUOTED_PRIMITIVE", phase },
    );
  }
  private reserved(name: string): Field<Value>[] {
    const fields = this.check(
      this.primitives.get("ReservedSymbol")!,
      valSymbol(name),
    );
    return fields.map((field) => {
      const value = field.value;
      return {
        ...field,
        value: value.kind === "view" ? { ...value, provisional: true } : value,
      };
    });
  }
  private symbolValue(name: string): Value {
    const category = ordinarySymbolCategory(name);
    if (!category) return valSymbol(name);
    const value = single(
      this.check(this.primitives.get(category)!, valSymbol(name)),
    );
    return value.kind === "view" ? { ...value, provisional: true } : value;
  }
  /** Native predicates have a known result type; this needs no inference. */
  private boolean(value: boolean): Value {
    return single(
      this.check(
        this.primitives.get("Bool")!,
        valSymbol(value ? "True" : "False"),
      ),
    );
  }
  private ascribeRational(value: Value): Field<Value>[] {
    return this.check(this.primitives.get("Rational")!, value);
  }
  private ascribeString(value: Value): Field<Value>[] {
    return this.check(this.primitives.get("String")!, value);
  }
  private stringValue(text: string): Value {
    return single(this.ascribeString(valLiteral(text)));
  }
  /** Prefix `-(a)` is negation; infix `-(a)(b)` remains subtraction. */
  private negateValue(v: Value): Field<Value>[] {
    const space = concreteSpace(v);
    if (!space || space.numeric === "rational") {
      const r = asRational(v);
      if (!r) throw new LanguageError("expected a number");
      const value = valRational(-r.n, r.d);
      return space ? this.check(space, value) : this.ascribeRational(value);
    }
    const r = asRational(v);
    if (!r) throw new LanguageError("expected a number");
    const n = rationalToNumber(r);
    if (!Number.isFinite(n)) throw new LanguageError("expected a number");
    const negated = -n;
    if (
      !Number.isFinite(negated) ||
      (space.numeric !== "float32" &&
        space.numeric !== "float64" &&
        Number.isInteger(negated) &&
        !Number.isSafeInteger(negated))
    )
      throw new LanguageError("result exceeds safe numeric range");
    const value = valLiteral(negated);
    return space ? this.check(space, value) : singleton(value);
  }
  private requireExactNumericDesignation(type: TypeValue, value: Value) {
    const numeric = type.numeric ?? type.baseType?.numeric;
    if (numeric !== "float32" && numeric !== "float64") return;
    const target = type.baseType ?? type;
    const prior = concreteSpace(value);
    if (prior && typeIdentity(prior) === typeIdentity(target)) return;
    const r = asRational(value);
    if (!r) return;
    const exact = numeric === "float32" ? isExactFloat32(r) : isExactFloat64(r);
    if (!exact)
      throw new LanguageError(
        "not exactly representable as " +
          (numeric === "float32" ? "Float32" : target.name),
      );
  }
  private numericPayload(type: TypeValue, value: Value): Value {
    const r = asRational(value);
    if (type.numeric === "float32") {
      if (!r || !isExactFloat32(r))
        throw new LanguageError("not exactly representable as Float32");
      return valLiteral(Math.fround(rationalToNumber(r)));
    }
    if (type.numeric === "int64") {
      if (!r || r.d !== 1n) throw new LanguageError("expected a number");
      return valLiteral(Number(r.n));
    }
    if (type.numeric === "float64") {
      if (!r || !isExactFloat64(r))
        throw new LanguageError(
          "not exactly representable as " + (type.baseType ?? type).name,
        );
      return valLiteral(rationalToNumber(r));
    }
    if (type.numeric === "rational") {
      if (!r) throw new LanguageError("expected a number");
      return valRational(r.n, r.d);
    }
    return unwrap(value);
  }
  /**
   * D09: match-based projection may cross one union boundary when the payload
   * uniquely designates a member. Ordinary binding and dispatch do not unwrap.
   * Postfix T? is unwrapped T | :None, so a unique present payload projects.
   * Constructor-only unions such as T^ stay constructor matches.
   */
  private findImmediateUnion(
    pattern: Pattern<Value>,
    active = new Set<unknown>(),
  ): Extract<Pattern<Value>, { kind: "union" }> | undefined {
    if (pattern.kind === "union") return pattern;
    if (pattern.kind === "map" || pattern.kind === "capture")
      return this.findImmediateUnion(pattern.pattern, active);
    if (pattern.kind !== "ref" || active.has(pattern.key)) return;
    return this.findImmediateUnion(
      pattern.resolve(),
      new Set(active).add(pattern.key),
    );
  }
  private choiceIdentity(choice: Pattern<Value>): string | undefined {
    const seen = new Set<unknown>();
    let pattern = choice;
    while (pattern.kind === "ref" && !seen.has(pattern.key)) {
      seen.add(pattern.key);
      const identity = pattern.dispatchIdentity?.();
      if (typeof identity === "string") return identity;
      pattern = pattern.resolve();
    }
    if (pattern.kind === "map") return this.choiceIdentity(pattern.pattern);
  }
  private immediateUnionChoices(type: TypeValue): Pattern<Value>[] | undefined {
    if (type.unionMembers && type.unionMembers.length >= 2)
      return type.unionMembers.map((member) => this.typePattern(member));
    const union = this.findImmediateUnion(type.pattern());
    if (!union || union.choices.length < 2) return;
    return union.choices;
  }
  /** Explicit member evidence wins; otherwise prefer a direct arm over inward designation. */
  private concreteUnionSelection(
    type: TypeValue,
    value: Value,
  ): Pattern<Value> | undefined {
    if (type.packaged || type.baseType) return;
    const choices = this.immediateUnionChoices(type);
    if (!choices) return;
    const space = concreteSpace(value);
    const exact = space
      ? choices.filter((choice) => {
          const member = this.choiceIdentity(choice);
          return member && member === typeIdentity(space);
        })
      : [];
    if (exact.length)
      return exact.length === 1 ? exact[0] : { kind: "union", choices: exact };
    // A bound concrete value cannot be reinterpreted as raw constructor data.
    if (
      space &&
      !(value.kind === "view" && value.provisional) &&
      space.numeric !== "rational"
    ) {
      const inward = choices.filter((choice) => this.choiceIdentity(choice));
      return inward.length ? { kind: "union", choices: inward } : undefined;
    }
    const direct = choices.filter((choice) => {
      if (
        choice.kind !== "test" &&
        choice.kind !== "node" &&
        choice.kind !== "postfix"
      )
        return false;
      if (
        choice.kind === "test" &&
        !(Array.isArray(choice.identity) && choice.identity[0] === "literal")
      )
        return false;
      return true;
    });
    return direct.length && direct.length < choices.length
      ? { kind: "union", choices, preferred: direct }
      : undefined;
  }
  private concreteUnionMember(type: TypeValue, value: Value): boolean {
    if (type.packaged || type.baseType) return false;
    const space = concreteSpace(value);
    return (
      !!space &&
      (this.immediateUnionChoices(type) ?? []).some((choice) => {
        const member = this.choiceIdentity(choice);
        return member && member === typeIdentity(space);
      })
    );
  }
  private uniqueMatchUnionMember(
    prior: TypeValue,
    value: Value,
    target: TypeValue,
  ): boolean {
    const choices = this.immediateUnionChoices(prior);
    if (!choices) return false;
    const payload = value.kind === "view" ? value.base : unwrap(value);
    const space = concreteSpace(payload);
    const exact = space
      ? choices.filter(
          (choice) => this.choiceIdentity(choice) === typeIdentity(space),
        )
      : [];
    if (exact.length)
      return (
        exact.length === 1 && typeIdentity(space!) === typeIdentity(target)
      );
    const hits: string[] = [];
    let constructorHit = false;
    for (const choice of choices) {
      try {
        this.interpretMatch(choice, singleton(payload));
        const member = this.choiceIdentity(choice);
        if (member) hits.push(member);
        else constructorHit = true;
      } catch (error) {
        if (!(error instanceof Mismatch)) throw error;
      }
    }
    return (
      !constructorHit && hits.length === 1 && hits[0] === typeIdentity(target)
    );
  }
  private check(type: TypeValue, value: Value, env?: Scope): Field<Value>[] {
    this.requireExactNumericDesignation(type, value);
    try {
      return this.interpretMatch(
        this.typePattern(type, !!env),
        singleton(value),
      ).fields;
    } catch (e) {
      if (e instanceof Mismatch) {
        let label = type.name;
        if (env) {
          try {
            label = valueText(type, this.textDomain(env));
          } catch (error) {
            if (
              !(error instanceof LanguageError) ||
              error.diagnostic.code !== "E_TYPE_SERIALIZATION"
            )
              throw error;
          }
        }
        throw new Mismatch(
          "expected " +
            label +
            ", got " +
            display(value) +
            ": " +
            e.diagnostic.message,
          e.diagnostic.primary,
          {
            related: e.diagnostic.related,
            path: e.diagnostic.path,
            expected: e.diagnostic.expected,
            actual: e.diagnostic.actual,
            causes: [e.diagnostic],
          },
        );
      }
      throw e;
    }
  }
  private instantiate(decl: TypeDeclaration, args: Field<Value>[]): TypeValue {
    return constructingTypes(() => this.instantiateDefinition(decl, args));
  }
  private instantiateDefinition(
    decl: TypeDeclaration,
    args: Field<Value>[],
  ): TypeValue {
    const key =
      "named:" +
      decl.id +
      ":" +
      JSON.stringify(
        canonicalFields(args).map((f) => {
          const v = unwrap(this.materializeType(f.value) ?? f.value);
          return [f.label, v.kind === "type" ? v.key : descriptionKey(v)];
        }),
      );
    const cached = this.types.get(key);
    if (cached) return cached;
    const local = new Scope(decl.env);
    const matched = this.matchParameters(decl.parameters, args, decl.env);
    for (const [name, capture] of matched.captures) {
      this.bind(local, name, captureValue(capture, name));
      if (!this.compileTimeDepth) local.runtimeBindings.add(name);
    }
    const name =
      decl.name +
      (decl.parameterized
        ? "(" +
          canonicalFields(args)
            .map((f) => {
              const v = unwrap(this.materializeType(f.value) ?? f.value);
              return (
                (positional(f.label) ? "" : f.label + ": ") +
                (v.kind === "type" ? v.name : display(v))
              );
            })
            .join(", ") +
          ")"
        : "");
    let target: TypeValue | undefined;
    const type: TypeValue = {
      kind: "type",
      key,
      name,
      declaration: decl,
      arguments: args,
      pattern: () => {
        if (!target)
          throw new LanguageError(
            "recursive type was inspected before its definition was complete",
            decl.body.span,
            {
              code: "E_UNGUARDED_TYPE",
              phase: "declaration",
            },
          );
        return this.typePattern(target);
      },
    };
    this.types.set(key, type);
    this.buildingTypes++;
    const outerTypeDepth = this.inlineTypeDepth;
    this.inlineTypeDepth = 0;
    try {
      const result = single(
        this.evaluate(decl.body, local),
        "definition " + decl.name,
      );
      target = this.materializeType(result);
      if (!target)
        throw new LanguageError(
          "TitleCase definition " +
            decl.name +
            " must return a type, got " +
            display(result),
          decl.body.span,
          {
            code: "E_EXPECTED_TYPE",
            phase: "declaration",
            notes: [
              "Use type Pattern to construct a type, or a lowercase name to bind an ordinary value.",
            ],
          },
        );
      if (target === type || target.baseType === type)
        throw new LanguageError(
          "nonproductive recursive type needs a constructor before its self reference",
          decl.body.span,
          { code: "E_UNGUARDED_TYPE", phase: "declaration" },
        );
      this.aliasTargets.set(type, target);
      for (
        let alias: TypeValue | undefined = target;
        alias;
        alias = this.aliasTargets.get(alias)
      )
        if (alias === type)
          throw new LanguageError(
            "nonproductive recursive type needs a constructor",
            decl.body.span,
            { code: "E_UNGUARDED_TYPE", phase: "declaration" },
          );
      type.baseType = target.baseType;
      type.numeric = target.numeric;
      type.transparent = target.transparent;
      type.packaged = target.packaged;
      type.facet = target.facet;
      type.unionMembers = target.unionMembers;
      type.treeGrammar = target.treeGrammar;
      const produced =
        this.definitionEvaluation(local).get(target) ??
        this.definitionProducts.get(target);
      if (produced) this.definitionProducts.set(type, { ...produced, type });
      this.pendingDefinitions.set(type, decl);
    } catch (error) {
      this.types.delete(key);
      throw error;
    } finally {
      this.buildingTypes--;
      this.inlineTypeDepth = outerTypeDepth;
    }
    if (!this.buildingTypes) {
      const definitions = [...this.pendingDefinitions];
      this.pendingDefinitions.clear();
      const unions = this.deferredUnions.splice(0);
      const flatten = (
        t: TypeValue,
        active = new Set<TypeValue>(),
      ): TypeValue[] => {
        if (!t.unionMembers) return [t];
        if (active.has(t))
          throw new LanguageError(
            "nonproductive recursive union needs a constructor",
            decl.body.span,
            { code: "E_UNGUARDED_TYPE", phase: "declaration" },
          );
        const nested = new Set(active).add(t);
        return t.unionMembers.flatMap((member) => flatten(member, nested));
      };
      for (const union of unions) {
        const normalized = this.unionType(flatten(union));
        union.unionMembers!.splice(
          0,
          union.unionMembers!.length,
          ...normalized.unionMembers!,
        );
        union.packaged = normalized.packaged;
        union.name = normalized.name;
      }
      for (const [completed] of definitions)
        if (completed.unionMembers)
          completed.packaged = completed.unionMembers.length > 1;
      for (const [completed, declaration] of definitions)
        this.registerTypeDefinition(completed, declaration);
    }
    return type;
  }
  private typeFromSyntax(n: Syntax, env: Scope): TypeValue {
    env =
      lexicalScopes.get(n) ??
      (n.kind === "apply"
        ? lexicalScopes.get(n.head)
        : n.kind === "postfix"
          ? lexicalScopes.get(n.operand)
          : undefined) ??
      env;
    let cache = this.evaluatedTypes.get(env);
    if (!cache) this.evaluatedTypes.set(env, (cache = new WeakMap()));
    const previous = cache.get(n);
    if (previous) return previous;
    const result = this.evaluateTypeSyntax(n, env);
    cache.set(n, result);
    return result;
  }
  private modifiedType(name: string, element: TypeValue): TypeValue {
    if (name === "!")
      throw new LanguageError("postfix ! is reserved for future action types");
    const key = name + "(" + element.key + ")";
    const cached = this.types.get(key);
    if (cached) return cached;
    const type: TypeValue = {
      kind: "type",
      key,
      name: element.name + name,
      element,
      modifier: name,
      pattern: () => {
        if (name === "*")
          return {
            kind: "node",
            head: literalPattern(valSymbol("[]")),
            body: {
              kind: "fields",
              parts: [
                {
                  kind: "repeat",
                  pattern: {
                    kind: "label",
                    label: "_1",
                    pattern: this.typePattern(element),
                  },
                },
              ],
            },
          };
        if (name === "^")
          return {
            kind: "union",
            choices: [
              {
                kind: "node",
                head: literalPattern(valSymbol("Ok")),
                body: positionalPattern([this.typePattern(element)]),
              },
              {
                kind: "node",
                head: literalPattern(valSymbol("Error")),
                body: positionalPattern([any<Value>()]),
              },
            ],
          };
        throw new LanguageError("unsupported type modifier: " + name);
      },
    };
    this.types.set(key, type);
    return type;
  }
  private evaluateTypeSyntax(n: Syntax, env: Scope): TypeValue {
    if (n.kind === "sequence")
      return this.typeFromSyntax(this.grammar.resolve(n), env);
    if (n.kind === "block") {
      const lines = [...n.lines];
      const last = lines.pop();
      if (!last)
        throw new LanguageError("type block requires a final type", n.span);
      const items = last.kind === "sequence" ? last.items : [last];
      lines.push({
        kind: "sequence",
        items: [{ kind: "symbol", name: "type", quoted: false }, ...items],
        span: last.span,
      });
      const result = single(
        this.evaluateBlock({ ...n, lines }, env),
        "type block",
      );
      const type = this.materializeType(result);
      if (!type)
        throw new LanguageError("type block must return a type", n.span);
      return type;
    }
    if (n.kind === "form" && n.name === "UnionTypeExpression") {
      const result = this.materializeType(single(this.evaluate(n, env)));
      if (!result) throw new LanguageError("expected a type", n.span);
      return result;
    }
    if (n.kind === "form" && n.name === "TypeExpression")
      return this.anonymousType(this.capture(n, "pattern"), env);
    if (n.kind === "symbol" && !n.quoted) {
      const value = single(this.evaluate(n, env), "type expression");
      const type = this.materializeType(value);
      if (type) return type;
      throw new LanguageError(
        "expected a type, got " + display(value),
        n.span,
        { code: "E_EXPECTED_TYPE" },
      );
    }
    if (binary(n, "|")) return this.anonymousType(n, env);
    if (this.isTypeCall(n, env)) {
      const result = unwrap(
        single(this.evaluate(this.grammar.resolve(n), env), "type expression"),
      );
      const type = this.materializeType(result);
      if (!type)
        throw new LanguageError(
          "type expression must return a type, got " + display(result),
          n.span,
          {
            code: "E_EXPECTED_TYPE",
          },
        );
      return type;
    }
    if (n.kind === "quote") return this.anonymousType(n, env);
    if (n.kind === "postfix") {
      if (n.operator === "*" || n.operator === "^")
        return this.modifiedType(
          n.operator,
          this.typeFromSyntax(n.operand, env),
        );
      return this.anonymousType(n, env);
    }
    if (n.kind === "apply" || n.kind === "literal")
      return this.anonymousType(n, env);
    throw new LanguageError("expected a type expression", n.span);
  }
}
export { displayResults, display, inspectResults };
