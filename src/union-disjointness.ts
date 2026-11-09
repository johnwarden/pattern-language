import type { Pattern } from "./pattern.ts";
import type { Value, TypeValue } from "./values.ts";
import { unwrap, equal, asRational } from "./values.ts";
import { LanguageError } from "./syntax.ts";
import { symbolCategory } from "./lexical.ts";

type P = Pattern<Value>;
type Answer = "yes" | "no" | "unknown";
const every = (answers: Answer[]): Answer =>
  answers.includes("no")
    ? "no"
    : answers.includes("unknown")
      ? "unknown"
      : "yes";
const some = (answers: Answer[]): Answer =>
  answers.includes("yes")
    ? "yes"
    : answers.includes("unknown")
      ? "unknown"
      : "no";
const numeric = new Set([
  "int64",
  "float32",
  "float64",
  "rational",
  "Int",
  "Int64",
  "Float",
  "Float32",
  "Float64",
  "Number",
  "Num",
  "Rational",
]);
const symbols = new Set([
  "Symbol",
  "LowerCamelSymbol",
  "UpperCamelSymbol",
  "UpperSnakeSymbol",
  "PunctuationSymbol",
  "Bool",
]);
const id = (p: Extract<P, { kind: "test" }>): unknown[] | undefined =>
  Array.isArray(p.identity) ? p.identity : undefined;
/** Conservative, bounded proof over structural patterns. Unknown is never disjoint.
 * It never calls a user predicate, default, constructor or reader.
 * General UnionType no longer requires disjoint syntax (D07). C14 unambiguous
 * certification may still consult this proof; do not treat it as membership policy. */
