/** Inspect the bounded source Body grammar through ordinary patterns. */
const bodyFields = `def Capture type
  (name :: LowerCamelSymbol) ::: (annotation :: Expression)
end
def Pattern unionType LowerCamelSymbol | Capture
def Sum type
  (left :: ValueExpression) :+ (right :: ValueExpression)
end
def Product type
  (left :: ValueExpression) :* (right :: ValueExpression)
end
def ValueExpression unionType NumericValue | String | Symbol | Sum | Product
def FunctionSignature type
  (name :: LowerCamelSymbol)(parameters... :: Pattern*)
end
def Definition type :def signature :: FunctionSignature value :: (unionType ValueExpression | Body)
def DestructuringBinding type
  (patterns... :: Pattern*) := (value :: (unionType ValueExpression | Body))
end
def Binding unionType DestructuringBinding | Definition
def Body type
  bindings :: Binding*
  ...
  resultExpression... :: ValueExpression*
end
(
  bindings :: Binding*
  ...
  resultExpression... :: ValueExpression*
) = program
`;
const bodyInspector = (field: string) => `def ${field}(program :: Code)
${bodyFields
  .split("\n")
  .filter(Boolean)
  .map((line) => "  " + line)
  .join("\n")}
  ${field}
end`;

/** Source-level conventions. The reader and matcher do not reserve these names. */
export const DEFAULT_PRELUDE = `def (T :: Type)? type T | :None
def Symbol unionType LowerCamelSymbol | UpperCamelSymbol | UpperSnakeSymbol | PunctuationSymbol
def not(x :: Bool) x == False
${bodyInspector("bindings")}
${bodyInspector("resultExpression")}
`;
