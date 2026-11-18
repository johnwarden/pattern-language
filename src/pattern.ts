import { LanguageError, positional, canonicalFields } from "./syntax.ts";
import type { Diagnostic } from "./diagnostics.ts";
import type { Field, Span, Syntax } from "./syntax.ts";
import {
  duplicateCapture,
  uniqueCaptures,
  patternBindings,
} from "./pattern-captures.ts";
/** The sole matching engine, instantiated for syntax and runtime values. */
export interface Capture<T> {
  fields: Field<T>[];
  rest: boolean;
  wrap?: (value: T) => T;
}
export type Captures<T> = Map<string, Capture<T>>;
export interface Match<T> {
  end: number;
  fields: Field<T>[];
  captures: Captures<T>;
  interpretations?: InterpretationTrace<T>;
  skippedPredicate?: true;
}
export type Pattern<T> =
  | { kind: "any" }
  | {
      kind: "test";
      name: string;
      identity?: unknown;
      test: (value: T) => boolean;
    }
  | {
      kind: "capture";
      name: string;
      pattern: Pattern<T>;
      rest?: boolean;
      wrap?: (value: T) => T;
      /** Compiler metadata only; never part of a type's structural identity. */
      origin?: { syntax: Syntax; implicit: boolean };
    }
  | {
      kind: "union";
      choices: Pattern<T>[];
      preserveSpace?: boolean;
      preferred?: Pattern<T>[];
    }
  | { kind: "sequence"; parts: Pattern<T>[] }
  | {
      kind: "fields";
      parts: Pattern<T>[];
      openLabels?: boolean;
      ignorePositions?: boolean;
    }
  | { kind: "repeat"; pattern: Pattern<T>; collect?: boolean }
  | { kind: "row"; pattern: Pattern<T> }
  | {
      kind: "label";
      label: string;
      pattern: Pattern<T>;
      fallback?: () => T;
      defaultIdentity?: string;
      span?: Span;
    }
  | { kind: "node"; head: Pattern<T>; body: Pattern<T> }
  | { kind: "postfix"; operator: Pattern<T>; operand: Pattern<T> }
  | {
      kind: "ref";
      key: unknown;
      name: string;
      resolve: () => Pattern<T>;
      /** Dispatch recognizes the base domain; predicates validate after selection. */
      dispatchBase?: () => Pattern<T>;
      dispatchIdentity?: () => string;
      facet?: boolean;
      wrappedPrimitive?: boolean;
      /** The reference as an author would write it, for ambiguity diagnostics. */
      describe?: () => string | undefined;
      referent?: T;
    }
  | {
      kind: "map";
      localCaptures?: boolean;
      identity?: unknown;
      accept?: (value: T) => boolean;
      input?: (value: T) => T;
      validate?: (fields: Field<T>[]) => boolean;
      failure?: string;
      pattern: Pattern<T>;
      transform: (fields: Field<T>[], captures: Captures<T>) => Field<T>[];
    }
  | {
      kind: "reader";
      name: string;
      capturePattern?: Pattern<T>;
      inputPattern?: Pattern<T>;
      read: (
        items: Field<T>[],
        position: number,
        matcher: Matcher<T>,
      ) => Match<T>[];
    };
export interface Adapter<T> {
  describe?: (value: T) => string;
  /** The fields an alternative consumed as source text, for ambiguity diagnostics. */
  source?: (
    fields: Field<T>[],
    annotations?: ReadonlyMap<Field<T>, string>,
  ) => string;
  equal: (a: T, b: T) => boolean;
  decompose: (value: T) => { head: T; body: Field<T>[] } | undefined;
  rebuild: (value: T, head: T, body: Field<T>[]) => T;
  postfix?: (value: T) => { operator: T; operand: T } | undefined;
  rebuildPostfix?: (value: T, operator: T, operand: T) => T;
  row?: (value: T) => Field<T>[] | undefined;
  rebuildRow?: (value: T, fields: Field<T>[]) => T;
  collection?: (values: Field<T>[]) => T;
}
export class Mismatch extends LanguageError {
  constructor(message: string, span?: Span, details: Partial<Diagnostic> = {}) {
    super(message, span, {
      code: "E_PATTERN_MISMATCH",
      phase: "match",
      ...details,
    });
  }
}
interface UnionSite<T> {
  consumed: Field<T>[];
  alternatives: unknown[];
}

