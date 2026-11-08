import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  inspectResults,
  normal,
  parseExpression,
  LanguageError,
} from "../src/index.ts";
import { TYPE_SCHEMA } from "../src/type-schema.ts";
import { single, unwrap, valLiteral } from "../src/values.ts";

const run = (source: string) => displayResults(new Interpreter().run(source));
const full =
  'def Colored type :Rect(Float,Float,color: String)\ndef Rectangular type :Rect(w :: Float,h :: Float,**)\nr = Rect(2,3,color: "black") :: Colored\n';
const rejects = (source: string, code: string) =>
  assert.throws(
    () => run(source),
    (e: unknown) => e instanceof LanguageError && e.diagnostic.code === code,
  );

test("constructed fields are exact and argument packs remain open to extra labels", () => {
  assert.throws(
    () => run("Rect(w,h) = Rect(2,3,color: :Black)\nw"),
    /unexpected labeled field/,
  );
  assert.equal(run("(w,h) = (2,3,color: :Black)\n(w,h)"), "(2, 3)");
  assert.throws(
    () => run("def f(Rect(w,h)) w\nf(Rect(2,3,color: :Black))"),
    /no applicable function/,
  );
  assert.equal(run("def f(w,h) w + h\nf(2,3,color: :Black)"), "5");
});

test("positional and labeled ignore markers are independent", () => {
  assert.equal(
    run(
      'Rect(w,h,...,color: c,**) = Rect(2,3,4,5,color: :Black,note: "x")\n(w,h,c)',
    ),
    "(2, 3, Black)",
  );
  assert.throws(
    () => run("Rect(w,h,...) = Rect(2,3,color: :Black)\nw"),
    /unexpected labeled field/,
  );
  assert.throws(
    () => run("Rect(w,h,**) = Rect(2,3,4)\nw"),
    /expected field|expected|match/,
  );
  assert.throws(
    () => run('Rect(w,h,color: c,**) = Rect(2,3,note: "x")\nc'),
    /missing required/,
  );
});

test("labeled tail markers follow labels and canonical label sorting preserves the tail", () => {
  const source = "Rect(w,h,...,z: z,a: a,**)";
  assert.equal(
    normal(parseExpression(source)),
    "Rect(w, h, …, a: a, z: z, **)",
  );
  assert.equal(
    normal(parseExpression(normal(parseExpression(source)))),
    normal(parseExpression(source)),
  );
  assert.throws(
    () => parseExpression("Rect(w,**,color: c)"),
    /must follow all/,
  );
  assert.throws(
    () => run("Rect(a,...,b) = Rect(1,2)\na"),
    /must follow positional/,
  );
  assert.throws(
    () => run("Rect(a,rest...,b) = Rect(1,2)\na"),
    /last positional pattern/,
  );
});

test("rest captures collect only positional fields and may precede named patterns", () => {
  for (const [tail, expected] of [
    ["", "[]"],
    [",2", "[2]"],
    [",2,3", "[2, 3]"],
  ]) {
    assert.equal(
      run(
        `(first,rest...,color: c) = (1${tail},color: :Black,note: "x")
(rest,c)`,
      ),
      `(${expected}, Black)`,
    );
    assert.equal(
      run(
        `Rect(first,rest...,color: c,**) = Rect(1${tail},color: :Black,note: "x")
(rest,c)`,
      ),
      `(${expected}, Black)`,
    );
  }
});

test("rest fields have the same behavior in functions, match arms, and macros", () => {
  assert.equal(
    run(
      'def f(Rect(first,rest...,color: c,**))\n  (first,rest,c)\nend\nf(Rect(1,2,color: :Black,note: "x"))',
    ),
    "(1, [2], Black)",
  );
  assert.equal(
    run(
      'match Rect(1,2,color: :Black,note: "x")\n  Rect(first,rest...,color: c,**) -> (first,rest,c)\nend',
    ),
    "(1, [2], Black)",
  );
  assert.equal(
    run(
      'macro :take Rect(x,color: c,**) Code$` $(x)\ntake Rect(1,color: :Black,note: "x")',
    ),
    "1",
  );
});

