import {
  LanguageError,
  operator,
  binary,
  fieldPattern,
  quotePatternHead,
  quoteHole,
} from "./syntax.ts";
import type { Syntax } from "./syntax.ts";
import type { Scope, Closure } from "./values.ts";
import { lexicalScopes } from "./macros.ts";

type Binders = (pattern: Syntax) => Set<string>;
/** Conservative dependency analysis, not speculative evaluation of function bodies. */
export function runtimeDependency(
  expression: Syntax,
  scope: Scope,
  binders: Binders,
  bound = new Set<string>(),
  seen = new Set<Closure>(),
): Extract<Syntax, { kind: "symbol" }> | undefined {
  const inspect = (
    n: Syntax,
    names = bound,
  ): ReturnType<typeof runtimeDependency> => {
    if (n.kind === "literal") return;
    if (n.kind === "symbol") {
      if (n.quoted || names.has(n.name)) return;
      const env = lexicalScopes.get(n) ?? scope;
      if (env.isRuntime(n.name)) return n;
      const value = env.get(n.name);
      const functions = [...env.visible(n.name)];
      if (value && "kind" in value && value.kind === "closure")
        functions.push(value);
      for (const fn of functions) {
        if (fn.kind !== "closure" || seen.has(fn)) continue;
        seen.add(fn);
        const params = new Set<string>();
        for (const pack of fn.parameters) {
          const pattern: Syntax = { kind: "pack", body: pack };
          for (const expression of patternExpressions(pattern)) {
            const dependency = runtimeDependency(
              expression,
              fn.env,
              binders,
              params,
              seen,
            );
            if (dependency) return dependency;
          }
          for (const name of binders(pattern)) params.add(name);
        }
        const dependency = runtimeDependency(
          fn.body,
          fn.env,
          binders,
          params,
          seen,
        );
        if (dependency) return dependency;
      }
      return;
    }
    if (n.kind === "quote") return;
    if (n.kind === "template") {
      if (n.reader) {
        const dependency = inspect(n.reader, names);
        if (dependency) return dependency;
      }
      for (const part of n.parts)
        if (part.kind === "hole" && !part.protection) {
          const dependency = inspect(part.value, names);
          if (dependency) return dependency;
        }
      return;
    }
    if (n.kind === "typedQuote")
      return (
        inspect(n.grammar, names) ??
        (n.interpolate ? quoteHoles(n.value, names) : undefined)
      );
    if (n.kind === "block") {
      const local = new Set(names);
      for (const line of n.lines) {
        const item =
          line.kind === "sequence" && line.items.length === 1
            ? line.items[0]
            : line;
        const binding = operator(item, "=");
        if (binding) {
          for (const expression of patternExpressions({
            kind: "pack",
            body: binding[0],
          })) {
            const dep = inspect(expression, local);
            if (dep) return dep;
          }
          for (const field of binding[1]) {
            const dep = inspect(field.value, local);
            if (dep) return dep;
          }
          for (const name of binders({ kind: "pack", body: binding[0] }))
            local.add(name);
        } else {
          const dep = inspect(item, local);
          if (dep) return dep;
        }
      }
      return;
    }
    const declaration =
      n.kind === "form" && n.name === "Definition"
        ? [
            n.captures.get("signature")?.fields[0]?.value,
            n.captures.get("body")?.fields[0]?.value,
          ]
        : n.kind === "sequence" &&
            n.items[0]?.kind === "symbol" &&
            n.items[0].name === "def" &&
            n.items.length >= 3
          ? [
              n.items[1],
              n.items.length === 3
                ? n.items[2]
                : { kind: "sequence" as const, items: n.items.slice(2) },
            ]
          : undefined;
    if (declaration?.[0] && declaration[1]) {
      const [signature, body] = declaration;
      const packs: Syntax[] = [];
      let head = signature;
      while (head.kind === "apply") {
        packs.unshift({ kind: "pack", body: head.body });
        head = head.head;
      }
      const local = new Set(names);
      if (head.kind === "symbol") local.add(head.name);
      for (const pack of packs) {
        for (const expression of patternExpressions(pack)) {
          const dependency = inspect(expression, local);
          if (dependency) return dependency;
        }
        for (const name of binders(pack)) local.add(name);
      }
      return inspect(body, local);
    }
    const arrow = operator(n, "->");
    if (arrow) {
      for (const expression of patternExpressions({
        kind: "pack",
        body: arrow[0],
      })) {
        const dep = inspect(expression, names);
        if (dep) return dep;
      }
      const local = new Set([
        ...names,
        ...binders({ kind: "pack", body: arrow[0] }),
      ]);
      for (const field of arrow[1]) {
        const dep = inspect(field.value, local);
        if (dep) return dep;
      }
      return;
    }
    const children =
      n.kind === "pack"
        ? n.body.map((e) => e.value)
        : n.kind === "sequence" || n.kind === "form"
          ? n.items
          : n.kind === "postfix"
            ? [n.operand]
            : [n.head, ...n.body.map((e) => e.value)];
    for (const child of children) {
      const dep = inspect(child, names);
      if (dep) return dep;
    }
  };
  const quoteHoles = (
    n: Syntax,
    names: Set<string>,
  ): ReturnType<typeof runtimeDependency> => {
    if (n.kind === "literal" || n.kind === "symbol") return;
    if (n.kind === "quote") return quoteHoles(n.value, names);
    if (n.kind === "typedQuote") return quoteHoles(n.value, names);
    if (n.kind === "template") {
      for (const part of n.parts)
        if (part.kind === "hole" && !part.protection) {
          const dependency = inspect(part.value, names);
          if (dependency) return dependency;
        }
      return;
    }
    const hole = quoteHole(n);
    if (hole) return hole.protection ? undefined : inspect(hole.value, names);
    const children =
      n.kind === "block"
        ? n.lines
        : n.kind === "sequence" || n.kind === "form"
          ? n.items
          : n.kind === "pack"
            ? n.body.map((e) => e.value)
            : n.kind === "postfix"
              ? [n.operand]
              : [n.head, ...n.body.map((e) => e.value)];
    for (const child of children) {
      const dep = quoteHoles(child, names);
      if (dep) return dep;
    }
  };
  return inspect(expression);
}

