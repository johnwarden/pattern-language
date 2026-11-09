# Patterns as Types tour

The tutorial's editable source lives here, alongside the language implementation.
The [interactive tour](https://patterns-as-types-tour.halvedplume.chatgpt.site)
renders these pages and runs their examples with the native interpreter.

## Edit a lesson

Edit a Markdown file in [pages/](pages/), locally or with GitHub's pencil button.
Keep its `title`, `slug`, `section` and `summary` frontmatter in sync with
[manifest.json](manifest.json). The manifest controls navigation order.

Use fenced `pattern` blocks for runnable programs. Each program is standalone and
runs in a fresh interpreter session. Keep definitions close to their use and leave
blank lines between logical sections. Raw HTML is not supported by the tour.

The current six pages have one starter program each. `expectedOutput` records its
authored native output, including type annotations. Review intended behavior before
changing an expected result; do not replace it merely with observed output.

## Check the examples

From the repository root, using the project's Node.js 24 environment:

```sh
node --experimental-strip-types tutorial/check.mjs
```

This checks page metadata and executes every fenced `pattern` program with the
repository's native interpreter, comparing its actual output with the manifest.
Run the repository's `just check` for its usual full validation.

## Publish edits

Committing Markdown updates the source documents. The hosted tour currently uses
a build-time copy; it does not yet automatically deploy GitHub changes. Ask to
refresh the tour after committing edits. The Site build reads the Markdown,
extracts runnable examples and regenerates its UI content.

[TEACHING-PLAN.md](TEACHING-PLAN.md) records the recovered reviewer outline, the
proposed Rectangle-first progression and explicitly unresolved later topics.
