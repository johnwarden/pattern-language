
# Strong Functional Equality

Functional equality requires that: 

	(x == y) ⟹ ∀f f(x) != f(y)

Here we assume the same set of functions must be defined over x and y.

The *strong* version of this is true not only for any *value*, but for any *expression*. I should not be able to plugin any expression x or y and allow the above to be true.

This creates a problem. We intuitively want fixed-precision numbers to be comparable to exact rationals (number literals)

	x = 0 :: Int
	assert x == 0

But then we can do:

		x = 0 :: Int
		def foo(x :: Int) = "int"
		def foo(x :: ExactRational) = "exact rational"
		x == 0 && foo(x) != foo(0)

Which violates strong functional equality. So we can't just say that `1` means `1 :: Int` in context where an int is expected.

## DISCARDED Option:  Numeric Literals (ExactRationals) directly *represent* values of fixed-precision number types.

	x = 1 :: Int
	y = 1 :: Float
	x == 1
	y == 1
	INCOMPARABLE: x == y

	AMZBIGUOUS: sqrt(2)
	sqrt(2 :: Float64)

	AMBIGUOUS: x + 1
	x + 1 :: Int
	y + 1 :: Float

	AMBIGUOUS: x > 0
	x + 0 :: Int


But this means many numeric operations are ambiguous:

	AMBIGUOUS: sqrt(2) 
	sqrt(2 :: Float)
	AMBIGUOUS: x + 1
	x + 1 :: Int
	AMBIGUOUS: 1 / 3
	(1 :: ExactRational) / (3 :: ExactRational)	


# DECISIoN: Fixed precision number types are wrapped ExactRationals.

A numeric literal by itself has type ExactRational and is not exactly equal to any fixed-precision value.

	x = 1 :: Int
	y = 1 :: Float

	INCOMPARABLE: x == 1
	x == 1 :: Int
	INCOMPARABLE: y == 1
	y == 1 :: Float

	INCOMPARABLE: x == 1 :: ExactRational
	NO: y == 1 :: ExactRational

	INCOMPARABLE: x == y

	sqrt(2)      # ExactRational 
	sqrt(2 :: Float) => Float
	x + 1        # Int because +(Int)(ExactRational) is explicitly defined
	x + 1 :: Int # Int
	1 / 3        # ExactRational
	(1 :: ExactRational) / (3 :: ExactRational)	

	x > 0 # Okay

The downside is that we can't just say

	x == 0
	x != 0

But we can define a new numeric Equality operator that

  x =#= 0
  x !#= 0

This if formatting safe because "x = #= comment" wouldn't compile. Oh yes it could if continued on indented next line. So we just say comments that start with `=` or `# =` aren't allowed (at least not directly after =) .

When people try to use x == 0 when x is one of the fixed-precision types they will get a compile error (comparing different concrete types)

# Definition of `Number` Union type

But what if we define Number as a union of fixed precision types? 

	def FixedPrecisionNumber Float32 | Float64 | Int32 | ...
	def Number FixedPrecisionNumber | ExactRational

	def foo(x :: Number) x == 0

Since the definition of Number includes ExactRational, then this would be *false* for all numbers except 

	Problem: foo(0 :: Int) == False

But if Number excludes ExactRational, then 

	def Number FixedPrecisionNumber

	expect def foo(x :: Number) x == 0 error "Number and ExactRational are disjoint..."

Then this works.

	def foo(x :: Number) x =#= 0

As well as the arithmetic operators so `x + 1` etc work.

Number Union would need to define

	def +(x :: Number | ExactRational)(y :: Number | ExactRational) ...
	def -(x :: Number | ExactRational)(y :: Number | ExactRational) ...
	def *(x :: Number | ExactRational)(y :: Number | ExactRational) ...
	def /(x :: Number | ExactRational)(y :: Number | ExactRational) ...
	def (<)(x :: Number | ExactRational)(y :: Number | ExactRational) ...
	etc.

# Designation and Ambiguity

Can we allow a value of inner type to designate value of outer type?

# DISCARDED OPTION 1: An outer type can be designated by a value of it's inner type only if unambiguous. Fail or require explicit type otherwise.

