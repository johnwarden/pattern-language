# New Numeric Constants and Fixed-With Numeric Type Spec

- Use NumericValue as the primitive type for number literals.
- The new arithmetic grouping rules no longer require parentheses around fraction literal
- Numeric values can now represent complex numbers
- The fixed-width fraction and complex types, (to be defined), will be designated by a single numeric value
- Make undefined operations statically impossible:
	- Sqrt only defined on complex numbers, positive floats and fractions.
- Create separate union for fixed-with non-complex rationals
- New rules for _ in constants
- Overflow rules are configurable:
	- Can set to wrap or panic, or panic in dev/debug and panic in production
	
## NumericValue Literal Format

New format:

	RADIX ::= 0(x|b|f)
	REAL_PART ::= {RADIX}?DIGITS(.DIGITS)?((e|p)EXPONTENT)?(/{RADIX}?DIGITS)?
	IMAGINARY_PART ::= {RADIX}?DIGITS((e|p)EXPONTENT)?(i)?(/{RADIX}?DIGITS)?
	NUMERIC_CONSTANT ::= (-)?{REAL_PART} | (-)?{IMAGINARY_PART} | {REAL_PART}(+|-){IMAGINARY_PART}

Parentheses are no longer required for fraction constants. Reason: the new arithmetic grouping rules remove the formatting safety issue that motivated this. 

The denominator goes *after* any exponent and/or `i`. 
	Reason: otherwise parens would be necessary inside constants to distinguish 1/3i and not (1/3)i

Numerator, denominator, real and imaginary parts can use different radix. 
	Reason:

	These are potentially confusing
		0xf+11i # Is 11 interpreted as hex or decimal?
		0xf/11 # Is 11 interpreted as hex or decimal?
			if the former, then 0xf/11 != 0xf / 11
			thus it should be latter
			but this implies mixed radix constants allowed, including
				0xf/0x11


`i` alone is not a numeric literal (it's a lowerCamelSymbol)

QUESTION: 
	Decimal point not allowed in numerator if there is a denominator? or maybe it's harmless
	0f not allowed as radix for fracitons?

Sample TEsts:

	# Parens not required
	expect 1 / 3 is 1/3 :: NumericValue 

	# / after exponent
	expect 10000 / 3 is 1e4/3 :: NumericValue 

	# Mixed radix
	expect 10 / 11 is 0xa/0xb :: NumericValue 
	expect 3 / 10 is 0b11/10 :: NumericValue 

	# Imaginary parts only
	expect 1i / 3 is 1i/3 :: NumericValue
	expect 1i * 10000 / 3 is 1e4i/3 :: NumericValue
	expect 10 * 1i is 0xai :: NumericValue
	expect (10 / 3) * 1i is 0xai/3 :: NumericValue
	expect (40 / 3) * 1i is 0xap2i/3 :: NumericValue
	expect -1 * i is -1i :: NumericValue

	# Real + Imaginary parts
	expect 1 + (3i) is 1+3i :: NumericValue
	expect 1 - (1000i) is 1-1e3i :: NumericValue
	expect 10 + 10i is 0xa+0xai :: NumericValue

	# mixed-radix complex
	expect 10 + 10i is 0xa+10i :: NumericValue
	expect 3 + 3i is 0b11+3i :: NumericValue

	# complex with fractions
	expect (10/3) + (1i / 3) is 10/0b11+1i/3 :: NumericValue
	expect 1000 + (10000i) is 0xap3+0xap4i :: NumericValue

	# invalid numeric constants
	expect 0xa+3 fails "Invalid numeric constant (missing i in imaginary part)"
	expect 0xa+a fails "Invalid numeric constant (a is not valid decimal)"
	expect 5ie3 fails "Invalid numeric constant (i goes after exponent)"
	expect 1/3i fails "Invalid numeric constant (i must go before /)"
	expect 0f1/3 fails "Invalid numeric constant (0f cannot combine with fractions)" # Question: allow this?
	expect 1.1/3 fails "Invalid numeric constant (Numerator of fraction must be integer)" # QUESTION: allow this
	expect i fails "`i` is not defined"
	expect 1+i fails "Invalid numeric constant (missing digits before i)"
	expect 
		i = 1i
		3 + i
	is 3+1i


## Normal Form Rules:

Canonical form of numeric value doesn't print imaginary part if it is 0.

	expect toString(NumericValue)(0f0.1 + (0 * 1i)) is "0f0.1"
	expect toString(NumericValue)(0f0.1 + (0 * 1i)) is "0f0.1"

If one of two parts of complex number is 0, that part is not printed. If both parts are 0, print 0.

	expect toString(1+0i) is "1"
	expect toString(0-1i) is "-1i"
	expect toString(0-0i) is "0"

## Extend new arithmetic grouping rules extended for fraction literals.

RULE: If expressions like `1 / 2 / 3` or `1 + 2 / 3` are syntax errors via grouping rules, then the same expressions without spaces around the operators should also be error.

	expect 1/3 / 3 fails "Write `(1/3)` or `1/(3 / 3)`..."
	expect 1 / 3/3 fails "Write `1 / (3/3)` or `(1 / 3)/3`..."
	expect 1i/3 + 3 fails "Write `(1i/3) + 3` or `1i(3 + 3)`..."
	expect 3+4i / 3 fails "Write `(3+4i) / 3` or `3+(4i / 3)`..."

## Small Change: Underscores

Underscores can only go in decimals where commas can usually go. 10_00 is not valid but 1_000 is. 

QUESTION: 
	should underscores be allowed in binary or hex constants? Between bytes or words? 0xffaf_ffaa_aaff


	expect 1000 = 1_000
	expect 10_00 fails "Invalid numeric constant"

## Fixed-width fraction and complex types directly represented by literals.

	x = 1/3 :: Fraction64
	expect x * 2 is 2/3 :: Fraction64
	y = 1+1i :: Complex(Fraction64)
	expect y ^ 2 is 2i :: Complex(Fraction64)

QUESTION: 
	Should we call the type FractionM, RatioM, or RationalM?
	Does Fraction64 represent a fraction represented using two 64 bit integers, or two 32 bit integers



## No Undefined Arithmetic Behavior

sqrt is undefined for fixed-width rational types unless isNonNegative is true.
sqrt defined for fixed-with Complex types.

	# sqrt defined for floats *only* for non-negative numbers
	def sqrt(n :: Float64 .where nonNegative)

	def sqrt(n :: Complex(N))

	# division defined *only* for non-zero numbers
	def /(numerator :: Float64, denominator :: Float64 .where nonZero)


And of course, values with imaginary part == 0 don't print that part. 

	expect toString(1+0i) value 1 :: Rational 



## Various Number Abstract Unions

Inequality operators are not defined over complex numbers. But sometimes programmers will want to define functions defined over rational numbers that use inequality comparisons. Sometimes they'll want to define functions over numbers in general (without using inequality operators.

So I want to define 

	type Rational Int32 | Float32 | Fraction32 | ...
	type Complex Complex(Float32) | Complex(Fraction64) | ...
	type Number Rational | Complex









