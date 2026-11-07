/** The language's self-evaluating atoms, independent of surface syntax. */
export const primitiveNames = new Map([
  ["Float", "Float"],
  ["Number", "Float"],
  ["Float32", "Float32"],
  ["Int", "Int"],
  ["String", "String"],
  ["Bool", "Bool"],
  ["Symbol", "Symbol"],
  ["SentenceCaseSymbol", "SentenceCaseSymbol"],
  ["TitleCaseSymbol", "TitleCaseSymbol"],
  ["PunctuationSymbol", "PunctuationSymbol"],
  ["Expression", "Expression"],
  ["Body", "Body"],
  ["Any", "Any"],
  ["Type", "Type"],
]);
export const constantNames = new Set(["True", "False"]);
export const isSelfEvaluating = (name: string): boolean =>
  primitiveNames.has(name) || constantNames.has(name);
export const isCanonicalAtom = (name: string): boolean =>
  constantNames.has(name) || primitiveNames.get(name) === name;

/** Bootstrap syntax domains are defaults that source grammars may replace lexically. */
export const bootstrapTypeNames = new Set(["Expression", "Body"]);
