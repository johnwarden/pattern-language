# Overloading, libraries and printed function values

The [closed immutable value and exact local-printing principles](../approved/library-closure-and-local-printing.md)
are approved. An overloaded function name evaluates to a `PolymorphicValue`
that contains the complete visible group of definitions.

```pattern
type PolymorphicValue concrete
  (definitions :: Definition*)
  ...
end
```

Binding `saved = f` captures that group as an immutable value. A call
through `saved` uses the same overload rules as a call through the
name. The declaration fixes the `definitions` field. The public
`Definition` schema and any further fields remain open.

Selection of overloaded constants, printed value syntax and printed
type annotations remain proposals. Local text may use a visible name
only if it denotes the exact, complete value, including referenced
definitions. See the [test plan](named-function-value-tests.md).
The following examples retain a proposed `library` spelling for
discussion.

```pattern
  test "Overloading and libraries"
    def zero :: String ""
    def zero :: Float 0

    expect zero value library
      def zero :: String ""
      def zero :: Float 0
    end

    def f(x :: String) $'x is string $x'
    def f(x :: Float) $'x is float $x'

    expect f value library
      def f(x :: String) :: String $'x is string $x'
      def f(x :: Float) :: Float $'x is float $x'
    end

    expect f("foo") value 'x is string foo'
    expect f(1.5) value 'x is float 1.5'
  end

  test "Printing types with predicates"

    def isSquare(r :: Rectangle) r.width == r.height

    square = Rectangle .where isSquare
    expect toString(Type)(square) value "Rectangle .where isSquare)" :: String

    expect toString(Function)(isSquare) value '
      library 
        def isSquare(r :: Rectangle) :: Bool -> r.width == r.height
      end
    end

  end

  test "Printing types with anonymous predicates"

    square = Rectangle .where r -> r.width == r.height

    expect toString(Type)(square) value "Rectangle .where (r :: Rectangle) -> r.width == r.height" :: String
  end


```