This could almost work. 

	def foo(x :: Int) "Int"
	foo(5) "Int"

	def foo(x :: ExactRational) "ExactRational"
	AMbIGUOUS: foo(5)
	foo(5 :: Int) "Int"
	foo(5 :: ExactRational) "ExactRational"

But then this is not true

	(5 == 5 :: ExactRational) && foo(5) == foo(5 :: ExactRational)

Another problem with this:

	def foo(v :: String?) "String?"
	def foo(v :: String??) "String??"

How do you disambiguate? If you allowed this:

	AMBIGUOUS: foo(:None :: String?)
	assert foo((:None :: String?) :: String??) is "String??"
	assert foo((:None :: String?) :: String?) is "String?"

But (:None :: String?) :: String? is the same as (:None :: String?).

Spo that doesn't make sense.

SO THIS OPTION SOULD BE DISCARDED

# OPTION 2: An outer type can be designated by a value of it's inner type. For function overloading, inner type takes priority.

	def foo(x :: Int) "Int"
	foo(5) "Int"

	def foo(x :: ExactRational) "ExactRational"
	foo(5) "ExactRational"
	foo(5 :: Int) "Int"
	foo(5 :: ExactRational) "ExactRational"

This seems odd because adding a definition of `foo` changes what foo(5) means. But I think this is the best compromise.

Analogously:

	t = concrete ExactRational | Int

	(x :: t) = 5
	expect x is 5 :: ExactRational
	(y :: t) = 5 :: Int 
	expect y is 5 :: Int

	def foo(value :: t)
		match value 
			when ExactRational "ExactRational"
			when Int "Int"
		end
	end

	expect foo(5) is "ExactRational"
	expect foo(5 :: Int) is "Int"


What if we have multiple layers of designation. 

	def Id concrete Int64

	x = 5 :: Id

5 designates Int64 which designates Id. We'd want the string form to use the smallest unambiguous expression.

	expect toString<Any>(x) is "5 :: Id"

	y = 5 :: Int64
	z = y :: Id
	assert z == x


## Examples: ambiguity with option types

So an integer can designate a value of type Int?. 

	def foo(x :: Int?) "Int?"
	expect foo(5 :: Int) is "Int?"

And because an ExactRational can designate an integer.

	expect foo(5) is "Int?"
	expect foo(:None) is "Int?"

Now there is a different type of ambiguity here: `foo(:None)` could mean various things:

	def foo(x :: String?) "String?"
	def foo(x :: Int?) "Int?"

In this case, there is no priority. Type must be explict.

	expect foo(:None) fails "Ambiguous foo(String?) and foo(Int?)"
	expect foo(:None :: String?) is "String?"
	expect foo(:None :: Int?) is "Int?"

Now, a value of type String?? can take on values `:None :: String?` or `:None :: String??`

We have a rule where that when a value can designate a value of both the outer and inner type, as in the case of :None in the context of String??,
assume the value of outer type. This interacts with the rule that in the case of ambiguous overloaded functions, the function over the inner type
takes precedence. This seems to contradict but it really doesn't. Here's a complete example showing the interaction.

test "String?? scenario: Interaction of ambiguity rules"
	(s :: String??) = :None
	expect s is :None :: String??

	(t :: String??) = :None :: String?
	(u :: String??) = :None :: String??
	assert s != t
	assert s == u

	test "Start with defining function over outer type"
		def foo(v :: String??) "Outer: " ++ toString(String??)(v)

		expect foo(:None) is "Outer: :None"
		# NOTE: if the rule were that the inner type takes priority in case of ambiguity in type definition, the above test would be:
 		# expect foo(:None) is "Outer: :None :: String?"

		expect foo(:None :: String?) is "Outer: :None :: String?"
		expect foo(:None :: String??) is "Outer: :None"
		expect foo((:None :: String?) :: String??) is "Outer: :None :: String?"

		test "Overloaded function over inner type"
			def foo(v :: String?) toString(String?)(v)

			# Then the definition for the inner type takes precedence
			expect foo(:None) is "Inner: :None"
			expect foo(:None :: String?) is "Inner: :None"
			expect foo(:None :: String??) is "Outer: :None"
			expect foo((:None :: String?) :: String??) is "Outer: :None :: String?"
		end
	end
end






