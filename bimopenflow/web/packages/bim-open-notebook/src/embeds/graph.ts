// Renders a graph embed as a live, read-only canvas: the graph editor from
// @bimopenflow/graph mounted over a store built from the embed's stored
// document, with the reply's focus nodes selected (which also lights the
// wires that feed them, as in the studio). The host's GraphText print folds
// under "Show text", and "Open in editor" stays a separate link: editing
// happens in the studio, not in a transcript. With no stored document the
// print shows open instead. A refresh keeps the freshness contract by graph
// hash and, when the host answers, pushes the current document and the node
// statuses into the cell.
//
// Each cell has its own store, because a transcript's turns can embed
// different versions of one analysis. The canvas mounts when the cell scrolls
// near the viewport (the same rule as the 3D embed), so a long notebook does
// not start a runtime per graph on load.

import type { NodeDescriptor } from "@bimopenflow/contracts";
import { createGraphEditor, type FitOptions, type GraphEditor, type GraphEditorOptions } from "@bimopenflow/graph";
import { createStore, initialState, parseDocument, type GraphDocument, type Store } from "@bimopenflow/state";
import type { GraphEmbed } from "../document/format";
import type { EmbedContext, EmbedRenderer, Freshness } from "./contract";

/** How a cell mounts its editor; tests pass a fake, since jsdom has no 2D canvas. */
export type GraphEditorMount = (canvas: HTMLCanvasElement, options: GraphEditorOptions) => GraphEditor;

/** Height of the canvas block before its graph is laid out, in CSS pixels. */
export const GRAPH_CELL_HEIGHT = 320;

/** Bounds on the cell's height: a one-node graph still gets a readable box, and a deep graph
 *  stops at about two thirds of a laptop screen rather than pushing the transcript away. */
export const GRAPH_CELL_MIN_HEIGHT = 160;
export const GRAPH_CELL_MAX_HEIGHT = 560;

/** The smallest zoom a cell draws at. Node cards draw their titles at 15 to 17 px and port names
 *  at 13 px; at 0.6 those are 9 to 10 px and about 8 px, the least that stays legible on a 1x
 *  screen. A graph that needs less overflows its cell, centred, and is reached by panning. */
export const GRAPH_MIN_ZOOM = 0.6;

/** How every cell frames its graph. The 24 px margin also clears the description line a card
 *  draws under itself, which lies outside the node's bounds. */
export const GRAPH_FIT: FitOptions = { minZoom: GRAPH_MIN_ZOOM, margin: 24, overflow: "center" };

/** The cell height that shows a graph of `content` world units at the zoom the cell's width allows
 *  (at most 1, at least GRAPH_MIN_ZOOM), within GRAPH_CELL_MIN_HEIGHT and GRAPH_CELL_MAX_HEIGHT. */
export function graphCellHeight(content: { readonly width: number; readonly height: number }, cellWidth: number): number {
  const margin = GRAPH_FIT.margin ?? 0;
  const zoom = Math.max(GRAPH_MIN_ZOOM, Math.min(1, (cellWidth - 2 * margin) / content.width));
  const height = Math.round(content.height * zoom + 2 * margin);
  return Math.min(GRAPH_CELL_MAX_HEIGHT, Math.max(GRAPH_CELL_MIN_HEIGHT, height));
}

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

/** The focus ids that exist in `document`; the reducer rejects a selection of unknown nodes. */
function presentFocus(focus: readonly string[] | undefined, document: GraphDocument): string[] {
  const ids = new Set(document.structure.nodes.map((n) => n.id));
  return (focus ?? []).filter((id) => ids.has(id));
}

