import { describe, expect, it, vi } from "vitest";
import { createSelectionBus } from "../src/embeds/selection";
import type { EmbedContext, NotebookApi } from "../src/embeds/contract";
import type { FileEmbed, GraphEmbed, PictureEmbed } from "../src/document/format";
import { renderFile, readableSize } from "../src/embeds/file";
import { renderGraph } from "../src/embeds/graph";
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

function ctxWith(api: NotebookApi): EmbedContext {
  return { api, selection: createSelectionBus() };
}

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

  it("gives the Open in editor link a left margin, so it never runs into the header text", () => {
    expect(notebookCss).toMatch(/\.notebook-graph-open\s*\{[^}]*margin-left:\s*\d/);
  });

  it("draws the diagram open by default and folds the text print under 'Show text'", () => {
    const el = document.createElement("div");
    renderGraph(el, graphEmbed({ document: GRAPH_DOCUMENT_V1 }), ctxWith(fakeApi()));

    expect(el.querySelector(".notebook-graph-diagram svg")).not.toBeNull();
    const fold = el.querySelector("details.notebook-graph-text-fold") as HTMLDetailsElement;
    expect(fold.open).toBe(false);
    expect(fold.querySelector("summary")!.textContent).toBe("Show text");
    expect(fold.querySelector("pre.notebook-graph-text")!.textContent).toBe(GRAPH_TEXT_V1);
    const mark = fold.querySelector("mark.notebook-graph-focus")!;
    expect(mark.textContent).toBe('answer = math.sum@1(in: source.out);');
  });

  it("falls back to the text print shown open when there is no document to draw", () => {
    const el = document.createElement("div");
    renderGraph(el, graphEmbed({ document: undefined }), ctxWith(fakeApi()));

    expect(el.querySelector(".notebook-graph-diagram svg")).toBeNull();
    const fold = el.querySelector("details.notebook-graph-text-fold") as HTMLDetailsElement;
    expect(fold.open).toBe(true);
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
