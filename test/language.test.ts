import test from "node:test";
import assert from "node:assert/strict";
import {
  Interpreter,
  displayResults,
  Grammar,
  DEFAULT_GRAMMAR,
  normal,
  parseExpression,
} from "../src/index.ts";
const run = (s: string) => displayResults(new Interpreter().run(s));
const cases: [string, string, string][] = [
  ["function value", "f = () -> 42\nf", "<function>"],
  ["empty results", "def f()\n  ()\nend\nf()", "()"],
  ["empty lambda", "f = x -> ()\nf(1)", "()"],
  ["multiple results", "f = x -> (x,x)\n(a,b) = f(3)\na + b", "6"],
  ["block result pack", "(a,b) =\n  y = 1\n  (y,y)\nend\na + b", "2"],
  ["ignore named binding result", 'x = (1,foo: "bar")\nx', "1"],
  ["capture named binding result", '(x,foo: f) = (1,foo: "bar")\nf', '"bar"'],
  [
    "ignore preceding extra name",
    '(x,foo: f) = (1,unused: 2,foo: "bar")\nf',
    '"bar"',
  ],
  ["lowercase captures only", ":None = :None\n:None", "None"],
  ["empty outfix", "[]", "[]"],
  [
    "repeated type",
    "def Vector(t :: Type) type [values... :: t*]\n[1,2] :: Vector(Int)",
    "[1, 2]",
  ],
  [
    "nested vector",
    "def Vector(t :: Type) type [values... :: t*]\n[[1,2],[]] :: Vector(Vector(Int))",
    "[[1, 2], []]",
  ],
  [
    "tuple type args",
    'def Tuple(ts... :: Type*) type {ts…}\n{1,"a"} :: Tuple(Int,String)',
    '{1, "a"}',
  ],
  [
    "empty tuple type args",
    "def Tuple(ts... :: Type*) type {ts…}\n{} :: Tuple()",
    "{}",
  ],
  [
    "lazy names",
    "def List(t :: Type) type :Nil | :Cons(t,List(t))\nList(Int)",
    "Type(Recursive(:Nil | Cons(Int, Recur(0))))",
  ],
  [
    "recursive type",
    "def List(t :: Type) type :Nil | :Cons(t,List(t))\nCons(1,Cons(2,:Nil)) :: List(Int)",
    "Cons(1, Cons(2, Nil))",
  ],
  [
    "field accessor",
    "def Rectangle type :Rect(w :: Float,h :: Float)\nr = Rect(3,4) :: Rectangle\nr.w",
    "3",
  ],
  [
    "field function",
    "def Rectangle type :Rect(w :: Float,h :: Float)\nr = Rect(3,4) :: Rectangle\nw(r)",
    "3",
  ],
  [
    "field name versus capture",
    "def R type :Rect(width: w :: Int)\nr = Rect(width: 3) :: R\nr.w",
    "3",
  ],
  [
    "rest accessor returns list",
    "def Vector(t :: Type) type [values... :: t*]\nv = [1,2] :: Vector(Int)\n[a,b] = v.values\na + b",
    "3",
  ],
  [
    "interpretation equality",
    "def R type :Rect(w :: Int)\nr = Rect(3) :: R\nr == (Rect(3) :: R)",
    "True",
  ],
  ["structural ordering", "Rect(1,2) < Rect(1,3)", "True"],
  ["quoted symbol", "v = :f\nv", "f"],
  [
    "pattern union",
    "def S type :Rect(Int,Int) | :Circle(Int)\nCircle(2) :: S",
    "Circle(2)",
  ],
  ["block def", "def f(x)\n  y = x ^ 2\n  y + 1\nend\nf(3)", "10"],
  [
    "nested definition",
    "def outer(x)\n  def inner(y) x + y\n  inner(2)\nend\nouter(3)",
    "5",
  ],
  ["anonymous block", "f = x ->\n  y = x ^ 2\n  y + 1\nend\nf(3)", "10"],
  ["if clauses", "if 1 < 2\n  x = 1\n  x + 1\nelse\n  3\nend", "2"],
  [
    "macro in head",
    "f = x -> x + 1\ng = x -> x + 2\n(if True f else g)(3)",
    "4",
  ],
  ["match", "match Some(2)\n  :Some(v) -> v\n  :None -> 0\nend", "2"],
  [
    "anonymous type macro",
    "t = t -> type :Some(value :: t)\nt(type Int)",
    "Type(Some(Int))",
  ],
  ["option", "1 :: Int?", "1"],
  ["list of options", "[1,:None] :: [_... :: Int?*]", "[1, None]"],
  ["result", "Ok(1) :: Int^", "Ok(1)"],
];
for (const [name, source, expected] of cases)
  test(name, () => assert.equal(run(source), expected));
