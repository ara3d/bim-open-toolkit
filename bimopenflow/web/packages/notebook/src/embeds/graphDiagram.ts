// A static, read-only SVG of a graph document: nodes as boxes titled with
// their id and kind, wires between ports, and the caller's focus nodes
// highlighted. Pure: a GraphDocument in, an SVG element out; no DOM other
// than the element it builds and (once) the stylesheet it injects.
//
// Every node's position always comes from this module's own compact layered
// layout (depth by longest path from a source node, one column per depth):
// a graph document's saved editor coordinates are meant for a canvas you pan
// and zoom (the S7 sample's saved x reaches about 1,700), not for a fixed
// notebook column, so a diagram built from them renders illegibly small text
// once the whole picture is squeezed to fit. Within a column, nodes are
// ordered by their saved y when the document has one, so the picture still
// reads top-to-bottom the way the author arranged it; a node with no saved
// position sorts after every node that has one, by id.
//
// The rendered size follows one rule: never render a node's text smaller
// than its authored size (TKT-80). A graph that fits the notebook's drawing
// width at its authored size is scaled up to fill the column (nicer to read,
// never smaller); a graph too wide for the column keeps its authored size
// and scrolls horizontally inside the embed body, which already allows it
// (`page/styles.ts`, `.nb-embed-body { overflow-x: auto }`), rather than
// shrinking below legible.

import { nodeTitle } from "@bimopenflow/app/src/graphPreview";
import type { GraphDocument } from "@bimopenflow/state";

const SVG_NS = "http://www.w3.org/2000/svg";

const NODE_W = 168;
const NODE_H = 46;
const H_GAP = 56;
const V_GAP = 26;
const PAD = 20;

/** Font sizes in SVG user units; at the render rule below, both stay at or above their size. */
export const ID_FONT_SIZE = 12;
export const KIND_FONT_SIZE = 10;

/**
 * The notebook column's drawing width (`docs/plans/notebook.md`: the column
 * is 760px with 16px page padding and 10px embed-body padding on each side).
 * A diagram that fits within this at its authored size is scaled up to fill
 * it; a wider one keeps its authored size instead of shrinking below it.
 */
export const DRAWING_WIDTH_PX = 700;

/** Style budget for the notebook column: a diagram taller than this scrolls, it never shrinks to fit. */
const MAX_HEIGHT_PX = 420;

const ID_PADDING_X = 10;
/** Rough average glyph width for the truncation budget below; no real text metrics in this DOM-agnostic module. */
const AVG_CHAR_WIDTH_FACTOR = 0.6;

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

/** The saved layout `y` for `id`, or +Infinity when the document has none (sorts after every node that has one). */
function savedYOf(doc: GraphDocument, id: string): number {
  return doc.layout[id]?.y ?? Number.POSITIVE_INFINITY;
}

/**
 * Depth-by-longest-path layout for every node: depth 0 holds nodes with no
 * incoming edge from another node in the graph, and each later depth is one
 * more than the deepest parent. Nodes at the same depth share a column,
 * ordered top to bottom by saved `y` (falling back to id) so the picture
 * keeps the author's vertical order without inheriting their x, which was
 * laid out for a pannable canvas, not a fixed-width column.
 */
function layeredLayout(doc: GraphDocument): Map<string, { x: number; y: number }> {
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
  const orderedIds = [...ids].sort((a, b) => {
    const ay = savedYOf(doc, a);
    const by = savedYOf(doc, b);
    return ay !== by ? ay - by : a.localeCompare(b);
  });
  const columns = new Map<number, string[]>();
  for (const id of orderedIds) {
    const d = depth.get(id)!;
    if (!columns.has(d)) columns.set(d, []);
    columns.get(d)!.push(id);
  }
  const result = new Map<string, { x: number; y: number }>();
  for (const [d, column] of columns)
    column.forEach((id, i) => {
      result.set(id, { x: d * (NODE_W + H_GAP), y: i * (NODE_H + V_GAP) });
    });
  return result;
}

/** One position and size per node, from the layered layout; every box shares the same size. */
function placeNodes(doc: GraphDocument): Map<string, Box> {
  const positions = layeredLayout(doc);
  const boxes = new Map<string, Box>();
  for (const n of doc.structure.nodes) {
    const p = positions.get(n.id)!;
    boxes.set(n.id, { x: p.x, y: p.y, w: NODE_W, h: NODE_H });
  }
  return boxes;
}

/** Trims `text` to fit `maxWidthPx` at `fontSizePx`, by an average-glyph-width estimate, with an ellipsis. */
function truncate(text: string, maxWidthPx: number, fontSizePx: number): string {
  const maxChars = Math.max(1, Math.floor(maxWidthPx / (fontSizePx * AVG_CHAR_WIDTH_FACTOR)));
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

let instanceCounter = 0;

const STYLE_ID = "nb-graph-diagram-styles";

const diagramCss = `
.nb-graph-svg { display: block; }
.nb-graph-svg-fit { width: 100%; height: auto; max-height: ${MAX_HEIGHT_PX}px; overflow-y: auto; }
.nb-graph-svg-wide { height: auto; max-height: ${MAX_HEIGHT_PX}px; overflow-y: auto; }
.nb-graph-svg text { font-family: var(--nb-font); fill: var(--nb-text); }
.nb-graph-node-box {
  fill: var(--nb-surface); stroke: var(--nb-border); stroke-width: 1.25; rx: 6;
}
.nb-graph-node-focus .nb-graph-node-box { stroke: var(--nb-accent); stroke-width: 2.5; }
.nb-graph-node-id { font-size: ${ID_FONT_SIZE}px; font-weight: 600; }
.nb-graph-node-kind { font-size: ${KIND_FONT_SIZE}px; fill: var(--nb-dim); }
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
  svg.setAttribute("viewBox", `0 0 ${Math.max(1, width)} ${Math.max(1, height)}`);
  // Fits the column at its authored size: scale up to fill it (never below authored). Otherwise: keep the
  // authored size (no CSS width) and let the embed body's horizontal scrollbar carry the rest of the width.
  if (width <= DRAWING_WIDTH_PX) {
    svg.setAttribute("class", "nb-graph-svg nb-graph-svg-fit");
  } else {
    svg.setAttribute("class", "nb-graph-svg nb-graph-svg-wide");
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));
  }
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

  const textMaxWidth = NODE_W - ID_PADDING_X * 2;
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

    const kindTitle = nodeTitle(node.kind);

    const idText = ownerDocument.createElementNS(SVG_NS, "text");
    idText.setAttribute("class", "nb-graph-node-id");
    idText.setAttribute("x", String(x + ID_PADDING_X));
    idText.setAttribute("y", String(y + 18));
    idText.textContent = truncate(node.id, textMaxWidth, ID_FONT_SIZE);
    g.appendChild(idText);

    const kindText = ownerDocument.createElementNS(SVG_NS, "text");
    kindText.setAttribute("class", "nb-graph-node-kind");
    kindText.setAttribute("x", String(x + ID_PADDING_X));
    kindText.setAttribute("y", String(y + 34));
    kindText.textContent = truncate(kindTitle, textMaxWidth, KIND_FONT_SIZE);
    g.appendChild(kindText);

    const nodeTitleEl = ownerDocument.createElementNS(SVG_NS, "title");
    nodeTitleEl.textContent = `${node.id} (${node.kind}@${node.version})`;
    g.appendChild(nodeTitleEl);

    nodeGroup.appendChild(g);
  }
  svg.appendChild(nodeGroup);

  return svg;
}
