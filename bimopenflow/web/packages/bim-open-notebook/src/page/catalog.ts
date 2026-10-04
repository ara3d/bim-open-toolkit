// A landing page's list of notebooks: one entry per notebook file, and the
// reading order, which the caller sets by naming the notebooks that lead.
// Pure functions; the static build (vite/samples.ts) and a page fetch.

import type { Notebook } from "../document/format";
import { NOTEBOOK_EXTENSION } from "../document/format";
import { parseNotebook } from "../document/io";

/** One notebook as a landing page shows it. */
export interface NotebookEntry {
  /** File name without `.notebook.json`, the value of `?notebook=`. */
  readonly name: string;
  readonly title: string;
  readonly profile?: string;
  readonly turns: number;
  /** The first request, as a taste of the session. */
  readonly firstRequest?: string;
  /** True for a session an agent replayed rather than a recorded one (`host.note`). */
  readonly reconstructed: boolean;
}

const notebookName = (file: string): string =>
  file.endsWith(NOTEBOOK_EXTENSION) ? file.slice(0, -NOTEBOOK_EXTENSION.length) : file;

/** A notebook file as a list entry, or the parse errors. */
export function notebookEntry(file: string, text: string): NotebookEntry | { readonly errors: readonly string[] } {
  const parsed = parseNotebook(text);
  if (!parsed.ok) return { errors: parsed.errors };
  return entryOf(notebookName(file), parsed.notebook);
}

function entryOf(name: string, notebook: Notebook): NotebookEntry {
  return {
    name,
    title: notebook.title,
    profile: notebook.host?.profile,
    turns: notebook.turns.length,
    firstRequest: notebook.turns[0]?.request.text,
    reconstructed: /reconstructed/i.test(notebook.host?.note ?? ""),
  };
}

/** Entries in reading order: those named in `lead` first, in its order, then the rest in the order given. */
export function orderNotebooks(entries: readonly NotebookEntry[], lead: readonly string[] = []): NotebookEntry[] {
  const rank = (e: NotebookEntry): number => {
    const i = lead.indexOf(e.name);
    return i < 0 ? lead.length : i;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b));
}
