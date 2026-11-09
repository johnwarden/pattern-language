// Bootstrap schema evaluated by the same interpreter and matcher as user code.
// The readable example is generated from this source by build.mjs.
export const TYPE_SCHEMA = `# Executable recursive schema for the portable pattern-description vocabulary.
# Recursive reference scope and semantic normalization remain decoder checks.
def primitiveTag(s)
  match s
    (True | False) -> False
    _ -> True
  end
end
def PrimitiveTag
  (type ReservedSymbol) .where (s -> primitiveTag(s))
end
def reservedHead(h)
  match h == Type
    True -> False
    False -> h != String
  end
end
def ordinaryHead(h)
  match h
    (r :: ReservedSymbol) -> reservedHead(r)
    (:UnionType | :Facet | :Literal | :Apply | :Postfix | :Fields | :OpenFields | :Repeat | :Row | :Sequence | :Collect | :Recursive | :Recur | :Union | :TreeGrammar | (:|)) -> False
    _ -> True
  end
end
def OrdinaryHead
  (type Symbol | ReservedSymbol) .where (h -> ordinaryHead(h))
end
def Index
  (type Int) .where (n -> n >= (0 :: Int))
end
def Data type Rational | String | Symbol | ReservedSymbol | (head :: Data)(fields... :: Data*,**)
def FieldPattern(p :: Type) type p | Repeat(p)
def FieldPack(p :: Type) type :Sequence(parts... :: p*) | :Fields(fields... :: FieldPattern(p)*,**) | :OpenFields(fields :: FieldPack(p),labels: Bool,positional: Bool)
def patternSymbol(s)
  match s
    :_ -> False
    _ -> True
  end
end
def PatternSymbol
  (type Symbol) .where (s -> patternSymbol(s))
end
def Pattern(t :: Type) type Rational | String | PatternSymbol | ReservedSymbol | Type(Pattern(t)) | :Facet(Pattern(t)) | :TreeGrammar(t) | :UnionType(first :: t,rest... :: t*) | :Literal(Data) | :Row(FieldPack(Pattern(t))) | :Collect(Pattern(t)) | :Apply(Pattern(t),FieldPack(Pattern(t))) | :Postfix(Pattern(t),Pattern(t)) | :Recursive(Pattern(t)) | :Recur(Index) | :Union(patterns... :: Pattern(t)*) | :|(Pattern(t))(Pattern(t)) | (head :: OrdinaryHead)(fields... :: FieldPattern(Pattern(t))*,**)
def TypeDescription Facet(type PrimitiveTag | :Recur(Index) | Type(Pattern(TypeDescription)) | :Facet(Pattern(TypeDescription)) | :TreeGrammar(TypeDescription) | :UnionType(first :: TypeDescription,rest... :: TypeDescription*))
type TypeDescription
`;
