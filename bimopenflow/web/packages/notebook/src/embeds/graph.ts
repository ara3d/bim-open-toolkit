// Renders a graph embed: a static SVG diagram of the graph document (drawn by
// graphDiagram.ts, open by default), the host's GraphText print folded under
// it ("Show text"), and a link to open the graph in the editor. The canvas
// editor cannot be mounted twice on a page (docs/plans/notebook.md,
// "Considered and rejected"), so this draws its own read-only diagram rather
// than embedding the canvas.

import { parseDocument, type GraphDocument } from "@bimopenflow/state";
import type { GraphEmbed } from "../document/format";
import type { EmbedContext, EmbedRenderer, Freshness } from "./contract";
import { buildGraphDiagram } from "./graphDiagram";

/** Base URL of the editor page; the tables profile of scripts/start-bim-flow.mjs by default. */
const EDITOR_BASE =
  (import.meta.env.VITE_BOF_EDITOR as string | undefined) ?? "http://127.0.0.1:5310/";

/** The graph hash on the print's second line ("// <analysisId>   graph <hash>"), GraphText.Header. */
function graphHashOf(text: string): string | undefined {
  const header = text.split("\n")[1] ?? "";
  return /graph\s+([0-9a-f]+)/.exec(header)?.[1];
}

/** Node ids the print binds, one unindented "id = kind@version(...);" line per node (Bindings.Line). */
function nodeIdsOf(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^(\S+) = \S+@\d+\(/.exec(line)?.[1])
    .filter((id): id is string => id !== undefined);
}

function editorUrl(analysisId: string): string {
  const base = EDITOR_BASE.endsWith("/") ? EDITOR_BASE : `${EDITOR_BASE}/`;
  return `${base}?analysis=${encodeURIComponent(analysisId)}`;
}

/** True for the api-client's "GET ... -> 404: ..." shape (ApiClient.request). */
function isNotFound(e: unknown): boolean {
  return e instanceof Error && /->\s*404\b/.test(e.message);
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function tryParseDocument(json: string | undefined): GraphDocument | undefined {
  if (json === undefined) return undefined;
  try {
    return parseDocument(json);
  } catch {
    return undefined;
  }
}

export const renderGraph: EmbedRenderer<GraphEmbed> = (el, embed, ctx: EmbedContext) => {
  const container = document.createElement("div");
  container.className = "notebook-embed notebook-embed-graph";

  const header = document.createElement("div");
  header.className = "notebook-graph-header";
  container.appendChild(header);

  const headerText = document.createElement("span");
  header.appendChild(headerText);

  const link = document.createElement("a");
  link.className = "notebook-graph-open";
  link.textContent = "Open in editor";
  link.target = "_blank";
  link.rel = "noopener";
  link.href = editorUrl(embed.analysisId);
  header.appendChild(link);

  const diagramSlot = document.createElement("div");
  diagramSlot.className = "notebook-graph-diagram";
  container.appendChild(diagramSlot);

  const textFold = document.createElement("details");
  textFold.className = "notebook-graph-text-fold";
  const textSummary = document.createElement("summary");
  textSummary.textContent = "Show text";
  textFold.appendChild(textSummary);
  const pre = document.createElement("pre");
  pre.className = "notebook-graph-text";
  textFold.appendChild(pre);
  container.appendChild(textFold);

  const status = document.createElement("div");
  status.className = "notebook-graph-status";
  container.appendChild(status);

  el.appendChild(container);

  let shownText = embed.text ?? "";
  let shownDocument = tryParseDocument(embed.document);

  const drawText = (text: string, focus: readonly string[] | undefined) => {
    const count = nodeIdsOf(text).length;
    headerText.textContent = count > 0 ? `Graph ${embed.analysisId} · ${count} nodes` : `Graph ${embed.analysisId}`;

    pre.textContent = "";
    const focusSet = new Set(focus ?? []);
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (i > 0) pre.appendChild(document.createTextNode("\n"));
      const id = /^(\S+) = \S+@\d+\(/.exec(line)?.[1];
      if (id !== undefined && focusSet.has(id)) {
        const mark = document.createElement("mark");
        mark.className = "notebook-graph-focus";
        mark.textContent = line;
        pre.appendChild(mark);
      } else {
        pre.appendChild(document.createTextNode(line));
      }
    });
  };

  const drawDiagram = (doc: GraphDocument | undefined, focus: readonly string[] | undefined) => {
    diagramSlot.textContent = "";
    if (doc === undefined) {
      // Nothing to draw from: fall back to the text print, shown open.
      textFold.open = true;
      return;
    }
    diagramSlot.appendChild(buildGraphDiagram(doc, { analysisId: embed.analysisId, focus }));
    textFold.open = false;
  };

  drawText(shownText, embed.focus);
  drawDiagram(shownDocument, embed.focus);

  return {
    async refresh(): Promise<Freshness> {
      let text: string;
      try {
        text = await ctx.api.getAnalysisText(embed.analysisId);
      } catch (e) {
        if (isNotFound(e) && embed.document !== undefined) {
          try {
            await ctx.api.putAnalysis(embed.analysisId, embed.document);
            text = await ctx.api.getAnalysisText(embed.analysisId);
          } catch (restoreError) {
            const reason = messageOf(restoreError);
            status.textContent = `unavailable: ${reason}`;
            return { state: "unavailable", reason };
          }
        } else {
          const reason = messageOf(e);
          status.textContent = `unavailable: ${reason}`;
          return { state: "unavailable", reason };
        }
      }

      if (text === shownText) {
        status.textContent = "";
        return { state: "current" };
      }

      const was = graphHashOf(shownText) ?? "graph changed";
      const now = graphHashOf(text) ?? "graph changed";
      shownText = text;
      drawText(text, embed.focus);

      try {
        const json = await ctx.api.getAnalysis(embed.analysisId);
        const doc = tryParseDocument(json);
        if (doc !== undefined) shownDocument = doc;
      } catch {
        // Keep the last diagram; the text above already reports the change.
      }
      drawDiagram(shownDocument, embed.focus);

      status.textContent = `changed: was ${was}, now ${now}`;
      return { state: "changed", was, now };
    },
    destroy(): void {
      container.remove();
    },
  };
};
