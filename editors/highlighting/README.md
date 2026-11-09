# Pattern Language highlighting

Sublime Text package for `.pattern` and `.test` files, targeting build **4166**.
Also includes a TextMate grammar and a working Markdown fence renderer. No Node
dependencies or editor plugin code are needed to install the Sublime package.

## Install in Sublime Text

Copy the entire `sublime/PatternLanguage` directory into the folder opened by
**Preferences → Browse Packages…**. Reopen a `.pattern` or `.test` file. If it
already has another syntax selected, choose **View → Syntax → Pattern Language**.
The package supplies `#` comment toggling and a default tab width of two;
syntax-specific user settings can override that width.

Alternatively, copy `PatternLanguage.sublime-package` into **Installed Packages**,
the sibling of the Packages folder opened by Browse Packages. Install either the
directory or the archive. The archive contains the files directly, without an
extra parent directory.

Build the archive from a repository checkout:

```sh
python3 editors/highlighting/package_sublime.py --output dist/PatternLanguage.sublime-package
```

The grammar uses `.sublime-syntax` version 2, available since build 4075, and no
newer syntax API. See the official [syntax documentation](https://www.sublimetext.com/docs/syntax.html)
and [4075 changelog](https://www.sublimetext.com/dev). Compatibility with build
4166 is based on that format support. A native Sublime 4166 run has not been
performed in the development environment.

## Token colors

The package selects **Pattern Language Dark** for `.pattern` and `.test` files.
Four roles have deliberately different colors, using their existing token scopes:

| Role                                            | Dark             | Light            |
| ----------------------------------------------- | ---------------- | ---------------- |
| Numbers                                         | Orange `#F4A261` | Orange `#9C4B00` |
| UpperCamel and type names                       | Cyan `#62D6E8`   | Blue `#006B88`   |
| Control, declaration and test words             | Purple `#C792EA` | Purple `#7A3EAC` |
| Quoted, UpperSnake and constructor-like symbols | Green `#B7D97A`  | Green `#426F13`  |

Tight UpperCamel call heads use the symbol color: `Some` in `Some(Int)` is green,
and `Int` remains blue. Bare UpperCamel names retain the type-name color, as do
built-in names in call position. This is a lexical cue for the call shape;
resolving user-defined constructors and type factories remains semantic work.

To use the light palette, open a Pattern Language file, choose **Preferences →
Settings – Syntax Specific**, and add this setting to the user settings:

```json
"color_scheme": "Packages/PatternLanguage/PatternLanguage Light.sublime-color-scheme"
```

Selection is specific to Pattern Language. The UI theme and other languages keep
their existing settings. These are complete palettes, so Pattern Language's text
area uses the selected palette's dark or light background. Syntax-specific user
settings can choose another scheme. The files use the documented
[JSON color-scheme format](https://www.sublimetext.com/docs/color_schemes.html),
with filename-based selection and no inheritance extension.

## Coverage and limits

Recognizes declarations, patterns/bindings, macros, match/control forms, test DSL
keywords (including `todo test`), type annotations, labels, symbol classes,
collections, rest captures, punctuation and numeric spellings. `#` starts a comment
outside strings even when touching an operand; `?` has no special optional-type
meaning in the grammar. Source definitions decide what postfix operators mean.

Raw and escaped strings, raw reader apostrophes, typed backtick quotes, explicit
interpolation, and indented quote blocks have separate contexts. Literal string
contents keep their own scopes instead of treating `#` as a comment. Quotes do
not imply code execution.

This is lexical highlighting, not a semantic parser. Source-defined grammars and
macros can change the language beyond what a static grammar can know. Inline
typed quotes use the rest of their line; block quotes use an aligned `end`.
Grammar-dependent clause continuations, arbitrary reader payload languages,
provisional angle-parameter syntax and invalid-program diagnostics are not fully
modeled. Coloring is not a claim that a program is supported or type-correct.

The generic `.test` extension may be used by other languages. Use the Syntax menu
to choose the appropriate language for those files.

## Reuse outside Sublime

`lexical.json` stores shared spelling tables. `generate.mjs` builds explicit
Sublime contexts and `textmate/pattern-language.tmLanguage.json` from those tables;
there is no runtime dependency on the interpreter. The scope is
`source.pattern-language`.

The TextMate grammar can be registered with compatible editors and renderers.
`examples/markdown.mjs` implements a Shiki highlight callback for fences named
`pattern` or `pattern-language`:

```js
import { createPatternFenceHighlighter } from "./examples/markdown.mjs";

const renderer = await createPatternFenceHighlighter();
try {
  const html = renderer.highlight(
    'todo test "Future"\n  assert False\nend',
    "pattern",
  );
  // Supply renderer.highlight as the highlight option in a Markdown renderer.
} finally {
  renderer.dispose();
}
```

Highlighted output escapes source HTML. The host Markdown renderer remains
responsible for parsing Markdown and safely rendering unhandled fence languages.

A native Vim adapter is a next step, not an included feature. It can generate
Vim syntax groups from `lexical.json`; nested interpolation and indentation-sensitive
regions need editor-specific state rules and regression tests. A Tree-sitter
grammar would be a separate parser project, especially for source-defined syntax.

## Develop and verify

The separate package keeps highlighting dependencies out of the interpreter build:

```sh
cd editors/highlighting
npm ci
npm run generate
npm run check
npm test
```

The tests exercise real TextMate/Oniguruma tokenization, compare spelling rules
with the language's lexer/numeric helpers, compile the Sublime patterns, check
context references and generated-file consistency, and render escaped Markdown
fences. They do not emulate Sublime's syntax engine.

Color checks apply the actual palette rules through TextMate/Shiki and assert the
rendered colors of numbers, UpperCamel/type names, clause words and quoted symbols,
including interpolation. Both palettes also check contrast against their background
and hue separation for the previously colliding pairs. Native scheme application
on Sublime 4166 still needs verification.

To run the native assertions, install the unpacked package, open
`sublime/PatternLanguage/syntax_test_pattern-language.pattern` in Sublime and run
**Tools → Build**. The fixture is generated from authored `test/cases.json` checks;
edit the fixtures or generator rather than generated grammar files.

With a Pattern Language file active, the Sublime console can check the resolved
foregrounds against the palette table:

```python
[(scope, view.style_for_scope("source.pattern-language " + scope + ".pattern-language")["foreground"]) for scope in ("constant.numeric", "entity.name.type", "keyword.control", "constant.other.symbol", "constant.other.symbol.constructor", "constant.other.symbol.upper-snake")]
```
