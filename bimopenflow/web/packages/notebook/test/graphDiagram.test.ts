import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDocument, type GraphDocument } from "@bimopenflow/state";
import {
  buildGraphDiagram,
  DRAWING_WIDTH_PX,
  ID_FONT_SIZE,
  KIND_FONT_SIZE,
} from "../src/embeds/graphDiagram";

function doc(overrides: Partial<GraphDocument> = {}): GraphDocument {
  return {
    formatVersion: "0.1.0",
    structure: {
      nodes: [
        { id: "source", kind: "ifc.source", version: 1 },
        { id: "answer", kind: "math.sum", version: 1 },
      ],
      edges: [{ from: "source.out", to: "answer.in" }],
    },
    values: {},
    layout: { source: { x: 0, y: 0 }, answer: { x: 240, y: 0 } },
    ...overrides,
  };
}

describe("buildGraphDiagram", () => {
  it("draws one box per node and one path per edge", () => {
    const svg = buildGraphDiagram(doc(), { analysisId: "nrc-q1" });
    expect(svg.querySelectorAll(".nb-graph-node").length).toBe(2);
    expect(svg.querySelectorAll(".nb-graph-edge").length).toBe(1);
  });

  it("titles each box with the node's id and a friendly kind title", () => {
    const svg = buildGraphDiagram(doc(), { analysisId: "nrc-q1" });
    const ids = [...svg.querySelectorAll(".nb-graph-node-id")].map((n) => n.textContent);
    expect(ids).toEqual(["source", "answer"]);
    const kinds = [...svg.querySelectorAll(".nb-graph-node-kind")].map((n) => n.textContent);
    // ifc.source and math.sum have no friendly title in graphPreview.nodeTitle, so it falls back to the kind.
    expect(kinds).toEqual(["ifc.source", "math.sum"]);
  });

  it("shows a friendly title from graphPreview.nodeTitle when one exists", () => {
    const svg = buildGraphDiagram(
      doc({
        structure: {
          nodes: [{ id: "scene", kind: "view3d.scene", version: 1 }],
          edges: [],
        },
        layout: { scene: { x: 0, y: 0 } },
      }),
      { analysisId: "a" },
    );
    expect(svg.querySelector(".nb-graph-node-kind")!.textContent).toBe("Model");
  });

  it("highlights focus nodes with nb-graph-node-focus", () => {
    const svg = buildGraphDiagram(doc(), { analysisId: "nrc-q1", focus: ["answer"] });
    const answer = svg.querySelector('[data-node-id="answer"]')!;
    const source = svg.querySelector('[data-node-id="source"]')!;
    expect(answer.classList.contains("nb-graph-node-focus")).toBe(true);
    expect(source.classList.contains("nb-graph-node-focus")).toBe(false);
  });

  it("gives the svg an accessible title naming the analysis and node count", () => {
    const svg = buildGraphDiagram(doc(), { analysisId: "nrc-q1" });
    expect(svg.querySelector("title")!.textContent).toBe("Graph nrc-q1: 2 nodes");
    expect(svg.getAttribute("aria-label")).toBe("Graph nrc-q1: 2 nodes");
  });

  it("always lays out by depth, ignoring the saved editor x (built for a pannable canvas, not this column)", () => {
    const withSavedX = doc({
      structure: {
        nodes: [
          { id: "a", kind: "k.a", version: 1 },
          { id: "b", kind: "k.b", version: 1 },
          { id: "c", kind: "k.c", version: 1 },
        ],
        edges: [
          { from: "a.out", to: "b.in" },
          { from: "b.out", to: "c.in" },
        ],
      },
      // Saved x values run the other way; the diagram should still put a before b before c.
      layout: { a: { x: 999, y: 0 }, b: { x: 500, y: 0 }, c: { x: 0, y: 0 } },
    });
    const svg = buildGraphDiagram(withSavedX, { analysisId: "x" });
    const boxOf = (id: string) => svg.querySelector(`[data-node-id="${id}"] rect`)!;
    const xOf = (id: string) => Number(boxOf(id).getAttribute("x"));
    // A depth-ordered layout puts a before b before c on the x axis, regardless of saved x.
    expect(xOf("a")).toBeLessThan(xOf("b"));
    expect(xOf("b")).toBeLessThan(xOf("c"));
  });

  it("draws a graph with no saved layout at all", () => {
    const noLayout = doc({ layout: {} });
    const svg = buildGraphDiagram(noLayout, { analysisId: "nrc-q1" });
    expect(svg.querySelectorAll(".nb-graph-node").length).toBe(2);
    const sourceX = Number(svg.querySelector('[data-node-id="source"] rect')!.getAttribute("x"));
    const answerX = Number(svg.querySelector('[data-node-id="answer"] rect')!.getAttribute("x"));
    expect(sourceX).toBeLessThan(answerX);
  });

  it("orders nodes sharing a column by saved y, not by id", () => {
    const siblings = doc({
      structure: {
        nodes: [
          { id: "zed", kind: "k", version: 1 },
          { id: "able", kind: "k", version: 1 },
        ],
        edges: [],
      },
      // Both at depth 0 (no edges): "zed" is saved above "able", so it should draw first.
      layout: { zed: { x: 0, y: 0 }, able: { x: 0, y: 400 } },
    });
    const svg = buildGraphDiagram(siblings, { analysisId: "x" });
    const yOf = (id: string) => Number(svg.querySelector(`[data-node-id="${id}"] rect`)!.getAttribute("y"));
    expect(yOf("zed")).toBeLessThan(yOf("able"));
  });

  it("orders a node with no saved position after every node that has one", () => {
    const mixed = doc({
      structure: {
        nodes: [
          { id: "hasY", kind: "k", version: 1 },
          { id: "noY", kind: "k", version: 1 },
        ],
        edges: [],
      },
      layout: { hasY: { x: 0, y: 999 } }, // deliberately a large y: still sorts before the node with none.
    });
    const svg = buildGraphDiagram(mixed, { analysisId: "x" });
    const yOf = (id: string) => Number(svg.querySelector(`[data-node-id="${id}"] rect`)!.getAttribute("y"));
    expect(yOf("hasY")).toBeLessThan(yOf("noY"));
  });

  it("truncates a long node id or kind with an ellipsis and keeps the full names in the title tooltip", () => {
    const longNames = doc({
      structure: {
        nodes: [{ id: "a-very-long-node-identifier-that-will-not-fit", kind: "some.very.long.node.kind.name", version: 3 }],
        edges: [],
      },
      layout: { "a-very-long-node-identifier-that-will-not-fit": { x: 0, y: 0 } },
    });
    const svg = buildGraphDiagram(longNames, { analysisId: "x" });
    const idText = svg.querySelector(".nb-graph-node-id")!.textContent!;
    const kindText = svg.querySelector(".nb-graph-node-kind")!.textContent!;
    expect(idText.endsWith("…")).toBe(true);
    expect(idText.length).toBeLessThan("a-very-long-node-identifier-that-will-not-fit".length);
    expect(kindText.endsWith("…")).toBe(true);
    const tooltip = svg.querySelector("[data-node-id] title")!.textContent!;
    expect(tooltip).toBe("a-very-long-node-identifier-that-will-not-fit (some.very.long.node.kind.name@3)");
  });

  it("scales up to fill the column when the diagram fits, and never renders text below its authored size", () => {
    // Two nodes side by side: narrower than the drawing width, so it should get the "fit" (scale-up) class.
    const svg = buildGraphDiagram(doc(), { analysisId: "nrc-q1" });
    expect(svg.getAttribute("class")).toContain("nb-graph-svg-fit");
    expect(svg.hasAttribute("width")).toBe(false); // width:100% comes from CSS, not an attribute, so it can scale up.
  });

  it("keeps its authored size instead of shrinking when the diagram is wider than the column", () => {
    // Five columns of one node each comfortably exceeds DRAWING_WIDTH_PX.
    const wide = doc({
      structure: {
        nodes: Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, kind: "k", version: 1 })),
        edges: Array.from({ length: 4 }, (_, i) => ({ from: `n${i}.out`, to: `n${i + 1}.in` })),
      },
      layout: {},
    });
    const svg = buildGraphDiagram(wide, { analysisId: "x" });
    expect(svg.getAttribute("class")).toContain("nb-graph-svg-wide");
    const viewBoxWidth = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
    expect(viewBoxWidth).toBeGreaterThan(DRAWING_WIDTH_PX);
    // No CSS scaling in this branch: the rendered width attribute matches the viewBox 1:1.
    expect(Number(svg.getAttribute("width"))).toBe(viewBoxWidth);
  });

  it("stays inside a positive viewBox even for a single node", () => {
    const svg = buildGraphDiagram(
      doc({ structure: { nodes: [{ id: "only", kind: "k", version: 1 }], edges: [] }, layout: { only: { x: 0, y: 0 } } }),
      { analysisId: "a" },
    );
    const viewBox = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(viewBox[2]).toBeGreaterThan(0);
    expect(viewBox[3]).toBeGreaterThan(0);
  });
});

