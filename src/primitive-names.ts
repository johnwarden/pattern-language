import { symbolCategory } from "./lexical.ts";

/** The language's self-evaluating atoms, independent of surface syntax. */
export const primitiveNames = new Map([
  ["NumericValue", "NumericValue"],
  ["Float64", "Float64"],
  ["Float32", "Float32"],
  ["Int64", "Int64"],
  ["Int32", "Int32"],
  ["UInt64", "UInt64"],
  ["String", "String"],
  ["Bool", "Bool"],
  ["LowerCamelSymbol", "LowerCamelSymbol"],
  ["UpperCamelSymbol", "UpperCamelSymbol"],
  ["UpperSnakeSymbol", "UpperSnakeSymbol"],
  ["PunctuationSymbol", "PunctuationSymbol"],
  ["Expression", "Expression"],
  ["Body", "Body"],
  ["Any", "Any"],
  ["Type", "Type"],
  ["ReservedSymbol", "ReservedSymbol"],
]);
/** Ordinary prelude aliases of fixed formats (`Int = Int64`, `Float = Float64`). */
export const numericAliases = new Map([
  ["Int", "Int64"],
  ["Float", "Float64"],
]);
export const constantNames = new Set(["True", "False"]);
export const isSelfEvaluating = (name: string): boolean =>
  primitiveNames.has(name) || constantNames.has(name);
export const isCanonicalAtom = (name: string): boolean =>
  constantNames.has(name) || primitiveNames.get(name) === name;
/** Reserved names belong to ReservedSymbol, not to an ordinary symbol class. */
export const ordinarySymbolCategory = (
  name: string,
): ReturnType<typeof symbolCategory> =>
  isSelfEvaluating(name) ? undefined : symbolCategory(name);

/** Bootstrap syntax domains are defaults that source grammars may replace lexically. */
export const bootstrapTypeNames = new Set(["Expression", "Body"]);