/** A graph renderer that mounts its canvas with `mount`. */
export function createGraphRenderer(mount: GraphEditorMount = createGraphEditor): EmbedRenderer<GraphEmbed> {
  return (el, embed, ctx: EmbedContext) => {
    const doc = el.ownerDocument;
    const container = doc.createElement("div");
    container.className = "notebook-embed notebook-embed-graph";

    const header = doc.createElement("div");
    header.className = "notebook-graph-header";
    container.appendChild(header);

    const headerText = doc.createElement("span");
    header.appendChild(headerText);

    const link = doc.createElement("a");
    link.className = "notebook-graph-open";
    link.textContent = "Open in editor";
    link.target = "_blank";
    link.rel = "noopener";
    link.href = editorUrl(embed.analysisId);
    header.appendChild(link);

    const cell = doc.createElement("div");
    cell.className = "notebook-graph-canvas";
    cell.style.height = `${GRAPH_CELL_HEIGHT}px`;
    const canvas = doc.createElement("canvas");
    canvas.className = "notebook-graph-cell";
    canvas.setAttribute("aria-label", `Graph ${embed.analysisId}`);
    cell.appendChild(canvas);
    container.appendChild(cell);

    const textFold = doc.createElement("details");
    textFold.className = "notebook-graph-text-fold";
    const textSummary = doc.createElement("summary");
    textSummary.textContent = "Show text";
    textFold.appendChild(textSummary);
    const pre = doc.createElement("pre");
    pre.className = "notebook-graph-text";
    textFold.appendChild(pre);
    container.appendChild(textFold);

    const status = doc.createElement("div");
    status.className = "notebook-graph-status";
    container.appendChild(status);

    el.appendChild(container);

    let shownText = embed.text ?? "";
    let shownDocument = tryParseDocument(embed.document);
    const catalog = new Map<string, NodeDescriptor>();
    let store: Store | null = null;
    let editor: GraphEditor | null = null;
    let destroyed = false;
    let observer: IntersectionObserver | null = null;
    let resizer: ResizeObserver | null = null;

    // Without a catalog the editor draws portless nodes; it fills in once the
    // page's shared catalog resolves.
    void ctx.catalog?.()
      .then((map) => {
        if (destroyed) return;
        for (const [kind, descriptor] of map) catalog.set(kind, descriptor);
        editor?.refresh();
        fitCell();
      })
      .catch(() => {});

    const drawText = (text: string, focus: readonly string[] | undefined) => {
      const count = nodeIdsOf(text).length;
      headerText.textContent = count > 0 ? `Graph ${embed.analysisId} · ${count} nodes` : `Graph ${embed.analysisId}`;

      pre.textContent = "";
      const focusSet = new Set(focus ?? []);
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (i > 0) pre.appendChild(doc.createTextNode("\n"));
        const id = /^(\S+) = \S+@\d+\(/.exec(line)?.[1];
        if (id !== undefined && focusSet.has(id)) {
          const mark = doc.createElement("mark");
          mark.className = "notebook-graph-focus";
          mark.textContent = line;
          pre.appendChild(mark);
        } else {
          pre.appendChild(doc.createTextNode(line));
        }
      });
    };

    // The cell's height follows the graph's aspect ratio at the zoom its width allows, and the graph
    // is refitted whenever the width changes (column or window resize) or the nodes change size
    // (the catalog adds ports, the host sends a new document). A cell that is hidden or not yet
    // laid out has no width; the resize observer frames it once it does.
    let fittedWidth = 0;
    const fitCell = () => {
      const bounds = editor?.bounds();
      const width = cell.clientWidth;
      if (!editor || !bounds || width <= 0) return;
      fittedWidth = width;
      cell.style.height = `${graphCellHeight(bounds, width)}px`;
      editor.fit(GRAPH_FIT);
    };

    const watchWidth = () => {
      const RO = (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
      if (!RO || resizer) return;
      // Only a width change refits: the height is ours, and setting it must not loop.
      resizer = new RO(() => {
        if (cell.clientWidth !== fittedWidth) fitCell();
      });
      resizer.observe(cell);
    };

    const mountEditor = () => {
      if (editor || destroyed || !shownDocument) return;
      store = createStore({ ...initialState, document: shownDocument, selection: presentFocus(embed.focus, shownDocument) });
      try {
        editor = mount(canvas, {
          store,
          catalog: () => catalog,
          readOnly: true,
          onError: (message) => { status.textContent = message; },
        });
      } catch (e) {
        // No 2D canvas (an unusual browser): the print stands in.
        cell.hidden = true;
        textFold.open = true;
        status.textContent = `Canvas unavailable: ${messageOf(e)}`;
        return;
      }
      fitCell();
      watchWidth();
    };

    const scheduleMount = () => {
      if (editor || observer) return;
      const IO = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
      if (!IO) {
        mountEditor();
        return;
      }
      observer = new IO((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer?.disconnect();
          observer = null;
          mountEditor();
        }
      }, { rootMargin: "800px 0px" });
      observer.observe(cell);
    };

    /** Shows the cell when there is a document to draw, else the print, open. */
    const showCell = () => {
      cell.hidden = shownDocument === undefined;
      textFold.open = shownDocument === undefined;
      if (shownDocument !== undefined) scheduleMount();
    };

    /** Pushes the host's current statuses into the cell; silent when the host cannot say. */
    const applyHostState = async () => {
      if (!store) return;
      try {
        const update = await ctx.api.getAnalysisState(embed.analysisId);
        if (!destroyed && store) store.dispatch({ type: "applyServerState", update });
      } catch {
        // Statuses stay as they were; the freshness result already says what the host answered.
      }
    };

    /** Replaces the cell's document with the host's current one, keeping the focus selected. */
    const replaceDocument = (json: string) => {
      const next = tryParseDocument(json);
      if (next === undefined) return;
      shownDocument = next;
      if (store) {
        store.dispatch({ type: "setDocument", json });
        store.dispatch({ type: "select", ids: presentFocus(embed.focus, next) });
        fitCell();
      } else {
        showCell();
      }
    };

    drawText(shownText, embed.focus);
    showCell();

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
          await applyHostState();
          return { state: "current" };
        }

        const was = graphHashOf(shownText) ?? "graph changed";
        const now = graphHashOf(text) ?? "graph changed";
        shownText = text;
        drawText(text, embed.focus);

        try {
          replaceDocument(await ctx.api.getAnalysis(embed.analysisId));
        } catch {
          // Keep the last canvas; the text above already reports the change.
        }
        await applyHostState();

        status.textContent = `changed: was ${was}, now ${now}`;
        return { state: "changed", was, now };
      },
      destroy(): void {
        destroyed = true;
        observer?.disconnect();
        observer = null;
        resizer?.disconnect();
        resizer = null;
        editor?.dispose();
        editor = null;
        container.remove();
      },
    };
  };
}

export const renderGraph: EmbedRenderer<GraphEmbed> = createGraphRenderer();
