import {
  binary,
  operator,
  isTypeCapture,
  fieldPattern,
  spread,
  apply,
  packOf,
  symbol,
  LanguageError,
  quoteHole,
} from "./syntax.ts";
import type { Syntax, Field, TextPart } from "./syntax.ts";
import { unwrap, textValue } from "./values.ts";
import type { Value, Scope } from "./values.ts";
import { bindingPattern } from "./pattern-compiler.ts";
import { patternBindings } from "./pattern-captures.ts";
import { syntaxData, dataSyntax, literalSyntax } from "./syntax-values.ts";
export { syntaxData, dataSyntax } from "./syntax-values.ts";

export const lexicalScopes = new WeakMap<object, Scope>();
export function hasLexicalOrigins(n: Syntax): boolean {
  if (lexicalScopes.has(n)) return true;
  // Recognized forms retain grammar-dependent capture metadata, not portable source.
  if (n.kind === "form") return true;
  if (n.kind === "apply")
    return (
      hasLexicalOrigins(n.head) ||
      n.body.some((f) => hasLexicalOrigins(f.value))
    );
  if (n.kind === "postfix") return hasLexicalOrigins(n.operand);
  if (n.kind === "pack") return n.body.some((f) => hasLexicalOrigins(f.value));
  if (n.kind === "template")
    return (
      !!(n.reader && hasLexicalOrigins(n.reader)) ||
      n.parts.some(
        (part) => part.kind === "hole" && hasLexicalOrigins(part.value),
      )
    );
  if (n.kind === "quote") return hasLexicalOrigins(n.value);
  if (n.kind === "typedQuote")
    return hasLexicalOrigins(n.grammar) || hasLexicalOrigins(n.value);
  if (n.kind === "sequence") return n.items.some(hasLexicalOrigins);
  if (n.kind === "block") return n.lines.some(hasLexicalOrigins);
  return false;
}
let serial = 0;

