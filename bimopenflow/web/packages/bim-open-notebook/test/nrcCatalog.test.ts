// @vitest-environment node  (paths below come from import.meta.url, a file URL only under node)
/// <reference types="node" />
// The NRC landing page's lists: the graphs read from the committed README of
// samples/nrc-analyses and the notebook entries read from samples/notebooks.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { notebookEntry, orderNotebooks, type NotebookEntry } from "../src/page/catalog";
import { NRC_LEAD, parseGraphTable } from "../src/page/nrcCatalog";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const README = readFileSync(join(ROOT, "samples", "nrc-analyses", "README.md"), "utf8");
const NOTEBOOKS = join(ROOT, "samples", "notebooks");
const ANALYSES = join(ROOT, "samples", "nrc-analyses");

describe("parseGraphTable", () => {
  const graphs = parseGraphTable(README);

  it("lists every graph document in samples/nrc-analyses, and nothing else", () => {
    const files = readdirSync(ANALYSES)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort();
    expect(graphs.map((g) => g.id).sort()).toEqual(files);
  });

  it("keeps the README's columns as text, code spans dropped", () => {
    const q1 = graphs.find((g) => g.id === "nrc-q1-building-total")!;
    expect(q1.answers).toBe("total operational carbon and element count");
    expect(q1.profiles).toBe("tables, bim");
    expect(q1.viewer3d).toBe(false);
  });

  it("marks the graphs that colour the model for the 3D page", () => {
    const viewer = graphs.filter((g) => g.viewer3d).map((g) => g.id);
    expect(viewer).toEqual(["nrc-dc-w1-verdicts", "nrc-color-operational-carbon"]);
  });

  it("is empty without a Graph table", () => {
    expect(parseGraphTable("# Nothing\n\n| Other | Table |\n|---|---|\n| a | b |\n")).toEqual([]);
  });
});

describe("notebookEntry", () => {
  const files = readdirSync(NOTEBOOKS).filter((f) => f.endsWith(".notebook.json"));
  const entries = files.map((f) => notebookEntry(f, readFileSync(join(NOTEBOOKS, f), "utf8")));

  it("reads every committed sample", () => {
    for (const entry of entries) expect("errors" in entry ? entry.errors : []).toEqual([]);
  });

  it("carries the title, profile, turn count, first request, and whether the session was reconstructed", () => {
    const eight = entries.find((e) => "name" in e && e.name === "nrc-eight-questions") as NotebookEntry;
    expect(eight.title).toBe("The NRC paper's eight questions");
    expect(eight.profile).toBe("tables");
    expect(eight.turns).toBe(9);
    expect(eight.firstRequest).toBe("What is the total operational carbon for the building?");
    expect(eight.reconstructed).toBe(false);
    const handover = entries.find((e) => "name" in e && e.name === "s13-handover") as NotebookEntry;
    expect(handover.reconstructed).toBe(true);
  });

  it("reports the parse errors of a bad file instead of throwing", () => {
    expect(notebookEntry("bad.notebook.json", "{}")).toHaveProperty("errors");
  });

  it("orders the three recorded NRC notebooks first, then the rest as listed", () => {
    const ordered = orderNotebooks(entries.filter((e): e is NotebookEntry => "name" in e), NRC_LEAD);
    expect(ordered.slice(0, 4).map((e) => e.name)).toEqual([
      "nrc-eight-questions",
      "nrc-test-kit",
      "nrc-door-check",
      "s01-first-look",
    ]);
  });
});
