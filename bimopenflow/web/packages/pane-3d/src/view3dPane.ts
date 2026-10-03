// The 3D pane's registration, for an editor that takes panes
// (@bimopenflow/client paneRegistry): which nodes it suits, how it loads the
// node's model once, and how it feeds the view recipe, boxes, or instances.

import {
  completeTable,
  hasResults,
  modelUrlFor,
  PANE_OFFERS,
  view3dDataKind,
  type PaneFeedIo,
  type PaneRegistration,
  type ShownNode,
} from "@bimopenflow/client";
import { hostMessage } from "@bimopenflow/client/host";
import type { Pane } from "@bimopenflow/panes";
import { buildLiveViewRecipe } from "./liveViewRecipe";
import { createViewPane3D } from "./viewPane3D";

/** The model url each mounted pane has loaded, so a re-feed skips reloading it. */
const loadedModel = new WeakMap<Pane, string>();

/**
 * Loads the shown node's model into the pane once per model: resolves the
 * node's model path to a catalog id and pushes { kind: "model" } before any
 * instance or box data, skipping when the same model is already loaded.
 */
async function feedModel(pane: Pane, shown: ShownNode, io: PaneFeedIo): Promise<void> {
  const path = shown.modelPath;
  if (!path || !io.resolveModelId) return;
  const id = await io.resolveModelId(path);
  if (!io.current()) return;
  const url = modelUrlFor(path, id);
  if (loadedModel.get(pane) === url) return;
  loadedModel.set(pane, url);
  // The model-bytes endpoint always serves BOS; the id in the url may keep
  // a source extension (.ifc), so the format cannot be inferred from it.
  pane.update({ kind: "model", url, format: "bos" });
}

async function feed3d(pane: Pane, shown: ShownNode, io: PaneFeedIo): Promise<void> {
  if (!io.port) return;
  const live = shown.live;
  if (live && live.kind !== "unsupported") {
    if (live.kind === "invalid") return;
    await feedModel(pane, shown, io);
    if (io.current()) pane.update({ kind: "view", data: live.data });
    return;
  }
  if (shown.pending || !hasResults(shown.state)) return;
  await feedModel(pane, shown, io);
  let data;
  try {
    data = await completeTable(io.ctx, shown.nodeId, io.port.name, io.current);
  } catch (e) {
    if (io.current()) io.note(`No rows to show: ${hostMessage(e)}`);
    return;
  }
  // The pane queues an instances slice that arrives before the model
  // finishes loading, so pushing the table right after is safe.
  if (data && io.current()) pane.update({ kind: view3dDataKind(io.port.name, data), data });
}

const hasView = (shown: ShownNode): boolean => shown.desc?.outputs.some((p) => p.name === "view") ?? false;

export const view3dPane: PaneRegistration = {
  kind: "view3d",
  label: "3D",
  offer: PANE_OFFERS.view3d,
  create: () => {
    const pane = createViewPane3D({ followGraph: true });
    pane.onEvent((e) => {
      if (e.kind === "action" && e.action === "loadError") loadedModel.delete(pane);
    });
    return pane;
  },
  fillHeight: true,
  feed: feed3d,
  // Recipe branches share the loaded model and renderer: reapply their
  // complete recipe without reloading the model on every node click.
  keep: (prev, next) => prev.modelPath === next.modelPath && hasView(prev) && hasView(next),
  preview: buildLiveViewRecipe,
};
