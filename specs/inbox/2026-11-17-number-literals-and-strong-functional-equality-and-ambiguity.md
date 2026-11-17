
# Strong Functional Equality

Strong functional equality is a substitution rule. If two expressions are
valid in the same typed value context and evaluate to the same exact value
with the same static type, substituting one for the other preserves the
result. In particular, an applicable function in that context produces equal
results for the two expressions. Quoting the expressions as source compares
a different kind of value.

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

	sqrt(2)      # Result policy for irrational roots remains open 
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

# Definition of `Number` union type

Whether `Number` includes `ExactRational` is independent of strict
equality. An operand statically typed as `Number` and a bare literal of
type `ExactRational` have different static types. A comparison can
explicitly put both operands in a common domain. Within that domain,
equal magnitudes in different concrete number types are unequal.
Numeric equality compares magnitudes across the supported number types.

## Prelude definitions for addition

Draft for `ExactRational`, `Int` (the Int64 alias), and `Float64`.
The result of mixing one fixed-precision operand with an `ExactRational`
has the fixed operand's type, in either order. Check exact representability
of the Rational operand before adding. Integer results are checked for
overflow. Float64 results are rounded once. Different fixed formats need
an explicit conversion for these overloads.

Each first pack selects one definition. A union in the second pack keeps
both supported operand types available after saving a partial application.
When the first pack is an `ExactRational`, its definition can return an
`ExactRational`, `Int`, or `Float64` according to the second operand.

```pattern
def (+)(a :: Int)(b :: Int | ExactRational)
  right = b :: Int
  addExact(unwrap(a), unwrap(right)) :: Int
end

def (+)(a :: Float64)(b :: Float64 | ExactRational)
  right = b :: Float64
  float64(addExact(unwrap(a), unwrap(right)))
end

def (+)(a :: ExactRational)(b :: ExactRational | Int | Float64)
  match b
    (q :: ExactRational) -> addExact(a, q)
    (i :: Int) -> (+(i)(a))
    (f :: Float64) -> (+(f)(a))
  end
end
```

`addExact` denotes the prelude's internal exact addition primitive
(the bootstrap already implements this operation as `addRationals`). The
delegating arms use the same checked conversions as the fixed-left
definitions. Match recognizes the concrete member held by `b`.
The `:: Int` and `:: Float64` checks on `right` explicitly designate
the operand, independent of whether it originated as a literal or a variable.
For example, the Int arm rejects a rational `0.5` even when the final sum
could be rounded. This is an explicit mixed-operand signature for addition,
replacing the homogeneous-only addition proposal in the
[fixed-precision draft](fixed-precision-numbers.md).

The [partial-application contract](../../tests/inbox/mixed-addition-partial-application.test)
checks the infix, successive-pack, and saved-partial forms, including a stored
Rational operand and a Rational first pack called with two different types.

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
