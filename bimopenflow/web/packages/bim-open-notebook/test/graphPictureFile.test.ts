import { describe, expect, it, vi } from "vitest";
import { createSelectionBus } from "../src/embeds/selection";
import type { EmbedContext, NotebookApi } from "../src/embeds/contract";
import type { FileEmbed, GraphEmbed, PictureEmbed } from "../src/document/format";
import { renderFile, readableSize } from "../src/embeds/file";
import {
  createGraphRenderer, GRAPH_CELL_MAX_HEIGHT, GRAPH_CELL_MIN_HEIGHT, GRAPH_FIT, GRAPH_MIN_ZOOM, graphCellHeight,
  renderGraph, type GraphEditorMount,
} from "../src/embeds/graph";
import type { GraphEditor, GraphEditorOptions } from "@bimopenflow/graph";
import type { NodeDescriptor } from "@bimopenflow/contracts";
import { renderPicture } from "../src/embeds/picture";
import { notebookCss } from "../src/page/styles";

/** A NotebookApi whose members throw unless overridden, so a test only wires what it uses. */
function fakeApi(overrides: Partial<NotebookApi> = {}): NotebookApi {
  const notBuilt = (name: string) => () => {
    throw new Error(`not wired in this test: ${name}`);
  };
  return {
    getResult: notBuilt("getResult") as unknown as NotebookApi["getResult"],
    getSuggestions: notBuilt("getSuggestions") as unknown as NotebookApi["getSuggestions"],
    getModelBosUrl: notBuilt("getModelBosUrl") as unknown as NotebookApi["getModelBosUrl"],
    getEntityProperties: notBuilt(
      "getEntityProperties",
    ) as unknown as NotebookApi["getEntityProperties"],
    listModels: notBuilt("listModels") as unknown as NotebookApi["listModels"],
    getAnalysis: notBuilt("getAnalysis") as unknown as NotebookApi["getAnalysis"],
    putAnalysis: notBuilt("putAnalysis") as unknown as NotebookApi["putAnalysis"],
    getAnalysisState: notBuilt("getAnalysisState") as unknown as NotebookApi["getAnalysisState"],
    getAnalysisText: notBuilt("getAnalysisText") as unknown as NotebookApi["getAnalysisText"],
    getNodeCatalog: notBuilt("getNodeCatalog") as unknown as NotebookApi["getNodeCatalog"],
    ...overrides,
  };
}

function ctxWith(api: NotebookApi, catalog?: ReadonlyMap<string, NodeDescriptor>): EmbedContext {
  return { api, selection: createSelectionBus(), ...(catalog ? { catalog: async () => catalog } : {}) };
}

/** A mount that records what the cell asked for and returns a spy editor whose graph covers
 *  `bounds`; jsdom has no 2D canvas. */
function fakeMount(bounds = { x: 0, y: 0, width: 400, height: 100 }) {
  const mounts: { canvas: HTMLCanvasElement; options: GraphEditorOptions }[] = [];
  const editor: GraphEditor = {
    refresh: vi.fn(), results: () => ({ counts: new Map(), peek: null }), fit: vi.fn(), focus: vi.fn(),
    bounds: () => bounds, refreshSuggestions: vi.fn(), setTheme: vi.fn(), dispose: vi.fn(),
  };
  const mount: GraphEditorMount = (canvas, options) => { mounts.push({ canvas, options }); return editor; };
  return { mount, mounts, editor, render: createGraphRenderer(mount) };
}

const sourceDescriptor: NodeDescriptor = {
  kind: "ifc.source", version: 1, capability: "Pure", inputs: [],
  outputs: [{ name: "out", type: "Table", optional: false }], params: [], description: "Reads an IFC file.",
};

const GRAPH_TEXT_V1 = [
  "dfg 1;",
  "// nrc-q1   graph a1b2c3d4e5f6",
  'source = ifc.source@1(path: "duplex.ifc");',
  "  // Ok  456598 rows",
  "answer = math.sum@1(in: source.out);",
  "  // Ok  37196.2",
].join("\n");

