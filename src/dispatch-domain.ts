import type { Pattern } from "./pattern.ts";
import { orderedParts } from "./pattern-captures.ts";

/** Compare whole argument-pack domains, ignoring captures and refinement predicates.
 * This is declaration validation, not semantic type equality or an overlap prover.
 */
export function dispatchSignature<T>(packs: Pattern<T>[]): {
  key: string;
  refined: boolean;
} {
  let refined = false;
  function shape(p: Pattern<T>): unknown {
    switch (p.kind) {
      case "capture":
        return shape(p.pattern);
      case "ref":
        refined ||= !!p.dispatchBase;
        return ["type", p.dispatchIdentity?.() ?? p.name];
      case "map":
        return shape(p.pattern);
      case "test":
        return ["test", p.identity ?? p.name];
      case "any":
        return ["any"];
      case "node":
        return ["node", shape(p.head), shape(p.body)];
      case "postfix":
        return ["postfix", shape(p.operator), shape(p.operand)];
      case "label":
        return ["label", p.label, !!p.fallback, shape(p.pattern)];
      case "row":
        return ["row", shape(p.pattern)];
      case "repeat":
        return ["repeat", !!p.collect, shape(p.pattern)];
      case "fields":
        return [
          "fields",
          !!p.openLabels,
          !!p.ignorePositions,
          orderedParts(p.parts).map(shape),
        ];
      case "sequence":
        return ["sequence", p.parts.map(shape)];
      case "union":
        return ["union", p.choices.map(shape)];
      case "reader":
        return [
          "reader",
          p.name,
          p.inputPattern && shape(p.inputPattern),
          p.capturePattern && shape(p.capturePattern),
        ];
    }
  }
  const key = JSON.stringify(packs.map(shape));
  return { key, refined };
}
