// Renders a view3d embed: a still or a placeholder at once, and the editor's
// 3D pane over the node's model when the user asks for it. A page may hold
// many 3D embeds and browsers cap live WebGL contexts at about 16, so no
// WebGL view exists until "Show 3D" and "Hide" disposes it.
//
// Feeding the pane follows the editor's pane area (app/src/paneArea.ts,
// feedModel and feedData): the model first as "model:<id>" in BOS, then the
// node's view recipe when the chain is one buildLiveViewRecipe can read, else
// its complete result table as view, boxes, or instances.

import type { NodeDescriptor, TableSlice } from "@bimopenflow/contracts";
import {
  createViewPane3D,
  ensurePaneStyles,
  isBoxTable,
  type Pane,
  type PaneContext,
} from "@bimopenflow/panes";
import { parseDocument } from "@bimopenflow/state";
import { completeTable } from "@bimopenflow/app/src/completeTable";
import { buildLiveViewRecipe } from "@bimopenflow/app/src/liveViewRecipe";
import { modelCatalog } from "@bimopenflow/app/src/modelCatalog";
import { modelPathFor } from "@bimopenflow/app/src/modelRef";
import { hostMessage } from "@bimopenflow/app/src/paneArea";
import { makePaneContext } from "@bimopenflow/app/src/paneContext";
import type { View3dEmbed } from "../document/format";
import type { EmbedRenderer, Freshness, NotebookApi } from "./contract";

/** Makes the 3D pane; tests pass one built on fake View3DDeps (no WebGL in jsdom). */
export type View3dPaneFactory = () => Pane;

const defaultPane: View3dPaneFactory = () => createViewPane3D({ followGraph: true });

/** One model-path resolver per host client, so many embeds share one model list. */
const resolvers = new WeakMap<NotebookApi, (path: string) => Promise<string | null>>();
const resolverFor = (api: NotebookApi) => {
  let resolve = resolvers.get(api);
  if (!resolve) resolvers.set(api, (resolve = modelCatalog(() => api.listModels())));
  return resolve;
};

/** What the pane gets for one node: the model url and the data to push after it. */
interface Feed {
  readonly modelUrl?: string;
  readonly data: () => Promise<{ kind: "view" | "boxes" | "instances"; data: TableSlice } | undefined>;
}

/** Works out the feed the editor's pane area would use for this node, or throws a sentence. */
async function planFeed(
  embed: View3dEmbed,
  api: NotebookApi,
  paneCtx: PaneContext,
  isCurrent: () => boolean,
): Promise<Feed> {
  const { analysisId, nodeId, port } = embed.source;
  const [text, nodeCatalog] = await Promise.all([api.getAnalysis(analysisId), api.getNodeCatalog()]);
  const document = parseDocument(text);
  const catalog = new Map<string, NodeDescriptor>(nodeCatalog.nodes.map((n) => [n.kind, n]));
  const path = modelPathFor(document, nodeId);
  let modelUrl: string | undefined;
  if (path) {
    const id = await resolverFor(api)(path);
    if (!id) throw new Error(`Model is not in the host catalog: ${path}. Add its directory to ModelRoots.`);
    modelUrl = `model:${id}`;
  }
  // A bounded view3d chain is built here from the document, as the editor
  // previews it; anything else is the node's evaluated result on the host.
  const live = buildLiveViewRecipe(document, nodeId, catalog);
  if (live.kind === "invalid") throw new Error(live.message);
  if (live.kind === "ready") return { modelUrl, data: async () => ({ kind: "view", data: live.data }) };
  return {
    modelUrl,
    data: async () => {
      const state = (await api.getAnalysisState(analysisId)).nodes.find((n) => n.nodeId === nodeId);
      if (state?.status !== "Ok")
        throw new Error(`No result for ${nodeId}: ${state ? state.error ?? state.status : "not in the analysis"}.`);
      const data = await completeTable(paneCtx, nodeId, port, isCurrent);
      if (!data) return undefined;
      const kind = port === "view" ? "view" : port === "boxes" || isBoxTable(data.columns) ? "boxes" : "instances";
      return { kind, data };
    },
  };
}

