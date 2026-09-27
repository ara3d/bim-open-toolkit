import { describe, expect, it } from "vitest";
import type { Notebook, Reply, Request, Turn } from "../src/document/format";
import {
  appendTurn,
  clearStale,
  commit,
  continuationOf,
  nextTurnId,
  redo,
  removeTurn,
  resendTurn,
  startHistory,
  undo,
} from "../src/document/edits";

const request = (text: string): Request => Object.freeze({ text });

const reply = (text: string, analysisId?: string): Reply =>
  Object.freeze({ text, tools: [], embeds: [], ...(analysisId !== undefined ? { analysisId } : {}) });

const turn = (id: string, text: string, analysisId?: string, extra: Partial<Turn> = {}): Turn =>
  Object.freeze({ id, request: request(`req ${text}`), reply: reply(`reply ${text}`, analysisId), ...extra });

const notebookWith = (turns: readonly Turn[]): Notebook =>
  Object.freeze({
    format: "bimopen-notebook/0.1",
    title: "n",
    createdUtc: "2026-09-27T00:00:00Z",
    turns: Object.freeze(turns),
  });

const empty = notebookWith([]);

describe("nextTurnId", () => {
  it("is t1 for an empty notebook", () => {
    expect(nextTurnId(empty)).toBe("t1");
  });

  it("is one past the highest numeric suffix in use", () => {
    const nb = notebookWith([turn("t1", "a"), turn("t3", "b")]);
    expect(nextTurnId(nb)).toBe("t4");
  });

  it("ignores ids of other shapes", () => {
    const nb = notebookWith([turn("t2", "a"), turn("intro", "b"), turn("t-x", "c")]);
    expect(nextTurnId(nb)).toBe("t3");
  });
});

describe("appendTurn", () => {
  it("adds a turn at the end with the next id", () => {
    const nb = notebookWith([turn("t1", "a")]);
    const next = appendTurn(nb, request("q"), reply("a"));
    expect(next.turns).toHaveLength(2);
    expect(next.turns[1].id).toBe("t2");
    expect(next.turns[1].request.text).toBe("q");
    expect(next.turns[0]).toBe(nb.turns[0]);
  });

  it("does not mutate the input notebook", () => {
    const nb = notebookWith([turn("t1", "a")]);
    appendTurn(nb, request("q"), reply("a"));
    expect(nb.turns).toHaveLength(1);
  });
});

describe("resendTurn", () => {
  it("replaces the request and reply, keeping the old ones in earlier, and clears the turn's own stale mark", () => {
    const t1 = turn("t1", "one", undefined, { stale: true });
    const nb = notebookWith([t1]);
    const next = resendTurn(nb, "t1", request("new"), reply("new-reply"));
    expect(next.turns[0].stale).toBe(false);
    expect(next.turns[0].request.text).toBe("new");
    expect(next.turns[0].earlier).toEqual([{ request: t1.request, reply: t1.reply }]);
  });

  it("appends to an existing earlier list", () => {
    const t1 = turn("t1", "one", undefined, { earlier: [{ request: request("zero"), reply: reply("zero-reply") }] });
    const nb = notebookWith([t1]);
    const next = resendTurn(nb, "t1", request("new"), reply("new-reply"));
    expect(next.turns[0].earlier).toHaveLength(2);
    expect(next.turns[0].earlier?.[1]).toEqual({ request: t1.request, reply: t1.reply });
  });

  it("marks every later turn stale and leaves earlier turns untouched", () => {
    const t1 = turn("t1", "one");
    const t2 = turn("t2", "two");
    const t3 = turn("t3", "three");
    const nb = notebookWith([t1, t2, t3]);
    const next = resendTurn(nb, "t1", request("new"), reply("new-reply"));
    expect(next.turns[1].stale).toBe(true);
    expect(next.turns[2].stale).toBe(true);
    expect(next.turns[1].request).toBe(t2.request);
  });

  it("marks nothing later when resending the last turn", () => {
    const t1 = turn("t1", "one");
    const t2 = turn("t2", "two");
    const nb = notebookWith([t1, t2]);
    const next = resendTurn(nb, "t2", request("new"), reply("new-reply"));
    expect(next.turns[0]).toBe(t1);
  });

  it("throws for an unknown id", () => {
    const nb = notebookWith([turn("t1", "one")]);
    expect(() => resendTurn(nb, "missing", request("x"), reply("y"))).toThrow();
  });

  it("does not mutate the input notebook", () => {
    const t1 = Object.freeze(turn("t1", "one"));
    const nb = Object.freeze(notebookWith([t1]));
    resendTurn(nb, "t1", request("new"), reply("new-reply"));
    expect(nb.turns[0]).toBe(t1);
  });
});

