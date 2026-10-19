// @vitest-environment node  (paths below come from import.meta.url, a file URL only under node)
/// <reference types="node" />
// The expected answers of samples/notebooks/s14-door-bcf.notebook.json, the door-clearance BCF
// session (written by scripts/write-sample-notebooks.ts from outlines/s14-door-bcf.outline.json):
// the DC-W1 verdicts, their agreement with NRC's ground truth, and the three BCF files under
// samples/nrc/bcf that its file embeds name. The BCF files are read back from disk with a small
// zip reader, so the checks cover what a BCF tool would open and not only the notebook's numbers.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { parseNotebook, type Embed, type Notebook, type TableSnapshot } from "@bimopenflow/bim-open-notebook";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../../..");
const NOTEBOOK = join(ROOT, "samples", "notebooks", "s14-door-bcf.notebook.json");
const GRAPHS = join(ROOT, "samples", "notebooks", "graphs", "s14-door-bcf");

const parsed = parseNotebook(readFileSync(NOTEBOOK, "utf8"));
if (!parsed.ok) throw new Error(parsed.errors.join("\n"));
const notebook: Notebook = parsed.notebook;

const embedsOfTurn = (turn: number): readonly Embed[] => notebook.turns[turn]!.reply.embeds;

function tableOf(turn: number, caption: string): TableSnapshot {
  const embed = embedsOfTurn(turn).find((e) => e.kind === "table" && e.caption === caption);
  if (embed?.kind !== "table") throw new Error(`turn ${turn} has no table "${caption}"`);
  return embed.snapshot;
}

/** The rows of a snapshot as objects keyed by column name. */
const rowsOf = (s: TableSnapshot): Record<string, unknown>[] =>
  s.rows.map((row) => Object.fromEntries(s.columns.map((c, i) => [c.name, row[i]])));

/** A BCF archive's entries, read from its central directory (the writer's entries are deflated). */
function unzip(path: string): Map<string, string> {
  const zip = readFileSync(path);
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(eocd + 10);
  let at = zip.readUInt32LE(eocd + 16);
  const entries = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const compressed = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const extraLength = zip.readUInt16LE(at + 30);
    const commentLength = zip.readUInt16LE(at + 32);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + compressed);
    if (!name.endsWith("/")) entries.set(name, (method === 8 ? inflateRawSync(data) : data).toString("utf8"));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

const bcfPath = (name: string) => join(ROOT, "samples", "nrc", "bcf", name);
const parts = (bcf: Map<string, string>, suffix: string) => [...bcf].filter(([n]) => n.endsWith(suffix)).map(([, xml]) => xml);
const all = (xml: string, pattern: RegExp) => [...xml.matchAll(pattern)].map((m) => m[1]!);