const failures: [string, string, RegExp][] = [
  ["cross-kind ordering", '1 < "a"', /different concrete types/],
  ["extra positional result", "x = (1,2)\nx", /received 2/],
  [
    "extra positional block result",
    "x =\n  y = 1\n  (y,y)\nend\nx",
    /received 2/,
  ],
  [
    "binding cannot consume zero results",
    "x = ()\nx",
    /expected field|received 0/,
  ],
  ["wrong first pack", "def f(x,y)(z) z\nf(1)", /no applicable/],
  ["uppercase is literal", ":None = Some(1)\n:None", /expected None/],
  ["repeat binding differs", "Pair(x,x) = Pair(1,2)\nx", /duplicate capture/],
  [
    "repeat type differs",
    "def Same type :Pair(x :: Int,x :: Int)\nPair(1,2) :: Same",
    /duplicate capture/,
  ],
  [
    "bad vector element",
    'def Vector(t :: Type) type [values... :: t*]\n[1,"bad"] :: Vector(Int)',
    /expected Vector\(Int\)/,
  ],
  [
    "no structural accessor discovery",
    "def R type :Rect(w :: Int)\nRect(3).w",
    /no applicable/,
  ],
  [
    "function accessor collision",
    "def R type :Rect(w :: Int)\ndef w(x) 7\nr = Rect(3) :: R\nr.w",
    /ambiguous call/,
  ],
  [
    "equal named interpretations are rejected",
    "def R type :Rect(w :: Int)\ndef S type :Rect(w :: Int)\nr = (Rect(3) :: R) :: S\nr.w",
    /same structural identity/,
  ],
  [
    "interpretation equality original Int/Rational",
    "def R type :Rect(w :: Int)\nr = Rect(3) :: R\nr == Rect(3)",
    /different concrete types cannot be compared/,
  ],
  [
    "mixed Int plus unannotated Rational",
    "(3 :: Int) + 1",
    /same concrete numeric type/,
  ],
  [
    "inexact Float designation",
    "0.1 :: Float",
    /not exactly representable as Float/,
  ],
  [
    "withdrawn Number type",
    "0.1 :: Number",
    /unbound/,
  ],
  [
    "mixed Float32 plus unannotated Rational",
    "float32(0.5) + 0.5",
    /same concrete numeric type/,
  ],
  [
    "mixed Float32 equals unannotated Rational",
    "float32(0.5) == 0.5",
    /different concrete types cannot be compared/,
  ],
  ["nonproductive recursion", "def Loop type Loop\n1 :: Loop", /nonproductive/],
  ["program final binding", "x = 1", /must end with a result/],
  [
    "block final binding",
    "def f(x)\n  y = x\nend\n0",
    /must end with a result/,
  ],
  ["program final definition", "def f(x) x", /must end with a result/],
  ["infix needs spaces", "1+2", /spaces/],
  ["named precedes positional", "Rect(w: 1,2)", /positional/],
  ["duplicate labels", "Rect(w: 1,w: 2)", /duplicate/],
];
for (const [name, source, pattern] of failures)
  test(name, () => assert.throws(() => run(source), pattern));
