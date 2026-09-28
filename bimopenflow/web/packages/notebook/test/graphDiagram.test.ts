import { describe, expect, it } from "vitest";
import type { GraphDocument } from "@bimopenflow/state";
import { buildGraphDiagram } from "../src/embeds/graphDiagram";

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

  it("falls back to a layered layout when any node has no saved position", () => {
    const withGap = doc({
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
      // "b" has no saved position: the whole graph should fall back, not just b.
      layout: { a: { x: 999, y: 999 }, c: { x: 999, y: 999 } },
    });
    const svg = buildGraphDiagram(withGap, { analysisId: "x" });
    const boxOf = (id: string) => svg.querySelector(`[data-node-id="${id}"] rect`)!;
    const xOf = (id: string) => Number(boxOf(id).getAttribute("x"));
    // A depth-ordered fallback puts a before b before c on the x axis.
    expect(xOf("a")).toBeLessThan(xOf("b"));
    expect(xOf("b")).toBeLessThan(xOf("c"));
  });

  it("draws a graph with no saved layout at all (every position from the fallback)", () => {
    const noLayout = doc({ layout: {} });
    const svg = buildGraphDiagram(noLayout, { analysisId: "nrc-q1" });
    expect(svg.querySelectorAll(".nb-graph-node").length).toBe(2);
    const sourceX = Number(svg.querySelector('[data-node-id="source"] rect')!.getAttribute("x"));
    const answerX = Number(svg.querySelector('[data-node-id="answer"] rect')!.getAttribute("x"));
    expect(sourceX).toBeLessThan(answerX);
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