const GRAPH_TEXT_V2 = [
  "dfg 1;",
  "// nrc-q1   graph 9f8e7d6c5b4a",
  'source = ifc.source@1(path: "duplex.ifc");',
  "  // Ok  456598 rows",
  "answer = math.sum@1(in: source.out);",
  "  // Ok  40000",
].join("\n");

function graphEmbed(overrides: Partial<GraphEmbed> = {}): GraphEmbed {
  return {
    id: "g1",
    kind: "graph",
    analysisId: "nrc-q1",
    text: GRAPH_TEXT_V1,
    focus: ["answer"],
    ...overrides,
  };
}

const GRAPH_DOCUMENT_V1 = JSON.stringify({
  formatVersion: "0.1.0",
  structure: {
    nodes: [
      { id: "source", kind: "ifc.source", version: 1 },
      { id: "answer", kind: "math.sum", version: 1 },
    ],
    edges: [{ from: "source.out", to: "answer.in" }],
  },
  values: {},
  layout: { source: { x: 0, y: 0 }, answer: { x: 200, y: 0 } },
});

/** V1 plus a filter between source and answer: what the host holds after an edit. */
const GRAPH_DOCUMENT_V2 = JSON.stringify({
  formatVersion: "0.1.0",
  structure: {
    nodes: [
      { id: "source", kind: "ifc.source", version: 1 },
      { id: "walls", kind: "table.filter", version: 1 },
      { id: "answer", kind: "math.sum", version: 1 },
    ],
    edges: [{ from: "source.out", to: "walls.in" }, { from: "walls.out", to: "answer.in" }],
  },
  values: {},
  layout: { source: { x: 0, y: 0 }, walls: { x: 200, y: 0 }, answer: { x: 400, y: 0 } },
});

describe("graphCellHeight", () => {
  const margins = 2 * (GRAPH_FIT.margin ?? 0);

  it("gives a wide shallow graph a short cell at the zoom the width allows", () => {
    // 1400 x 150 world units in a 728 px column: zoom (728 - 48) / 1400 = 0.486, floored at 0.6;
    // 150 * 0.6 + 48 = 138 px, raised to the minimum.
    expect(graphCellHeight({ width: 1400, height: 150 }, 728)).toBe(GRAPH_CELL_MIN_HEIGHT);
    // 1000 x 400: zoom 0.68, so 400 * 0.68 + 48 = 320 px.
    expect(graphCellHeight({ width: 1000, height: 400 }, 728)).toBe(320);
  });

  it("caps a deep graph at the maximum height", () => {
    expect(graphCellHeight({ width: 300, height: 2000 }, 728)).toBe(GRAPH_CELL_MAX_HEIGHT);
  });

  it("never zooms a one-node graph past 1 and keeps the minimum height", () => {
    expect(graphCellHeight({ width: 184, height: 94 }, 728)).toBe(GRAPH_CELL_MIN_HEIGHT);
    // A taller single node sits at zoom 1: its own height plus the margins.
    expect(graphCellHeight({ width: 260, height: 240 }, 728)).toBe(240 + margins);
  });

  it("draws no smaller than the zoom floor however narrow the column", () => {
    expect(graphCellHeight({ width: 2000, height: 500 }, 320)).toBe(Math.round(500 * GRAPH_MIN_ZOOM + margins));
  });
});

