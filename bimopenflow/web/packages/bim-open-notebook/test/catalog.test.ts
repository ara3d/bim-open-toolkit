// A landing page's notebook list (src/page/catalog.ts): entries from made-up
// notebooks, and the order a caller's lead list sets.

import { describe, expect, it } from "vitest";
import { notebookEntry, orderNotebooks, type NotebookEntry } from "../src/page/catalog";
import { appendTurn } from "../src/document/edits";
import { emptyNotebook, serializeNotebook } from "../src/document/io";

const entry = (name: string): NotebookEntry => ({ name, title: name, turns: 0, reconstructed: false });

describe("notebookEntry", () => {
  it("names the entry by its file without the extension, and reads title, profile, turns and first request", () => {
    const notebook = appendTurn(
      { ...emptyNotebook("Doors", "2026-10-03T00:00:00Z"), host: { profile: "tables", note: "Reconstructed session" } },
      { text: "How many doors?" },
      { text: "142.", tools: [], embeds: [] },
    );
    expect(notebookEntry("doors.notebook.json", serializeNotebook(notebook))).toEqual({
      name: "doors",
      title: "Doors",
      profile: "tables",
      turns: 1,
      firstRequest: "How many doors?",
      reconstructed: true,
    });
  });
});

describe("orderNotebooks", () => {
  it("puts the lead names first, in the lead's order, then the rest as given", () => {
    const ordered = orderNotebooks(
      [entry("s01"), entry("nrc-door-check"), entry("nrc-eight-questions")],
      ["nrc-eight-questions", "nrc-test-kit", "nrc-door-check"],
    );
    expect(ordered.map((e) => e.name)).toEqual(["nrc-eight-questions", "nrc-door-check", "s01"]);
  });

  it("keeps the given order when no lead is named", () => {
    const names = ["b", "a", "c"];
    expect(orderNotebooks(names.map(entry)).map((e) => e.name)).toEqual(names);
  });
});
