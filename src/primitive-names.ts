import { symbolCategory } from "./lexical.ts";

/** The language's self-evaluating atoms, independent of surface syntax. */
export const primitiveNames = new Map([
  ["Rational", "Rational"],
  ["Float", "Float"],
  ["Float64", "Float64"],
  ["Float32", "Float32"],
  ["Int", "Int"],
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
export const constantNames = new Set(["True", "False"]);
/** Withdrawn spellings that must not become ordinary symbols either. */
export const withdrawnPrimitiveNames = new Set(["Number", "Num"]);
export const isSelfEvaluating = (name: string): boolean =>
  primitiveNames.has(name) || constantNames.has(name);
export const isCanonicalAtom = (name: string): boolean =>
  constantNames.has(name) || primitiveNames.get(name) === name;
/** Quoted `:True` / `:Int` / `:Number` are not ordinary symbols. */
export const isReservedPrimitiveSpelling = (name: string): boolean =>
  isSelfEvaluating(name) || withdrawnPrimitiveNames.has(name);
/** Spelling class of an ordinary (non-reserved) symbol, if it has one. */
export const ordinarySymbolCategory = (
  name: string,
): ReturnType<typeof symbolCategory> =>
  isReservedPrimitiveSpelling(name) ? undefined : symbolCategory(name);

/** Bootstrap syntax domains are defaults that source grammars may replace lexically. */
export const bootstrapTypeNames = new Set(["Expression", "Body"]);
