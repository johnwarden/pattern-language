<!-- SYNTAX TEST "Packages/PatternLanguage/Markdown.sublime-syntax" -->

# Markdown remains Markdown
<!-- <- markup.heading.1.markdown - source.pattern-language -->

```pattern
<!-- <- punctuation.definition.raw.code-fence.begin.markdown -->
value = Some(Int)
<!--    ^^^^ constant.other.symbol.constructor.pattern-language -->
<!--         ^^^ support.type.pattern-language -->
answer = 42
<!--     ^^ constant.numeric.pattern-language -->
```
<!-- <- punctuation.definition.raw.code-fence.end.markdown - source.pattern-language -->

**Markdown stays bold**
<!--^ markup.bold.markdown - source.pattern-language -->

````pattern test
<!-- <- punctuation.definition.raw.code-fence.begin.markdown -->
test "Embedded test"
<!-- <- keyword.other.test.pattern-language -->
  expect 2 is 2 :: Rational
<!--     ^ constant.numeric.pattern-language -->
```
<!-- <- source.pattern-language -->
value = [
<!-- <- source.pattern-language -->
`````
<!-- <- punctuation.definition.raw.code-fence.end.markdown - source.pattern-language -->

# Heading after an unfinished Pattern group
<!-- <- markup.heading.1.markdown - source.pattern-language -->

~~~pattern test
<!-- <- punctuation.definition.raw.code-fence.begin.markdown -->
todo test "Later"
<!-- <- keyword.other.test.pattern-language -->
  assert False
<!--     ^^^^^ constant.language.pattern-language -->
~~~~
<!-- <- punctuation.definition.raw.code-fence.end.markdown - source.pattern-language -->

```python
answer = 42
<!-- <- source.python - source.pattern-language -->
```

```patterned
not Pattern code
<!-- <- - source.pattern-language -->
```

```pattern
text = "
  an unfinished block string
<!-- <- source.pattern-language -->
```
<!-- <- punctuation.definition.raw.code-fence.end.markdown - source.pattern-language -->

# Heading after an unfinished Pattern string
<!-- <- markup.heading.1.markdown - source.pattern-language -->
