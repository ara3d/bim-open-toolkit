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

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const SAMPLES = join(ROOT, "samples", "notebooks");
const ANALYSES = join(ROOT, "samples", "nrc-analyses");

const sampleFiles = readdirSync(SAMPLES).filter((f) => f.endsWith(".notebook.json"));

function load(name: string): Notebook {
  const parsed = parseNotebook(readFileSync(join(SAMPLES, `${name}.notebook.json`), "utf8"));
  if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
  return parsed.notebook;
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
  it("finds the three samples", () => {
    expect(sampleFiles.sort()).toEqual([
      "nrc-door-check.notebook.json",
      "nrc-eight-questions.notebook.json",
      "nrc-test-kit.notebook.json",
    ]);
  });

  it.each(sampleFiles)("%s parses", (file) => {
    const parsed = parseNotebook(readFileSync(join(SAMPLES, file), "utf8"));
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  it.each(sampleFiles)("%s names only analyses in samples/nrc-analyses", (file) => {
    const known = new Set(readdirSync(ANALYSES).map((f) => f.replace(/\.json$/, "")));
    const notebook = load(file.replace(/\.notebook\.json$/, ""));
    const named = embedsOf(notebook).flatMap(({ embed }) =>
      embed.kind === "graph" ? [embed.analysisId] : "source" in embed ? [embed.source.analysisId] : [],
    );
    expect(named.length).toBeGreaterThan(0);
    expect(named.filter((id) => !known.has(id))).toEqual([]);
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
