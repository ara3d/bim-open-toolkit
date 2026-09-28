import { describe, expect, it, vi } from "vitest";
import type { EvalUpdate, NodeDescriptor, TableSlice } from "@bimopenflow/contracts";
import { createViewPane3D, type Pane, type PaneContext, type PaneEvent, type PaneInput, type View3DDeps } from "@bimopenflow/panes";
import type { View3dEmbed } from "../src/document/format";
import type { EmbedContext, NotebookApi } from "../src/embeds/contract";
import { createSelectionBus } from "../src/embeds/selection";
import { createView3dRenderer } from "../src/embeds/view3d";

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// The shape of the category colouring (samples/nrc-analyses/nrc-color-operational-carbon.json with valueColumn Category) as the host holds
// it after seeding: {SAMPLES} replaced by an absolute path.
const colorGraph = JSON.stringify({
  formatVersion: "0.1.0",
  structure: {
    nodes: [
      { id: "model", kind: "view3d.instances", version: 1 },
      { id: "values", kind: "csv.read", version: 1 },
      { id: "answer", kind: "view3d.color", version: 1 },
    ],
    edges: [
      { from: "model.instances", to: "answer.instances" },
      { from: "values.table", to: "answer.values" },
    ],
  },
  values: {
    model: { path: "C:/repo/samples/nrc/duplex-enriched.ifc" },
    values: { path: "C:/repo/samples/nrc/nrc_analytics_elements.csv" },
    answer: { joinColumn: "globalId", valueColumn: "Category", colorMap: "category10" },
  },
});

const descriptor = (kind: string, output: string): NodeDescriptor =>
  ({ kind, version: 1, params: [], inputs: [], outputs: [{ name: output, type: "Table" }] }) as unknown as NodeDescriptor;

const instances: TableSlice = {
  columns: [
    { name: "entityId", type: "Integer" },
    { name: "r", type: "Number" },
    { name: "g", type: "Number" },
    { name: "b", type: "Number" },
  ],
  rows: [[5, 1, 0, 0]],
  totalRows: 1,
  skip: 0,
};

const embed: View3dEmbed = {
  id: "e3d",
  kind: "view3d",
  source: { analysisId: "nrc-color-category", nodeId: "answer", port: "instances" },
  caption: "Duplex by category",
};

const okState = (status = "Ok", error?: string): EvalUpdate => ({
  analysisId: embed.source.analysisId,
  nodes: [{ nodeId: "answer", status, error, warnings: [] }],
} as EvalUpdate);

const fakeApi = (overrides: Partial<NotebookApi> = {}): NotebookApi => ({
  getResult: vi.fn(async () => instances),
  getSuggestions: vi.fn(async () => ({ values: [] }) as never),
  getModelBosUrl: vi.fn((id: string) => `/api/models/${id}/bos`),
  getEntityProperties: vi.fn(async () => ({ localId: 5, parameters: [] })),
  listModels: vi.fn(async () => [
    { id: "duplex-enriched.ifc", name: "duplex", kind: "Ifc", sizeBytes: 1, lastWriteUtc: "", sourcePath: "C:\\repo\\samples\\nrc\\duplex-enriched.ifc" },
  ] as never),
  getAnalysis: vi.fn(async () => colorGraph),
  putAnalysis: vi.fn(async () => ({}) as never),
  getAnalysisState: vi.fn(async () => okState()),
  getAnalysisText: vi.fn(async () => ""),
  getNodeCatalog: vi.fn(async () => ({
    nodes: [descriptor("view3d.instances", "instances"), descriptor("csv.read", "table"), descriptor("view3d.color", "instances")],
  })),
  ...overrides,
});

/** A pane that records its lifecycle and lets the test emit events. */
const recordingPane = () => {
  const log: string[] = [];
  const inputs: PaneInput[] = [];
  const handlers: ((e: PaneEvent) => void)[] = [];
  let ctx: PaneContext | undefined;
  const pane: Pane = {
    mount: (_el, c) => { ctx = c; log.push("mount"); },
    update: (input) => { inputs.push(input); log.push(input.kind); },
    onEvent: (h) => void handlers.push(h),
    destroy: () => void log.push("destroy"),
  };
  return { pane, log, inputs, emit: (e: PaneEvent) => handlers.forEach((h) => h(e)), ctx: () => ctx! };
};