test("ignore markers are pattern operations, not value construction or keyword spreading", () => {
  rejects("Rect(**)", "E_PATTERN_MARKER");
  rejects("Rect(...)", "E_PATTERN_MARKER");
  assert.equal(run(":(Rect(**))"), "Rect(**)");
});

test("moving a concrete value into an abstract slot preserves identity", () => {
  assert.equal(
    run("n = 3 :: Int\n(x :: Any) = n\n(y :: Int) = x\n(n == x,x == n,x == y)"),
    "(True, True, True)",
  );
  assert.equal(
    run("def identity(x :: Any) x\nn = 3 :: Int\nidentity(n) == n"),
    "True",
  );
});

test("abstract value-expression ascriptions are rejected", () => {
  rejects("3 :: Any", "E_ABSTRACT_ASCRIPTION");
  rejects(
    "def U UnionType(type Int,type String)\n3 :: U",
    "E_ABSTRACT_ASCRIPTION",
  );
  rejects(full + "r :: Rectangular", "E_ABSTRACT_ASCRIPTION");
});

test("every abstract field and container element needs a concrete interpretation", () => {
  assert.equal(run("(x :: Any) = 3\nx"), "3");
  assert.equal(run("(xs :: [_... :: Any*]) = [1]\nxs"), "[1]");
  assert.equal(run("def Box type :Box(Any)\nBox(1) :: Box"), "Box(1)");
  rejects("(xs :: [_... :: Any*]) = [[]]\nxs", "E_CONCRETE_TYPE_REQUIRED");
  assert.equal(
    run(
      "(xs :: [_... :: Any*]) = [( [] :: [_... :: Int*]),3 :: Int]\nparse(type [_... :: Any*])(toString(type [_... :: Any*])(xs)) == xs",
    ),
    "True",
  );
});

test("canonical text includes annotations only at abstract positions", () => {
  assert.equal(
    run(
      "def Box type :Box(Any,n: Float)\nb = Box(3 :: Int,n: 4) :: Box\ntoString(Box)(b)",
    ),
    '"Box(3 :: Int, n: 4)"',
  );
  assert.equal(
    run("n = 3 :: Int\n(toString(Int)(n),toString(n))"),
    '("3", "3")',
  );
  assert.equal(run("(x :: Any) = 3 :: Int\ntoString(Int)(x)"), '"3"');
  assert.equal(run("(x :: Any) = 3 :: Int\ntoString(Any)(x)"), '"3 :: Int"');
});

test("REPL inspection distinguishes runtime concrete types from uninterpreted syntax", () => {
  const interpreter = new Interpreter();
  assert.equal(
    inspectResults(interpreter.run("(x :: Any) = 3 :: Int\nx")),
    "3 :: Int",
  );
  assert.equal(inspectResults(interpreter.run("3 :: Int")), "3 :: Int");
  assert.equal(inspectResults(interpreter.run("3")), "3 :: Rational");
  assert.equal(inspectResults(interpreter.run("type Int")), "Int :: Type");
});

test("open type patterns are abstract facets and preserve the complete concrete value", () => {
  assert.equal(
    run(
      full +
        "(p :: Rectangular) = r\n(p,p.w,p.h,p == r,toString(Rectangular)(p))",
    ),
    '(Rect(2, 3, color: "black"), 2, 3, True, "Rect(2, 3, color: \\"black\\") :: Type(Rect(Float, Float, color: String))")',
  );
  rejects(
    'def Rectangular type :Rect(w :: Float,h :: Float,**)\n(p :: Rectangular) = Rect(2,3,color: "black")\np',
    "E_CONCRETE_TYPE_REQUIRED",
  );
});

test("facets can constrain additional positional fields without dropping them", () => {
  assert.equal(
    run(
      "def Full type :R(Int,Int,Int)\ndef First type :R(first :: Int,...)\nr = R(1,2,3) :: Full\n(p :: First) = r\n(p,p.first,p == r,parse(First)(toString(First)(p)) == r)",
    ),
    "(R(1, 2, 3), 1, True, True)",
  );
});

