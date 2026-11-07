import { LanguageError, normal, syntaxKey } from "./syntax.ts";
import { parseSurface } from "./parser.ts";
import type { Syntax } from "./syntax.ts";
import {
  valSymbol,
  valLiteral,
  unwrap,
  syntaxOrigins,
  concreteSpace,
} from "./values.ts";
import type { Value } from "./values.ts";
import { typeData } from "./type-data.ts";
import { primitiveNames } from "./primitive-names.ts";

/** Remove only the program reader's outer wrapper, never a quoted block itself. */
export function readCode(source: string): Syntax {
  let tree = parseSurface(source, "serialized code");
  if (tree.kind === "block" && tree.lines.length === 1) {
    tree = tree.lines[0];
    if (tree.kind === "sequence" && tree.items.length === 1)
      tree = tree.items[0];
  }
  return tree;
}

export function codeSource(tree: Syntax): string {
  const text = normal(tree);
  try {
    if (syntaxKey(readCode(text)) === syntaxKey(tree)) return text;
  } catch (error) {
    if (!(error instanceof LanguageError)) throw error;
  }
  throw new LanguageError(
    "this Code tree needs its structural syntax view before serialization",
    tree.span,
    { code: "E_VALUE_SERIALIZATION" },
  );
}

/** Structural syntax/data adapters shared by quotation, inspection and text. */
export function syntaxData(n: Syntax, insertions?: Map<Syntax, Value>): Value {
  const inserted = insertions?.get(n);
  if (inserted) return inserted;
  const child = (node: Syntax) => syntaxData(node, insertions);
  let result: Value;
  switch (n.kind) {
    case "typedQuote":
      // Raw quotation retains its compatibility representation until Code has
      // a public tree grammar. The syntax origin retains the typed-quote node.
      result = {
        kind: "term",
        head: child(n.grammar),
        body: [
          {
            label: "_1",
            value: child({ kind: "quote", value: n.value, span: n.span }),
          },
          {
            label: "interpolate",
            value: valSymbol(n.interpolate ? "True" : "False"),
          },
        ],
      };
      break;
    case "template":
      result = {
        kind: "term",
        head: valSymbol("syntaxTemplate"),
        body: [
          ...n.parts.map((part, i) => ({
            label: "_" + (i + 1),
            value:
              part.kind === "text"
                ? {
                    kind: "term" as const,
                    head: valSymbol("Text"),
                    body: [{ label: "_1", value: valLiteral(part.value) }],
                  }
                : {
                    kind: "term" as const,
                    head: valSymbol("Hole"),
                    body: [
                      { label: "_1", value: child(part.value) },
                      { label: "_2", value: valLiteral(part.protection) },
                      { label: "_3", value: valLiteral(part.spelling ?? "") },
                    ],
                  },
          })),
          ...(n.reader ? [{ label: "reader", value: child(n.reader) }] : []),
        ],
      };
      break;
    case "literal":
      result = valLiteral(n.value);
      break;
    case "symbol":
      result = valSymbol(n.name);
      break;
    case "apply":
      result = {
        kind: "term",
        head: child(n.head),
        body: n.body.map((e) => ({ ...e, value: child(e.value) })),
      };
      break;
    case "pack":
      result = {
        kind: "pack",
        body: n.body.map((e) => ({ ...e, value: child(e.value) })),
      };
      break;
    default: {
      const children =
        n.kind === "quote" ? [n.value] : n.kind === "block" ? n.lines : n.items;
      result = {
        kind: "term",
        head: valSymbol("syntax" + n.kind[0].toUpperCase() + n.kind.slice(1)),
        body: children.map((value, i) => ({
          label: "_" + (i + 1),
          value: child(value),
        })),
      };
    }
  }
  syntaxOrigins.set(result, n);
  return result;
}
export function dataSyntax(value: Value): Syntax {
  const v = unwrap(value),
    original = syntaxOrigins.get(v);
  if (v.kind === "code") return v.tree;
  if (original) return original;
  if (v.kind === "type") return dataSyntax(typeData(v));
  if (v.kind === "symbol")
    return { kind: "symbol", name: v.name, quoted: false };
  if (v.kind === "literal") return { kind: "literal", value: v.value };
  if (v.kind === "term")
    return {
      kind: "apply",
      head: dataSyntax(v.head),
      body: v.body.map((e) => ({ ...e, value: dataSyntax(e.value) })),
    };
  if (v.kind === "pack")
    return {
      kind: "pack",
      body: v.body.map((e) => ({ ...e, value: dataSyntax(e.value) })),
    };
  throw new LanguageError(
    "cannot insert a function value into quoted syntax",
    undefined,
    { code: "E_UNQUOTE_VALUE", phase: "expand" },
  );
}

/** Embed a value as inert source structure, preserving concrete interpretations.
 * This is structural construction, never a stringify/reparse or code execution.
 */
export function literalSyntax(value: Value): Syntax {
  const raw = unwrap(value),
    space = concreteSpace(value);
  const pack = (node: Syntax) => [{ label: "_1", value: node }];
  const quoted = (node: Syntax): Syntax => ({ kind: "quote", value: node });
  let expression: Syntax;
  if (raw.kind === "literal")
    expression =
      typeof raw.value === "number" && raw.value < 0
        ? {
            kind: "apply",
            head: { kind: "symbol", name: "negate", quoted: false },
            body: pack({ kind: "literal", value: -raw.value }),
          }
        : { kind: "literal", value: raw.value };
  else if (raw.kind === "symbol")
    expression = { kind: "symbol", name: raw.name, quoted: true };
  else if (raw.kind === "type") expression = quoted(dataSyntax(typeData(raw)));
  else if (raw.kind === "code") expression = quoted(raw.tree);
  else if (raw.kind === "pack") {
    if (raw.body.some((field) => concreteSpace(field.value)))
      throw new LanguageError(
        "a typed raw-pack constant needs a portable pack representation",
        undefined,
        { code: "E_UNQUOTE_VALUE" },
      );
    expression = quoted(dataSyntax(raw));
  } else if (raw.kind === "term") {
    const body = raw.body.map((field) => ({
      ...field,
      value: literalSyntax(field.value),
    }));
    const head = unwrap(raw.head);
    expression =
      head.kind === "symbol" || head.kind === "term"
        ? { kind: "apply", head: literalSyntax(raw.head), body }
        : {
            kind: "apply",
            head: { kind: "symbol", name: "Node", quoted: false },
            body: [
              { label: "_1", value: literalSyntax(raw.head) },
              {
                label: "_2",
                value: {
                  kind: "apply",
                  head: { kind: "symbol", name: "{}", quoted: false },
                  body,
                },
              },
            ],
          };
  } else
    throw new LanguageError(
      "this value needs a portable constant representation before insertion",
      undefined,
      { code: "E_UNQUOTE_VALUE" },
    );
  if (!space) return expression;
  const description = typeData(space);
  const type =
    description.kind === "symbol" && primitiveNames.has(description.name)
      ? { kind: "symbol" as const, name: description.name, quoted: false }
      : {
          kind: "apply" as const,
          head: { kind: "symbol" as const, name: "Type", quoted: false },
          body: pack(quoted(dataSyntax(description))),
        };
  return {
    kind: "apply",
    head: {
      kind: "apply",
      head: { kind: "symbol", name: "::", quoted: false },
      body: pack(expression),
    },
    body: pack(type),
  };
}
