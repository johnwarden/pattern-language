# Typed macro expansion and lexical capture

## Expansion contract

An ordinary function `expandMacro(env)(form)` receives a form recognized by a
registered input grammar and returns Code. Registration is explicit. Grammars
can describe sidefix, application, body, and annotation forms. The bootstrap
implements a sidefix subset. The registration spelling and the operations in
the indented sketches below are proposals.

Select a registered form by structure. Then validate its contextual
requirements in the read-only preparation environment. A failed requirement
reports the operand's source span, expected type, actual type when known,
and macro name. It cannot trigger fallback to another expander. For example,
`unless "yes" 42` should identify the condition and explain that it needs
`Bool` and has `String`.

`env.check(e, T)` prepares syntax under an expected type. `env.infer(e)`
prepares it when the operand supplies its own type. Both return syntax
carrying its lexical bindings, source spans and any overload selections.
Inference also returns the inferred type. Splicing a prepared operand as one
expression preserves those decisions. Neither operation evaluates the
program. An environment-dependent constraint belongs to preparation. The
portable representations of Code and FunctionValue need no live
LexicalEnvironment.

Rhombus uses parsed operands to preserve structure during splicing, syntax
objects to retain lexical origin, and static information that can flow between
a form and its operands. Its base language deliberately limits how much
expansion can demand from inside blocks. Those distinctions motivate the
proposed checking and inference operations here.
[Flatt et al., *Rhombus*, §§3.2–4.1, 5.1, 6.2–6.3](https://users.cs.utah.edu/plt/publications/oopsla23-faadffggkkmppst.pdf)

## An expression macro: unless

The motivating design computes the result type and selects a polymorphic
zero while expanding. This sketch assumes a body with an independently
inferable type and exactly one applicable closed zero value.

    type BooleanExpression(env :: LexicalEnvironment) pattern Expression .where
      (e :: Expression) -> env.typeOf(e) is Bool
    end

    def expandMacro(env :: LexicalEnvironment)(:unless condition :: BooleanExpression(env) body :: Body)
      returnType = env.typeOf(body)
      zeroValue = zero :: returnType
      Code$` if($condition, $zeroValue, $body)
    end

The proposed default lets the conditional receive the caller's expected
result type. Its branches share the ordinary conditional typing rules.

    def expandMacro(env :: LexicalEnvironment)(:unless condition :: Expression body :: Body)
      Code$` if($condition, zero, $body)
    end

`if` checks the condition against Bool. When the result is expected at T,
both branches are checked at T. Otherwise an independently known body type
can select the corresponding zero. If both branches need a type and there
is no unique result, report ambiguity. If the type is known but has no zero,
report the missing zero for that type. At evaluation the condition runs once
and only the selected branch runs. The sketch uses `if(c, t, f)` for the
conditional; its existing sidefix spelling works as well.

For a macro that needs a checked operand in its own logic,
`condition :: BooleanExpression(env)` can express the same checking demand.
Validate it with `env.check(condition, Bool)`; the capture carries the prepared
operand forward. This permits an expected Bool to select an overloaded name
whose type could not be inferred in isolation.

    def zero :: Int 0 :: Int
    def zero :: String ""
    (n :: Int) = unless flag zero     # the caller supplies Int for both branches
    unless flag (3 :: Int)            # the body supplies Int for the template zero

With those definitions and the proposed expander registered, the same
shadowing test also exercises designation from the definition-site overload
group:

    def chooseZero(flag :: Bool)
      zero = 17 :: Int
      (result :: Int) = unless flag zero
      result
    end
    expect chooseZero(True) is 0 :: Int
    expect chooseZero(False) is 17 :: Int

The template's `if` and `zero` resolve in its definition scope. The condition
and body keep their use-site bindings. In the executable test the two occurrences
of `zero` denote different values even though both branches have type Int.
It exercises today's registration and conditional spelling.

```pattern
test "Unless keeps the template zero and the caller's shadowing zero distinct"
  zero = 0 :: Int
  macro :unless condition :: Expression body :: Body
    Code$` if $(condition) zero else $(body)
  end
  def example(flag :: Bool)
    zero = 17 :: Int
    unless flag zero
  end
  expect example(True) is 0 :: Int
  expect example(False) is 17 :: Int
end
```

## A binding macro: the expression arrow

The expression grammar registers `->` with a parameter-pattern operand
and a Body operand. In a match arm the same surface arrow belongs to the
match grammar. Given `x -> x + offset`, the expander can resolve which
`offset` occurs even when its value will only be supplied by a later call
to the enclosing function.

    def expandMacro(env :: LexicalEnvironment)(params :: ParameterSyntax :-> body :: Body)
      parameters = env.prepareParameters(params)
      preparedBody = parameters.bodyEnvironment.prepareBody(body)
      plan = closurePlan(parameters, preparedBody)
      captureCode = plan.freeBindings.map(binding -> env.referenceCode(binding))
      emitFunctionConstruction(plan, captureCode)
    end

These operations describe a possible expander interface. Its result is Code
that constructs the closed function when the arrow expression is evaluated.
The steps have the following semantics.

1. Compile parameter packs with the ordinary pattern compiler, retaining
   binder identities, annotations, rests, labels, defaults and pack boundaries.
   Prepare each default in its specified scope. For example, in
   `(size: Int = size) -> size`, the default can refer to an enclosing
   `size` and the body refers to the parameter. Prepare nested binding forms
   under the scopes they introduce.
2. Walk the resolved parameters and body. Record each free lexical binding
   once in first-use order. Keep references to parameters and locals bound.
   Treat literal names and quoted data as inert. Traverse active interpolation
   holes at their own stage. Include free dependencies used only in defaults,
   type annotations or accessor calls.
3. Emit a constructor expression containing the parameter/body templates and
   a lexical reference expression for each capture. Evaluating the constructor
   reads the current immutable value of each capture and substitutes **typed
   value data** at its recorded free uses. Preserve concrete descriptors,
   including a selected callable or a still-overloaded group. Body and
   default syntax remain inert. No capture is obtained by printing its value,
   reparsing text, or consulting a name at the eventual invocation site.
4. Close transitive dependencies with the same rules as named functions.
   Mutually recursive definitions form a finite local group with bound back
   references. Only fixed primitives can remain external. The resulting
   FunctionValue has the parameter packs and closed body specified in
   [named function values](named-function-values.md). The construction plan
   is an implementation detail and contributes no field to function equality
   or global text.

For `makeShift(offset) = (n -> n + offset)` in schematic notation, expansion
records the outer parameter's binding. Calling `makeShift(3 :: Int)` creates
a function whose free use of `offset` contains the typed value `3 :: Int`;
calling it with 8 creates a different function from the same expansion.
Calling either result supplies `n`. For a nested arrow the outer invocation
similarly supplies the values of its parameters when the inner function is made.

```pattern
test "Each evaluation of an arrow captures that invocation's value"
  def makeShift(offset :: Int)
    (n :: Int) -> n + offset
  end
  three = makeShift(3 :: Int)
  eight = makeShift(8 :: Int)
  offset = 100 :: Int
  expect three(2 :: Int) is 5 :: Int
  expect eight(2 :: Int) is 10 :: Int
end
```

The behavioral example also passes for an interpreter with private closures.
The [fresh-interpreter contract on #84](https://github.com/johnwarden/pattern-language/blob/spec/function-values/specs/named-function-values.md#fresh-interpreter-contract)
additionally requires a printed function to reconstruct its captures, behavior,
and global text with no access to the defining scope.
