// @vitest-environment node  (paths below come from import.meta.url, a file URL only under node)
/// <reference types="node" />
// The 3D views of the toolkit's sample notebooks are recorded so a page draws them with no host: the
// model file's name and every row of the instance table. A notebook regenerated against a host that
// could not find the model records neither (the notebook script then prints "no .bos beside ..."),
// and the static site's smoke (gates/nrc-pages-smoke.mjs) fails on it. s15-text-annotation also has
// to keep every labelled row and the four label columns the 3D pane reads (TKT-336).

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseNotebook, type Embed, type Notebook, type TableSnapshot } from "@bimopenflow/bim-open-notebook";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const SAMPLES = join(ROOT, "samples", "notebooks");

/** s10-snowdon works on a private model that is not committed, so its model file is not beside the notebook. */
const PRIVATE = "s10-snowdon.notebook.json";
const notebooks = readdirSync(SAMPLES).filter((f) => f.endsWith(".notebook.json") && f !== PRIVATE);

function load(file: string): Notebook {
  const parsed = parseNotebook(readFileSync(join(SAMPLES, file), "utf8"));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.notebook;
}

type View3d = Extract<Embed, { kind: "view3d" }>;

const viewsOf = (notebook: Notebook): View3d[] =>
  notebook.turns.flatMap((t) => t.reply.embeds.filter((e): e is View3d => e.kind === "view3d"));

describe("recorded 3D views", () => {
  it.each(notebooks)("%s records the model and the rows of every 3D view", (file) => {
    for (const view of viewsOf(load(file))) {
      expect(view.model, `${view.source.analysisId} ${view.source.nodeId}: model`).toMatch(/^models\/.+\.bos$/);
      expect(view.snapshot?.rows.length, `${view.source.analysisId} ${view.source.nodeId}: rows`).toBeGreaterThan(0);
      expect(view.snapshot?.rows.length).toBe(view.snapshot?.totalRows);
    }
  });
});

describe("s15-text-annotation", () => {
  const notebook = load("s15-text-annotation.notebook.json");

  /** The labels of a view: each non-null label with its anchor, which the pane reads from these four columns. */
  function labelsOf(view: View3d): { label: string; anchor: unknown[] }[] {
    const snapshot = view.snapshot as TableSnapshot;
    const index = (name: string) => snapshot.columns.findIndex((c) => c.name === name);
    const [label, x, y, z] = ["label", "labelX", "labelY", "labelZ"].map(index);
    expect([label, x, y, z].every((i) => i >= 0)).toBe(true);
    return snapshot.rows
      .filter((row) => row[label!] !== null)
      .map((row) => ({ label: String(row[label!]), anchor: [row[x!], row[y!], row[z!]] }));
  }

  const turnViews = (turn: number) => viewsOf({ ...notebook, turns: [notebook.turns[turn]!] });

  it("has three turns, each with a 3D view that carries the four label columns and a number for each anchor", () => {
    expect(notebook.turns).toHaveLength(3);
    for (const turn of [0, 1, 2]) {
      expect(turnViews(turn).length).toBeGreaterThan(0);
      for (const view of turnViews(turn))
        for (const { anchor } of labelsOf(view)) expect(anchor.every((v) => typeof v === "number")).toBe(true);
    }
  });

  it("turn 1 labels each storey that has a slab with its operational carbon total, once", () => {
    const [view] = turnViews(0);
    expect(labelsOf(view!).map((l) => l.label)).toEqual([
      "Level 1: 17,457.0 kgCO2e/yr",
      "Level 2: 13,970.2 kgCO2e/yr",
      "Roof: 1,767.3 kgCO2e/yr",
    ]);
    expect(view!.snapshot?.rows).toHaveLength(21);
  });

  it("turn 2 labels the 14 doors with width and verdict: 8 Pass and 6 Fail", () => {
    const [view] = turnViews(1);
    const labels = labelsOf(view!).map((l) => l.label);
    expect(labels).toHaveLength(14);
    expect(labels.filter((l) => l.endsWith("Pass"))).toHaveLength(8);
    expect(labels.filter((l) => l.endsWith("Fail"))).toHaveLength(6);
    expect([...new Set(labels)].sort()).toEqual(["1250 mm Pass", "762 mm Fail", "813 mm Fail", "864 mm Pass"]);
  });

  it("turn 3 labels the ten highest elements, and limit 5 keeps five of the same labels", () => {
    const [all, capped] = turnViews(2);
    const values = labelsOf(all!).map((l) => l.label);
    expect(values).toHaveLength(10);
    expect(values).toContain("412.0 kgCO2e/yr");
    expect(labelsOf(capped!).map((l) => l.label)).toEqual(values.filter((v) => v !== "").slice(0, 5));
  });
});
