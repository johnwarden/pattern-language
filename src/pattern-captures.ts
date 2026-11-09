import type { Pattern } from "./pattern.ts";
import { LanguageError, positional } from "./syntax.ts";

export function orderedParts<T>(parts: Pattern<T>[]): Pattern<T>[] {
  return [...parts].sort((a, b) =>
    a.kind === "label" &&
    b.kind === "label" &&
    !positional(a.label) &&
    !positional(b.label)
      ? a.label < b.label
        ? -1
        : a.label > b.label
          ? 1
          : 0
      : 0,
  );
}

export function duplicateCapture(name: string): never {
  throw new LanguageError("duplicate capture name: " + name, undefined, {
    code: "E_DUPLICATE_CAPTURE",
    phase: "declaration",
    notes: [
      "Use different capture names; express relationships between values with a refinement.",
    ],
  });
}

/** A capture may occur once on a matching path. Alternatives have separate paths. */
export function uniqueCaptures<T>(pattern: Pattern<T>): Pattern<T> {
  patternCaptures(pattern);
  return pattern;
}

export function patternCaptures<T>(pattern: Pattern<T>): Set<string> {
  return new Set(patternBindings(pattern).keys());
}

/** Captures written as `name :: Type`, not implicit label captures from `label: Type`. */
export function explicitPatternCaptures<T>(pattern: Pattern<T>): Set<string> {
  const names = new Set<string>();
  for (const [name, sites] of patternBindings(pattern))
    if (sites.some((site) => !site.origin?.implicit)) names.add(name);
  return names;
}

/** One binding per matching path, with all source sites across alternatives.
 * References and local-capture maps establish separate binding scopes.
 */
export function patternBindings<T>(pattern: Pattern<T>) {
  type Binding = Pick<
    Extract<Pattern<T>, { kind: "capture" }>,
    "name" | "rest" | "origin" | "wrap"
  >;
  function visit(p: Pattern<T>): Map<string, Binding[]> {
    const names = new Map<string, Binding[]>();
    const add = (sites: Binding[], name: string) => {
      if (names.has(name)) duplicateCapture(name);
      names.set(name, sites);
    };
    if (p.kind === "capture") {
      names.set(p.name, [
        { name: p.name, rest: p.rest, origin: p.origin, wrap: p.wrap },
      ]);
      visit(p.pattern).forEach(add);
    } else if (p.kind === "union") {
      p.choices.forEach((branch) =>
        visit(branch).forEach((sites, name) =>
          names.set(name, [...(names.get(name) ?? []), ...sites]),
        ),
      );
    } else if (p.kind === "node") {
      visit(p.head).forEach(add);
      visit(p.body).forEach(add);
    } else if (p.kind === "postfix") {
      visit(p.operator).forEach(add);
      visit(p.operand).forEach(add);
    } else if (p.kind === "fields" || p.kind === "sequence") {
      p.parts.forEach((part) => visit(part).forEach(add));
    } else if (
      p.kind === "label" ||
      p.kind === "repeat" ||
      p.kind === "row" ||
      (p.kind === "map" && !p.localCaptures)
    ) {
      visit(p.pattern).forEach(add);
    } else if (p.kind === "reader" && p.capturePattern) {
      visit(p.capturePattern).forEach(add);
    }
    // References and local-capture maps expose no captures to this scope.
    return names;
  }
  return visit(pattern);
}

/** Open structural constraints are facets, not declarations of a concrete space.
 * References establish a boundary: an abstract field does not make its parent open.
 */
export function isOpenPattern<T>(p: Pattern<T>): boolean {
  switch (p.kind) {
    case "fields":
      return (
        !!p.openLabels || !!p.ignorePositions || p.parts.some(isOpenPattern)
      );
    case "node":
      return isOpenPattern(p.head) || isOpenPattern(p.body);
    case "postfix":
      return isOpenPattern(p.operator) || isOpenPattern(p.operand);
    case "capture":
    case "label":
    case "row":
    case "repeat":
    case "map":
      return isOpenPattern(p.pattern);
    case "union":
      return p.choices.some(isOpenPattern);
    case "sequence":
      return p.parts.some(isOpenPattern);
    default:
      return false;
  }
}