describe("renderGraph", () => {
  it("draws the header, node count, and Open in editor link", () => {
    const api = fakeApi();
    const el = document.createElement("div");
    renderGraph(el, graphEmbed(), ctxWith(api));

    const header = el.querySelector(".notebook-graph-header")!;
    expect(header.querySelector("span")!.textContent).toBe("Graph nrc-q1 · 2 nodes");
    const link = header.querySelector("a.notebook-graph-open") as HTMLAnchorElement;
    expect(link.textContent).toBe("Open in editor");
    expect(link.href).toBe("http://127.0.0.1:5310/?analysis=nrc-q1");
  });

  it("leaves out the Open in editor link on a hostless page", () => {
    const el = document.createElement("div");
    renderGraph(el, graphEmbed(), { ...ctxWith(fakeApi()), hostless: true });
    expect(el.querySelector(".notebook-graph-header span")!.textContent).toBe("Graph nrc-q1 · 2 nodes");
    expect(el.querySelector("a.notebook-graph-open")).toBeNull();
  });

  it("gives the Open in editor link a left margin, so it never runs into the header text", () => {
    expect(notebookCss).toMatch(/\.notebook-graph-open\s*\{[^}]*margin-left:\s*\d/);
  });

  it("mounts a read-only canvas over the embed's document with the focus selected, and folds the text", async () => {
    const { render, mounts, editor } = fakeMount();
    const el = document.createElement("div");
    const catalog = new Map([["ifc.source", sourceDescriptor]]);
    render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(fakeApi(), catalog));

    expect(mounts).toHaveLength(1);
    const { canvas, options } = mounts[0]!;
    expect(canvas).toBe(el.querySelector("canvas.notebook-graph-cell"));
    expect(options.readOnly).toBe(true);
    expect(options.store.getState().document.structure.nodes.map((n) => n.id)).toEqual(["source", "answer"]);
    expect(options.store.getState().selection).toEqual(["answer"]);
    await Promise.resolve();
    expect(options.catalog().get("ifc.source")).toBe(sourceDescriptor);
    expect(editor.refresh).toHaveBeenCalled();

    const fold = el.querySelector("details.notebook-graph-text-fold") as HTMLDetailsElement;
    expect(fold.open).toBe(false);
    expect(fold.querySelector("summary")!.textContent).toBe("Show text");
    expect(fold.querySelector("pre.notebook-graph-text")!.textContent).toBe(GRAPH_TEXT_V1);
    const mark = fold.querySelector("mark.notebook-graph-focus")!;
    expect(mark.textContent).toBe('answer = math.sum@1(in: source.out);');
  });

  it("sizes the cell to the graph and fits it, and refits when the width changes", () => {
    const observers: { callback: () => void }[] = [];
    vi.stubGlobal("ResizeObserver", class {
      constructor(readonly callback: () => void) { observers.push(this); }
      observe() {}
      disconnect() {}
    });
    let width = 728;
    const widthSpy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
    try {
      const { render, editor } = fakeMount({ x: 0, y: 0, width: 1000, height: 400 });
      const el = document.createElement("div");
      render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(fakeApi()));
      const cell = el.querySelector(".notebook-graph-canvas") as HTMLElement;
      expect(cell.style.height).toBe(`${graphCellHeight({ width: 1000, height: 400 }, 728)}px`);
      expect(editor.fit).toHaveBeenLastCalledWith(GRAPH_FIT);

      // Setting the height re-triggers the observer; the same width must not refit.
      observers[0]!.callback();
      expect(editor.fit).toHaveBeenCalledTimes(1);

      width = 400;
      observers[0]!.callback();
      expect(cell.style.height).toBe(`${graphCellHeight({ width: 1000, height: 400 }, 400)}px`);
      expect(editor.fit).toHaveBeenCalledTimes(2);
    } finally {
      widthSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("selects only the focus nodes the document has", () => {
    const { render, mounts } = fakeMount();
    const el = document.createElement("div");
    render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1, focus: ["answer", "gone"] }), ctxWith(fakeApi()));
    expect(mounts[0]!.options.store.getState().selection).toEqual(["answer"]);
  });

  it("falls back to the text print shown open when there is no document to draw", () => {
    const { render, mounts } = fakeMount();
    const el = document.createElement("div");
    render(el, graphEmbed({ document: undefined }), ctxWith(fakeApi()));

    expect(mounts).toHaveLength(0);
    expect((el.querySelector(".notebook-graph-canvas") as HTMLElement).hidden).toBe(true);
    const fold = el.querySelector("details.notebook-graph-text-fold") as HTMLDetailsElement;
    expect(fold.open).toBe(true);
  });

  it("shows the print, open, when the browser has no 2D canvas", () => {
    const el = document.createElement("div");
    renderGraph(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(fakeApi()));
    const fold = el.querySelector("details.notebook-graph-text-fold") as HTMLDetailsElement;
    expect(fold.open).toBe(true);
    expect(el.querySelector(".notebook-graph-status")!.textContent).toMatch(/^Canvas unavailable/);
  });

  it("a changed graph replaces the cell's document, re-selects the focus, and takes the host's statuses", async () => {
    const { render, mounts } = fakeMount();
    const api = fakeApi({
      getAnalysisText: async () => GRAPH_TEXT_V2,
      getAnalysis: async () => GRAPH_DOCUMENT_V2,
      getAnalysisState: async () => ({ analysisId: "nrc-q1", nodes: [{ nodeId: "answer", status: "Ok", warnings: [] }] }),
    });
    const el = document.createElement("div");
    const handle = render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({ state: "changed", was: "a1b2c3d4e5f6", now: "9f8e7d6c5b4a" });
    const state = mounts[0]!.options.store.getState();
    expect(state.document.structure.nodes.map((n) => n.id)).toEqual(["source", "walls", "answer"]);
    expect(state.selection).toEqual(["answer"]);
    expect(state.evalState["answer"]?.status).toBe("Ok");
  });

  it("a current graph still takes the host's statuses", async () => {
    const { render, mounts } = fakeMount();
    const api = fakeApi({
      getAnalysisText: async () => GRAPH_TEXT_V1,
      getAnalysisState: async () => ({ analysisId: "nrc-q1", nodes: [{ nodeId: "source", status: "Ok", warnings: [] }] }),
    });
    const el = document.createElement("div");
    const handle = render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({ state: "current" });
    expect(mounts[0]!.options.store.getState().evalState["source"]?.status).toBe("Ok");
  });

  it("destroy disposes the editor", () => {
    const { render, editor } = fakeMount();
    const el = document.createElement("div");
    const handle = render(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(fakeApi()));
    handle.destroy();
    expect(editor.dispose).toHaveBeenCalledTimes(1);
    expect(el.children.length).toBe(0);
  });

  it("reports current when the host's text equals the embed's", async () => {
    const api = fakeApi({ getAnalysisText: async () => GRAPH_TEXT_V1 });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed(), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({ state: "current" });
  });

  it("reports changed with was/now hashes and redraws the new text", async () => {
    const api = fakeApi({ getAnalysisText: async () => GRAPH_TEXT_V2 });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed(), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({
      state: "changed",
      was: "a1b2c3d4e5f6",
      now: "9f8e7d6c5b4a",
    });
    expect(el.querySelector("pre.notebook-graph-text")!.textContent).toBe(GRAPH_TEXT_V2);
  });

  it("falls back to 'graph changed' when a hash cannot be read", async () => {
    const api = fakeApi({ getAnalysisText: async () => "dfg 1;\nno header here\n" });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed({ text: "dfg 1;\n// no hash\n" }), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({
      state: "changed",
      was: "graph changed",
      now: "graph changed",
    });
  });

  it("restores a missing analysis from embed.document, once, then reads the text again", async () => {
    let getCalls = 0;
    const putAnalysis = vi.fn(async (_id: string, _body: string) => ({
      id: "nrc-q1",
      graphHash: "9f8e7d6c5b4a",
    }));
    const api = fakeApi({
      getAnalysisText: async () => {
        getCalls++;
        if (getCalls === 1) throw new Error("GET /api/analyses/nrc-q1/text -> 404: no such analysis");
        return GRAPH_TEXT_V2;
      },
      putAnalysis,
    });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed({ document: '{"nodes":[]}' }), ctxWith(api));
    const result = await handle.refresh();
    expect(putAnalysis).toHaveBeenCalledTimes(1);
    expect(putAnalysis).toHaveBeenCalledWith("nrc-q1", '{"nodes":[]}');
    expect(getCalls).toBe(2);
    expect(result).toEqual({ state: "changed", was: "a1b2c3d4e5f6", now: "9f8e7d6c5b4a" });
  });

  it("reports unavailable, never rejecting, on any other failure", async () => {
    const api = fakeApi({
      getAnalysisText: async () => {
        throw new Error("offline");
      },
    });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed(), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({ state: "unavailable", reason: "offline" });
  });

  it("reports unavailable when the restore itself fails", async () => {
    const api = fakeApi({
      getAnalysisText: async () => {
        throw new Error("GET /api/analyses/nrc-q1/text -> 404: no such analysis");
      },
      putAnalysis: async () => {
        throw new Error("PUT rejected: bad document");
      },
    });
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed({ document: "{}" }), ctxWith(api));
    await expect(handle.refresh()).resolves.toEqual({
      state: "unavailable",
      reason: "PUT rejected: bad document",
    });
  });

  it("destroy is idempotent", () => {
    const el = document.createElement("div");
    const handle = renderGraph(el, graphEmbed(), ctxWith(fakeApi()));
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    expect(el.children.length).toBe(0);
  });
});