test("empty calls preserve structure", () =>
  assert.notDeepEqual(parseExpression("f"), parseExpression("f()")));
test("outfix versus nested head", () =>
  assert.notDeepEqual(parseExpression("[1, 2]"), parseExpression("[](1,2)")));
test("grammar is authoritative for execution", () => {
  const grammar = DEFAULT_GRAMMAR.replace(":if ", ":when ");
  const i = new Interpreter(grammar);
  assert.equal(displayResults(i.run("when True 1 else 2")), "1");
  assert.throws(() => i.run("if True 1 else 2"), /grammar|macro/);
});
test("custom grammar rejects duplicate captures", () => {
  assert.throws(
    () => new Grammar("def Same type :Pair(x :: Int,x :: Int)"),
    /duplicate capture/,
  );
});
test("grammar repetition", () => {
  const g = new Grammar("def Many type :Many(xs... :: Int*)");
  assert.equal(normal(g.parseAs("Many(1, 2)", "Many")), "Many(1, 2)");
});
test("REPL permits a binding and commits only on success", () => {
  const i = new Interpreter();
  i.run("x = 1", "repl");
  assert.equal(displayResults(i.run("x + 1", "repl")), "2");
  assert.throws(() => i.run("z = 9\n1 / 0", "repl"));
  assert.throws(() => i.run("z", "repl"), /unbound/);
});
for (const [name, source, expected] of cases.filter(
  ([name]) => !["anonymous type macro"].includes(name),
))
  test("canonical roundtrip: " + name, () => {
    const i = new Interpreter(),
      tree = i.parse(source);
    assert.equal(tree.kind, "block");
    if (tree.kind !== "block") return;
    const canonical = tree.lines.map((n) => normal(n)).join("\n");
    assert.equal(run(canonical), expected, canonical);
  });
test("nested bindings require explicit label openness", () =>
  assert.equal(run("Rect(x,**) = Rect(1,extra: 2)\nx"), "1"));
test("nested function patterns permit explicitly ignored labels", () =>
  assert.equal(run("def f(Rect(x,**)) x\nf(Rect(1,extra: 2))"), "1"));
test("untyped grammar rejects duplicate captures", () => {
  assert.throws(
    () => new Grammar("def Same type :Pair(x,x)"),
    /duplicate capture/,
  );
});
test("empty grammar repetition", () =>
  assert.equal(
    normal(
      new Grammar("def Many type :Many(xs... :: Int*)").parseAs(
        "Many()",
        "Many",
      ),
    ),
    "Many()",
  ));
test("constructor shape independent of interpretation names", () =>
  assert.equal(
    run(
      "def produce()\n  def R type :Rect(w :: Int)\n  Rect(2) :: R\nend\na = produce()\ndef S type :Rect(width :: Int)\nb = Rect(2) :: S\na == b",
    ),
    "True",
  ));
test("parameter annotations and destructuring share type references", () =>
  assert.equal(run("Pair(Int,Int) = Pair(1,2)\nTrue"), "True"));
test("type annotation checks all declared fields", () =>
  assert.equal(
    run(
      "def R type :Rect(w :: Int,extra: Int)\n(r :: R) = Rect(1,extra: 2)\nr",
    ),
    "Rect(1, extra: 2)",
  ));

test("opaque functions require a structural representation for equality", () =>
  assert.throws(
    () => run("f = x -> x\nf == f"),
    /value has no structural representation/,
  ));
test("opaque partial applications cannot use host identity as equality", () =>
  assert.throws(
    () => run("def f(x)(y) x + y\ng = f(1)\nh = f(2)\ng == h"),
    /value has no structural representation/,
  ));

