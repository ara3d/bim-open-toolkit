// Renders a graph embed: the host's GraphText print of the analysis (GraphText.cs,
// docs/graph-text.md), folded under a heading, with a link to open the graph in the
// editor. The canvas editor cannot be mounted twice on a page (docs/plans/notebook.md,
// "Considered and rejected"), so this renders the text print, not the canvas.

import type { GraphEmbed } from "../document/format";
import type { EmbedContext, EmbedRenderer, Freshness } from "./contract";

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

export const renderGraph: EmbedRenderer<GraphEmbed> = (el, embed, ctx: EmbedContext) => {
  const details = document.createElement("details");
  details.className = "notebook-embed notebook-embed-graph";
  details.open = true;

  const summary = document.createElement("summary");
  details.appendChild(summary);

  const pre = document.createElement("pre");
  pre.className = "notebook-graph-text";
  details.appendChild(pre);

  const status = document.createElement("div");
  status.className = "notebook-graph-status";
  details.appendChild(status);

  const link = document.createElement("a");
  link.className = "notebook-graph-open";
  link.textContent = "Open in editor";
  link.target = "_blank";
  link.rel = "noopener";
  details.appendChild(link);

  el.appendChild(details);

  let shownText = embed.text ?? "";

  const draw = (text: string, focus: readonly string[] | undefined) => {
    const count = nodeIdsOf(text).length;
    summary.textContent = count > 0 ? `Graph ${embed.analysisId} · ${count} nodes` : `Graph ${embed.analysisId}`;
    link.href = editorUrl(embed.analysisId);

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

  draw(shownText, embed.focus);

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
      draw(text, embed.focus);
      status.textContent = `changed: was ${was}, now ${now}`;
      return { state: "changed", was, now };
    },
    destroy(): void {
      details.remove();
    },
  };
};
