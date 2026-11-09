# Overloading, libraries and printed function values

The [closed immutable value and exact local-printing principles](../approved/library-closure-and-local-printing.md)
are approved in the project chat. The Library representation, overloaded constant
selection and printed type annotations below remain proposals. The
[test plan](named-function-value-tests.md) separates agreed behavioral contracts
from cases that need those decisions; the original examples are retained below.

So I think the value of overloaded definitions, or definitions in general (with def), should be something like a "library". 
I think even constants can be overloaded.

Local printing may reuse an in-scope name only for the exact complete value,
including referenced definitions; that settled portion is in the approved record.
The precise Function/Library value grammar and the illustrative strings below
still need clarification.

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