test("labels supply default captures in bindings and function parameters", () => {
  assert.equal(run("(width: Int) = (width: 3)\nwidth"), "3");
  assert.equal(run("def f(width: Int) width\nf(width: 3)"), "3");
  assert.equal(
    run("def f(rest: type [_... :: Int*]) rest\nf(rest: [2,3])"),
    "[2, 3]",
  );
  assert.throws(() => run("(tag: :Red) = (tag: :Red)\ntag"), /unbound name/);
});

test("implicit named type captures define accessors", () => {
  assert.equal(
    run(
      "def R type :Rect(width: Int,height: Int)\nr = Rect(width: 3,height: 4) :: R\nr.width * height(r)",
    ),
    "12",
  );
  assert.equal(
    run(
      "def R type :Rect(rest: type [_... :: Int*])\nr = Rect(rest: [2,3]) :: R\nr.rest",
    ),
    "[2, 3]",
  );
});

test("explicit capture and wildcard override the default label capture", () => {
  assert.equal(run("def f(width: w :: Int) w\nf(width: 3)"), "3");
  assert.throws(
    () => run("def f(width: w :: Int) width\nf(width: 3)"),
    /unbound/i,
  );
  assert.throws(() => run("(width: _) = (width: 3)\nwidth"), /unbound/i);
  assert.throws(
    () =>
      run(
        "def R type :Rect(width: w :: Int)\nr = Rect(width: 3) :: R\nr.width",
      ),
    /unbound/i,
  );
});

test("rest captures only remaining positional fields", () => {
  for (const [input, expected] of [
    ["1", "[]"],
    ["1,2", "[2]"],
    ["1,2,3", "[2, 3]"],
    ["1,foo: 2", "[]"],
  ]) {
    assert.equal(run(`def f(first,rest...) [rest...]\nf(${input})`), expected);
    assert.equal(run(`(first,rest...) = (${input})\n[rest...]`), expected);
  }
  assert.equal(run("[first,rest...] = [1,2,3]\n[rest...]"), "[2, 3]");
});

test("labels must start lowercase in values and patterns", () => {
  for (const source of [
    "Rect(Width: 3)",
    "def f(Width: Int) 1\nf(Width: 3)",
    "(Width: x) = (width: 3)\nx",
    "Rect(_1: 3)",
  ]) {
    assert.throws(
      () => new Interpreter().parse(source),
      /labels must be lowercase/,
    );
  }
  assert.equal(
    run('def f(firstName: String) firstName\nf(firstName: "Ada")'),
    '"Ada"',
  );
});

test("canonical named fields sort after positional fields", () => {
  assert.equal(normal(parseExpression("R(9,z: 2,a: 1)")), "R(9, a: 1, z: 2)");
  assert.equal(normal(parseExpression("(9,z: 2,a: 1)")), "(9, a: 1, z: 2)");
  assert.equal(run("R(9,z: 2,a: 1)"), "R(9, a: 1, z: 2)");
});

test("named matching ignores declaration and argument order", () => {
  for (const pattern of ["a: Int,z: Int", "z: Int,a: Int"]) {
    for (const args of ["a: 1,z: 2", "z: 2,a: 1"]) {
      assert.equal(
        run(`def f(x,${pattern})\n  (x,a,z)\nend\nf(9,${args})`),
        "(9, 1, 2)",
      );
      assert.equal(run(`(${pattern}) = (${args})\n(a,z)`), "(1, 2)");
      assert.equal(
        run(`def R type :R(${pattern})
r = R(${args}) :: R
(r.a,r.z)`),
        "(1, 2)",
      );
    }
  }
  assert.equal(run("def f(R(z: Int,a: Int)) a + z\nf(R(a: 1,z: 2))"), "3");
  assert.equal(run("(z: Int,a: Int) = (a: 1,extra: 9,z: 2)\n(a,z)"), "(1, 2)");
  assert.equal(run("def f(z: Int,a: Int) a\nf(a: 1,extra: 9,z: 2)"), "1");
});

