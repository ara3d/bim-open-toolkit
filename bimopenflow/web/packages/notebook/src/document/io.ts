// Reading and writing notebook files: validation with messages a person can
// act on, and a stable serialization so a saved notebook diffs cleanly.

import type { Notebook } from "./format";

export type ParseResult =
  | { readonly ok: true; readonly notebook: Notebook }
  | { readonly ok: false; readonly errors: readonly string[] };

/** Parses and validates a notebook file; every problem found is listed, with its JSON path. */
export function parseNotebook(text: string): ParseResult {
  throw new Error(`not built: parseNotebook(${text.length} chars)`);
}

/** Two-space JSON with keys in a fixed order and a final newline; parseNotebook(serializeNotebook(n)) equals n. */
export function serializeNotebook(notebook: Notebook): string {
  throw new Error(`not built: serializeNotebook(${notebook.title})`);
}

/** A notebook with no turns. */
export function emptyNotebook(title: string, createdUtc: string): Notebook {
  throw new Error(`not built: emptyNotebook(${title}, ${createdUtc})`);
}
