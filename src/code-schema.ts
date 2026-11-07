import { SYNTAX_SCHEMA } from "./language-description.ts";

/** The public Code tree grammar is ordinary source, shared with inspection. */
export const CODE_SCHEMA = `${SYNTAX_SCHEMA}def Code TreeGrammar(SyntaxNode)
Code
`;