test("named order does not change equality or ordering", () => {
  assert.equal(run("R(z: 2,a: 1) == R(a: 1,z: 2)"), "True");
  assert.equal(run("R(z: 2,a: 1) < R(a: 1,z: 2)"), "False");
  assert.equal(run("R(z: 9,a: 1) < R(a: 2,z: 0)"), "True");
  assert.equal(
    run("Pair(x,y) = Pair(R(z: 2,a: 1),R(a: 1,z: 2))\nx == y"),
    "True",
  );
});

test("duplicate named labels are surface errors including nested packs", () => {
  for (const source of [
    "R(a: 1,a: 2)",
    "(a: 1,a: 2)",
    "def f(a: Int,a: Int) 1\n0",
    "(a: x,a: y) = (a: 1)\n0",
  ]) {
    assert.throws(
      () => parseExpression(source.split("\n")[0].replace(/^def f/, "f")),
      /duplicate/,
    );
    assert.throws(() => new Interpreter().parse(source), /duplicate/);
  }
});

test("rest captures are list values at every length and binding boundary", () => {
  for (const [tail, expected] of [
    ["", "[]"],
    [",2", "[2]"],
    [",2,3", "[2, 3]"],
  ]) {
    assert.equal(run(`[y,rest...] = [1${tail}]\nrest`), expected);
    assert.equal(run(`(y,rest...) = (1${tail})\nrest`), expected);
    assert.equal(run(`def f(y,rest...) rest\nf(1${tail})`), expected);
    assert.equal(
      run(`def V type [y :: Int,rest... :: Int*]\nv = [1${tail}] :: V\nv.rest`),
      expected,
    );
    assert.equal(run(`[y,rest...] = [1${tail}]\nrest == ${expected}`), "True");
  }
  assert.equal(run("[y,rest...] = [1,2]\n[0,rest...]"), "[0, 2]");
  assert.equal(
    run("def one(x :: [_... :: Int*]) x\n[y,rest...] = [1,2]\none(rest)"),
    "[2]",
  );
});

test("all calls ignore extra names but require positional and named pattern fields", () => {
  assert.equal(run("def f(x) x\nf(1,foo: 2)"), "1");
  assert.equal(run("toString(3,extra: 4)"), '"3"');
  assert.equal(run("+(1,extra: 4)(2,other: 5)"), "3");
  assert.equal(
    run("def R type :R(x :: Int)\nr = R(2) :: R\nx(r,extra: 3)"),
    "2",
  );
  assert.throws(
    () => run("def f(size: Int) size\nf(other: 3)"),
    /no applicable/,
  );
  assert.throws(() => run("def f(x) x\nf(1,2,extra: 3)"), /no applicable/);
});

test("labeled defaults bind, override, and validate values", () => {
  const color = "def Color type :Black | :White\n";
  assert.equal(
    run(color + "(size: s :: Int,color: c :: Color = :Black) = (size: 3)\nc"),
    "Black",
  );
  assert.equal(
    run(
      color +
        "def f(size: s :: Int,color: c :: Color = :Black) c\nf(size: 3,extra: 9)",
    ),
    "Black",
  );
  assert.equal(
    run(
      color +
        "def f(size: s :: Int,color: c :: Color = :Black) c\nf(color: :White,size: 3)",
    ),
    "White",
  );
  assert.equal(run("(size: Int = 3) = ()\nsize"), "3");
  assert.equal(run("(size: s = 3) = ()\ns"), "3");
  assert.equal(run("def f(size: Int = (1 / 0)) size\nf(size: 4)"), "4");
  assert.equal(run("fallback = 3\ndef f(size: Int = fallback) size\nf()"), "3");
  assert.throws(
    () => run(color + "def f(color: c :: Color = :Black) c\nf(color: :Red)"),
    /no applicable/,
  );
  assert.throws(
    () => run('def f(size: Int = "bad") size\nf()'),
    /default for size does not match/,
  );
  assert.throws(
    () => run("def f(size: Int = (1,2)) size\nf()"),
    /default value requires 1/,
  );
  assert.throws(
    () => run("(size: Int) = ()\nsize"),
    /missing required labeled argument/,
  );
});

