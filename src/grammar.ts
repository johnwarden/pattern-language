import { readBootstrap } from "./bootstrap.ts";
import { elaborateBlock, validateLanguageBlock } from "./elaboration.ts";
import { PatternCompiler } from "./pattern-compiler.ts";
import { primitiveNames } from "./primitive-names.ts";
import {
  addLayoutForm,
  emptyLayoutForms,
  parseSurface,
  type LayoutForms,
} from "./parser.ts";
import {
  LanguageError,
  operator,
  binary,
  spread,
  normal,
  syntaxKey,
  listLayer,
  symbol,
  isName,
  isTypeSpecification,
} from "./syntax.ts";
import type { Syntax, Field } from "./syntax.ts";
import { Matcher, sequencePattern } from "./pattern.ts";
import type { Pattern, Match, Adapter } from "./pattern.ts";
import {
  HOST_READERS,
  record,
  list,
  encodeSyntax,
  decodeSyntax,
  field,
  items,
  text,
  blockPolicy,
  readerDescriptions,
  typeGrammarDescription,
} from "./language-description.ts";
import {
  valLiteral,
  valSymbol,
  equal,
  unwrap,
  compareRationals,
  rationalFromSyntax,
} from "./values.ts";
import type { Value } from "./values.ts";
export const DEFAULT_GRAMMAR = `def Definition type :def signature :: Signature body :: Body
def MacroRegistration type :macro signature :: Signature body :: Body
def TypeExpression type :type pattern :: PatternBody
def ConcreteTypeDeclaration type :type signature :: Signature :concrete pattern :: PatternBody
def AbstractTypeDeclaration type :type signature :: Signature :abstract pattern :: PatternBody
def ConcreteTypeExpression type :concrete pattern :: PatternBody
def AbstractTypeExpression type :abstract pattern :: PatternBody
def UnionTypeExpression type :unionType pattern :: PatternBody
def IfExpression type :if condition :: Expression consequent :: Body :else alternative :: Body
def MatchExpression type :match subject :: Expression arms :: Arms`;
const syntaxAdapter: Adapter<Syntax> = {
  equal: (a, b) => syntaxKey(a) === syntaxKey(b),
  decompose: (n) =>
    n.kind === "apply"
      ? { head: n.head, body: n.body }
      : n.kind === "block"
        ? {
            head: { kind: "symbol", name: "syntaxBlock", quoted: true },
            body: n.lines.map((value, i) => ({ label: "_" + (i + 1), value })),
          }
        : undefined,
  postfix: (n) =>
    n.kind === "postfix"
      ? { operator: symbol(n.operator), operand: n.operand }
      : undefined,
  rebuildPostfix: (n, operator, operand) => {
    if (operator.kind !== "symbol")
      throw new LanguageError("a postfix operator must be punctuation", n.span);
    return { kind: "postfix", operator: operator.name, operand, span: n.span };
  },
  rebuild: (n, head, body) =>
    n.kind === "block"
      ? { ...n, lines: body.map((f) => f.value) }
      : n.kind === "postfix"
        ? n
        : ({ ...n, head, body } as Syntax),
  row: (n) => {
    if (n.kind === "sequence" && n.items.length === 1) n = n.items[0];
    return n.kind === "pack" ? n.body : [{ label: "_1", value: n }];
  },
  collection: (body) => ({
    kind: "apply",
    head: { kind: "symbol", name: "[]", quoted: false },
    body,
  }),
};
const entry = (value: Syntax, label = "_1"): Field<Syntax> => ({
  label,
  value,
});
export const syntaxGrammars = new WeakMap<Syntax, Grammar>();
export class Grammar {
  deferBlocks = false;
  /** Inert schema reading: Expression/Body captures retain one surface operand. */
  private opaqueExpressions: boolean;
  rules = new Map<string, Pattern<Syntax>>();
  private ruleSyntax = new Map<string, Syntax[]>();
  private structuralNames = new Set<string>();
  keywords = new Map<string, string[]>();
  constructor(
    source = DEFAULT_GRAMMAR,
    options: { opaqueExpressions?: boolean } = {},
  ) {
    this.opaqueExpressions = options.opaqueExpressions ?? false;
    for (const { name, pattern: items } of readBootstrap(source)) {
      if (
        this.rules.has(name.name) ||
        [...HOST_READERS.map(([name]) => name), "Num"].includes(name.name)
      )
        throw new LanguageError(
          "duplicate or reserved grammar name: " + name.name,
        );
      this.ruleSyntax.set(name.name, items);
      this.rules.set(
        name.name,
        sequencePattern(items.map((n) => this.compilePattern(n))),
      );
      if (items.length > 1) {
        const first = items[0];
        if (first.kind !== "symbol" || !first.quoted)
          throw new LanguageError(
            "a sidefix form starts with a quoted keyword",
          );
        this.keywords.set(first.name, [
          ...(this.keywords.get(first.name) ?? []),
          name.name,
        ]);
      }
    }
  }
  private compiler(
    typeDefinition = false,
    dimensions = 0,
  ): PatternCompiler<Syntax> {
    return new PatternCompiler<Syntax>(
      {
        bareCaptures: true,
        expression: (n) => {
          if (n.kind !== "postfix" || !isTypeSpecification(n.operand)) return;
          const tag = (
            name: string,
            pattern: Pattern<Syntax>,
          ): Pattern<Syntax> => ({
            kind: "node",
            head: {
              kind: "test",
              name,
              test: (v) => v.kind === "symbol" && v.name === name,
            },
            body: {
              kind: "fields",
              parts: [{ kind: "label", label: "_1", pattern }],
            },
          });
          if (n.operator === "*")
            return {
              kind: "node",
              head: {
                kind: "test",
                name: "[]",
                test: (v) => v.kind === "symbol" && v.name === "[]",
              },
              body: {
                kind: "fields",
                parts: [
                  {
                    kind: "repeat",
                    pattern: {
                      kind: "label",
                      label: "_1",
                      pattern: this.compilePattern(n.operand),
                    },
                  },
                ],
              },
            };
          if (n.operator === "^")
            return {
              kind: "union",
              choices: [
                tag("Ok", this.compilePattern(n.operand)),
                tag("Error", { kind: "any" }),
              ],
            };
        },
        defaultValue: (n) => n,
        head: (n, depth = 0) =>
          n.kind === "symbol"
            ? {
                kind: "test",
                name: n.name,
                test: (v) => v.kind === "symbol" && v.name === n.name,
              }
            : this.compiler(typeDefinition, depth).compile(n),
        annotation: (n, dimensions = 0) => {
          for (let i = 0; i < dimensions; i++) {
            const layer = listLayer(n);
            if (!layer)
              throw new LanguageError(
                "vertical capture annotation requires a list layer",
                n.span,
              );
            n = layer.operand;
          }
          return this.compilePattern(n);
        },
        repeatedElement: (n, dimensions = 0) => {
          for (let i = 0; i < dimensions; i++) {
            const layer = listLayer(n);
            if (!layer)
              throw new LanguageError(
                "vertical capture annotation requires a list layer",
                n.span,
              );
            n = layer.operand;
          }
          const rest = listLayer(n);
          if (!rest) throw new LanguageError("rest annotation requires T*");
          return this.compilePattern(rest.operand);
        },
        expand: () => undefined,
        atom: (n) => {
          if (n.kind === "symbol")
            return n.quoted
              ? {
                  kind: "test",
                  name: n.name,
                  test: (v) => v.kind === "symbol" && v.name === n.name,
                }
              : {
                  kind: "ref",
                  key: "grammar:" + n.name,
                  name: n.name,
                  resolve: () => this.reference(n.name),
                };
          if (n.kind === "literal")
            return {
              kind: "test",
              name: normal(n),
              test: (v) => {
                if (v.kind !== "literal") return false;
                const left = rationalFromSyntax(v),
                  right = rationalFromSyntax(n);
                if (left && right) return compareRationals(left, right) === 0;
                return v.value === n.value;
              },
            };
          throw new LanguageError("unsupported grammar pattern", n.span);
        },
      },
      dimensions,
    );
  }
  private compilePattern(n: Syntax, typeDefinition = false): Pattern<Syntax> {
    const annotation = binary(n, "::");
    if (spread(n) || (annotation && spread(annotation[0])))
      throw new LanguageError(
        "spread (...) is only valid inside an argument pack; sidefix sequences are fixed-length",
        n.span,
        { code: "E_SIDEFIX_SPREAD", phase: "declaration" },
      );
    return this.compiler(typeDefinition).compile(n);
  }
  private reference(name: string): Pattern<Syntax> {
    if (this.rules.has(name)) {
      const pattern = this.rules.get(name)!;
      return this.structuralNames.has(name)
        ? {
            kind: "map",
            pattern,
            localCaptures: true,
            transform: (fields) => fields,
          }
        : pattern;
    }
    if (["Number", "Num", "Int", "String"].includes(name))
      return {
        kind: "test",
        name,
        test: (n) => {
          if (n.kind !== "literal") return false;
          if (name === "String") return typeof n.value === "string";
          const r = rationalFromSyntax(n);
          if (!r) return typeof n.value === "number";
          return name !== "Int" || r.d === 1n;
        },
      };
    if (name === "Pattern") return { kind: "test", name, test: () => true };
    if (name === "PatternBody")
      return {
        kind: "reader",
        name,
        read: (items, pos, matcher) => {
          const value = items[pos]?.value;
          if (!value) return [];
          // Only nested type forms are interpreted here. Other pattern operands
          // stay opaque. Ungrouped quoted-keyword tails replace the banned
          // `type :assert …` grouping; a one-line block unwraps to that line.
          if (
            value.kind === "symbol" &&
            !value.quoted &&
            this.keywords.get(value.name)?.includes("TypeExpression")
          )
            return this.readForm(items, pos, matcher);
          const taken = this.takeOpaqueSequence(items, pos, {
            attachBlock: true,
          });
          return [
            {
              end: taken.end,
              fields: [
                entry(this.unwrapPatternOperand(taken.value), items[pos].label),
              ],
              captures: new Map(),
            },
          ];
        },
      };
    if (name === "Signature")
      return {
        kind: "reader",
        name,
        read: (items, pos) => {
          const n = items[pos]?.value;
          if (!n) return [];
          if (this.microSignature(n) || this.sidefixSignature(n))
            return [
              {
                end: pos + 1,
                fields: [entry(n, items[pos].label)],
                captures: new Map(),
              },
            ];
          if (n.kind === "symbol" && n.quoted) {
            const taken = this.takeOpaqueSequence(items, pos, {
              stopBeforeBlock: true,
              stopBeforeBody: true,
            });
            if (taken.end > pos)
              return [
                {
                  end: taken.end,
                  fields: [entry(taken.value, items[pos].label)],
                  captures: new Map(),
                },
              ];
          }
          return [];
        },
      };
    if (this.opaqueExpressions && ["Expression", "Body"].includes(name))
      return {
        kind: "reader",
        name,
        read: (items, pos) => {
          const item = items[pos];
          return item
            ? [{ end: pos + 1, fields: [item], captures: new Map() }]
            : [];
        },
      };
    if (["Expression", "Form", "Body", "Arms"].includes(name))
      return {
        kind: "reader",
        name,
        read: (items, pos, matcher) => {
          const n = items[pos]?.value;
          if (!n) return [];
          if (n.kind === "block") {
            if (name === "Expression" || name === "Form") return [];
            const value =
              name === "Arms"
                ? this.arms(n, matcher)
                : this.block(n, matcher, false);
            return [
              {
                end: pos + 1,
                fields: [entry(value, items[pos].label)],
                captures: new Map(),
              },
            ];
          }
          if (name === "Arms") return [];
          return this.readForm(items, pos, matcher).filter(
            (m) =>
              name !== "Expression" ||
              m.fields.every((e) => e.value.kind !== "form"),
          );
        },
      };
    throw new LanguageError("unknown grammar reference: " + name);
  }
  /** Concrete/abstract forms elaborate to the existing declaration/type operations.
   * Keep original items and spans so source printing and inert inspection remain lossless. */
  private elaborateTypeForm(
    n: Extract<Syntax, { kind: "form" }>,
    sourceItems: Syntax[],
  ): Syntax {
    if (
      [
        "ConcreteTypeExpression",
        "AbstractTypeExpression",
        "ConcreteTypeDeclaration",
        "AbstractTypeDeclaration",
      ].includes(n.name)
    ) {
      // A primitive atom is already a type value: there is no pattern to make
      // concrete or abstract, so a lone primitive operand is rejected, not wrapped.
      const operand = n.captures.get("pattern")?.fields[0]?.value;
      if (
        operand?.kind === "symbol" &&
        !operand.quoted &&
        primitiveNames.has(operand.name)
      )
        throw new LanguageError(
          operand.name +
            " is already a type value; use " +
            operand.name +
            " itself, not " +
            (n.name.startsWith("Concrete") ? "concrete " : "abstract ") +
            operand.name,
          operand.span ?? n.span,
          { code: "E_TYPE_DESCRIPTION", phase: "declaration" },
        );
    }
    if (n.name === "ConcreteTypeExpression")
      return { ...n, name: "TypeExpression", items: sourceItems };
    if (n.name === "AbstractTypeExpression")
      return { ...n, name: "UnionTypeExpression", items: sourceItems };
    if (
      !["ConcreteTypeDeclaration", "AbstractTypeDeclaration"].includes(n.name)
    )
      return n;
    const signature = n.captures.get("signature");
    const name = signature?.fields[0]?.value;
    if (
      !name ||
      name.kind !== "symbol" ||
      name.quoted ||
      !/^\p{Lu}/u.test(name.name)
    )
      throw new LanguageError(
        "type declaration requires a bare UpperCamel name; parameterized declarations remain unsupported",
        name?.span ?? n.span,
        { code: "E_TYPE_DECLARATION_SIGNATURE", phase: "declaration" },
      );
    const pattern = n.captures.get("pattern")!;
    const body: Syntax = {
      kind: "form",
      name:
        n.name === "ConcreteTypeDeclaration"
          ? "TypeExpression"
          : "UnionTypeExpression",
      captures: new Map([["pattern", pattern]]),
      items: sourceItems.slice(2),
      span: sourceItems[2]?.span ?? n.span,
    };
    return {
      ...n,
      name: "Definition",
      items: sourceItems,
      captures: new Map([
        ["signature", signature!],
        ["body", { rest: false, fields: [entry(body)] }],
      ]),
    };
  }
  private readForm(
    items: Field<Syntax>[],
    pos: number,
    matcher: Matcher<Syntax>,
  ): Match<Syntax>[] {
    const n = items[pos]?.value;
    if (!n) return [];
    if (n.kind === "symbol" && !n.quoted && this.keywords.has(n.name)) {
      return this.keywords.get(n.name)!.flatMap((name) =>
        matcher.scan(this.rules.get(name)!, items, pos).map((m) => ({
          end: m.end,
          fields: [
            entry(
              this.elaborateTypeForm(
                {
                  kind: "form",
                  name,
                  captures: m.captures,
                  items: m.fields.map((e) => e.value),
                  span: n.span,
                },
                items.slice(pos, m.end).map((e) => e.value),
              ),
              items[pos].label,
            ),
          ],
          captures: new Map(),
        })),
      );
    }
    const resolved = this.resolveOperand(n, items, pos + 1, matcher);
    return [
      {
        end: resolved.end,
        fields: [entry(resolved.node, items[pos].label)],
        captures: new Map(),
      },
    ];
  }
  /** Macro operands consume the available surface tail uniformly, not by keyword patches. */
  private resolveOperand(
    n: Syntax,
    tail: Field<Syntax>[],
    end: number,
    matcher: Matcher<Syntax>,
  ): { node: Syntax; end: number } {
    if (n.kind === "quote" || n.kind === "typedQuote" || n.kind === "template")
      return { node: n, end };
    if (n.kind === "sequence")
      if (n.items[0]?.kind === "symbol" && n.items[0].quoted)
        return { node: n, end };
    if (n.kind === "sequence")
      return { node: this.resolveSequence(n, matcher), end };
    if (n.kind === "block") return { node: this.block(n, matcher, false), end };
    if (n.kind === "postfix") {
      const operand = this.resolveOperand(n.operand, tail, end, matcher);
      return { node: { ...n, operand: operand.node }, end: operand.end };
    }
    if (n.kind === "apply" || n.kind === "pack") {
      const head =
        n.kind === "pack"
          ? undefined
          : operator(n, "=") || operator(n, "->")
            ? n.head
            : this.resolveOperand(n.head, [], 0, matcher).node;
      const body = n.body.map((field, i) => {
        // Only the final operand can consume an unparenthesized macro tail.
        const mayConsume = i === n.body.length - 1;
        const v = field.value;
        // An empty collection row block is data, not an empty executable body.
        if (
          n.kind === "apply" &&
          (isName(n.head, "[]") || isName(n.head, "{}")) &&
          n.body.length === 1 &&
          v.kind === "block" &&
          !v.lines.length
        )
          return field;
        if (
          mayConsume &&
          v.kind === "symbol" &&
          !v.quoted &&
          this.keywords.has(v.name)
        ) {
          const borrowed = [entry(v), ...tail.slice(end)],
            matches = this.readForm(borrowed, 0, matcher);
          if (matches.length !== 1)
            throw new LanguageError(
              "incomplete or ambiguous macro operand",
              v.span,
            );
          end += matches[0].end - 1;
          return { ...field, value: matches[0].fields[0].value };
        }
        if (v.kind === "sequence") {
          if (!(v.items[0]?.kind === "symbol" && v.items[0].quoted))
            return {
              ...field,
              value: this.resolveSequence(v, matcher, true),
            };
          return { ...field, value: v };
        }
        const r = this.resolveOperand(
          v,
          mayConsume ? tail : [],
          mayConsume ? end : 0,
          matcher,
        );
        if (mayConsume) end = r.end;
        return { ...field, value: r.node };
      });
      return {
        node: n.kind === "pack" ? { ...n, body } : { ...n, head: head!, body },
        end,
      };
    }
    return { node: n, end };
  }
  private resolveSequence(
    n: Syntax,
    matcher: Matcher<Syntax>,
    nested = false,
  ): Syntax {
    if (n.kind !== "sequence")
      return this.resolveOperand(n, [], 0, matcher).node;
    const xs = n.items.map((v) => entry(v)),
      matches = this.readForm(xs, 0, matcher).filter(
        (m) => m.end === xs.length,
      );
    if (matches.length > 1) throw new LanguageError("ambiguous macro", n.span);
    if (matches.length !== 1) {
      if (nested) return n;
      throw new LanguageError("unknown or incomplete macro form", n.span);
    }
    return matches[0].fields[0].value;
  }
  private arms(
    n: Extract<Syntax, { kind: "block" }>,
    matcher: Matcher<Syntax>,
  ): Syntax {
    if (!n.lines.length)
      throw new LanguageError("match needs at least one arm", n.span);
    const lines = n.lines.map((line) => this.resolveSequence(line, matcher));
    for (const line of lines)
      if (!operator(line, "->"))
        throw new LanguageError(
          "match arms require pattern -> expression",
          line.span,
        );
    return { ...n, lines };
  }
  private block(
    n: Extract<Syntax, { kind: "block" }>,
    matcher: Matcher<Syntax>,
    repl: boolean,
  ): Syntax {
    if (this.deferBlocks) {
      // Check the obvious tail without interpreting the body's local grammar.
      validateLanguageBlock(n.lines, false);
      return n;
    }
    const rules = new Map(this.rules),
      keywords = new Map(this.keywords),
      syntax = new Map(this.ruleSyntax),
      structuralNames = new Set(this.structuralNames);
    try {
      return this.blockBody(n, matcher, repl);
    } finally {
      this.rules = rules;
      this.keywords = keywords;
      this.ruleSyntax = syntax;
      this.structuralNames = structuralNames;
    }
  }
  /** Runtime staging: accept each form before reading the next, with nested bodies deferred. */
  private describeForm(input: Syntax): string | undefined {
    const first = input.kind === "sequence" ? input.items[0] : input;
    const names =
      first?.kind === "symbol" ? this.keywords.get(first.name) : undefined;
    if (!names) return;
    const alternatives = names.map((name) => ({
      name,
      pattern: this.ruleSyntax.get(name),
    }));
    return (
      "incomplete or invalid " +
      names.join(" or ") +
      "; expected grammar " +
      alternatives
        .map(({ pattern }) => pattern?.map(normal).join(" "))
        .join(" OR ") +
      "; found " +
      normal(input)
    );
  }
  elaborate(
    n: Extract<Syntax, { kind: "block" }>,
    accept: (form: Syntax) => Syntax | void,
    repl = false,
    complete?: (input: Syntax) => Syntax | undefined,
  ): Syntax {
    const matcher = new Matcher(syntaxAdapter);
    return elaborateBlock(n, {
      read: (items, pos) => this.readForm(items, pos, matcher),
      accept,
      finish: (lines) => validateLanguageBlock(lines, repl),
      describe: (input) => this.describeForm(input),
      complete,
    });
  }
  private blockBody(
    n: Extract<Syntax, { kind: "block" }>,
    matcher: Matcher<Syntax>,
    repl: boolean,
  ): Syntax {
    return elaborateBlock(n, {
      read: (items, pos) => this.readForm(items, pos, matcher),
      accept: (line) => this.registerDefinition(line),
      finish: (lines) => validateLanguageBlock(lines, repl),
      describe: (input) => this.describeForm(input),
    });
  }
  registerDefinition(line: Syntax): void {
    if (
      line.kind === "form" &&
      ["Definition", "MacroRegistration"].includes(line.name)
    ) {
      const signature = line.captures.get("signature")?.fields[0]?.value;
      const body = line.captures.get("body")?.fields[0]?.value;
      if (line.name === "MacroRegistration" && signature?.kind !== "sequence")
        throw new LanguageError(
          "macro registration requires a sidefix signature; functions use micro syntax",
          signature?.span,
          { code: "E_MACRO_SIGNATURE", phase: "declaration" },
        );
      if (signature?.kind === "sequence" && body) {
        if (line.name !== "MacroRegistration")
          throw new LanguageError(
            "sidefix syntax requires explicit macro registration",
            signature.span,
            { code: "E_MACRO_REGISTRATION", phase: "declaration" },
          );
        this.registerSidefix(signature);
      }
      if (
        signature?.kind === "symbol" &&
        !signature.quoted &&
        /^\p{Lu}/u.test(signature.name) &&
        body?.kind === "form" &&
        body.name === "TypeExpression"
      ) {
        const pattern = body.captures.get("pattern")?.fields[0]?.value;
        if (pattern) {
          // Sidefix data grammars are selected by typed quotation, not installed
          // as executable forms in the surrounding Code grammar.
          if (pattern.kind === "sequence") return;
          this.ruleSyntax.set(signature.name, [pattern]);
          this.structuralNames.add(signature.name);
          this.rules.set(signature.name, {
            kind: "ref",
            name: signature.name,
            key: pattern,
            resolve: () => this.compilePattern(pattern, true),
          });
        }
      }
      if (signature) syntaxGrammars.set(signature, this.clone());
    }
  }