interface Interpretation<T> {
  site: UnionSite<T>;
  choice: Pattern<T>;
  nested?: InterpretationTrace<T>;
}

type InterpretationTrace<T> =
  | Interpretation<T>
  | { left: InterpretationTrace<T>; right: InterpretationTrace<T> };

function joinInterpretations<T>(
  left?: InterpretationTrace<T>,
  right?: InterpretationTrace<T>,
): InterpretationTrace<T> | undefined {
  return left && right ? { left, right } : (left ?? right);
}

export function combineMatchDetails<T>(a: Match<T>, b: Match<T>) {
  return {
    interpretations: joinInterpretations(a.interpretations, b.interpretations),
    skippedPredicate: a.skippedPredicate ?? b.skippedPredicate,
  };
}

function* interpretations<T>(trace?: InterpretationTrace<T>) {
  const pending = trace ? [trace] : [];
  while (pending.length) {
    const next = pending.pop()!;
    if ("site" in next) {
      yield next;
      if (next.nested) pending.push(next.nested);
    } else pending.push(next.right, next.left);
  }
}

const alternativeKey = <T>(p: Pattern<T>): unknown =>
  p.kind === "ref" ? p.key : p;

export interface MatchFailure {
  message: string;
  code: string;
  path: string[];
  expected?: string;
  actual?: string;
  span?: Span;
  patternSpan?: Span;
}
interface ScanRequest<T> {
  pattern: Pattern<T>;
  items: Field<T>[];
  position: number;
}
type ScanStep<T> = Generator<ScanRequest<T>, Match<T>[], Match<T>[]>;