test("binding defaults preserve inputs and type definitions reject defaults", () => {
  assert.equal(run("def f(R(size: Int = 3,**)) size\nf(R(extra: 9))"), "3");
  assert.equal(run("match R()\n  R(size: Int = 3) -> size\nend"), "3");
  assert.equal(
    run("r = R(extra: 9)\nR(size: s :: Int = 3,**) = r\n(r,s)"),
    "(R(extra: 9), 3)",
  );
  assert.throws(
    () => run("def R type :R(size: Int = 3)\n0"),
    /defaults are only allowed in binding patterns/,
  );
  const source = "def f(size: s :: Int = 3) s\nf()";
  const tree = new Interpreter().parse(source);
  assert.equal(run(normal(tree)), "3");
});

test("built-in concrete types require exact labels", () => {
  for (const source of [
    "Some(1,meta: 2) :: (type :Some(Int))",
    "Ok(1,meta: 2) :: (type :Ok(Int))",
    "[1,2,meta: 3] :: [_... :: Int*]",
  ])
    assert.throws(() => run(source), /unexpected labeled field/);
  assert.throws(() => run("Some(meta: 2) :: (type :Some(Int))"), /expected/);
});

test("question mark preserves option type semantics in defaulted fields", () => {
  const color = "def Color type :Black | :White\n";
  assert.equal(run(color + "(color: c :: Color? = :Black) = ()\nc"), "Black");
  assert.equal(
    run(color + "def f(color: c :: Color? = :Black) c\nf()"),
    "Black",
  );
  assert.equal(
    run(color + "def f(color: c :: Color? = :Black) c\nf(color: :White)"),
    "White",
  );
  assert.throws(
    () => run(color + "(color: c :: Color? = Some(:Black)) = ()\nc"),
    /expected/,
  );
  assert.throws(
    () =>
      run(
        color + "def f(color: c :: Color? = :Black) c\nf(color: Some(:White))",
      ),
    /no applicable/,
  );
  assert.throws(
    () => run(color + "(color: c :: Color?) = ()\nc"),
    /missing required labeled argument/,
  );
});

test("named type captures stay local to each interpreted instance", () => {
  assert.equal(
    run(
      "def R type :R(x :: Int)\ndef sum(a :: R,b :: R) a.x + b.x\nsum(R(1),R(2))",
    ),
    "3",
  );
  assert.equal(
    run("def R type :R(x :: Int)\n(a :: R,b :: R) = (R(1),R(2))\na.x + b.x"),
    "3",
  );
  assert.equal(
    run(
      "def R type :R(x :: Int)\ndef Pair type :Pair(R,R)\nPair(R(1),R(2)) :: Pair",
    ),
    "Pair(R(1), R(2))",
  );
  assert.throws(
    () => run("def Same type :Pair(x :: Int,x :: Int)\nPair(1,2) :: Same"),
    /duplicate capture/,
  );
});

test("grouped layout must consume every source line", () => {
  for (const s of ["(\n  1\n0 / 0\n)", "(\n  1\nx = 2\n)", "f(\n  1\n2\n)"]) {
    assert.throws(() => new Interpreter().parse(s), /inconsistent indentation/);
    assert.throws(() => run(s), /inconsistent indentation/);
  }
});

test("ambiguous patterns do not silently fall through arms or dispatch", () => {
  assert.throws(
    () => run("match 1\n  (x | x) -> 10\n  _ -> 20\nend"),
    /ambiguous pattern/,
  );
  assert.throws(() => run("def f(x | x) 1\nf(1)"), /ambiguous pattern/);
});

test("actions are absent and prefix exclamation stays reserved", () => {
  assert.throws(() => run("action(() -> ())"), /unbound name/);
  assert.throws(() => run("!(1)"), /reserved/);
  assert.equal(parseExpression("()!").kind, "postfix");
  assert.equal(normal(parseExpression("Int!")), "Int!");
});