  clone(): Grammar {
    const grammar = new Grammar("", {
      opaqueExpressions: this.opaqueExpressions,
    });
    grammar.deferBlocks = this.deferBlocks;
    grammar.ruleSyntax = new Map(this.ruleSyntax);
    grammar.structuralNames = new Set(this.structuralNames);
    grammar.keywords = new Map(this.keywords);
    for (const [name, items] of grammar.ruleSyntax)
      grammar.rules.set(
        name,
        grammar.structuralNames.has(name)
          ? {
              kind: "ref",
              name,
              key: items,
              resolve: () =>
                sequencePattern(
                  items.map((n) => grammar.compilePattern(n, true)),
                ),
            }
          : sequencePattern(items.map((n) => grammar.compilePattern(n))),
      );
    return grammar;
  }
  /** The active rule set, including scoped structural and sidefix registrations. */
  description(): Value {
    return record("Language", {
      start: valSymbol("Program"),
      rules: list(
        [...this.ruleSyntax].map(([name, pattern]) =>
          record("Rule", {
            name: valLiteral(name),
            kind: valSymbol(
              this.structuralNames.has(name) ? "Structural" : "Form",
            ),
            pattern: list(pattern.map(encodeSyntax)),
          }),
        ),
      ),
      readers: readerDescriptions(),
      blocks: blockPolicy(),
      typeGrammar: typeGrammarDescription(),
    });
  }
  /** Rebuild recognition only: macro implementations are not installed by data. */
  static fromDescription(
    value: Value,
    validate: (value: Value) => void,
  ): Grammar {
    validate(value);
    const start = unwrap(field(value, "start"));
    if (
      start.kind !== "symbol" ||
      start.name !== "Program" ||
      !equal(field(value, "readers"), readerDescriptions()) ||
      !equal(field(value, "blocks"), blockPolicy()) ||
      !equal(field(value, "typeGrammar"), typeGrammarDescription())
    )
      throw new LanguageError(
        "language description requests an unsupported host reader or block/type policy",
        undefined,
        { code: "E_LANGUAGE_DESCRIPTION", phase: "declaration" },
      );
    const grammar = new Grammar("");
    for (const rule of items(field(value, "rules"))) {
      const name = text(field(rule, "name")),
        kind = unwrap(field(rule, "kind"));
      if (
        grammar.rules.has(name) ||
        [...HOST_READERS.map(([name]) => name), "Num"].includes(name) ||
        kind.kind !== "symbol" ||
        !["Structural", "Form"].includes(kind.name)
      )
        throw new LanguageError(
          "duplicate rule or invalid rule kind: " + name,
          undefined,
          { code: "E_LANGUAGE_DESCRIPTION", phase: "declaration" },
        );
      const pattern = items(field(rule, "pattern")).map(decodeSyntax);
      if (!pattern.length)
        throw new LanguageError("empty grammar rule: " + name);
      if (kind.name === "Structural") grammar.structuralNames.add(name);
      else if (pattern.length > 1) {
        const first = pattern[0];
        if (first.kind !== "symbol" || !first.quoted)
          throw new LanguageError(
            "sidefix rule requires a quoted starting keyword: " + name,
          );
        grammar.keywords.set(first.name, [
          ...(grammar.keywords.get(first.name) ?? []),
          name,
        ]);
      }
      grammar.ruleSyntax.set(name, pattern);
      grammar.rules.set(
        name,
        sequencePattern(
          pattern.map((n) =>
            grammar.compilePattern(n, kind.name === "Structural"),
          ),
        ),
      );
    }
    return grammar;
  }
  resolve(n: Syntax): Syntax {
    return this.resolveSequence(n, new Matcher(syntaxAdapter));
  }
  private registerSidefix(signature: Extract<Syntax, { kind: "sequence" }>) {
    const first = signature.items[0];
    if (first?.kind !== "symbol" || !first.quoted)
      throw new LanguageError(
        "sidefix signature must start with a quoted keyword",
        signature.span,
      );
    const name = "User:" + first.name;
    if (this.rules.has(name))
      throw new LanguageError(
        "duplicate sidefix keyword: " + first.name,
        signature.span,
        { code: "E_SIDEFIX_KEYWORD", phase: "declaration" },
      );
    this.ruleSyntax.set(name, signature.items);
    this.rules.set(
      name,
      sequencePattern(signature.items.map((n) => this.compilePattern(n))),
    );
    this.keywords.set(first.name, [name]);
  }
  /** Start keywords and extra clause keywords from this grammar's sidefix rules. */
  layoutForms(): LayoutForms {
    const forms = emptyLayoutForms();
    for (const items of this.ruleSyntax.values()) addLayoutForm(forms, items);
    return forms;
  }
  /** Unquoted start/clause names that close an ungrouped sidefix pattern tail. */
  private formStops(): Set<string> {
    const stops = new Set<string>();
    for (const [start, clauses] of this.layoutForms()) {
      stops.add(start);
      for (const clause of clauses) stops.add(clause);
    }
    return stops;
  }
  private microSignature(n: Syntax): boolean {
    if (n.kind === "postfix") return true;
    let head: Syntax = n;
    while (head.kind === "apply") head = head.head;
    return head.kind === "symbol" && !head.quoted;
  }
  private sidefixSignature(n: Syntax): boolean {
    return (
      n.kind === "sequence" &&
      n.items[0]?.kind === "symbol" &&
      !!n.items[0].quoted
    );
  }
  /** A one-line pattern block is the same operand as the inline line. */
  private unwrapPatternOperand(n: Syntax): Syntax {
    if (n.kind === "block" && n.lines.length === 1) {
      const line = n.lines[0];
      const inner =
        line.kind === "sequence" && line.items.length === 1
          ? line.items[0]
          : line;
      // A block whose only line is `...` is vertical spread, not a bare rest.
      if (inner.kind === "symbol" && inner.name === "…") return n;
      return inner;
    }
    return n;
  }
  /**
   * Quoted-keyword sidefix tails used to be grouped as `(:assert x)`. The spaced
   * `(` after a term is now illegal, so the same sequence is the remaining items.
   * Macro signatures stop before an indented body.
   */
  private takeOpaqueSequence(
    items: Field<Syntax>[],
    pos: number,
    options: {
      attachBlock?: boolean;
      stopBeforeBlock?: boolean;
      stopBeforeBody?: boolean;
    } = {},
  ): { end: number; value: Syntax } {
    const value = items[pos]!.value;
    const block = items[pos + 1]?.value;
    if (
      options.attachBlock &&
      value.kind === "symbol" &&
      value.quoted &&
      block?.kind === "block"
    )
      return {
        end: pos + 2,
        value: {
          kind: "sequence",
          items: [value, block],
          span: value.span,
        },
      };
    if (value.kind !== "symbol" || !value.quoted)
      return { end: pos + 1, value };
    const stops = this.formStops();
    const seq: Syntax[] = [value];
    let end = pos + 1;
    while (end < items.length) {
      const n = items[end].value;
      if (
        options.stopBeforeBlock &&
        (n.kind === "block" || n.kind === "typedQuote" || n.kind === "template")
      )
        break;
      if (options.stopBeforeBody && (n.kind === "literal" || n.kind === "form"))
        break;
      // Flattened program items from later rows are the next statement, not a
      // continuation of an ungrouped `type :keyword …` / `macro :keyword …` tail.
      if (
        value.span?.line !== undefined &&
        n.span?.line !== undefined &&
        n.span.line !== value.span.line
      )
        break;
      if (n.kind === "symbol" && !n.quoted && stops.has(n.name)) break;
      seq.push(n);
      end++;
    }
    return {
      end,
      value:
        seq.length === 1
          ? seq[0]
          : { kind: "sequence", items: seq, span: value.span },
    };
  }
  parse(
    source: string,
    mode: "program" | "repl" = "program",
    sourceName = "program",
  ): Syntax {
    const root = parseSurface(source, sourceName, {
      layoutForms: this.layoutForms(),
    });
    if (root.kind !== "block") throw new LanguageError("expected program");
    return this.blockBody(root, new Matcher(syntaxAdapter), mode === "repl");
  }
  parseAs(source: string, start: string): Syntax {
    if (start === "Program") return this.parse(source);
    const root = parseSurface(source, "program", {
      layoutForms: this.layoutForms(),
    });
    if (root.kind !== "block") throw new LanguageError("expected source");
    const xs = root.lines
      .flatMap((n) => (n.kind === "sequence" ? n.items : [n]))
      .map((n) => entry(n));
    const matcher = new Matcher(syntaxAdapter);
    const m = matcher.match(this.reference(start), xs);
    return m.fields.length === 1
      ? m.fields[0].value
      : { kind: "sequence", items: m.fields.map((e) => e.value) };
  }
}