function pictureEmbed(overrides: Partial<PictureEmbed> = {}): PictureEmbed {
  return {
    id: "p1",
    kind: "picture",
    src: "pictures/plan.png",
    alt: "Level 3 plan",
    caption: "Level 3, coloured by category",
    ...overrides,
  };
}

describe("renderPicture", () => {
  it("draws an image with its caption and enlarges on click", async () => {
    const el = document.createElement("div");
    const handle = renderPicture(el, pictureEmbed(), ctxWith(fakeApi()));

    const img = el.querySelector("img")!;
    expect(img.src).toContain("pictures/plan.png");
    expect(img.alt).toBe("Level 3 plan");
    expect(el.querySelector("figcaption")!.textContent).toBe("Level 3, coloured by category");

    expect(img.classList.contains("notebook-picture-enlarged")).toBe(false);
    img.dispatchEvent(new Event("click", { bubbles: true }));
    expect(img.classList.contains("notebook-picture-enlarged")).toBe(true);
    img.dispatchEvent(new Event("click", { bubbles: true }));
    expect(img.classList.contains("notebook-picture-enlarged")).toBe(false);

    await expect(handle.refresh()).resolves.toEqual({ state: "snapshot" });
  });

  it("destroy is idempotent", () => {
    const el = document.createElement("div");
    const handle = renderPicture(el, pictureEmbed(), ctxWith(fakeApi()));
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    expect(el.children.length).toBe(0);
  });
});

