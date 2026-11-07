import { LanguageError } from "./diagnostics.ts";

/** Only Recursive introduces a binder; Type is not a recursive binding. */
export class DescriptionScope<T> {
  private recursiveBinders: T[] = [];

  enter<R>(action: () => R, recursive?: T): R {
    if (recursive !== undefined) this.recursiveBinders.push(recursive);
    try {
      return action();
    } finally {
      if (recursive !== undefined) this.recursiveBinders.pop();
    }
  }

  recursive(index: number, path: string[]): T {
    const binder = this.recursiveBinders.at(-1 - index);
    if (binder !== undefined) return binder;
    throw new LanguageError(
      "recursive type reference Recur(" + index + ") is outside its binder",
      undefined,
      {
        code: "E_TYPE_DESCRIPTION",
        phase: "declaration",
        path,
        notes: ["In type description: " + (path.join(" → ") || "root")],
      },
    );
  }
}
