// @vitest-environment node  (paths below come from import.meta.url, a file URL only under node)
/// <reference types="node" />
// The committed sample notebooks (samples/notebooks, written by
// scripts/write-sample-notebooks.ts): they parse, and their snapshots carry
// the paper's expected answers.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Embed, Notebook, TableSnapshot } from "../src/document/format";
import { parseNotebook } from "../src/document/io";
import { sampleGraphFiles, staleLayouts, syncLayouts } from "../scripts/embedLayouts";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const SAMPLES = join(ROOT, "samples", "notebooks");
const OUTLINES = join(SAMPLES, "outlines");
const ANALYSES = join(ROOT, "samples", "nrc-analyses");

const sampleFiles = readdirSync(SAMPLES).filter((f) => f.endsWith(".notebook.json"));

function load(name: string): Notebook {
  const parsed = parseNotebook(readFileSync(join(SAMPLES, `${name}.notebook.json`), "utf8"));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.notebook;
}

/** The analysis ids of the graphs an outline saves to the host (file names without .json). */
function outlineGraphIds(name: string): string[] {
  const outline = JSON.parse(readFileSync(join(OUTLINES, `${name}.outline.json`), "utf8")) as { graphs?: string[] };
  return (outline.graphs ?? []).map((path) => path.split("/").pop()!.replace(/\.json$/, ""));
}

/** Every embed of every turn, with the turn's index. */
const embedsOf = (notebook: Notebook): { turn: number; embed: Embed }[] =>
  notebook.turns.flatMap((t, turn) => t.reply.embeds.map((embed) => ({ turn, embed })));

/** The cell in `column` of the row whose first cell is `key`. */
function cell(snapshot: TableSnapshot, key: string, column: string): unknown {
  const col = snapshot.columns.findIndex((c) => c.name === column);
  return snapshot.rows.find((row) => row[0] === key)?.[col];
}

function snapshotOf(embed: Embed | undefined): TableSnapshot {
  if (!embed || !("snapshot" in embed)) throw new Error(`expected an embed with a snapshot, got ${embed?.kind}`);
  return embed.snapshot;
}

