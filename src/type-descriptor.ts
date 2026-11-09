import type { Pattern } from "./pattern.ts";
import type { TypeValue, Value } from "./values.ts";
import { LanguageError } from "./syntax.ts";
import { typeDescription, descriptionKey } from "./type-data.ts";
import { orderedParts } from "./pattern-captures.ts";
const identities = new WeakMap<TypeValue, string>();
let constructing = 0;
/** Recursive groups mutate their references while normalizing. Their descriptions
 * are usable during construction, but must not be memoized until the graph closes. */
export function constructingTypes<T>(action: () => T): T {
  constructing++;
  try {
    return action();
  } finally {
    constructing--;
  }
}

/** Finite structural encoding. Names of declarations and captures are absent.
 * Recursive references use binder depth. Public type trees canonicalize union order;
 * this internal signature only supports matching/cache bookkeeping.
 * This is descriptor equality, not arbitrary semantic pattern equivalence.
 */
export function typeIdentity(type: TypeValue): string {
  const cached = constructing ? undefined : identities.get(type);
  if (cached !== undefined) return cached;
  try {
    const structural = descriptionKey(typeDescription(type));
    if (!constructing) identities.set(type, structural);
    return structural;
  } catch (error) {
    // Legacy predicate/default closures retain their session-local identity until
    // those features have portable descriptions. Never serialize that fallback.
    if (
      !(error instanceof LanguageError) ||
      error.diagnostic.code !== "E_TYPE_SERIALIZATION"
    )
      throw error;
  }
  const active: unknown[] = [];
  let work = 0;
  function encode(p: Pattern<Value>): unknown {
    if (++work > 10000)
      throw new LanguageError("type descriptor exceeds structural budget");
    switch (p.kind) {
      case "any":
        return ["any"];
      case "test":
        return ["test", p.identity ?? p.name];
      case "capture":
        return encode(p.pattern);
      case "ref": {
        const at = active.indexOf(p.key);
        if (at >= 0) return ["recursive", active.length - 1 - at];
        active.push(p.key);
        try {
          return encode(p.resolve());
        } finally {
          active.pop();
        }
      }
      case "map": {
        const value = encode(p.pattern);
        return p.identity === undefined
          ? value
          : ["constraint", p.identity, value];
      }
      case "node":
        return ["node", encode(p.head), encode(p.body)];
      case "postfix":
        return ["postfix", encode(p.operator), encode(p.operand)];
      case "label":
        return ["label", p.label, p.defaultIdentity ?? null, encode(p.pattern)];
      case "row":
        return ["row", encode(p.pattern)];
      case "repeat":
        return ["repeat", !!p.collect, encode(p.pattern)];
      case "fields": {
        const parts = orderedParts(p.parts);
        return [
          "fields",
          !!p.openLabels,
          !!p.ignorePositions,
          parts.map((x) => encode(x)),
        ];
      }
      case "sequence":
        return ["sequence", p.parts.map((x) => encode(x))];
      case "union":
        return [
          p.preserveSpace ? "type-union" : "union",
          p.choices.map((x) => encode(x)),
        ];
      case "reader":
        throw new LanguageError(
          "this pattern requires an explicit descriptor before it can define a concrete type",
          undefined,
          { code: "E_TYPE_DESCRIPTOR", phase: "declaration" },
        );
    }
  }
  active.push(type.key);
  const result = JSON.stringify(encode(type.pattern()));
  if (!constructing) identities.set(type, result);
  return result;
}