/**
 * Stands in for the browser's IntersectionObserver, which jsdom has none of.
 * Installed on `window` only for the span of one `mount()` call, since the
 * renderer reads `IntersectionObserver` once, synchronously, at construction.
 */
class FakeIntersectionObserver {
  callback: IntersectionObserverCallback = () => {};
  readonly observed: Element[] = [];
  disconnected = false;

  /** The constructor function the renderer sees as `window.IntersectionObserver`. */
  ctor(): typeof IntersectionObserver {
    const self = this;
    return function (this: unknown, callback: IntersectionObserverCallback) {
      self.callback = callback;
      return self; // a constructor returning an object makes `new` use it as `this`
    } as unknown as typeof IntersectionObserver;
  }

  observe(el: Element): void {
    this.observed.push(el);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  fire(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const mount = (
  api: NotebookApi,
  e: View3dEmbed = embed,
  pane = recordingPane(),
  observer?: FakeIntersectionObserver,
) => {
  const el = document.createElement("div");
  const ctx: EmbedContext = { api, selection: createSelectionBus() };
  if (observer) (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = observer.ctor();
  const handle = createView3dRenderer(() => pane.pane)(el, e, ctx);
  if (observer) delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
  const button = () => el.querySelector("button")!;
  return { el, ctx, handle, pane, button };
};

describe("view3d embed", () => {
  it("draws the placeholder text and caption under the pane, hidden once shown", async () => {
    const { el } = mount(fakeApi());
    expect(el.textContent).toContain("answer");
    expect(el.textContent).toContain("nrc-color-category");
    await settle();
  });

  it("draws the still as an image when there is one", () => {
    const { el } = mount(fakeApi(), { ...embed, still: "data:image/png;base64,AA" });
    expect(el.querySelector("img")!.getAttribute("src")).toBe("data:image/png;base64,AA");
  });

  it("mounts the pane by default, with no click needed (no IntersectionObserver in jsdom)", async () => {
    const { pane, button } = mount(fakeApi());
    expect(pane.log).toContain("mount");
    expect(button().textContent).toBe("Hide");
    await settle();
    expect(pane.log).toEqual(["mount", "model", "instances"]);
    expect(pane.inputs[0]).toEqual({ kind: "model", url: "model:duplex-enriched.ifc", format: "bos" });
    expect(pane.inputs[1]).toEqual({ kind: "instances", data: instances });
  });

  it("only mounts once the embed comes near the viewport, when IntersectionObserver exists", async () => {
    const observer = new FakeIntersectionObserver();
    const { pane, button } = mount(fakeApi(), embed, recordingPane(), observer);
    expect(observer.observed).toHaveLength(1);
    expect(pane.log).toEqual([]);
    expect(button().textContent).toBe("Show 3D");
    observer.fire(false);
    expect(pane.log).toEqual([]);
    observer.fire(true);
    await settle();
    expect(pane.log).toEqual(["mount", "model", "instances"]);
    expect(button().textContent).toBe("Hide");
    expect(observer.disconnected).toBe(true);
  });

  it("the Hide/Show toggle still works once auto-mounted", async () => {
    const { pane, button } = mount(fakeApi());
    await settle();
    button().click();
    expect(pane.log.at(-1)).toBe("destroy");
    expect(button().textContent).toBe("Show 3D");
    button().click();
    await settle();
    expect(pane.log.at(-1)).toBe("instances");
    expect(button().textContent).toBe("Hide");
  });

  it("feeds a bounded view3d chain as a view recipe built from the document", async () => {
    const scene = JSON.stringify({
      formatVersion: "0.1.0",
      structure: { nodes: [{ id: "scene", kind: "view3d.scene", version: 1 }], edges: [] },
      values: { scene: { path: "C:/repo/samples/nrc/duplex-enriched.ifc" } },
    });
    const api = fakeApi({
      getAnalysis: vi.fn(async () => scene),
      getNodeCatalog: vi.fn(async () => ({ nodes: [descriptor("view3d.scene", "view")] })),
    });
    const { pane } = mount(api, { ...embed, source: { ...embed.source, nodeId: "scene", port: "view" } });
    await settle();
    expect(pane.log).toEqual(["mount", "model", "view"]);
    expect(api.getResult).not.toHaveBeenCalled();
  });

  it("says why when the node has no result, after loading the model", async () => {
    const { el, pane } = mount(fakeApi({ getAnalysisState: vi.fn(async () => okState("Error", "csv not found")) }));
    await settle();
    expect(pane.log).toEqual(["mount", "model"]);
    expect(el.querySelector("[role=alert]")!.textContent).toContain("csv not found");
  });

  it("Hide and destroy dispose the pane; destroy is idempotent", async () => {
    const { el, handle, pane, button } = mount(fakeApi());
    await settle();
    button().click();
    expect(pane.log.at(-1)).toBe("destroy");
    expect(button().textContent).toBe("Show 3D");
    button().click();
    await settle();
    handle.destroy();
    handle.destroy();
    expect(pane.log.filter((l) => l === "destroy")).toHaveLength(2);
    expect(el.children).toHaveLength(0);
  });

  it("destroy before the embed ever intersects disconnects the observer without mounting", () => {
    const observer = new FakeIntersectionObserver();
    const { handle, pane } = mount(fakeApi(), embed, recordingPane(), observer);
    handle.destroy();
    expect(pane.log).toEqual([]);
    expect(observer.disconnected).toBe(true);
  });

  it("publishes a pick with the embed id as origin and mirrors others' selections", async () => {
    const { ctx, pane } = mount(fakeApi());
    const heard: string[] = [];
    ctx.selection.subscribe((ids, origin) => heard.push(`${origin}:${ids.join(",")}`));
    await settle();
    pane.emit({ kind: "selection", event: { source: "view3d", ids: ["5"] } });
    expect(heard).toEqual(["e3d:5"]);
    ctx.selection.publish(["7"], "table-1");
    expect(pane.inputs.at(-1)).toEqual({ kind: "selection", ids: ["7"] });
    expect(pane.inputs.filter((i) => i.kind === "selection")).toHaveLength(1);
  });

  it("refresh: Ok is current, anything else unavailable, and it never rejects", async () => {
    expect(await mount(fakeApi()).handle.refresh()).toEqual({ state: "current" });
    expect(await mount(fakeApi({ getAnalysisState: vi.fn(async () => okState("Unready")) })).handle.refresh())
      .toEqual({ state: "unavailable", reason: "Unready" });
    expect(await mount(fakeApi({ getAnalysisState: vi.fn(async () => okState("Error", "bad column")) })).handle.refresh())
      .toEqual({ state: "unavailable", reason: "bad column" });
    const offline = fakeApi({ getAnalysisState: vi.fn(async () => { throw new Error('GET x -> 404: {"error":"no such analysis"}'); }) });
    expect(await mount(offline).handle.refresh()).toEqual({ state: "unavailable", reason: "no such analysis" });
  });
});

describe("view3d embed on the real pane (fake viewer rig)", () => {
  it("loads the model through the host's BOS url and asks the host for a picked entity's properties", async () => {
    let pick: (id: number | null) => void = () => {};
    const loads: string[] = [];
    let disposed = 0;
    const deps: View3DDeps = {
      createRig: (_canvas, onPick) => {
        pick = onPick;
        return {
          load: async (url: string) => { loads.push(url); return []; },
          setBoxes: () => {},
          clearBoxes: () => {},
          requestRender: () => {},
          dispose: () => void disposed++,
        };
      },
    };
    const api = fakeApi();
    const el = document.createElement("div");
    const ctx: EmbedContext = { api, selection: createSelectionBus() };
    const heard: string[] = [];
    ctx.selection.subscribe((ids, origin) => heard.push(`${origin}:${ids.join(",")}`));
    const handle = createView3dRenderer(() => createViewPane3D({ deps }))(el, embed, ctx);
    await settle();
    expect(loads).toEqual(["/api/models/duplex-enriched.ifc/bos"]);
    pick(5);
    await settle();
    expect(heard).toEqual(["e3d:5"]);
    expect(api.getEntityProperties).toHaveBeenCalledWith("duplex-enriched.ifc", "5");
    handle.destroy();
    expect(disposed).toBe(1);
  });
});
