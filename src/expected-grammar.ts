import { binary, operator } from "./syntax.ts";
import type { Field, Syntax } from "./syntax.ts";
import type { Pattern } from "./pattern.ts";
import { valSymbol } from "./values.ts";
import type { TypeValue, Value } from "./values.ts";

export type SequenceGrammarPart =
  | { kind: "keyword"; name: string }
  | { kind: "field" };

const peel = (pattern: Pattern<Value>): Pattern<Value> => {
  for (let i = 0; i < 8; i++) {
    if (pattern.kind === "ref") pattern = pattern.resolve();
    else if (pattern.kind === "map" || pattern.kind === "label")
      pattern = pattern.pattern;
    else break;
  }
  return pattern;
};

const literalName = (pattern: Pattern<Value>): string | undefined => {
  if (pattern.kind !== "test" || !Array.isArray(pattern.identity)) return;
  if (pattern.identity[0] !== "literal") return;
  const value = pattern.identity[1] as Value | undefined;
  return value && value.kind === "symbol" ? value.name : undefined;
};

const isStringPrimitive = (pattern: Pattern<Value>): boolean => {
  const inner = peel(pattern);
  return (
    inner.kind === "test" &&
    Array.isArray(inner.identity) &&
    inner.identity[0] === "primitive" &&
    inner.identity[1] === "String"
  );
};

/** Single-line sidefix grammars whose field positions are concrete String. */
export function sequenceGrammarParts(
  type: TypeValue,
): SequenceGrammarPart[] | undefined {
  const root = peel(type.pattern());
  if (root.kind !== "node" || literalName(peel(root.head)) !== "syntaxSequence")
    return;
  const body = peel(root.body);
  const fields =
    body.kind === "fields" || body.kind === "sequence" ? body.parts : undefined;
  if (!fields?.length) return;
  const parts: SequenceGrammarPart[] = [];
  let keywords = 0,
    stringFields = 0;
  for (const field of fields) {
    const inner = peel(field);
    const name = literalName(inner);
    if (name && name !== "syntaxSequence") {
      parts.push({ kind: "keyword", name });
      keywords++;
      continue;
    }
    if (!isStringPrimitive(inner)) return;
    parts.push({ kind: "field" });
    stringFields++;
  }
  return keywords && stringFields ? parts : undefined;
}

export function annotatedPatternTypes(pattern: Field<Syntax>[]): Syntax[] {
  return pattern.flatMap((field) => {
    const annotation = binary(field.value, "::");
    return annotation ? [annotation[1]] : [];
  });
}

/** Group `pattern = first rest...` into one assignment whose RHS is the rest sequence. */
export function regroupAssignmentLine(items: Syntax[]): Syntax | undefined {
  if (items.length < 2) return;
  const first = items[0];
  const assignment = operator(first, "=");
  if (!assignment || assignment[1].length !== 1 || first.kind !== "apply")
    return;
  return {
    ...first,
    body: [
      {
        label: "_1",
        value: {
          kind: "sequence" as const,
          items: [assignment[1][0].value, ...items.slice(1)],
          span: first.span,
        },
      },
    ],
  };
}

/** Evaluate String fields; keywords stay source names. Holes are ordinary `$` calls. */
export function elaborateSequenceGrammar(
  tree: Syntax,
  parts: SequenceGrammarPart[],
  evaluate: (n: Syntax) => Value,
): Value | undefined {
  if (tree.kind !== "sequence" || tree.items.length !== parts.length) return;
  const body: Field<Value>[] = [];
  for (let i = 0; i < parts.length; i++) {
    const item = tree.items[i],
      part = parts[i];
    if (part.kind === "keyword") {
      if (item.kind !== "symbol" || item.quoted || item.name !== part.name)
        return;
      body.push({ label: "_" + (i + 1), value: valSymbol(item.name) });
    } else body.push({ label: "_" + (i + 1), value: evaluate(item) });
  }
  return { kind: "term", head: valSymbol("syntaxSequence"), body };
}