describe("sample notebooks", () => {
  it("has one notebook per outline", () => {
    const outlines = readdirSync(OUTLINES).filter((f) => f.endsWith(".outline.json"));
    expect(sampleFiles.sort()).toEqual(outlines.map((f) => f.replace(/\.outline\.json$/, ".notebook.json")).sort());
    expect(sampleFiles.length).toBeGreaterThanOrEqual(12);
  });

  it.each(sampleFiles)("%s parses", (file) => {
    const parsed = parseNotebook(readFileSync(join(SAMPLES, file), "utf8"));
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  it.each(sampleFiles)("%s names only analyses in samples/nrc-analyses or its outline's graphs", (file) => {
    const name = file.replace(/\.notebook\.json$/, "");
    const known = new Set([
      ...readdirSync(ANALYSES).map((f) => f.replace(/\.json$/, "")),
      ...outlineGraphIds(name),
    ]);
    const named = embedsOf(load(name)).flatMap(({ embed }) =>
      embed.kind === "graph" ? [embed.analysisId] : "source" in embed ? [embed.source.analysisId] : [],
    );
    expect(named.filter((id) => !known.has(id))).toEqual([]);
  });

  // The graph files are relaid out so no two cards overlap (TKT-110); a stale copy in a notebook
  // draws them on top of each other. Fix with scripts/sync-embed-layouts.ts.
  it.each(sampleFiles)("%s places every graph card where its graph file does", (file) => {
    const name = file.replace(/\.notebook\.json$/, "");
    const stale = staleLayouts(readFileSync(join(SAMPLES, file), "utf8"), sampleGraphFiles(name));
    expect(stale.map((s) => `${s.analysisId}.${s.node}`)).toEqual([]);
  });

  it("the layout check reports a card moved in the graph file but not in the notebook", () => {
    const text = readFileSync(join(SAMPLES, "nrc-eight-questions.notebook.json"), "utf8");
    const graphs = sampleGraphFiles("nrc-eight-questions");
    const embed = load("nrc-eight-questions").turns[8].reply.embeds.find((e) => e.kind === "graph");
    const embedded = embed?.kind === "graph" ? embed.document! : "";
    const document = JSON.parse(embedded) as { layout: object };
    const moved = JSON.stringify({ ...document, layout: { ...document.layout, answer: { x: 1, y: 2 } } }, null, 2);
    const staleText = text.split(JSON.stringify(embedded)).join(JSON.stringify(moved));
    expect(staleLayouts(staleText, graphs).map((s) => `${s.analysisId}.${s.node}`)).toEqual(["nrc-storey-carbon-chart.answer"]);
    expect(staleLayouts(syncLayouts(staleText, graphs), graphs)).toEqual([]);
  });

  it.each(sampleFiles.filter((f) => /^s\d+-/.test(f)))("%s is labelled as reconstructed", (file) => {
    expect(load(file.replace(/\.notebook\.json$/, "")).host?.note).toMatch(/^Reconstructed session/);
  });

  // A machine-local path, however the JSON escapes its separators: a drive
  // letter with \Users\ (doubled to \\Users\\ in the JSON source) or /Users/,
  // or a Unix home directory under /home/ or /Users/.
  const LOCAL_PATH = /[A-Za-z]:(\\\\|\/)Users(\\\\|\/)|\/home\/|\/Users\//;

  it.each(sampleFiles)("%s names no path on the machine that wrote it", (file) => {
    expect(readFileSync(join(SAMPLES, file), "utf8")).not.toMatch(LOCAL_PATH);
  });

  it("the local-path check catches a JSON-escaped backslash path, a forward-slash one, and a Unix home directory", () => {
    expect('"C:\\\\Users\\\\me\\\\file.json"').toMatch(LOCAL_PATH);
    expect('"C:/Users/me/file.json"').toMatch(LOCAL_PATH);
    expect('"/home/me/file.json"').toMatch(LOCAL_PATH);
    expect('"/Users/me/file.json"').toMatch(LOCAL_PATH);
    expect('"samples/notebooks/graphs/x.json"').not.toMatch(LOCAL_PATH);
  });
});

// Expected answers from nrc-ifc-llm/poc/results/expected_answers.json.
describe("nrc-eight-questions", () => {
  const notebook = load("nrc-eight-questions");

  it("asks the eight questions of samples/nrc/questions.txt verbatim, then one follow-up", () => {
    const questions = readFileSync(join(ROOT, "samples", "nrc", "questions.txt"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line !== "" && !line.startsWith("#"));
    expect(questions).toHaveLength(8);
    expect(notebook.turns).toHaveLength(9);
    expect(notebook.turns.slice(0, 8).map((t) => t.request.text)).toEqual(questions);
  });

  it("Q1 shows the total operational carbon as a value, 37,196.2 kgCO2e/yr", () => {
    const value = notebook.turns[0].reply.embeds.find((e) => e.kind === "value");
    expect(value?.kind === "value" && value.unit).toBe("kgCO2e/yr");
    const snapshot = snapshotOf(value);
    expect(value?.kind === "value" && value.column).toBe("Total");
    expect(snapshot.rows[0][snapshot.columns.findIndex((c) => c.name === "Total")]).toBeCloseTo(37196.2, 1);
  });

  it("Q7 finds the roof with no embodied-carbon value", () => {
    const snapshot = snapshotOf(notebook.turns[6].reply.embeds.find((e) => e.kind === "table"));
    expect(snapshot.totalRows).toBe(1);
    expect(snapshot.rows[0][0]).toBe("0jf0rYHfX3RAB3bSIRjmxl");
  });

  it("Q8 carries the embodied carbon A1-A3 of each storey", () => {
    const snapshot = snapshotOf(notebook.turns[7].reply.embeds.find((e) => e.kind === "table"));
    const expected = { "Level 1": 49451.2, "Level 2": 48696.8, "T/FDN": 11761.3, Roof: 5821.0 };
    for (const [storey, embodied] of Object.entries(expected))
      expect(cell(snapshot, storey, "Embodied")).toBeCloseTo(embodied, 1);
  });

  it("ends with a chart", () => {
    expect(notebook.turns[8].reply.embeds.map((e) => e.kind)).toContain("chart");
  });
});

describe("nrc-door-check", () => {
  const notebook = load("nrc-door-check");
  const verdicts = snapshotOf(notebook.turns[0].reply.embeds.find((e) => e.kind === "table"));
  const column = (name: string) => verdicts.columns.findIndex((c) => c.name === name);

  it("has 8 pass and 6 fail verdicts for DC-W1", () => {
    expect(verdicts.totalRows).toBe(14);
    expect(new Set(verdicts.rows.map((r) => r[column("checkId")]))).toEqual(new Set(["DC-W1"]));
    const count = (v: string) => verdicts.rows.filter((r) => r[column("verdict")] === v).length;
    expect([count("Pass"), count("Fail")]).toEqual([8, 6]);
  });

  it("agrees with the DC-W1 rows of samples/nrc/door_verdicts.csv, as its reply says", () => {
    const fromFile = readFileSync(join(ROOT, "samples", "nrc", "door_verdicts.csv"), "utf8")
      .split(/\r?\n/)
      .map((line) => /^"([^"]+)","DC-W1",(\w+),/.exec(line))
      .filter((m) => m !== null)
      .map((m) => [m[1], m[2]]);
    const fromGraph = verdicts.rows.map((r) => [r[column("GlobalId")], String(r[column("verdict")]).toLowerCase()]);
    expect(fromGraph.sort()).toEqual(fromFile.sort());
  });

  it("shows the verdicts in 3D and names the verdict file", () => {
    const kinds = embedsOf(notebook).map(({ embed }) => embed.kind);
    expect(kinds).toContain("view3d");
    const file = embedsOf(notebook).find(({ embed }) => embed.kind === "file")?.embed;
    expect(file?.kind === "file" && file.path).toBe("samples/nrc/door_verdicts.csv");
  });
});