/** Rename template binders; inserted trees keep their original names and scopes. */
export function quote(
  n: Syntax,
  scope: Scope,
  evaluate: (n: Syntax) => Value,
  hygienic = false,
  transformInsertion?: (value: Value) => Value,
  interpolate = false,
): Value {
  if (!interpolate && !hygienic) return syntaxData(n);
  const insertions = new Map<Syntax, Value>();
  const prefix = "\0macro" + ++serial + "Local";
  let counter = 0;
  const fresh = () => prefix + ++counter;
  const insert = (value: Value): Syntax => {
    value = transformInsertion ? transformInsertion(value) : value;
    const tree = dataSyntax(value);
    insertions.set(tree, value);
    return tree;
  };
  const unquote = (x: Syntax) => {
    const hole = interpolate && quoteHole(x);
    return hole && hole.protection === 0 ? hole.value : undefined;
  };
  function pattern(input: Syntax, names: Map<string, string>): Syntax {
    // Binding decisions come from the same compiler used by matching. Inserted
    // syntax keeps its caller's names, so interpolation is opaque to this pass.
    const outer = new Map(names);
    const bindings = patternBindings(
      bindingPattern(
        [input],
        false,
        new Set(),
        (x) => interpolate && !!quoteHole(x),
      ),
    );
    const sites = new WeakMap<Syntax, { name: string; implicit: boolean }>();
    for (const [name, captures] of bindings) {
      const renamed = isTypeCapture(name)
        ? "\0macroType" + serial + "Local" + ++counter
        : fresh();
      names.set(name, renamed);
      for (const capture of captures)
        if (capture.origin)
          sites.set(capture.origin.syntax, {
            name: renamed,
            implicit: capture.origin.implicit,
          });
    }
    function fields(xs: Field<Syntax>[]): Field<Syntax>[] {
      return xs.map((e) => {
        const { pattern: base, fallback } = fieldPattern(e.value);
        let value = rewrite(base);
        if (fallback)
          value = apply(
            apply(symbol("="), packOf(value)),
            packOf(walk(fallback, outer)),
          );
        return { ...e, value };
      });
    }
    function rewrite(x: Syntax, head = false): Syntax {
      if (interpolate && quoteHole(x)) return walk(x, names);
      const capture = sites.get(x);
      if (capture) {
        if (capture.implicit)
          return {
            ...apply(
              apply(symbol("::"), packOf(symbol(capture.name))),
              packOf(walk(x, outer)),
            ),
            span: x.span,
          };
        if (x.kind === "symbol") return { ...x, name: capture.name };
      }
      if (x.kind === "quote") return { ...x, value: rewrite(x.value, true) };
      const annotation = !head && binary(x, "::");
      if (annotation && x.kind === "apply" && x.head.kind === "apply")
        return {
          ...x,
          head: {
            ...x.head,
            body: x.head.body.map((e) => ({ ...e, value: rewrite(e.value) })),
          },
          body: x.body.map((e) => ({ ...e, value: walk(e.value, outer) })),
        };
      if (x.kind === "apply")
        return { ...x, head: rewrite(x.head, true), body: fields(x.body) };
      if (x.kind === "postfix")
        return { ...x, operand: rewrite(x.operand) };
      if (x.kind === "pack") return { ...x, body: fields(x.body) };
      if (x.kind === "sequence")
        return { ...x, items: x.items.map((e) => rewrite(e)) };
      // Symbolic constructor heads are literals, never lexical variable uses.
      return head && x.kind === "symbol" ? x : walk(x, outer);
    }
    return rewrite(input);
  }
  function patternFields(
    xs: Field<Syntax>[],
    names: Map<string, string>,
  ): Field<Syntax>[] {
    const result = pattern({ kind: "pack", body: xs }, names);
    if (result.kind !== "pack")
      throw new Error("expected rewritten pattern pack");
    return result.body;
  }
  function bodyFields(
    xs: Field<Syntax>[],
    names: Map<string, string>,
  ): Field<Syntax>[] {
    const out: Field<Syntax>[] = [];
    let pos = 0;
    for (const e of xs) {
      const rest = spread(e.value),
        direct = unquote(e.value);
      const insertion = (rest && unquote(rest)) ?? (direct && spread(direct));
      if (insertion) {
        const values = unwrap(evaluate(insertion));
        if (values.kind !== "term" && values.kind !== "pack")
          throw new LanguageError(
            "quoted spread requires an argument body",
            e.value.span,
            { code: "E_QUOTE_SPREAD", phase: "expand" },
          );
        for (const item of values.body)
          out.push({
            ...item,
            label: /^_\d+$/.test(item.label) ? "_" + ++pos : item.label,
            value: insert(item.value),
          });
      } else
        out.push({
          ...e,
          label: /^_\d+$/.test(e.label) ? "_" + ++pos : e.label,
          value: walk(e.value, names),
        });
    }
    const labels = new Set<string>();
    let named = false;
    for (const e of out) {
      const positional = /^_\d+$/.test(e.label);
      if (positional && named)
        throw new LanguageError(
          "positional arguments must precede named arguments",
          e.value.span,
        );
      named ||= !positional;
      if (labels.has(e.label))
        throw new LanguageError(
          "duplicate argument label: " + e.label,
          e.value.span,
          { code: "E_DUPLICATE_LABEL", phase: "expand" },
        );
      labels.add(e.label);
    }
    return out;
  }
  // Deferred holes retain references to generated binders without evaluating them.
  function renameOnly(x: Syntax, names: Map<string, string>): Syntax {
    if (x.kind === "symbol") {
      const result = {
        ...x,
        name: !x.quoted ? (names.get(x.name) ?? x.name) : x.name,
      };
      if (hygienic && !x.quoted && !names.has(x.name))
        lexicalScopes.set(result, scope);
      return result;
    }
    if (x.kind === "literal") return x;
    if (x.kind === "quote") return x;
    if (x.kind === "typedQuote")
      return {
        ...x,
        grammar: renameOnly(x.grammar, names),
        value: renameOnly(x.value, names),
      };
    if (x.kind === "template")
      return {
        ...x,
        reader: x.reader && renameOnly(x.reader, names),
        parts: x.parts.map((p) =>
          p.kind === "text" ? p : { ...p, value: renameOnly(p.value, names) },
        ),
      };
    if (x.kind === "apply")
      return {
        ...x,
        head: renameOnly(x.head, names),
        body: x.body.map((f) => ({ ...f, value: renameOnly(f.value, names) })),
      };
    if (x.kind === "postfix")
      return { ...x, operand: renameOnly(x.operand, names) };
    if (x.kind === "pack")
      return {
        ...x,
        body: x.body.map((f) => ({ ...f, value: renameOnly(f.value, names) })),
      };
    if (x.kind === "block")
      return { ...x, lines: x.lines.map((n) => renameOnly(n, names)) };
    return { ...x, items: x.items.map((n) => renameOnly(n, names)) };
  }
  function declaration(
    signature: Syntax,
    body: Syntax,
    names: Map<string, string>,
  ): [Syntax, Syntax] {
    const local = new Map(names);
    let head = signature;
    const packs: Syntax[] = [];
    while (head.kind === "apply") {
      packs.unshift({ kind: "pack", body: head.body });
      head = head.head;
    }
    // Validate the entire signature before alpha-renaming can conceal duplicate
    // source names occurring in different packs.
    bindingPattern(
      packs,
      false,
      new Set(),
      (x) => interpolate && !!quoteHole(x),
    );
    if (head.kind === "sequence") head = head.items[0];
    if (head.kind === "symbol") {
      names.set(head.name, head.name);
      local.set(head.name, head.name);
    }
    const signaturePattern = (n: Syntax): Syntax => {
      if (n.kind === "apply")
        return {
          ...n,
          head: signaturePattern(n.head),
          body: patternFields(n.body, local),
        };
      if (n.kind === "postfix")
        return { ...n, operand: signaturePattern(n.operand) };
      if (n.kind === "sequence") return pattern(n, local);
      return walk(n, local);
    };
    const result = signaturePattern(signature);
    return [result, walk(body, local)];
  }
  /** Nested raw colon data is opaque to lexical renaming, but explicit outer
   * interpolation still visits its holes as specified by the quotation stages. */
  function rawData(x: Syntax, names: Map<string, string>): Syntax {
    if (interpolate && quoteHole(x)) return walk(x, names);
    if (x.kind === "quote") return { ...x, value: rawData(x.value, names) };
    if (x.kind === "apply")
      return {
        ...x,
        head: rawData(x.head, names),
        body: x.body.map((f) => ({ ...f, value: rawData(f.value, names) })),
      };
    if (x.kind === "postfix")
      return { ...x, operand: rawData(x.operand, names) };
    if (x.kind === "pack")
      return {
        ...x,
        body: x.body.map((f) => ({ ...f, value: rawData(f.value, names) })),
      };
    if (x.kind === "block")
      return { ...x, lines: x.lines.map((n) => rawData(n, names)) };
    if (x.kind === "sequence")
      return { ...x, items: x.items.map((n) => rawData(n, names)) };
    if (x.kind === "typedQuote" || x.kind === "template")
      return walk(x, new Map());
    return x;
  }
  function walk(x: Syntax, names: Map<string, string>): Syntax {
    const inserted = unquote(x);
    if (inserted) return insert(evaluate(inserted));
    const protectedHole = interpolate && quoteHole(x);
    if (
      protectedHole &&
      protectedHole.protection > 0 &&
      x.kind === "apply" &&
      x.head.kind === "symbol"
    ) {
      if (protectedHole.protection > 32)
        throw new LanguageError("quote protection depth exceeds 32", x.span, {
          code: "E_QUOTE_STAGE_LIMIT",
        });
      return {
        ...x,
        head: { ...x.head, name: x.head.name.slice(1) },
        body: x.body.map((f) => ({ ...f, value: renameOnly(f.value, names) })),
      };
    }
    if (x.kind === "quote") return { ...x, value: rawData(x.value, names) };
    if (x.kind === "typedQuote")
      return {
        ...x,
        grammar: renameOnly(x.grammar, names),
        value: walk(x.value, names),
      };
    if (x.kind === "template") {
      const parts: TextPart[] = [];
      const text = (value: string) => {
        const previous = parts.at(-1);
        if (previous?.kind === "text") previous.value += value;
        else if (value) parts.push({ kind: "text", value });
      };
      for (const part of x.parts) {
        if (part.kind === "text") text(part.value);
        else if (!interpolate)
          parts.push({ ...part, value: renameOnly(part.value, names) });
        else if (part.protection)
          parts.push({
            ...part,
            protection: part.protection - 1,
            spelling: part.protection > 1 ? part.spelling?.slice(1) : undefined,
            value: renameOnly(part.value, names),
          });
        else if (x.reader)
          parts.push({
            kind: "hole",
            value: literalSyntax(evaluate(part.value)),
            protection: 0,
          });
        else text(textValue(evaluate(part.value)));
      }
      if (!x.reader && !parts.some((p) => p.kind === "hole"))
        return {
          kind: "literal",
          value: parts.map((p) => (p.kind === "text" ? p.value : "")).join(""),
          span: x.span,
        };
      return {
        ...x,
        reader: x.reader && renameOnly(x.reader, names),
        parts: parts.length ? parts : [{ kind: "text", value: "" }],
      };
    }
    if (
      hygienic &&
      x.kind === "sequence" &&
      x.items.length >= 3 &&
      x.items[0].kind === "symbol" &&
      ["def", "macro"].includes(x.items[0].name)
    ) {
      let sigEnd = 2;
      if (
        x.items[0].name === "macro" &&
        x.items[1]?.kind === "symbol" &&
        x.items[1].quoted
      ) {
        while (sigEnd < x.items.length) {
          const n = x.items[sigEnd]!;
          if (
            n.kind === "block" ||
            n.kind === "typedQuote" ||
            n.kind === "template" ||
            n.kind === "literal" ||
            n.kind === "form"
          )
            break;
          sigEnd++;
        }
      }
      const signature: Syntax =
        sigEnd === 2
          ? x.items[1]!
          : {
              kind: "sequence",
              items: x.items.slice(1, sigEnd),
              span: x.items[1]?.span,
            };
      const rest = x.items.slice(sigEnd);
      const body: Syntax =
        rest.length === 1
          ? rest[0]!
          : { kind: "sequence", items: rest, span: rest[0]?.span };
      const [rewrittenSignature, rewritten] = declaration(
        signature,
        body,
        names,
      );
      return {
        ...x,
        items: [
          x.items[0],
          rewrittenSignature,
          ...(rewritten.kind === "sequence" ? rewritten.items : [rewritten]),
        ],
      };
    }
    if (x.kind === "symbol") {
      const result = {
        ...x,
        name: !x.quoted ? (names.get(x.name) ?? x.name) : x.name,
      };
      if (hygienic && !x.quoted && !names.has(x.name))
        lexicalScopes.set(result, scope);
      return result;
    }
    if (x.kind === "literal") return { ...x };
    const arrow = operator(x, "->");
    if (hygienic && arrow && x.kind === "apply" && x.head.kind === "apply") {
      const local = new Map(names),
        params = patternFields(arrow[0], local);
      return {
        ...x,
        head: { ...x.head, body: params },
        body: arrow[1].map((e) => ({ ...e, value: walk(e.value, local) })),
      };
    }
    if (hygienic && x.kind === "block") {
      const local = new Map(names);
      return {
        ...x,
        lines: x.lines.map((line) => {
          const one =
            line.kind === "sequence" && line.items.length === 1
              ? line.items[0]
              : line;
          const binding = operator(one, "=");
          if (binding && one.kind === "apply" && one.head.kind === "apply") {
            const body = binding[1].map((e) => ({
              ...e,
              value: walk(e.value, local),
            }));
            const params = patternFields(binding[0], local);
            return { ...one, head: { ...one.head, body: params }, body };
          }
          return walk(line, local);
        }),
      };
    }
    if (x.kind === "apply")
      return {
        ...x,
        head: walk(x.head, names),
        body: bodyFields(x.body, names),
      };
    if (x.kind === "postfix")
      return { ...x, operand: walk(x.operand, names) };
    if (x.kind === "block")
      return { ...x, lines: x.lines.map((e) => walk(e, names)) };
    if (x.kind === "pack") return { ...x, body: bodyFields(x.body, names) };
    if (x.kind === "sequence")
      return { ...x, items: x.items.map((e) => walk(e, names)) };
    return {
      ...x,
      items: x.items.map((e) => walk(e, names)),
      captures: new Map(
        [...x.captures].map(([key, xs]) => [
          key,
          {
            ...xs,
            fields: xs.fields.map((e) => ({
              ...e,
              value: walk(e.value, names),
            })),
          },
        ]),
      ),
    };
  }
  return syntaxData(walk(n, new Map()), insertions);
}