function fileEmbed(overrides: Partial<FileEmbed> = {}): FileEmbed {
  return {
    id: "f1",
    kind: "file",
    path: "artifacts/report.html",
    mediaType: "text/html",
    bytes: 3482,
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    preview: "<html>...",
    ...overrides,
  };
}

describe("renderFile", () => {
  it("shows the name, media type, size, hash prefix, and preview", async () => {
    const el = document.createElement("div");
    const handle = renderFile(el, fileEmbed(), ctxWith(fakeApi()));

    expect(el.querySelector(".notebook-file-name")!.textContent).toBe("report.html");
    const meta = el.querySelector(".notebook-file-meta")!.textContent!;
    expect(meta).toContain("text/html");
    expect(meta).toContain("3.4 KB");
    expect(meta).toContain("9f86d081884c");
    expect(meta).not.toContain("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
    expect(el.querySelector(".notebook-file-preview")!.textContent).toBe("<html>...");

    await expect(handle.refresh()).resolves.toEqual({ state: "snapshot" });
  });

  it("omits the preview element when there is none", () => {
    const el = document.createElement("div");
    renderFile(el, fileEmbed({ preview: undefined }), ctxWith(fakeApi()));
    expect(el.querySelector(".notebook-file-preview")).toBeNull();
  });

  it("formats byte counts as readable units", () => {
    expect(readableSize(512)).toBe("512 B");
    expect(readableSize(3482)).toBe("3.4 KB");
    expect(readableSize(1024 * 1024 * 2)).toBe("2.0 MB");
  });

  it("destroy is idempotent", () => {
    const el = document.createElement("div");
    const handle = renderFile(el, fileEmbed(), ctxWith(fakeApi()));
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
    expect(el.children.length).toBe(0);
  });
});
