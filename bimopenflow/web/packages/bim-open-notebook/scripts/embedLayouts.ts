/// <reference types="node" />
// A graph embed stores its own copy of the graph document, taken from the host
// when the notebook was written. The committed graph file is the source of
// truth for where each card sits: when a sample is relaid out
// (bimopenflow/web/packages/graph, npm run relayout-samples), the copies in
// the notebooks go stale and draw overlapping cards. staleLayouts lists the
// drift for samples.test.ts, and syncLayouts copies the file's positions into
// the embeds for scripts/sync-embed-layouts.ts. Layout is outside the graph
// hash, so syncing changes no hash, snapshot, or run record.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ROOT } from "./outline";

type Layout = Record<string, { x: number; y: number }>;

interface GraphDocumentJson {
  layout?: Layout;
  [key: string]: unknown;
}

/** One card whose embedded position differs from its graph file's. */
export interface StaleLayout {
  readonly analysisId: string;
  readonly node: string;
  readonly embedded?: { x: number; y: number };
  readonly source: { x: number; y: number };
}

/** The graph file of each analysis id a sample notebook may embed: samples/nrc-analyses and the
 *  outline's own `graphs`, whose paths are relative to samples/notebooks/outlines. */
export function sampleGraphFiles(notebookName: string): Map<string, string> {
  const analyses = join(ROOT, "samples", "nrc-analyses");
  const outlines = join(ROOT, "samples", "notebooks", "outlines");
  const outline = JSON.parse(readFileSync(join(outlines, `${notebookName}.outline.json`), "utf8")) as { graphs?: string[] };
  const files = [
    ...readdirSync(analyses).filter((f) => f.endsWith(".json")).map((f) => join(analyses, f)),
    ...(outline.graphs ?? []).map((path) => resolve(outlines, path)),
  ];
  return new Map(files.map((file) => [file.split(/[\\/]/).pop()!.replace(/\.json$/, ""), file]));
}

/** Every graph embed in a notebook's JSON text that carries a document. */
function graphEmbeds(notebookText: string): { analysisId: string; document: string }[] {
  const notebook = JSON.parse(notebookText) as { turns: { reply: { embeds: Record<string, unknown>[] } }[] };
  return notebook.turns.flatMap((t) => t.reply.embeds).flatMap((e) =>
    e["kind"] === "graph" && typeof e["document"] === "string"
      ? [{ analysisId: e["analysisId"] as string, document: e["document"] }]
      : []);
}

const layoutOf = (file: string): Layout => (JSON.parse(readFileSync(file, "utf8")) as GraphDocumentJson).layout ?? {};

function staleIn(analysisId: string, embedded: Layout, source: Layout): StaleLayout[] {
  return Object.entries(source).flatMap(([node, at]) => {
    const was = embedded[node];
    return was?.x === at.x && was?.y === at.y ? [] : [{ analysisId, node, embedded: was, source: at }];
  });
}

/** The cards of `notebookText`'s graph embeds that sit elsewhere than in their graph file. */
export function staleLayouts(notebookText: string, graphFiles: ReadonlyMap<string, string>): StaleLayout[] {
  return graphEmbeds(notebookText).flatMap(({ analysisId, document }) => {
    const file = graphFiles.get(analysisId);
    if (file === undefined) return [];
    return staleIn(analysisId, (JSON.parse(document) as GraphDocumentJson).layout ?? {}, layoutOf(file));
  });
}

/** `notebookText` with each graph embed's positions taken from its graph file. Only the embedded
 *  document strings change; the host writes them with two-space indentation, and so does this. */
export function syncLayouts(notebookText: string, graphFiles: ReadonlyMap<string, string>): string {
  let text = notebookText;
  for (const { analysisId, document } of graphEmbeds(notebookText)) {
    const file = graphFiles.get(analysisId);
    if (file === undefined) continue;
    const parsed = JSON.parse(document) as GraphDocumentJson;
    const source = layoutOf(file);
    if (staleIn(analysisId, parsed.layout ?? {}, source).length === 0) continue;
    const layout = { ...parsed.layout, ...source };
    const next = JSON.stringify({ ...parsed, layout }, null, 2);
    text = text.split(JSON.stringify(document)).join(JSON.stringify(next));
  }
  return text;
}
