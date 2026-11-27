/** Source-level conventions. The reader and matcher do not reserve these names. */
export const DEFAULT_PRELUDE = `def (T :: Type)? type T | :None
def Symbol unionType LowerCamelSymbol | UpperCamelSymbol | UpperSnakeSymbol | PunctuationSymbol
def not(x :: Bool) x == False
type Predicate struct :isNonZero | :isPositive | :isSquare
`;
