# Working on the pattern language

The TypeScript implementation is the bootstrap reference. Read ROADMAP.md and the
relevant specification before changing language semantics. Future contracts in the
suite are not evidence that their language features are implemented.

Run npm run check, npm run build, npm test, and npm run test:language. Build before
host tests because playground checks exercise the generated browser bundle.

The source suite is tests/**/*.test, grouped by topic. Assertions use
expect subject result expected :: Type, assert, and expect subject error "reason".
Expected results are data, not expressions to execute. Todo assertions run and must
fail; an unexpected success requires removing todo. Legacy assertions must pass
until explicitly retired. Do not generate expected values from current outputs.

Use the common pattern compiler/matcher and source schemas. Preserve complete
argument-pack semantics and canonical printing, including spaces after commas.
Keep credentials out of source and browser bundles. CI requires no application secrets.
