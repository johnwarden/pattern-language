
So I think the value of overloaded definitions, or definitions in general (with def), should be something like a "library". 
I think even constants can be overloaded.

As when printing types, when printing function values, the local-print logic just print the *function name* when it is defined in scope. 
If it prints the body, substitute inline function calls with functions available in scope.

I think printed function body should have type annotations?


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

