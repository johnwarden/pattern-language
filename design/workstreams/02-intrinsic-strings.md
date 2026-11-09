# Workstream 2: intrinsic String values

Status: implemented in PR #31, awaiting review. Ordinary runtime String
literals and String-returning natives ascribe the String primitive. Quoted Code
splices those values as string literals, matching Rational. The PR also carries
the 9 November primitive-name and symbol-printing rulings (LANGUAGE-DECISIONS
D19, D20). PrimitiveType and public inspection/decoding remain unchosen.

## Accepted behavior

Ordinary runtime String literals have intrinsic String identity. Operations whose
result is textual, including typed `toString`, should return String rather than
relying on raw Expression fallback. Use one consistent mechanism for literal and
native results; do not infer an expected type from observed output.

Target source checks include:

```text
expect "hello" result "hello" :: String
expect "a" + "b" result "ab" :: String
expect toString(Rational)(0.1) result "0.1" :: String
```

These checks are live in `tests/specification/primitives.test`.

## Scope and boundaries

- Align literal evaluation, intrinsic/observed type reporting and String-returning
  native paths coherently. Keep numeric and symbol identities intact.
- Audit source and host expectations according to what their subjects represent.
  Runtime strings and inert syntax containing a string are different roles; do
  not mechanically replace every Expression expectation with String.
- Promote the affected same-subject String todos and retire their superseded
  legacy counterparts together. Keep unrelated primitive/metatype todos pending.
- Preserve expected results as inert data, quote hygiene, source locations,
  literal/reader contents, canonical text and fresh-context transport.
- Preserve current equivalent-declaration/accessor collision errors. Do not change
  declaration registration or choose the public inspection/decoding boundary.
- No PrimitiveType redesign, descriptor-to-Type coercion, new public tree taxonomy,
  numeric policy or general inference belongs in this PR. If String alignment
  genuinely needs an undecided boundary, report the minimal example instead of
  assigning it semantics.

## Ownership and coordination

Own String-related paths in `src/values.ts`, runtime literal evaluation and native
text-result paths in `src/runtime.ts`, plus the associated tests. Announce any
additional shared methods or files in the PR before editing. The declaration
workstream owns type construction/definition/accessor methods in the same runtime
file. Avoid unrelated formatting and changes to shared roadmap/checklist prose.

Keep the baseline audit agent away from String-related promotions. Both branches
start from master; do not silently stack on the baseline draft. The coordinator
reviews integration and rebases the declaration branch after this work lands.

## Acceptance criteria

- Direct literals, returned strings, concatenation and typed printing report String
  consistently, including through calls, bindings and collections.
- Positive/negative type checks and fresh-interpreter parse/print checks cover the
  changed behavior; quoted Code remains inert and structurally round-trips.
- Relevant active assertions pass, fulfilled todos are removed deliberately, and
  the legacy inventory remains accurate. No harness relaxation hides failures.
- Targeted checks and the final PR's full `just check` gate pass. No source grammar
  or inspection/decoding policy is chosen to make a test pass.

Use `just test-language tests/specification/primitives.test` and affected example
groups while working. Merge requires the author's explicit authorization for
this PR. Report the commit, validation and remaining boundaries when ready.