export class Matcher<T> {
  adapter: Adapter<T>;
  steps = 0;
  private hostReaderDepth = 0;
  failure = "pattern did not match";
  failures: MatchFailure[] = [];
  private path: string[] = [];
  active: { key: unknown; value: T | undefined; position: number }[] = [];
  private readonly activeReferences = new Map<
    unknown,
    Map<T | undefined, Set<number>>
  >();
  private recognizing = false;
  private readonly unionSites = new WeakMap<Field<T>, UnionSite<T>[]>();
  private readonly fieldOrigins = new WeakMap<Field<T>, Field<T>>();
  // A recognition-only hole is never returned to the caller or passed to tests.
  // It preserves an omitted constructed field through annotated destructuring.
  private readonly deferredDefault = {} as T;
  constructor(adapter: Adapter<T>) {
    this.adapter = adapter;
  }
  /** Check supplied structure without evaluating defaults or refinement predicates.
   * Binding/construction must run separately after an interpretation is selected.
   */
  recognize(pattern: Pattern<T>, items: Field<T>[]): void {
    this.recognizing = true;
    try {
      this.match(pattern, items);
    } finally {
      this.recognizing = false;
    }
  }
  reject(message: string, details: Partial<MatchFailure> = {}): Match<T>[] {
    this.failure = message;
    if (this.failures.length < 100)
      this.failures.push({
        message,
        code: "E_PATTERN_MISMATCH",
        path: this.path.slice(),
        ...details,
      });
    return [];
  }
  merge(a: Captures<T>, b: Captures<T>): Captures<T> | undefined {
    const result = new Map(a);
    for (const [name, values] of b) {
      const prev = result.get(name);
      if (prev) duplicateCapture(name);
      result.set(name, values);
    }
    return result;
  }
  scan(pattern: Pattern<T>, items: Field<T>[], position = 0): Match<T>[] {
    const frames: ScanStep<T>[] = [];
    const schedule = (request: ScanRequest<T>) => {
      if (++this.steps > 100000)
        throw new LanguageError(
          "pattern matching work budget exceeded",
          undefined,
          {
            code: "E_MATCH_LIMIT",
            phase: "match",
          },
        );
      frames.push(this.step(request.pattern, request.items, request.position));
    };
    let results: Match<T>[] = [];
    try {
      schedule({ pattern, items, position });
      while (frames.length) {
        const next = frames[frames.length - 1].next(results);
        if (next.done) {
          frames.pop();
          results = next.value;
        } else {
          schedule(next.value);
          results = [];
        }
      }
      return results;
    } finally {
      // Errors in tests, defaults, or adapters must unwind suspended labels and
      // recursive-reference guards just as native call-stack unwinding would.
      for (let i = frames.length - 1; i >= 0; i--) frames[i].return([]);
    }
  }
  private *step(p: Pattern<T>, items: Field<T>[], pos: number): ScanStep<T> {
    const item = items[pos],
      one = () => [
        {
          end: pos + 1,
          fields: [item],
          captures: new Map<string, Capture<T>>(),
        },
      ];
    if (
      this.recognizing &&
      item?.value === this.deferredDefault &&
      [
        "any",
        "test",
        "node",
        "postfix",
        "ref",
        "map",
        "reader",
        "union",
      ].includes(p.kind)
    )
      return one();
    switch (p.kind) {
      case "any":
        return item ? one() : this.reject("expected an element");
      case "test":
        return item && p.test(item.value)
          ? one()
          : this.reject(
              "expected " +
                p.name +
                (item
                  ? ", received " +
                    (this.adapter.describe?.(item.value) ?? "value")
                  : ", but no value was supplied"),
              {
                expected: p.name,
                actual: item ? this.adapter.describe?.(item.value) : undefined,
                span: item?.span,
              },
            );
      case "reader": {
        if (p.inputPattern && p.capturePattern) {
          const inputs = yield {
            pattern: p.inputPattern,
            items,
            position: pos,
          };
          const results: Match<T>[] = [];
          for (const input of inputs) {
            const captures = yield {
              pattern: p.capturePattern,
              items: input.fields,
              position: 0,
            };
            for (const result of captures) {
              if (result.end !== input.fields.length) continue;
              const merged = this.merge(input.captures, result.captures);
              if (merged)
                results.push({
                  ...result,
                  ...combineMatchDetails(input, result),
                  end: input.end,
                  captures: merged,
                });
            }
          }
          return results;
        }
        // Opaque host readers may synchronously reenter scan. They cannot be
        // suspended through the generic callback API, so bound that host-only
        // recursion separately from ordinary structural pattern traversal.
        if (++this.hostReaderDepth > 128) {
          this.hostReaderDepth--;
          throw new LanguageError(
            "host reader recursion budget exceeded",
            undefined,
            {
              code: "E_MATCH_LIMIT",
              phase: "match",
            },
          );
        }
        try {
          return p.read(items, pos, this);
        } finally {
          this.hostReaderDepth--;
        }
      }
      case "label": {
        this.path.push(
          positional(p.label) ? "argument " + p.label.slice(1) : p.label,
        );
        try {
          return item &&
            (positional(p.label)
              ? positional(item.label)
              : item.label === p.label)
            ? yield { pattern: p.pattern, items, position: pos }
            : this.reject("expected field " + p.label, {
                patternSpan: p.span,
                span: item?.span,
              });
        } finally {
          this.path.pop();
        }
      }
      case "capture":
        return (yield { pattern: p.pattern, items, position: pos }).flatMap(
          (m) => {
            const normalized = m.fields.map((e, i) => ({
              label: !p.rest || positional(e.label) ? "_" + (i + 1) : e.label,
              value: e.value,
            }));
            const captures = this.merge(
              m.captures,
              new Map([
                [p.name, { fields: normalized, rest: !!p.rest, wrap: p.wrap }],
              ]),
            );
            return captures ? [{ ...m, captures }] : [];
          },
        );
      case "union": {
        const accepted: { choice: Pattern<T>; results: Match<T>[] }[] = [];
        const consider = function* (
          choice: Pattern<T>,
        ): Generator<ScanRequest<T>, void, Match<T>[]> {
          const results = yield { pattern: choice, items, position: pos };
          if (results.length) accepted.push({ choice, results });
        };
        const done = () => {
          if (
            accepted.length < 2 ||
            !this.adapter.source ||
            !accepted.some(({ choice }) => choice.kind === "ref" && choice.describe)
          )
            return accepted.flatMap(({ results }) => results);
          const alternatives = p.choices.map(alternativeKey);
          return accepted.flatMap(({ choice, results }) =>
            results.map((match) => {
              if (match.end <= pos) return match;
              const site = this.unionSite(
                items.slice(pos, match.end),
                alternatives,
              );
              return {
                ...match,
                interpretations: {
                  site,
                  choice,
                  nested: match.interpretations,
                },
              };
            }),
          );
        };
        if (p.preferred) {
          for (const choice of p.preferred) yield* consider(choice);
          if (accepted.length) return done();
        }
        for (const choice of p.choices)
          if (!p.preferred?.includes(choice))
            yield* consider(choice);
        // Both pattern and type unions require one interpretation. Do not
        // coalesce successful witnesses and silently conceal ambiguous branches.
        return done();
      }
      case "sequence": {
        let states: Match<T>[] = [
          { end: pos, fields: [], captures: new Map() },
        ];
        for (const part of p.parts) {
          if (!states.length) return [];
          const next: Match<T>[] = [];
          for (const state of states) {
            const matches = yield { pattern: part, items, position: state.end };
            for (const match of matches) {
              const captures = this.merge(state.captures, match.captures);
              if (captures)
                next.push({
                  ...combineMatchDetails(state, match),
                  end: match.end,
                  fields: state.fields.concat(match.fields),
                  captures,
                });
            }
          }
          states = next;
          if (!states.length) break;
        }
        return states;
      }
      case "fields": {
        // Resolve explicit named fields by label, independently of source order.
        let remaining = items.slice(pos);
        let states: Match<T>[] = [{ end: 0, fields: [], captures: new Map() }];
        const sequential: Pattern<T>[] = [];
        const defaults: Extract<Pattern<T>, { kind: "label" }>[] = [];
        for (const part of p.parts) {
          if (!states.length) return [];
          if (part.kind !== "label" || positional(part.label)) {
            sequential.push(part);
            continue;
          }
          const index = remaining.findIndex((e) => e.label === part.label);
          if (index < 0 && !part.fallback)
            return this.reject(
              "missing required labeled argument `" + part.label + "`",
              {
                code: "E_MISSING_FIELD",
                path: [...this.path, part.label],
                patternSpan: part.span,
              },
            );
          if (index < 0) {
            defaults.push(part);
            continue;
          }
          const field = remaining[index];
          remaining = remaining.filter((_, i) => i !== index);
          const matches = (yield {
            pattern: part,
            items: [field],
            position: 0,
          }).filter((m) => m.end === 1);
          states = states.flatMap((s) =>
            matches.flatMap((m) => {
              const captures = this.merge(s.captures, m.captures);
              return captures
                ? [
                    {
                      ...combineMatchDetails(s, m),
                      end: 0,
                      fields: s.fields.concat(m.fields),
                      captures,
                    },
                  ]
                : [];
            }),
          );
        }
        const ignored = remaining.filter((e) => !positional(e.label));
        if (ignored.length && !p.openLabels)
          return this.reject(
            "unexpected labeled field `" + ignored[0].label + "`",
            {
              code: "E_UNEXPECTED_FIELD",
              path: [...this.path, ignored[0].label],
              span: ignored[0].span,
            },
          );
        remaining = remaining.filter((e) => positional(e.label));
        if (!states.length) return [];
        const tails = (yield {
          // These parts are already validated by their enclosing fields pattern.
          pattern: { kind: "sequence", parts: sequential },
          items: remaining,
          position: 0,
        }).filter((m) => m.end === remaining.length || p.ignorePositions);
        states = states.flatMap((s) =>
          tails.flatMap((m) => {
            const captures = this.merge(s.captures, m.captures);
            return captures
              ? [
                  {
                    ...combineMatchDetails(s, m),
                    end: items.length,
                    fields: canonicalFields([
                      ...s.fields,
                      ...m.fields,
                      ...(p.ignorePositions ? remaining.slice(m.end) : []),
                      ...ignored,
                    ]),
                    captures,
                  },
                ]
              : [];
          }),
        );
        // Defaults are needed only after every supplied field has matched.
        for (const part of defaults) {
          if (!states.length) return [];
          let value: T;
          try {
            value = this.recognizing ? this.deferredDefault : part.fallback!();
          } catch (error) {
            if (error instanceof LanguageError)
              error.diagnostic.related.push({
                message: "Default for " + part.label + " declared here",
                span: part.span,
              });
            throw error;
          }
          const field = {
            label: part.label,
            value,
          };
          const failureStart = this.failures.length;
          const matches = (yield {
            pattern: part,
            items: [field],
            position: 0,
          }).filter((m) => m.end === 1);
          if (!this.recognizing && !matches.length)
            for (const failure of this.failures.slice(failureStart)) {
              failure.message =
                "default for " +
                part.label +
                " does not match: " +
                failure.message;
              failure.patternSpan ??= part.span;
            }
          states = states.flatMap((s) =>
            matches.flatMap((m) => {
              const captures = this.merge(s.captures, m.captures);
              return captures
                ? [
                    {
                      ...s,
                      ...combineMatchDetails(s, m),
                      captures,
                    },
                  ]
                : [];
            }),
          );
        }
        return states;
      }
      case "row": {
        const row = item && this.adapter.row?.(item.value);
        if (!row) return this.reject("expected a row", { span: item?.span });
        return (yield { pattern: p.pattern, items: row, position: 0 })
          .filter((m) => m.end === row.length)
          .map((m) => ({
            ...m,
            end: pos + 1,
            fields: [
              {
                ...item,
                value:
                  this.adapter.rebuildRow?.(item.value, m.fields) ?? item.value,
              },
            ],
            captures: m.captures,
          }));
      }
      case "repeat": {
        const empty: Captures<T> = new Map();
        if (p.collect)
          for (const [name, sites] of patternBindings(p.pattern))
            empty.set(name, { fields: [], rest: true, wrap: sites[0]?.wrap });
        const states: Match<T>[] = [{ end: pos, fields: [], captures: empty }];
        let frontier = states.slice();
        while (frontier.length) {
          const next: Match<T>[] = [];
          for (const state of frontier) {
            const matches = yield {
              pattern: p.pattern,
              items,
              position: state.end,
            };
            for (const match of matches) {
              if (match.end <= state.end)
                throw new LanguageError("repetition must consume an element");
              next.push({
                ...combineMatchDetails(state, match),
                end: match.end,
                fields: state.fields.concat(match.fields),
                captures: p.collect
                  ? (() => {
                      const result: Captures<T> = new Map();
                      for (const [name, previous] of state.captures) {
                        const capture = match.captures.get(name);
                        if (!capture)
                          throw new LanguageError(
                            "repeated row did not bind " + name,
                          );
                        const value = capture.rest
                          ? this.adapter.collection?.(capture.fields)
                          : capture.fields.length === 1
                            ? capture.fields[0].value
                            : undefined;
                        if (value === undefined)
                          throw new LanguageError(
                            "invalid repeated capture " + name,
                          );
                        result.set(name, {
                          rest: true,
                          wrap: capture.wrap ?? previous.wrap,
                          fields: [
                            ...previous.fields,
                            {
                              label: "_" + (previous.fields.length + 1),
                              value,
                            },
                          ],
                        });
                      }
                      return result;
                    })()
                  : state.captures,
              });
            }
          }
          frontier = next;
          states.push(...frontier);
          if (states.length > 10000)
            throw new LanguageError(
              "too many pattern alternatives",
              undefined,
              {
                code: "E_MATCH_LIMIT",
                phase: "match",
              },
            );
        }
        return states;
      }
      case "ref": {
        let values = this.activeReferences.get(p.key);
        if (!values) this.activeReferences.set(p.key, (values = new Map()));
        let positions = values.get(item?.value);
        if (!positions) values.set(item?.value, (positions = new Set()));
        if (positions.has(pos))
          return this.reject("nonproductive recursive pattern: " + p.name);
        positions.add(pos);
        this.active.push({ key: p.key, value: item?.value, position: pos });
        try {
          if (this.recognizing && p.dispatchBase) {
            const results = yield {
              pattern: p.dispatchBase(),
              items,
              position: pos,
            };
            return results.map((m) => ({ ...m, skippedPredicate: true }));
          }
          return yield { pattern: p.resolve(), items, position: pos };
        } finally {
          this.active.pop();
          positions.delete(pos);
          if (!positions.size) values.delete(item?.value);
          if (!values.size) this.activeReferences.delete(p.key);
        }
      }
      case "map":
        if (p.accept && (!item || !p.accept(item.value)))
          return this.reject(
            "value belongs to a different concrete type; explicit conversion is required",
          );
        return (yield {
          pattern: p.pattern,
          items:
            p.input && item
              ? items.map((field, index) => {
                  if (index !== pos) return field;
                  const mapped = { ...field, value: p.input!(field.value) };
                  this.fieldOrigins.set(
                    mapped,
                    this.fieldOrigins.get(field) ?? field,
                  );
                  return mapped;
                })
              : items,
          position: pos,
        }).flatMap((m) =>
          !this.recognizing && p.validate && !p.validate(m.fields)
            ? this.reject(p.failure ?? "value does not satisfy constraint", {
                code: "E_SUBSET_MISMATCH",
              })
            : [
                {
                  ...m,
                  fields: p.transform(m.fields, m.captures),
                  captures: p.localCaptures ? new Map() : m.captures,
                },
              ],
        );
      case "postfix": {
        const node = item && this.adapter.postfix?.(item.value);
        if (!node) return this.reject("expected a postfix value");
        const operators = (yield {
          pattern: p.operator,
          items: [{ label: "_1", value: node.operator }],
          position: 0,
        }).filter((m) => m.end === 1);
        if (!operators.length) return [];
        const operands = (yield {
          pattern: p.operand,
          items: [{ label: "_1", value: node.operand }],
          position: 0,
        }).filter((m) => m.end === 1);
        return operators.flatMap((h) =>
          operands.flatMap((b) => {
            const captures = this.merge(h.captures, b.captures);
            return captures
              ? [
                  {
                    ...combineMatchDetails(h, b),
                    end: pos + 1,
                    fields: [
                      {
                        label: item.label,
                        value: this.adapter.rebuildPostfix
                          ? this.adapter.rebuildPostfix(
                              item.value,
                              h.fields[0].value,
                              b.fields[0].value,
                            )
                          : item.value,
                      },
                    ],
                    captures,
                  },
                ]
              : [];
          }),
        );
      }
      case "node": {
        const node = item && this.adapter.decompose(item.value);
        if (!node) return this.reject("expected a constructed value");
        const heads = (yield {
          pattern: p.head,
          items: [{ label: "_1", value: node.head }],
          position: 0,
        }).filter((m) => m.end === 1);
        if (!heads.length) return [];
        const bodies = (yield {
          pattern: p.body,
          items: node.body,
          position: 0,
        }).filter((m) => m.end === node.body.length);
        return heads.flatMap((h) =>
          bodies.flatMap((b) => {
            const captures = this.merge(h.captures, b.captures);
            return captures
              ? [
                  {
                    ...combineMatchDetails(h, b),
                    end: pos + 1,
                    fields: [
                      {
                        label: item.label,
                        value: this.adapter.rebuild(
                          item.value,
                          h.fields[0].value,
                          b.fields,
                        ),
                      },
                    ],
                    captures,
                  },
                ]
              : [];
          }),
        );
      }
    }
  }
  match(pattern: Pattern<T>, items: Field<T>[]): Match<T> {
    const matches = this.scan(pattern, items).filter(
      (x) => x.end === items.length,
    );
    if (!matches.length) {
      const best = [...this.failures].sort(
        (a, b) =>
          Number(b.code === "E_SUBSET_MISMATCH") -
            Number(a.code === "E_SUBSET_MISMATCH") ||
          b.path.length - a.path.length,
      )[0];
      const message = best
        ? (best.path.length ? best.path.join(".") + ": " : "") + best.message
        : this.failure;
      throw new Mismatch(
        message +
          " (received " +
          items.length +
          " element" +
          (items.length === 1 ? "" : "s") +
          ")",
        best?.span,
        {
          code: best?.code ?? "E_PATTERN_MISMATCH",
          path: best?.path,
          expected: best?.expected,
          actual: best?.actual,
          related: best?.patternSpan
            ? [{ message: "Required by this pattern", span: best.patternSpan }]
            : [],
        },
      );
    }
    // A complete structural match can make a definition applicable. If any
    // complete interpretation needs a predicate, only the selected definition
    // may decide that ambiguity when it binds its arguments.
    if (
      matches.length > 1 &&
      !(this.recognizing && matches.some((m) => m.skippedPredicate))
    )
      throw new LanguageError(
        this.ambiguityMessage(matches),
        undefined,
        { code: "E_AMBIGUOUS_VALUE_DESIGNATOR", phase: "match" },
      );
    return matches[0];
  }