export function patternOverlap(left: P, right: P): Answer {
  let work = 0,
    depth = 0;
  const active = new Map<unknown, Set<unknown>>();
  function primitiveAccept(name: string, raw: Value): boolean | undefined {
    const value = unwrap(raw);
    if (name === "Any" || name === "Expression" || name === "Body") return true;
    if (numeric.has(name)) {
      const r = asRational(value);
      if (!r) return false;
      if (name === "int64")
        return (
          r.d === 1n &&
          r.n >= BigInt(Number.MIN_SAFE_INTEGER) &&
          r.n <= BigInt(Number.MAX_SAFE_INTEGER)
        );
      return true;
    }
    if (name === "String")
      return value.kind === "literal" && typeof value.value === "string";
    if (name === "Bool")
      return value.kind === "symbol" && ["True", "False"].includes(value.name);
    if (name === "Symbol") return value.kind === "symbol";
    if (name.endsWith("Symbol"))
      return value.kind === "symbol" && symbolCategory(value.name) === name;
    return;
  }
  function tests(
    a: Extract<P, { kind: "test" }>,
    b: Extract<P, { kind: "test" }>,
  ): Answer {
    const x = id(a),
      y = id(b);
    if (!x || !y) return "unknown";
    if (x[0] === "literal" && y[0] === "literal")
      return equal(x[1] as Value, y[1] as Value) ? "yes" : "no";
    if (x[0] === "literal" && y[0] === "primitive") {
      const result = primitiveAccept(String(y[1]), x[1] as Value);
      return result === undefined ? "unknown" : result ? "yes" : "no";
    }
    if (y[0] === "literal") return tests(b, a);
    if (x[0] !== "primitive" || y[0] !== "primitive") return "unknown";
    const n = String(x[1]),
      m = String(y[1]);
    if (
      n === m ||
      [n, m].some((t) => ["Any", "Expression", "Body"].includes(t))
    )
      return "yes";
    if (numeric.has(n) && numeric.has(m)) return "yes";
    if (symbols.has(n) && symbols.has(m)) {
      if (n === "Symbol" || m === "Symbol") return "yes";
      if (n === "Bool" || m === "Bool")
        return [n, m].includes("UpperCamelSymbol") ? "yes" : "no";
      return "no";
    }
    if (
      (numeric.has(n) || n === "String" || symbols.has(n)) &&
      (numeric.has(m) || m === "String" || symbols.has(m))
    )
      return "no";
    return "unknown";
  }
  function peel(p: P): P {
    while (p.kind === "capture" || p.kind === "label" || p.kind === "map")
      p = p.pattern;
    return p;
  }
  function fields(
    a: Extract<P, { kind: "fields" }>,
    b: Extract<P, { kind: "fields" }>,
  ): Answer {
    const shape = (p: typeof a) => {
      const fixed = new Map<string, P>();
      let repeat: P | undefined;
      for (let part of p.parts) {
        part = peelCapture(part);
        if (part.kind === "repeat") repeat = peel(part.pattern);
        else if (part.kind === "label") fixed.set(part.label, part.pattern);
        else return;
      }
      return { fixed, repeat };
    };
    const x = shape(a),
      y = shape(b);
    if (!x || !y) return "unknown";
    const answers: Answer[] = [];
    for (const label of new Set([...x.fixed.keys(), ...y.fixed.keys()])) {
      const positional = /^_\d+$/.test(label),
        l = x.fixed.get(label),
        r = y.fixed.get(label);
      if (l && r) answers.push(go(l, r));
      else {
        const other = l ? y : x,
          source = l ?? r!;
        const open = positional
          ? (l ? b : a).ignorePositions
          : (l ? b : a).openLabels;
        if (positional && other.repeat) answers.push(go(source, other.repeat));
        else if (!open) return "no";
      }
    }
    // Both repeats may be empty; their element types need not overlap.
    return every(answers);
  }
  function peelCapture(p: P): P {
    while (p.kind === "capture" || p.kind === "map") p = p.pattern;
    return p;
  }
  function go(a: P, b: P): Answer {
    if (++work > 10000 || depth >= 128) return "unknown";
    depth++;
    try {
      return compare(a, b);
    } finally {
      depth--;
    }
  }
  function compare(a: P, b: P): Answer {
    a = peel(a);
    b = peel(b);
    const ka = a.kind === "ref" ? a.key : a,
      kb = b.kind === "ref" ? b.key : b;
    if (active.get(ka)?.has(kb)) return "unknown";
    let set = active.get(ka);
    if (!set) active.set(ka, (set = new Set()));
    set.add(kb);
    try {
      if (a.kind === "ref") return go(a.resolve(), b);
      if (b.kind === "ref") return go(a, b.resolve());
      if (a.kind === "union") return some(a.choices.map((p) => go(p, b)));
      if (b.kind === "union") return some(b.choices.map((p) => go(a, p)));
      if (a.kind === "any" || b.kind === "any") return "yes";
      if (a.kind === "test" && b.kind === "test") return tests(a, b);
      if (a.kind === "node" && b.kind === "node")
        return every([go(a.head, b.head), go(a.body, b.body)]);
      if (a.kind === "postfix" && b.kind === "postfix")
        return every([go(a.operator, b.operator), go(a.operand, b.operand)]);
      if (a.kind === "postfix" || b.kind === "postfix") return "no";
      if (a.kind === "fields" && b.kind === "fields") return fields(a, b);
      if (a.kind === "node" && b.kind === "test") return nodeTest(b);
      if (b.kind === "node" && a.kind === "test") return nodeTest(a);
      return "unknown";
    } finally {
      set.delete(kb);
      if (!set.size) active.delete(ka);
    }
  }
  function nodeTest(p: Extract<P, { kind: "test" }>): Answer {
    const i = id(p);
    if (!i) return "unknown";
    if (i[0] === "literal")
      return unwrap(i[1] as Value).kind === "term" ? "unknown" : "no";
    if (
      i[0] === "primitive" &&
      (numeric.has(String(i[1])) ||
        symbols.has(String(i[1])) ||
        i[1] === "String")
    )
      return "no";
    return "unknown";
  }
  return go(left, right);
}
export function requireDisjointUnion(members: TypeValue[]): void {
  for (let i = 0; i < members.length; i++)
    for (let j = 0; j < i; j++) {
      const result = patternOverlap(members[i].pattern(), members[j].pattern());
      if (result !== "no")
        throw new LanguageError(
          result === "yes"
            ? "UnionType members have overlapping syntax: " +
                members[j].name +
                " and " +
                members[i].name
            : "cannot establish disjoint syntax for UnionType members: " +
                members[j].name +
                " and " +
                members[i].name,
          undefined,
          {
            code:
              result === "yes" ? "E_AMBIGUOUS_UNION" : "E_UNION_DISJOINTNESS",
            phase: "declaration",
            notes: [
              "Each unannotated value must select exactly one concrete member. Facet/Any positions still require concrete metadata.",
            ],
          },
        );
    }
}