/** The GlobalIds NRC's ground truth expects to fail, from the copy beside the graphs. */
const truthRows = readFileSync(join(GRAPHS, "door_ground_truth.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(","))
  .map((c) => ({ globalId: c[1]!, name: c[2]!, widthMm: Number(c[5]), verdict: c[8]! }));
const failing = truthRows.filter((r) => r.verdict === "fail");
const IDS_813 = ["1s1jVhK8z0pgKYcr9jt781", "1s1jVhK8z0pgKYcr9jt7AB"];

describe("s14-door-bcf", () => {
  it("has six turns, each on its own graph", () => {
    expect(notebook.turns).toHaveLength(6);
    expect(notebook.turns.map((t) => t.reply.analysisId)).toEqual([
      "nb-s14-door-bcf-verdicts",
      "nb-s14-door-bcf-compare",
      "nb-s14-door-bcf-issues",
      "nb-s14-door-bcf-issues",
      "nb-s14-door-bcf-review",
      "nb-s14-door-bcf-return",
    ]);
  });

  describe("turn 1: DC-W1 verdicts", () => {
    const rows = rowsOf(tableOf(0, "DC-W1 verdicts, 14 doors"));

    it("has 8 Pass and 6 Fail, with the widths and margins of NRC's test kit", () => {
      expect(rows).toHaveLength(14);
      const byWidth = (width: number) => rows.filter((r) => r["Width_mm"] === width);
      expect(byWidth(762).map((r) => [r["Verdict"], r["Margin_mm"]])).toEqual(Array(4).fill(["Fail", -88]));
      expect(byWidth(813).map((r) => [r["Verdict"], r["Margin_mm"]])).toEqual(Array(2).fill(["Fail", -37]));
      expect(byWidth(864).map((r) => [r["Verdict"], r["Margin_mm"]])).toEqual(Array(6).fill(["Pass", 14]));
      expect(byWidth(1250).map((r) => [r["Verdict"], r["Margin_mm"]])).toEqual(Array(2).fill(["Pass", 400]));
    });

    it("draws its 3D view with no host: a model file beside the notebook and every row recorded", () => {
      const view = embedsOfTurn(0).find((e) => e.kind === "view3d");
      expect(view?.kind === "view3d" && view.model).toBe("models/duplex-enriched.bos");
      expect(view?.kind === "view3d" && view.snapshot?.totalRows).toBe(714);
      expect(view?.kind === "view3d" && view.snapshot?.rows.length).toBe(714);
    });
  });

  describe("turn 2: ground truth", () => {
    it("agrees on all 14 doors, and the verdict file is NRC's, byte for byte", () => {
      expect(rowsOf(tableOf(1, "Doors whose verdict matches"))).toEqual([{ Agree: true, Doors: 14 }]);
      const file = embedsOfTurn(1).find((e) => e.kind === "file");
      const bytes = readFileSync(join(GRAPHS, "door_ground_truth.csv"));
      expect(file?.kind === "file" && [file.bytes, file.sha256]).toEqual([bytes.length, createHash("sha256").update(bytes).digest("hex")]);
    });

    it("names the near-threshold doors: the 813 mm ones fail by 37 mm, the 864 mm ones pass by 14 mm", () => {
      const rows = rowsOf(tableOf(1, "Verdict against ground truth, 14 doors"));
      const near = (margin: number) => rows.filter((r) => r["Margin_mm"] === margin).map((r) => r["Name"] as string);
      expect(near(-37).map((n) => n.split(":").pop())).toEqual(["171853", "171975"]);
      expect(near(14).map((n) => n.split(":").pop()).sort()).toEqual(["150378", "150478", "159734", "159834", "160065", "160208"]);
      expect(rows.every((r) => r["Width_mm"] === r["Truth_mm"])).toBe(true);
    });
  });

  describe("turn 3: one topic per failing door", () => {
    const topics = rowsOf(tableOf(2, "BCF topics Run will write"));

    it("previews six topics of one element each, for exactly the doors the ground truth fails", () => {
      expect(topics).toHaveLength(6);
      expect(topics.map((t) => t["Elements"])).toEqual(Array(6).fill(1));
      expect(topics.map((t) => t["GlobalIds"] as string).sort()).toEqual(failing.map((r) => r.globalId).sort());
    });

    it("states each door's shortfall in its description", () => {
      for (const t of topics) {
        const door = failing.find((r) => r.globalId === t["GlobalIds"])!;
        expect(t["Description"]).toContain(`${door.widthMm} mm wide, ${850 - door.widthMm} mm short`);
      }
    });
  });

  describe("turn 4: the failures BCF", () => {
    const path = bcfPath("s14-door-bcf-failures.bcf");
    const bcf = unzip(path);

    it("embeds the committed file with its size and SHA-256", () => {
      const file = embedsOfTurn(3).find((e) => e.kind === "file");
      const bytes = readFileSync(path);
      expect(file?.kind === "file" && [file.path, file.bytes, file.sha256]).toEqual([
        "samples/nrc/bcf/s14-door-bcf-failures.bcf",
        bytes.length,
        createHash("sha256").update(bytes).digest("hex"),
      ]);
      expect(bytes.length).toBe(8531);
    });

    it("holds one viewpoint per topic, selecting that topic's door, with a camera", () => {
      const markups = parts(bcf, "markup.bcf");
      const viewpoints = parts(bcf, "viewpoint.bcfv");
      expect(markups).toHaveLength(6);
      expect(viewpoints).toHaveLength(6);
      expect(viewpoints.flatMap((v) => all(v, /IfcGuid="([^"]+)"/g)).sort()).toEqual(failing.map((r) => r.globalId).sort());
      expect(viewpoints.every((v) => v.includes("<PerspectiveCamera>"))).toBe(true);
      expect(parts(bcf, "bcf.version")[0]).toContain('VersionId="3.0"');
    });

    it("names the Duplex model by a path from the repository root, not by a machine's folder", () => {
      const markup = parts(bcf, "markup.bcf")[0]!;
      expect(markup).toContain("<Reference>samples/nrc/duplex-enriched.bos</Reference>");
      expect(markup).not.toMatch(/Users|[A-Za-z]:[\\/]/);
    });
  });

  describe("turn 5: the reviewer's comment", () => {
    it("is one issue on the two 813 mm doors with a camera in its columns", () => {
      const rows = rowsOf(tableOf(4, "The reviewer's issue, with its camera"));
      expect(rows.map((r) => r["GlobalId"])).toEqual(IDS_813);
      expect(rows.map((r) => [r["Author"], r["CameraX"], r["CameraY"], r["CameraZ"], r["FieldOfView"]])).toEqual(
        Array(2).fill(["Reviewer", 24, -24, 12, 60]),
      );
    });

    it("is written as one topic, one comment by Reviewer, and a viewpoint at that camera", () => {
      const bcf = unzip(bcfPath("s14-door-bcf-review.bcf"));
      const markup = parts(bcf, "markup.bcf");
      expect(markup).toHaveLength(1);
      expect(all(markup[0]!, /<Author>([^<]+)<\/Author>/g)).toEqual(["Reviewer"]);
      const viewpoint = parts(bcf, "viewpoint.bcfv")[0]!;
      expect(all(viewpoint, /IfcGuid="([^"]+)"/g)).toEqual(IDS_813);
      expect(viewpoint).toMatch(/<CameraViewPoint>\s*<X>24<\/X>\s*<Y>-24<\/Y>\s*<Z>12<\/Z>/);
    });
  });

  describe("turn 6: the architect's reply comes back", () => {
    it("has two comments by two authors, in order", () => {
      const comments = rowsOf(tableOf(5, "Comments in the returned BCF"));
      expect(comments.map((c) => c["CommentAuthor"])).toEqual(["Reviewer", "Architect"]);
    });

    it("joins the flagged doors to the model on GlobalId: the two 813 mm doors, each with 2 comments", () => {
      const rows = rowsOf(tableOf(5, "Flagged elements joined to the model on GlobalId"));
      expect(rows.map((r) => [r["GlobalId"], r["Width_mm"], r["Verdict"], r["Status"], r["Comments"]])).toEqual(
        IDS_813.map((id) => [id, 813, "Fail", "Open", 2]),
      );
    });

    it("draws the coloured doors with no host", () => {
      const view = embedsOfTurn(5).find((e) => e.kind === "view3d");
      expect(view?.kind === "view3d" && view.model).toBe("models/duplex-enriched.bos");
      expect(view?.kind === "view3d" && view.snapshot?.rows.length).toBe(714);
    });

    it("is the reviewer's topic with the architect's comment added: same topic GUID, both comments in the file", () => {
      const review = unzip(bcfPath("s14-door-bcf-review.bcf"));
      const reply = unzip(bcfPath("s14-door-bcf-reply.bcf"));
      const guid = (bcf: Map<string, string>) => all(parts(bcf, "markup.bcf")[0]!, /<Topic Guid="([^"]+)"/g);
      expect(guid(reply)).toEqual(guid(review));
      expect(all(parts(reply, "markup.bcf")[0]!, /<Author>([^<]+)<\/Author>/g)).toEqual(["Reviewer", "Architect"]);
    });

    it("embeds the reply file with the size and SHA-256 of the committed file", () => {
      const bytes = readFileSync(bcfPath("s14-door-bcf-reply.bcf"));
      const file = embedsOfTurn(5).find((e) => e.kind === "file");
      expect(file?.kind === "file" && [file.bytes, file.sha256]).toEqual([bytes.length, createHash("sha256").update(bytes).digest("hex")]);
    });
  });
});