  private unionSite(fields: Field<T>[], alternatives: unknown[]): UnionSite<T> {
    const consumed = fields.map(
      (field) => this.fieldOrigins.get(field) ?? field,
    );
    const first = consumed[0];
    let sites = this.unionSites.get(first);
    if (!sites) this.unionSites.set(first, (sites = []));
    // A preceding ambiguous field can make the same typed field run more than
    // once. Its input fields and alternatives identify it across those visits.
    const previous = sites.find(
      (site) =>
        site.consumed.length === consumed.length &&
        site.consumed.every((field, i) => field === consumed[i]) &&
        site.alternatives.length === alternatives.length &&
        site.alternatives.every((choice, i) => choice === alternatives[i]),
    );
    if (previous) return previous;
    const site = { consumed, alternatives };
    sites.push(site);
    return site;
  }

  private interpretationType(choice: Pattern<T>): string | undefined {
    const text = choice.kind === "ref" && choice.describe?.();
    return text && text.length <= 160 && !text.includes("\n") ? text : undefined;
  }

  private ambiguityMessage(matches: Match<T>[]): string {
    const generic =
      "ambiguous value designator: " + matches.length + " interpretations match";
    if (!this.adapter.source) return generic;

    const candidates = new Map<UnionSite<T>, Map<unknown, Set<Interpretation<T>>>>();
    for (const pick of interpretations(matches[0].interpretations))
      candidates.set(
        pick.site,
        new Map([[alternativeKey(pick.choice), new Set([pick])]]),
      );
    for (let i = 1; i < matches.length && candidates.size; i++) {
      const visited = new Set<UnionSite<T>>();
      for (const pick of interpretations(matches[i].interpretations)) {
        const choices = candidates.get(pick.site);
        if (!choices) continue;
        visited.add(pick.site);
        const key = alternativeKey(pick.choice);
        let variants = choices.get(key);
        if (!variants) choices.set(key, (variants = new Set()));
        variants.add(pick);
      }
      for (const site of candidates.keys())
        if (!visited.has(site)) candidates.delete(site);
    }

    // Use the first position shared by every surviving match that has
    // multiple interpretations. Look only at the alternatives they used.
    for (const [site, choices] of candidates) {
      if (choices.size < 2) continue;
      try {
        const value = this.adapter.source(site.consumed);
        const suggestions = new Set<string>();
        const types = new Set<string>();
        alternatives: for (const key of site.alternatives) {
          const variants = choices.get(key);
          if (!variants) continue;
          const type = this.interpretationType(variants.values().next().value!.choice);
          if (!type || types.has(type)) break;

          for (const pick of variants) {
            // Count each distinct nested designation at this position.
            // Unrelated decisions elsewhere in the match share a suggestion.
            const annotations = new Map<Field<T>, string>();
            for (const inner of interpretations(pick.nested)) {
              const [field] = inner.site.consumed;
              const annotation = this.interpretationType(inner.choice);
              if (
                inner.site.consumed.length !== 1 ||
                !annotation ||
                annotations.has(field)
              ) break alternatives;
              annotations.set(field, annotation);
            }
            const source = annotations.size
              ? this.adapter.source(site.consumed, annotations)
              : value;
            suggestions.add("`" + source + " :: " + type + "`");
          }
          types.add(type);
        }
        if (types.size !== choices.size) continue;
        const shown = [...suggestions].slice(0, 2);
        const others = suggestions.size - shown.length;
        return (
          "ambiguous value designator " +
          value +
          ": please specify " +
          (others
            ? shown.join(", ") +
              ", ...and " +
              others +
              (others === 1 ? " other" : " others")
            : shown.join(" or "))
        );
      } catch (error) {
        if (
          !(error instanceof LanguageError) ||
          ![
            "E_VALUE_SERIALIZATION",
            "E_TYPE_SERIALIZATION",
            "E_SERIALIZATION_LIMIT",
          ].includes(error.diagnostic.code)
        )
          throw error;
      }
    }
    return generic;
  }
}
export const any = <T>(): Pattern<T> => ({ kind: "any" });
export const sequencePattern = <T>(parts: Pattern<T>[]): Pattern<T> =>
  uniqueCaptures({
    kind: "sequence",
    parts,
  });
