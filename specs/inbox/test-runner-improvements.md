## Assertion Failures: show the expression being asserted

Right now I just see these messages. I don't know which comparison it's referring to.

    "comparison: assertion is False"
    "comparison: This assertion now passes; remove todo."

## Detailed reporting for comparison assertions.

- If assertions are in the form a == b or a != b, show the actual value of a and b. 
- rewrite existing tests with assertions in form `not(a == b)` as `a != b`

## Optional Type Annotation

When I Write this:

    `expect 1 result 2`

I get this confusing error

    E_TEST_SYNTAX · specification/application-heads.test:93:3: incomplete assert/expect/todo/legacy form; group compound operands or use indented blocks

I think the error is lack of type annotation on result. I think that we can make the type annotation optional actually. 