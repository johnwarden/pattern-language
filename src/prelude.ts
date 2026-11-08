/** Source-level conventions. The reader and matcher do not reserve these operators. */
export const DEFAULT_PRELUDE = `def (T :: Type)? type T | :None
def Symbol unionType LowerCamelSymbol | UpperCamelSymbol | UpperSnakeSymbol | PunctuationSymbol
`;
