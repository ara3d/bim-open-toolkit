// The 3D pane's registration, fed directly the way the editor's pane area
// feeds it: the model first and once per pane, then the node's table.
import { describe, expect, it } from "vitest";
import type { NodeDescriptor, NodeState, TableSlice } from "@bimopenflow/contracts";
import type { PaneFeedIo, ShownNode } from "@bimopenflow/client";
import type { Pane, PaneInput } from "@bimopenflow/panes";
import { view3dPane } from "../src/view3dPane";

const slice: TableSlice = { columns: [{ name: "entityId", type: "Integer" }], rows: [[1], [2]], totalRows: 2, skip: 0 };
const okState = { nodeId: "n1", status: "Ok", warnings: [] } as NodeState;

const descWith = (kind: string, output: string): NodeDescriptor => ({
  kind, version: 1, capability: "Pure", inputs: [], outputs: [{ name: output, type: "Table", optional: false }], params: [], description: "",
});

const recorder = (): { pane: Pane; updates: PaneInput[] } => {
  const updates: PaneInput[] = [];
  return { updates, pane: { mount() {}, update: (i) => { updates.push(i); }, onEvent() {}, destroy() {} } };
};

const io = (resolved: Record<string, string>, port = "instances"): PaneFeedIo => ({
  ctx: { requestTable: async () => slice, resolveAsset: (url) => url },
  port: { name: port, type: "Table", optional: false },
  current: () => true,
  resolveModelId: async (path) => resolved[path] ?? null,
  note: () => {},
});

const shown = (over: Partial<ShownNode> = {}): ShownNode => ({
  nodeId: "n1", desc: descWith("view3d.instances", "instances"), values: {}, state: okState, ...over,
});

describe("view3dPane", () => {
  it("is offered for view3d nodes with a table output, after a verdict", () => {
    expect(view3dPane.offer(descWith("view3d.instances", "instances"))).toBe(2);
    expect(view3dPane.offer(descWith("table.sort", "out"))).toBeUndefined();
  });

  it("pushes the model before the instances table, once per model", async () => {
    const { pane, updates } = recorder();
    const feed = io({ "data/duplex.ifc": "duplex.ifc" });
    await view3dPane.feed(pane, shown({ modelPath: "data/duplex.ifc" }), feed);
    expect(updates).toEqual([
      { kind: "model", url: "model:duplex.ifc", format: "bos" },
      { kind: "instances", data: slice },
    ]);
    // a data refresh re-feeds the table but does not reload the model
    await view3dPane.feed(pane, shown({ modelPath: "data/duplex.ifc" }), feed);
    expect(updates.filter((u) => u.kind === "model")).toHaveLength(1);
  });

  it("throws a sentence naming the fix for a model path the catalog lacks", async () => {
    const { pane, updates } = recorder();
    await expect(view3dPane.feed(pane, shown({ modelPath: "unknown.ifc" }), io({}))).rejects.toThrow(/not in the host catalog/);
    expect(updates).toEqual([]);
  });

  it("feeds a ready live recipe without waiting for the host's result", async () => {
    const { pane, updates } = recorder();
    const live = { kind: "ready" as const, data: slice };
    await view3dPane.feed(pane, shown({ modelPath: "m", live, state: undefined, pending: true }), io({ m: "m" }, "view"));
    expect(updates).toEqual([{ kind: "model", url: "model:m", format: "bos" }, { kind: "view", data: slice }]);
  });

  it("keeps the pane across recipe branches of one model only", () => {
    const recipe = descWith("view3d.section", "view");
    const at = (nodeId: string, modelPath: string) => shown({ nodeId, modelPath, desc: recipe });
    expect(view3dPane.keep!(at("categories", "snowdon"), at("cutaway", "snowdon"))).toBe(true);
    expect(view3dPane.keep!(at("cutaway", "snowdon"), at("other", "duplex"))).toBe(false);
    expect(view3dPane.keep!(shown({ modelPath: "snowdon" }), at("cutaway", "snowdon"))).toBe(false);
  });
});
