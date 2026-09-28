// A static, read-only SVG of a graph document: nodes as boxes titled with
// their id and kind, wires between ports, and the caller's focus nodes
// highlighted. Pure: a GraphDocument in, an SVG element out; no DOM other
// than the element it builds and (once) the stylesheet it injects.
//
// The canvas editor's own auto-layout (packages/app/src/autoLayout.ts) takes
// a full CanvasModel, which only the editor's state layer builds (node
// sizes, params, selection); this module has no editor state, so nodes with
// no saved layout position get a small layered layout of its own (depth by
// longest path from a source node, one column per depth). This is a second
// layout algorithm on purpose (docs/plans/notebook.md, Debt: two layouts;
// unify if the notebook ever needs the editor's richer node sizing).

import { nodeTitle } from "@bimopenflow/app/src/graphPreview";
import type { GraphDocument } from "@bimopenflow/state";

const SVG_NS = "http://www.w3.org/2000/svg";

const NODE_W = 168;
const NODE_H = 46;
const H_GAP = 56;
const V_GAP = 26;
const PAD = 20;
/** Style budget for a 760px notebook column; the SVG scales to fit via viewBox. */
const MAX_HEIGHT_PX = 420;

export interface GraphDiagramOptions {
  readonly analysisId: string;
  readonly focus?: readonly string[];
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

function nodeId(portRef: string): string {
  return portRef.slice(0, portRef.lastIndexOf("."));
}

/**
 * Depth-by-longest-path layout for every node, ignoring any saved layout:
 * depth 0 holds nodes with no incoming edge from another node in the graph,
 * and each later depth is one more than the deepest parent. Nodes at the
 * same depth share a column, stacked top to bottom in id order (stable and
 * readable without extra centering logic).
 */
function fallbackLayout(doc: GraphDocument): Record<string, { x: number; y: number }> {
  const ids = doc.structure.nodes.map((n) => n.id);
  const parents = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const edge of doc.structure.edges) {
    const from = nodeId(edge.from);
    const to = nodeId(edge.to);
    if (parents.has(to) && parents.has(from)) parents.get(to)!.push(from);
  }
  const depth = new Map<string, number>();
  const remaining = new Set(ids);
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => parents.get(id)!.every((p) => depth.has(p)));
    if (ready.length === 0) {
      // A cycle (should not happen in a valid graph document): place what is left at depth 0.
      for (const id of remaining) depth.set(id, 0);
      break;
    }
    for (const id of ready) {
      depth.set(id, Math.max(-1, ...parents.get(id)!.map((p) => depth.get(p)!)) + 1);
      remaining.delete(id);
    }
  }
  const columns = new Map<number, string[]>();
  for (const id of [...ids].sort()) {
    const d = depth.get(id)!;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(id);
  }
  const result: Record<string, { x: number; y: number }> = {};
  for (const [d, column] of columns)
    column.forEach((id, i) => {
      result[id] = { x: d * (NODE_W + H_GAP), y: i * (NODE_H + V_GAP) };
    });
  return result;
}

/**
 * One position and size per node. Uses the document's saved layout only when
 * every node has one; a document with any node missing a position (an
 * incremental edit, or a hand-built fixture) uses the fallback layout for
 * every node instead, so the diagram never mixes two coordinate systems.
 */
function placeNodes(doc: GraphDocument): Map<string, Box> {
  const saved = doc.structure.nodes.every((n) => doc.layout[n.id] !== undefined);
  const positions: Record<string, { x: number; y: number; w?: number; h?: number }> = saved
    ? Object.fromEntries(doc.structure.nodes.map((n) => [n.id, doc.layout[n.id]!]))
    : fallbackLayout(doc);
  const boxes = new Map<string, Box>();
  for (const n of doc.structure.nodes) {
    const p = positions[n.id]!;
    boxes.set(n.id, { x: p.x, y: p.y, w: p.w ?? NODE_W, h: p.h ?? NODE_H });
  }
  return boxes;
}

let instanceCounter = 0;

const STYLE_ID = "nb-graph-diagram-styles";

const diagramCss = `
.nb-graph-svg { display: block; width: 100%; height: auto; max-height: ${MAX_HEIGHT_PX}px; }
.nb-graph-svg text { font-family: var(--nb-font); fill: var(--nb-text); }
.nb-graph-node-box {
  fill: var(--nb-surface); stroke: var(--nb-border); stroke-width: 1.25; rx: 6;
}
.nb-graph-node-focus .nb-graph-node-box { stroke: var(--nb-accent); stroke-width: 2.5; }
.nb-graph-node-id { font-size: 12px; font-weight: 600; }
.nb-graph-node-kind { font-size: 10px; fill: var(--nb-dim); }
.nb-graph-edge { fill: none; stroke: var(--nb-dim); stroke-width: 1.5; }
`;

