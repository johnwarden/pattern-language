// Bootstrap schema evaluated by the same interpreter and matcher as user code.
// The readable example is generated from this source by build.mjs.
export const TYPE_SCHEMA = `# Executable recursive schema for the portable pattern-description vocabulary.
# Recursive reference scope and semantic normalization remain decoder checks.
def primitiveTag(s)
  match toString(s)
    "Rational" -> True
    "Float" -> True
    "Float32" -> True
    "Float64" -> True
    "Int" -> True
    "Bool" -> True
    "String" -> True
    "Symbol" -> True
    "LowerCamelSymbol" -> True
    "UpperCamelSymbol" -> True
    "UpperSnakeSymbol" -> True
    "PunctuationSymbol" -> True
    "Any" -> True
    "Expression" -> True
    "Body" -> True
    "Type" -> True
    "ReservedSymbol" -> True
    _ -> False
  end
end
def PrimitiveTag
  (type ReservedSymbol) .where (s -> primitiveTag(s))
end
def ordinaryHead(h)
  match toString(h)
    "Type" -> False
    "String" -> False
    _ ->
      match h
        (:UnionType | :Facet | :Literal | :Apply | :Postfix | :Fields | :OpenFields | :Repeat | :Row | :Sequence | :Collect | :Recursive | :Recur | :Union | :TreeGrammar | (:|)) -> False
        _ -> True
      end
  end
end
def OrdinaryHead
  (type Symbol) .where (h -> ordinaryHead(h))
end
def Index
  (type Int) .where (n -> n >= (0 :: Int))
end
def Data type Rational | String | Symbol | (head :: Data)(fields... :: Data*,**)
def FieldPattern(p :: Type) type p | Repeat(p)
def FieldPack(p :: Type) type :Sequence(parts... :: p*) | :Fields(fields... :: FieldPattern(p)*,**) | :OpenFields(fields :: FieldPack(p),labels: Bool,positional: Bool)
def patternSymbol(s)
  match primitiveTag(s)
    True -> False
    False ->
      match s
        :_ -> False
        _ -> True
      end
  end
end
def PatternSymbol
  (type Symbol) .where (s -> patternSymbol(s))
end
def Pattern(t :: Type) type Rational | String | PatternSymbol | PrimitiveTag | Type(Pattern(t)) | :Facet(Pattern(t)) | :TreeGrammar(t) | :UnionType(first :: t,rest... :: t*) | :Literal(Data) | :Row(FieldPack(Pattern(t))) | :Collect(Pattern(t)) | :Apply(Pattern(t),FieldPack(Pattern(t))) | :Postfix(Pattern(t),Pattern(t)) | :Recursive(Pattern(t)) | :Recur(Index) | :Union(patterns... :: Pattern(t)*) | :|(Pattern(t))(Pattern(t)) | (head :: OrdinaryHead)(fields... :: FieldPattern(Pattern(t))*,**)
def TypeDescription Facet(type PrimitiveTag | :Recur(Index) | Type(Pattern(TypeDescription)) | :Facet(Pattern(TypeDescription)) | :TreeGrammar(TypeDescription) | :UnionType(first :: TypeDescription,rest... :: TypeDescription*))
type TypeDescription
`;
