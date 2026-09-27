// Pure edits of a notebook. A notebook is a record: an edit never changes an
// earlier reply's embeds; it adds a turn, replaces one reply (keeping the old
// one), marks later turns stale, or removes a turn.

import type { Notebook, Reply, Request } from "./format";

/** The id the next appended turn gets: "t<n>", one past the highest number in use. */
export function nextTurnId(notebook: Notebook): string {
  throw new Error(`not built: nextTurnId(${notebook.title})`);
}

/** Adds a turn at the end. */
export function appendTurn(notebook: Notebook, request: Request, reply: Reply): Notebook {
  throw new Error(`not built: appendTurn(${request.text}, ${reply.text})`);
}

/**
 * Replaces a turn's request and reply after the user edited and resent it.
 * The old request and reply go to the end of the turn's `earlier` list, the
 * turn's own stale mark is cleared, and every later turn is marked stale.
 * Throws when no turn has that id.
 */
export function resendTurn(notebook: Notebook, turnId: string, request: Request, reply: Reply): Notebook {
  throw new Error(`not built: resendTurn(${turnId}, ${request.text}, ${reply.text})`);
}

/**
 * Removes a turn. Later turns whose reply continued the same analysis (same
 * reply.analysisId) are marked stale, since they may refer to it.
 */
export function removeTurn(notebook: Notebook, turnId: string): Notebook {
  throw new Error(`not built: removeTurn(${notebook.title}, ${turnId})`);
}

/** Clears a turn's stale mark, after the user continued from it. */
export function clearStale(notebook: Notebook, turnId: string): Notebook {
  throw new Error(`not built: clearStale(${notebook.title}, ${turnId})`);
}

/**
 * The analysis a new request continues: the analysisId of the last reply
 * before `beforeTurnId` (or of the last reply when absent) that has one.
 */
export function continuationOf(notebook: Notebook, beforeTurnId?: string): string | undefined {
  throw new Error(`not built: continuationOf(${notebook.title}, ${beforeTurnId})`);
}

/** Undo history over whole notebooks; every edit is one step. */
export interface History {
  readonly past: readonly Notebook[];
  readonly present: Notebook;
  readonly future: readonly Notebook[];
}

export function startHistory(notebook: Notebook): History {
  throw new Error(`not built: startHistory(${notebook.title})`);
}

/** Makes `next` the present and clears the redo list. */
export function commit(history: History, next: Notebook): History {
  throw new Error(`not built: commit(${history.present.title}, ${next.title})`);
}

/** Steps back; unchanged when there is nothing to undo. */
export function undo(history: History): History {
  throw new Error(`not built: undo(${history.present.title})`);
}

/** Steps forward; unchanged when there is nothing to redo. */
export function redo(history: History): History {
  throw new Error(`not built: redo(${history.present.title})`);
}
