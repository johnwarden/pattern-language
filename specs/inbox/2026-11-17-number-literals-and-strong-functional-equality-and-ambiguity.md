
# Strong Functional Equality


Strong functional equality is a substitution rule. If two expressions evaluate to the same exact value
with the same static type (`==` equality), substituting one for the other in any context preserves the
result.

For example this should never be true:

	(E1 == E2) && (CONTEXT[E1] != CONTEXT[E2])

Where CONTEXT[...] can be any expression where an un-quoted value expression can be filled in.

Comparison is permitted whenever the operands' static types admit at least
one concrete type in common. For example, `Number` and `Float64` overlap
because `Number` includes `Float64`. Equality then compares the exact values,
including their concrete types, without designation. A `Number` holding
an `Int` zero therefore compares unequal to a `Float64` zero. The
substitution rule above applies when the expressions have the same static
type. See [existing abstract/concrete comparison coverage](../../test/abstract-values.test.ts#L25-L43).

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

	# Don't define sqrt over exact rationals, because it needs a finite-precision result. Only define over floats/decimal floats where a precision is implicit in the type.
	expect sqrt(2) fails "ambiguous"
	sqrt(2 :: Float64) => Float64
	x + 1        # Int because +(Int)(ExactRational) is explicitly defined
	(x + 1) :: Int # Int
	1 / 3        # ExactRational
	(1 :: ExactRational) / (3 :: ExactRational)	

	x > 0 # Okay

The fixed-precision prelude specifies the [`Number` union and numeric
equality](fixed-precision-numbers.md#number-and-numeric-equality) and the
[addition definitions](fixed-precision-numbers.md#prelude-definitions-for-addition).

Each fixed-precision floating type supplies a `sqrt` overload. An exact
argument such as `2` can designate both `Float32` and `Float64`, making the
call ambiguous. `sqrt(2 :: Float64)` selects the Float64 overload.

# Designation and Ambiguity

Overloads must have disjoint sets of directly admitted values. For
example, `f(x :: Int)` and `f(x :: Number)` cannot coexist because
`Number` includes every `Int`. Different concrete formats such as
`Float32` and `Float64` admit disjoint values, even though the same
exact rational can designate a value of either format at a call site.

An inner value can designate an outer value. The examples below explain
how that affects overload selection.

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

	t = struct ExactRational | Int

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

	type Id struct Int64

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
takes precedence. These rules apply at different points. Once the expected type
is `String??`, bare `:None` chooses its direct outer arm. The existing test
[“Nested postfix absence preserves explicit member evidence”](../../tests/bindings/nested-option-designation.test#L126-L136)
checks that rule. With both overloads in scope, the proposed rule additionally
prefers `String?` for bare syntax accepted by the two nested types. Peer
options such as `String?` and `Int?` are still ambiguous. The example below
checks the call behavior.

```pattern
test "A lone outer overload supplies the expected option type"
  def foo(v :: String??) "Outer"
  expect foo(:None) is "Outer"
  expect foo(:None :: String?) is "Outer"
  expect foo(:None :: String??) is "Outer"
end

test "Inner overload takes priority for nested option designation"
  def foo(v :: String??) "Outer"
  def foo(v :: String?) "Inner"

  expect foo(:None) is "Inner"
  expect foo(:None :: String?) is "Inner"
  expect foo(:None :: String??) is "Outer"
  expect foo((:None :: String?) :: String??) is "Outer"
end
```