test("ASCII camel and upper-snake words have explicit spelling boundaries", () => {
  for (const s of ["foo_bar", "foo_", "_FOO", "A__B", "A_B_", "café"])
    assert.throws(() => parseExpression(s), /ASCII/);
  for (const s of [
    "HTTP",
    "someURL",
    "URLValue",
    "aB",
    "ABc",
    "AB_",
    "A_B",
    "ERR_FILE_NOT_FOUND",
    "foo",
    "fooBar",
    "Http",
    "UserId",
    "Int",
    "T",
    "Ts",
  ])
    assert.doesNotThrow(() => parseExpression(s));
});

test("variables and defined functions have separate namespaces", () => {
  assert.equal(run("def R type :R(x :: Int)\nx = 5\nx"), "5");
  assert.equal(run("def R type :R(x :: Int)\ndef inc(x) x + 1\ninc(2)"), "3");
  assert.equal(run("def f(x) x + 1\nf = 9\n(f,f(2))"), "(9, 3)");
  assert.equal(run("f = x -> x + 1\nf(2)"), "3");
  assert.equal(
    run("def f(:Red) 1\ndef f(:Blue) 2\n(f(:Red),f(:Blue))"),
    "(1, 2)",
  );
  assert.throws(
    () => run("def f(x) 1\ndef f(:Red) 2\nf(:Red)"),
    /ambiguous call/,
  );
  assert.equal(
    run("def R type :R(x :: Int)\nx = 5\nr = R(2) :: R\n(x,x(r),r.x)"),
    "(5, 2, 2)",
  );
});

test("equals binds only in a block interpretation", () => {
  assert.equal(run("x = 5\ny = 1\nx + y"), "6");
  assert.throws(() => run("R(z: (x = 1),a: x)"), /unbound name/);
  assert.throws(() => run("def f(x) x\nf(y = 1)"), /unbound name/);
  assert.equal(
    run("def Syntax type\n  :=(Int)(Int)\nend\n(:=(1)(2)) :: Syntax"),
    "1 = 2",
  );
});

test("defined functions and accessors are not values", () => {
  for (const source of [
    "def f(x) x\nf",
    "def f(x) x\ndef use(x) x\nuse(f)",
    "def f(x) x\ndef make() f\nmake()",
    "def Rectangle type :Rect(w :: Float,h :: Float)\nw",
    "toString",
  ])
    assert.throws(() => run(source), /cannot be used as a value/);
});

test("callable variables compete with accessor methods", () => {
  const setup =
    "def Rectangle type :Rect(w :: Float,h :: Float)\nr = Rect(3,4) :: Rectangle\nw = (r :: Rectangle) -> r.h\n";
  for (const call of ["w(r)", "r.w"]) {
    assert.throws(
      () => run(setup + call),
      (error: any) => {
        assert.equal(error.diagnostic.code, "E_AMBIGUOUS_CALL");
        return true;
      },
    );
  }
  assert.equal(run(setup + "w"), "<function>");
  assert.equal(run(setup + "local = w\nlocal(r)"), "4");
});

test("direct calls select the only matching callable across namespaces", () => {
  assert.equal(
    run(
      'def f(x :: Float) x + (1 :: Float)\nf = (x :: String) -> x\n(f(2),f("hi"))',
    ),
    '(3, "hi")',
  );
  assert.equal(run("def f(x) x + 1\nf = 99\n(f,f(2))"), "(99, 3)");
  assert.throws(() => run("def f(x) x\nf = x -> x + 1\nf(2)"), /ambiguous/i);
});

test("anonymous wrappers and pack partial applications remain values", () => {
  assert.equal(run("def f(x) x + 1\ndef use(g) g(3)\nuse(x -> f(x))"), "4");
  assert.equal(run("def f(x)(y) x + y\ng = f(2)\ng(3)"), "5");
});