export function requireAvailable(
  expression: Syntax,
  scope: Scope,
  binders: Binders,
  bound?: Set<string>,
): void {
  const dependency = runtimeDependency(expression, scope, binders, bound);
  if (dependency)
    throw new LanguageError(
      "macro expansion requires a compile-time value, but " +
        dependency.name +
        " is a runtime binding",
      dependency.span,
      {
        code: "E_MACRO_RUNTIME_CAPTURE",
        phase: "declaration",
        notes: [
          "Quoted references to runtime bindings are allowed; reading their values during expansion is not.",
        ],
      },
    );
}

/** Defaults and annotations execute outside the newly captured parameter names. */
export function requirePatternAvailable(
  signature: Syntax,
  scope: Scope,
  binders: Binders,
): void {
  for (const expression of patternExpressions(signature))
    requireAvailable(expression, scope, binders);
}

/** Computations evaluated by a binding pattern, outside its new capture scope. */
export function patternExpressions(signature: Syntax): Syntax[] {
  const expressions: Syntax[] = [];
  const visit = (n: Syntax): void => {
    const annotation = binary(n, "::");
    if (annotation) {
      expressions.push(annotation[1]);
      visit(annotation[0]);
      return;
    }
    if (n.kind === "quote") {
      visit(quotePatternHead(n.value));
      return;
    }
    if (n.kind === "sequence") {
      n.items.forEach(visit);
      return;
    }
    if (n.kind === "postfix") {
      visit(n.operand);
      return;
    }
    if (n.kind === "apply" || n.kind === "pack") {
      if (n.kind !== "pack" && n.head.kind !== "symbol") visit(n.head);
      for (const field of n.body) {
        const { pattern, fallback } = fieldPattern(field.value);
        if (fallback) expressions.push(fallback);
        visit(pattern);
      }
    }
  };
  visit(signature);
  return expressions;
}
