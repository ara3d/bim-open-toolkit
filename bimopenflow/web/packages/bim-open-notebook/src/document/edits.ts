// Pure edits of a notebook. A notebook is a record: an edit never changes an
// earlier reply's embeds; it adds a turn, replaces one reply (keeping the old
// one), marks later turns stale, or removes a turn.

import type { Notebook, Reply, Request, Turn } from "./format";

/** The id the next appended turn gets: "t<n>", one past the highest number in use. */
export function nextTurnId(notebook: Notebook): string {
  const highest = notebook.turns.reduce((max, turn) => {
    const match = /^t(\d+)$/.exec(turn.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `t${highest + 1}`;
}

/** Adds a turn at the end. */
export function appendTurn(notebook: Notebook, request: Request, reply: Reply): Notebook {
  const turn: Turn = { id: nextTurnId(notebook), request, reply };
  return { ...notebook, turns: [...notebook.turns, turn] };
}

/**
 * Replaces a turn's request and reply after the user edited and resent it.
 * The old request and reply go to the end of the turn's `earlier` list, the
 * turn's own stale mark is cleared, and every later turn is marked stale.
 * Throws when no turn has that id.
 */
export function resendTurn(notebook: Notebook, turnId: string, request: Request, reply: Reply): Notebook {
  const index = notebook.turns.findIndex((turn) => turn.id === turnId);
  if (index < 0) throw new Error(`no turn ${turnId} in "${notebook.title}"`);
  const turns = notebook.turns.map((turn, i) => {
    if (i < index) return turn;
    if (i === index) {
      const earlier = [...(turn.earlier ?? []), { request: turn.request, reply: turn.reply }];
      return { ...turn, request, reply, earlier, stale: false };
    }
    return turn.stale ? turn : { ...turn, stale: true };
  });
  return { ...notebook, turns };
}

/**
 * Removes a turn. Later turns whose reply continued the same analysis (same
 * reply.analysisId) are marked stale, since they may refer to it.
 */
export function removeTurn(notebook: Notebook, turnId: string): Notebook {
  const index = notebook.turns.findIndex((turn) => turn.id === turnId);
  if (index < 0) throw new Error(`no turn ${turnId} in "${notebook.title}"`);
  const analysisId = notebook.turns[index].reply.analysisId;
  const turns = notebook.turns
    .map((turn, i) => {
      if (i <= index) return turn;
      if (analysisId !== undefined && turn.reply.analysisId === analysisId && !turn.stale) {
        return { ...turn, stale: true };
      }
      return turn;
    })
    .filter((_, i) => i !== index);
  return { ...notebook, turns };
}

/** Clears a turn's stale mark, after the user continued from it. */
export function clearStale(notebook: Notebook, turnId: string): Notebook {
  const turns = notebook.turns.map((turn) => (turn.id === turnId && turn.stale ? { ...turn, stale: false } : turn));
  return { ...notebook, turns };
}

/**
 * The analysis a new request continues: the analysisId of the last reply
 * before `beforeTurnId` (or of the last reply when absent) that has one.
 */
export function continuationOf(notebook: Notebook, beforeTurnId?: string): string | undefined {
  const end = beforeTurnId === undefined ? notebook.turns.length : notebook.turns.findIndex((t) => t.id === beforeTurnId);
  const upTo = end < 0 ? notebook.turns : notebook.turns.slice(0, end);
  for (let i = upTo.length - 1; i >= 0; i--) {
    const analysisId = upTo[i].reply.analysisId;
    if (analysisId !== undefined) return analysisId;
  }
  return undefined;
}

/** Undo history over whole notebooks; every edit is one step. */
export interface History {
  readonly past: readonly Notebook[];
  readonly present: Notebook;
  readonly future: readonly Notebook[];
}

export function startHistory(notebook: Notebook): History {
  return { past: [], present: notebook, future: [] };
}

/** Makes `next` the present and clears the redo list. */
export function commit(history: History, next: Notebook): History {
  return { past: [...history.past, history.present], present: next, future: [] };
}

/** Steps back; unchanged when there is nothing to undo. */
export function undo(history: History): History {
  if (history.past.length === 0) return history;
  const present = history.past[history.past.length - 1];
  const past = history.past.slice(0, -1);
  return { past, present, future: [history.present, ...history.future] };
}

/** Steps forward; unchanged when there is nothing to redo. */
export function redo(history: History): History {
  if (history.future.length === 0) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present], present, future };
}