/** Injects the diagram's stylesheet once per document; safe to call again. */
function ensureDiagramStyles(doc: Document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = diagramCss;
  doc.head.appendChild(style);
}

/** Builds a static SVG of `doc`: node boxes, one path per edge, `options.focus` highlighted. */
export function buildGraphDiagram(doc: GraphDocument, options: GraphDiagramOptions): SVGSVGElement {
  const ownerDocument = globalThis.document;
  ensureDiagramStyles(ownerDocument);

  const boxes = placeNodes(doc);
  const focusSet = new Set(options.focus ?? []);
  const instanceId = `nb-graph-arrow-${++instanceCounter}`;

  const minX = Math.min(0, ...[...boxes.values()].map((b) => b.x));
  const minY = Math.min(0, ...[...boxes.values()].map((b) => b.y));
  const maxX = Math.max(0, ...[...boxes.values()].map((b) => b.x + b.w));
  const maxY = Math.max(0, ...[...boxes.values()].map((b) => b.y + b.h));
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;
  const shift = (v: number, min: number) => v - min + PAD;

  const svg = ownerDocument.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  svg.setAttribute("class", "nb-graph-svg");
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
  svg.setAttribute("role", "img");
  const nodeCount = doc.structure.nodes.length;
  const label = `Graph ${options.analysisId}: ${nodeCount} node${nodeCount === 1 ? "" : "s"}`;
  svg.setAttribute("aria-label", label);

  const title = ownerDocument.createElementNS(SVG_NS, "title");
  title.textContent = label;
  svg.appendChild(title);

  const defs = ownerDocument.createElementNS(SVG_NS, "defs");
  const marker = ownerDocument.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", instanceId);
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrowPath = ownerDocument.createElementNS(SVG_NS, "path");
  arrowPath.setAttribute("d", "M0,0 L8,4 L0,8 z");
  arrowPath.setAttribute("fill", "var(--nb-dim)");
  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const edgeGroup = ownerDocument.createElementNS(SVG_NS, "g");
  edgeGroup.setAttribute("class", "nb-graph-edges");
  for (const edge of doc.structure.edges) {
    const from = boxes.get(nodeId(edge.from));
    const to = boxes.get(nodeId(edge.to));
    if (from === undefined || to === undefined) continue; // an edge to a node outside this document
    const x1 = shift(from.x, minX) + from.w;
    const y1 = shift(from.y, minY) + from.h / 2;
    const x2 = shift(to.x, minX);
    const y2 = shift(to.y, minY) + to.h / 2;
    const midX = (x1 + x2) / 2;
    const path = ownerDocument.createElementNS(SVG_NS, "path");
    path.setAttribute("class", "nb-graph-edge");
    path.setAttribute("d", `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`);
    path.setAttribute("marker-end", `url(#${instanceId})`);
    const edgeTitle = ownerDocument.createElementNS(SVG_NS, "title");
    edgeTitle.textContent = `${edge.from} -> ${edge.to}`;
    path.appendChild(edgeTitle);
    edgeGroup.appendChild(path);
  }
  svg.appendChild(edgeGroup);

  const nodeGroup = ownerDocument.createElementNS(SVG_NS, "g");
  nodeGroup.setAttribute("class", "nb-graph-nodes");
  for (const node of doc.structure.nodes) {
    const box = boxes.get(node.id)!;
    const x = shift(box.x, minX);
    const y = shift(box.y, minY);
    const g = ownerDocument.createElementNS(SVG_NS, "g");
    g.setAttribute("class", focusSet.has(node.id) ? "nb-graph-node nb-graph-node-focus" : "nb-graph-node");
    g.setAttribute("data-node-id", node.id);

    const rect = ownerDocument.createElementNS(SVG_NS, "rect");
    rect.setAttribute("class", "nb-graph-node-box");
    rect.setAttribute("x", String(x));
    rect.setAttribute("y", String(y));
    rect.setAttribute("width", String(box.w));
    rect.setAttribute("height", String(box.h));
    g.appendChild(rect);

    const idText = ownerDocument.createElementNS(SVG_NS, "text");
    idText.setAttribute("class", "nb-graph-node-id");
    idText.setAttribute("x", String(x + 10));
    idText.setAttribute("y", String(y + 18));
    idText.textContent = node.id;
    g.appendChild(idText);

    const kindText = ownerDocument.createElementNS(SVG_NS, "text");
    kindText.setAttribute("class", "nb-graph-node-kind");
    kindText.setAttribute("x", String(x + 10));
    kindText.setAttribute("y", String(y + 34));
    kindText.textContent = nodeTitle(node.kind);
    g.appendChild(kindText);

    const nodeTitleEl = ownerDocument.createElementNS(SVG_NS, "title");
    nodeTitleEl.textContent = `${node.id} (${node.kind}@${node.version})`;
    g.appendChild(nodeTitleEl);

    nodeGroup.appendChild(g);
  }
  svg.appendChild(nodeGroup);

  return svg;
}