test("facet constraints still check required labels and reject unspecified positional fields", () => {
  assert.equal(run(full + "r .matches (type Rectangular)"), "True");
  assert.equal(
    run(
      "def F type :R(x: Int,**)\n(R(y: 1) .matches (type F),R(1,x: 2) .matches (type F))",
    ),
    "(False, False)",
  );
});

test("abstract fields expose the original concrete type through normal typed narrowing", () => {
  assert.equal(
    run(
      full +
        "def Picture type :Picture(shape: Rectangular)\np = Picture(shape: r) :: Picture\n(shape :: Colored) = p.shape\n(p.shape.w,shape == r,parse(Picture)(toString(Picture)(p)) == p)",
    ),
    "(2, True, True)",
  );
});

test("facet descriptions are ordinary reconstructible values", () => {
  assert.equal(
    run(
      full +
        "t = type Rectangular\nu = parse(Type)(toString(Type)(t))\nFacet(pattern) = t\n(t == u,Facet(pattern) == t)",
    ),
    "(True, True)",
  );
});

test("facet descriptors and values transfer to an environment with no source type names", () => {
  const producer = new Interpreter();
  const values = producer.run(
    full + "(toString(Type)(type Rectangular),toString(Rectangular)(r))",
  );
  const other = new Interpreter();
  other.env.bindings.set("typeText", single([values[0]]));
  other.env.bindings.set("valueText", single([values[1]]));
  assert.equal(
    displayResults(
      other.run(
        "t = parse(Type)(typeText)\nv = parse(t)(valueText)\n(toString(t)(v) == valueText,toString(Type)(t) == typeText)",
      ),
    ),
    "(True, True)",
  );
});

test("local facet text uses names while global text remains structural", () => {
  assert.equal(
    run(
      full +
        "(p :: Rectangular) = r\n(toStringLocal(Rectangular)(p),parseLocal(Rectangular)(toStringLocal(Rectangular)(p)) == p)",
    ),
    '("Rect(2, 3, color: \\"black\\") :: Colored", True)',
  );
});

test("concrete Type cannot disguise an open constraint", () => {
  assert.throws(
    () =>
      run(
        "Type(Apply(:R,OpenFields(Fields(Int),labels: True,positional: False)))",
      ),
    /Facet/,
  );
  assert.throws(
    () =>
      run(
        "Facet(Apply(:R,OpenFields(Fields(),labels: :Maybe,positional: False)))",
      ),
    /invalid type-description shape/,
  );
});

test("abstract order is total inside a common domain but concrete cross-space comparison still fails", () => {
  assert.equal(
    run(
      '(x :: Any) = 1 :: Int\n(y :: Any) = "one" :: String\n(x == y,x < y,y > x)',
    ),
    "(False, True, True)",
  );
  rejects("(1 :: Int) == (1 :: Float)", "E_INCOMPARABLE_TYPES");
});

test("closed serialization rejects extra labels in a fresh environment", () => {
  const i = new Interpreter();
  i.env.bindings.set("text", valLiteral("R(1,extra: 2)"));
  assert.throws(
    () => i.run("def R type :R(Int)\nparse(R)(text)"),
    /unexpected labeled field/,
  );
});

test("facet pattern metadata has no dependence on local capture names", () => {
  assert.equal(
    run(
      "a = type :R(x :: Int,**)\nb = type :R(y :: Int,**)\n(a == b,toString(Type)(a) == toString(Type)(b))",
    ),
    "(True, True)",
  );
  const value = single(new Interpreter().run("type :R(x :: Int,**)"));
  assert.equal(unwrap(value).kind, "type");
});

test("ordinary type values keep their intrinsic meta-type across abstract storage", () => {
  assert.equal(
    run(
      "(x :: Any) = type Int\n(y :: Any) = Int\n(x == y,x == (type Int),toString(Any)(x),parse(Any)(toString(Any)(x)) == x)",
    ),
    '(True, True, "Int :: Type", True)',
  );
});

test("concrete meta-type slots unbox abstract storage and omit redundant annotations", () => {
  assert.equal(
    run(
      "(x :: Any) = type Int\n(m :: Type) = x\n(toString(Type)(m),m == (type Int))",
    ),
    '("Int", True)',
  );
});

