// The notebook page: a toolbar, the turns, and the request box. Owns the
// notebook and its undo history; every change goes through document/edits.

import type { Notebook } from "../document/format";
import type { AskTransport } from "../ask/events";
import type { EmbedRegistry, NotebookApi } from "../embeds/contract";

export interface NotebookViewOptions {
  readonly api: NotebookApi;
  /** Absent when the host has no /api/ask; the request box is then disabled with a note. */
  readonly ask?: AskTransport;
  readonly renderers?: EmbedRegistry;
  readonly initial?: Notebook;
  /** The clock, for request timestamps; injectable for tests. */
  readonly now?: () => string;
}

export interface NotebookView {
  notebook(): Notebook;
  load(notebook: Notebook): void;
  refreshAll(): Promise<void>;
  destroy(): void;
}

export function mountNotebook(root: HTMLElement, options: NotebookViewOptions): NotebookView {
  throw new Error(`not built: mountNotebook(${root.tagName}, ${typeof options})`);
}