/** A view3d renderer that makes its pane with `makePane`. */
export function createView3dRenderer(makePane: View3dPaneFactory = defaultPane): EmbedRenderer<View3dEmbed> {
  return (el, embed, ctx) => {
    const doc = el.ownerDocument;
    const { analysisId, nodeId } = embed.source;
    const root = doc.createElement("figure");
    root.className = "bof-nb-view3d";

    const placeholder = doc.createElement("div");
    placeholder.className = "bof-nb-view3d-placeholder";
    if (embed.still) {
      const img = doc.createElement("img");
      img.src = embed.still;
      img.alt = embed.caption ?? `3D view of ${nodeId} in ${analysisId}`;
      placeholder.append(img);
    } else {
      placeholder.textContent = `3D view of node ${nodeId} in analysis ${analysisId}`;
    }
    const viewport = doc.createElement("div");
    viewport.className = "bof-nb-view3d-viewport";
    viewport.style.height = "420px";
    viewport.hidden = true;
    const toggle = doc.createElement("button");
    toggle.type = "button";
    toggle.textContent = "Show 3D";
    const status = doc.createElement("div");
    status.className = "bof-nb-view3d-status";
    status.setAttribute("role", "status");
    root.append(placeholder, viewport, toggle, status);
    if (embed.caption) {
      const caption = doc.createElement("figcaption");
      caption.textContent = embed.caption;
      root.append(caption);
    }
    el.append(root);

    let pane: Pane | null = null;
    let token = 0;
    let destroyed = false;
    let unsubscribe: (() => void) | null = null;

    const say = (message: string, alert = false) => {
      status.textContent = message;
      status.setAttribute("role", alert ? "alert" : "status");
    };

    const hide = () => {
      token++;
      unsubscribe?.();
      unsubscribe = null;
      pane?.destroy();
      pane = null;
      viewport.textContent = "";
      viewport.hidden = true;
      placeholder.hidden = false;
      toggle.textContent = "Show 3D";
      say("");
    };

    const show = async () => {
      const mine = ++token;
      const shown = makePane();
      pane = shown;
      const current = () => mine === token && pane === shown;
      placeholder.hidden = true;
      viewport.hidden = false;
      toggle.textContent = "Hide";
      ensurePaneStyles(doc);
      const paneCtx = makePaneContext(ctx.api, analysisId);
      shown.onEvent((e) => {
        if (e.kind === "selection") ctx.selection.publish(e.event.ids, embed.id);
        else if (e.action === "loadError") say(`3D model load failed: ${e.payload?.message ?? "unknown error"}`, true);
      });
      const host = doc.createElement("div");
      host.style.height = "100%";
      viewport.append(host);
      shown.mount(host, paneCtx);
      unsubscribe = ctx.selection.subscribe((ids, origin) => {
        if (origin !== embed.id) shown.update({ kind: "selection", ids: [...ids] });
      });
      say("Loading…");
      try {
        const feed = await planFeed(embed, ctx.api, paneCtx, current);
        if (!current()) return;
        // The model-bytes endpoint always serves BOS; the id may keep a source
        // extension (.ifc), so the format is given, not inferred.
        if (feed.modelUrl) shown.update({ kind: "model", url: feed.modelUrl, format: "bos" });
        const input = await feed.data();
        if (!current() || !input) return;
        shown.update(input);
        say("");
      } catch (e) {
        if (current()) say(hostMessage(e), true);
      }
    };

    toggle.addEventListener("click", () => {
      if (pane) hide();
      else void show();
    });

    return {
      async refresh(): Promise<Freshness> {
        try {
          const update = await ctx.api.getAnalysisState(analysisId);
          const state = update.nodes.find((n) => n.nodeId === nodeId);
          if (!state) return { state: "unavailable", reason: `Node ${nodeId} is not in analysis ${analysisId}.` };
          if (state.status === "Ok") return { state: "current" };
          return { state: "unavailable", reason: state.error ?? state.status };
        } catch (e) {
          return { state: "unavailable", reason: hostMessage(e) };
        }
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        hide();
        root.remove();
      },
    };
  };
}

export const renderView3d: EmbedRenderer<View3dEmbed> = createView3dRenderer();