test("recursive facets preserve concrete children and survive descriptor reconstruction", () => {
  const source =
    'def Full type :Nil | :Cons(Float,Full,meta: String)\ndef Sequence type :Nil | :Cons(first :: Float,next :: Sequence,**)\nr = Cons(2,:Nil,meta: "x") :: Full\n';
  assert.equal(
    run(
      source +
        "(p :: Sequence) = r\nt = toString(Sequence)(p)\n(p.first,p.next,p == r,parse(Sequence)(t) == r,parse(Type)(toString(Type)(type Sequence)) == (type Sequence))",
    ),
    "(2, Nil, True, True, True)",
  );
  assert.equal(
    run(
      source +
        "t = parse(Type)(toString(Type)(type Sequence))\n(p :: t) = r\ntoString(t)(p) == toString(Sequence)(r)",
    ),
    "True",
  );
});

test("serialized abstract fields require concrete tags through facets and Any", () => {
  assert.throws(() => run('parse(Any)("3")'), /explicit concrete/);
  assert.throws(() => run('parse(Any)("Int")'), /explicit concrete/);
  assert.throws(
    () => run('def F type :R(x :: Int,**)\nparse(F)("R(1)")'),
    /explicit concrete/,
  );
  assert.throws(
    () => run('def Box type :Box(Any)\nparse(Box)("Box(1)")'),
    /explicit concrete/,
  );
});

test("named repetition cannot be smuggled through a portable field description", () => {
  assert.throws(
    () => run("Type(R(x: Repeat(Int)))"),
    /invalid type-description shape/,
  );
});

test("literal punctuation remains distinct from the labeled-rest marker in portable data", () => {
  for (const value of [":R(:**)", ":(R(**))", ":**"])
    assert.equal(
      run("v = " + value + "\nparse(Expression)(toString(Expression)(v)) == v"),
      "True",
      value,
    );
  for (const pattern of [":**", ":**(Int)"])
    assert.equal(
      run(
        "v =\n  type\n    " +
          pattern +
          "\n  end\nend\nparse(Expression)(toString(Expression)(v)) == v",
      ),
      "True",
      pattern,
    );
  rejects("def f(**fields) fields\nf(foo: 1)", "E_KEYWORD_REST_UNSUPPORTED");
});

test("REPL inspection retains abstract field metadata in otherwise concrete values", () => {
  const interpreter = new Interpreter();
  const result = interpreter.run(
    "def Box type :Box(Any)\nBox(3 :: Int) :: Box",
  );
  assert.equal(interpreter.inspect(result), "Box(3 :: Int) :: Box");
});

test("type-description grammar is a structural facet over cached and reconstructed type values", () => {
  assert.equal(
    run(
      TYPE_SCHEMA +
        "\na = type :R(Int)\nb = parse(Type)(toString(Type)(a))\n(a == b,a .matches (type TypeDescription),b .matches (type TypeDescription))",
    ),
    "(True, True, True)",
  );
});

test("Facet construction normalizes root type aliases without creating a concrete space", () => {
  assert.equal(
    run(
      "a = Facet(type :R(Int))\nb = Facet(:(Type(R(Int))))\n(a == b,parse(Type)(toString(Type)(a)) == a)",
    ),
    "(True, True)",
  );
});

test("Facet root normalization is independent of caches and source accessor metadata", () => {
  assert.equal(
    run(
      "a = type :R(x :: Int,**)\nb = parse(Type)(toString(Type)(a))\n(Facet(a) == Facet(b),Facet(b) == b)",
    ),
    "(True, True)",
  );
  rejects(
    "a = type :R(Int,**)\nb = Type(Expression$` Type($(a)))\nR(1) :: b",
    "E_ABSTRACT_ASCRIPTION",
  );
});

test("unsupported predicate descriptions cannot be silently erased by Facet construction", () => {
  assert.throws(
    () => run("Facet((type :R(x :: Int)) .where (R(n) -> n > 0))"),
    /portable predicate description/,
  );
});