describe("removeTurn", () => {
  it("removes the turn and leaves untouched turns reference-equal", () => {
    const t1 = turn("t1", "one");
    const t2 = turn("t2", "two");
    const nb = notebookWith([t1, t2]);
    const next = removeTurn(nb, "t1");
    expect(next.turns).toHaveLength(1);
    expect(next.turns[0]).toBe(t2);
  });

  it("marks later turns with the same reply.analysisId stale", () => {
    const t1 = turn("t1", "one", "a1");
    const t2 = turn("t2", "two", "a1");
    const t3 = turn("t3", "three", "a2");
    const nb = notebookWith([t1, t2, t3]);
    const next = removeTurn(nb, "t1");
    expect(next.turns).toHaveLength(2);
    expect(next.turns[0].stale).toBe(true);
    expect(next.turns[0].id).toBe("t2");
    expect(next.turns[1]).toBe(t3);
  });

  it("removing the only turn leaves an empty notebook", () => {
    const nb = notebookWith([turn("t1", "one")]);
    const next = removeTurn(nb, "t1");
    expect(next.turns).toHaveLength(0);
  });

  it("throws for an unknown id", () => {
    const nb = notebookWith([turn("t1", "one")]);
    expect(() => removeTurn(nb, "missing")).toThrow();
  });

  it("does not mutate the input notebook", () => {
    const nb = notebookWith([turn("t1", "one"), turn("t2", "two")]);
    removeTurn(nb, "t1");
    expect(nb.turns).toHaveLength(2);
  });
});

describe("clearStale", () => {
  it("clears the mark on the named turn only", () => {
    const t1 = turn("t1", "one", undefined, { stale: true });
    const t2 = turn("t2", "two", undefined, { stale: true });
    const nb = notebookWith([t1, t2]);
    const next = clearStale(nb, "t1");
    expect(next.turns[0].stale).toBe(false);
    expect(next.turns[1]).toBe(t2);
  });
});

describe("continuationOf", () => {
  it("is undefined for an empty notebook", () => {
    expect(continuationOf(empty)).toBeUndefined();
  });

  it("is undefined when no reply has an analysisId", () => {
    const nb = notebookWith([turn("t1", "one"), turn("t2", "two")]);
    expect(continuationOf(nb)).toBeUndefined();
  });

  it("is the last reply's analysisId when beforeTurnId is absent", () => {
    const nb = notebookWith([turn("t1", "one", "a1"), turn("t2", "two", "a2")]);
    expect(continuationOf(nb)).toBe("a2");
  });

  it("skips replies without an analysisId, walking backward from beforeTurnId", () => {
    const nb = notebookWith([turn("t1", "one", "a1"), turn("t2", "two"), turn("t3", "three")]);
    expect(continuationOf(nb, "t3")).toBe("a1");
  });
});

describe("history", () => {
  it("starts with an empty past and future", () => {
    const history = startHistory(empty);
    expect(history.past).toEqual([]);
    expect(history.present).toBe(empty);
    expect(history.future).toEqual([]);
  });

  it("commit pushes the present onto past and clears future", () => {
    const nb2 = notebookWith([turn("t1", "one")]);
    const nb3 = notebookWith([turn("t1", "one"), turn("t2", "two")]);
    let history = startHistory(empty);
    history = commit(history, nb2);
    history = undo(history);
    history = commit(history, nb3);
    expect(history.present).toBe(nb3);
    expect(history.future).toEqual([]);
    expect(history.past).toEqual([empty]);
  });

  it("undo and redo move through the steps", () => {
    const nb2 = notebookWith([turn("t1", "one")]);
    let history = startHistory(empty);
    history = commit(history, nb2);
    history = undo(history);
    expect(history.present).toBe(empty);
    history = redo(history);
    expect(history.present).toBe(nb2);
  });

  it("undo is a no-op at the start", () => {
    const history = startHistory(empty);
    expect(undo(history)).toEqual(history);
  });

  it("redo is a no-op at the end", () => {
    const history = startHistory(empty);
    expect(redo(history)).toEqual(history);
  });
});