// The regression this guards against (TKT-80): every graph embed's diagram, at the notebook's actual
// drawing width, must render node text at or above a readable minimum. A browser isn't available here,
// so this computes the rendered size from the same rule buildGraphDiagram uses to choose a CSS class:
// a diagram at or under DRAWING_WIDTH_PX gets scaled up by the column ("fit"), one wider than that keeps
// its authored font size and scrolls ("wide"); either way the scale factor is never below 1.
const SAMPLES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../samples/notebooks");
const MIN_ID_TEXT_PX = 11;
const MIN_KIND_TEXT_PX = 9;

function graphDocumentsIn(notebookFile: string): GraphDocument[] {
  const notebook = JSON.parse(readFileSync(join(SAMPLES_DIR, notebookFile), "utf8")) as {
    turns: { reply: { embeds: { kind: string; document?: string }[] } }[];
  };
  const docs: GraphDocument[] = [];
  for (const turn of notebook.turns)
    for (const embed of turn.reply.embeds)
      if (embed.kind === "graph" && embed.document !== undefined) docs.push(parseDocument(embed.document));
  return docs;
}

const notebookFiles = readdirSync(SAMPLES_DIR).filter((f) => f.endsWith(".notebook.json"));

describe("buildGraphDiagram over the committed sample notebooks (TKT-80)", () => {
  it("has at least one notebook with a graph embed to check", () => {
    const total = notebookFiles.flatMap((f) => graphDocumentsIn(f));
    expect(total.length).toBeGreaterThan(0);
  });

  it.each(notebookFiles)("%s: every graph embed renders text at or above the minimum size", (file) => {
    for (const graphDoc of graphDocumentsIn(file)) {
      const svg = buildGraphDiagram(graphDoc, { analysisId: "check" });
      const viewBoxWidth = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
      // Mirrors the CSS: "fit" scales up to the column width, "wide" never scales below 1.
      const scale = viewBoxWidth <= DRAWING_WIDTH_PX ? DRAWING_WIDTH_PX / viewBoxWidth : 1;
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(ID_FONT_SIZE * scale).toBeGreaterThanOrEqual(MIN_ID_TEXT_PX);
      expect(KIND_FONT_SIZE * scale).toBeGreaterThanOrEqual(MIN_KIND_TEXT_PX);
    }
  });

  it("reports the widest sample graph's column count", () => {
    let widestColumns = 0;
    let widestId = "";
    for (const file of notebookFiles)
      for (const graphDoc of graphDocumentsIn(file)) {
        const svg = buildGraphDiagram(graphDoc, { analysisId: "check" });
        const viewBoxWidth = Number(svg.getAttribute("viewBox")!.split(" ")[2]);
        const columns = Math.round((viewBoxWidth - 40) / (168 + 56)) || 1; // PAD*2=40, NODE_W+H_GAP=224
        if (columns > widestColumns) {
          widestColumns = columns;
          widestId = graphDoc.structure.nodes[0]?.id ?? "";
        }
      }
    // Not a hard requirement, just a sanity check that the scan above saw a real multi-column graph.
    expect(widestColumns).toBeGreaterThan(1);
    expect(widestId).not.toBe("");
  });
});
