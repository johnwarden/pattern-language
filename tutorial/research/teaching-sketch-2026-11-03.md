# Recovered teaching sketch · 3 November 2026

Source: `independent-language-design-review-2026-11-03.md`, section
“A smaller-core teaching sketch”. This is a historical reviewer proposal, not an
approved language specification or an agreed tutorial sequence. Later author
decisions and executable specifications take precedence.

Teach the language in this order:

1. **Trees and packs:** atoms, application heads, fields and rows; distinguish grouping, packs, lists and explicit tuple constructors immediately.
2. **Patterns:** structural recognition plus captures; exact constructed values, open boundary packs, two rest axes, alternatives and repetition.
3. **Interpretations:** a closed compound type establishes a descriptor-sensitive space; refinements preserve it; abstract domains retain a member's descriptor. Show identical spelling in different spaces before discussing interoperability.
4. **Evaluation:** values, bindings, complete-pack calls, functions and ordered matching. Teach overload names versus function values explicitly.
5. **Inert syntax and stages:** raw trees, typed grammar interpretation, explicit interpolation, then registered macro expansion.

Present accessors as declaration products, descriptors as public representations and schema decoding as an interpreter. Do not require beginners to learn `Recur` or `OpenFields` to construct a rectangle. Self-hosting may implement these mechanisms in source without making all their protocols fundamental user concepts.
