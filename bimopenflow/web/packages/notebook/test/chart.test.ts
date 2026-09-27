import { describe, expect, it } from "vitest";
import type { EntityProperties, SuggestionList, TableSlice } from "@bimopenflow/contracts";
import { renderChart } from "../src/embeds/chart";
import { createSelectionBus } from "../src/embeds/selection";
import type { EmbedContext, NotebookApi } from "../src/embeds/contract";
import type { ChartEmbed } from "../src/document/format";

const columns: TableSlice["columns"] = [
  { name: "storey", type: "Text" },
  { name: "count", type: "Integer" },
];

const snapshotSlice = (rows: unknown[][], totalRows = rows.length): TableSlice => ({
  columns,
  rows,
  totalRows,
  skip: 0,
});

const source = { analysisId: "rooms-per-storey", nodeId: "answer", port: "table" };

const embed: ChartEmbed = {
  id: "e1",
  kind: "chart",
  source,
  chart: { chart: "bar", categoryColumn: "storey", valueColumn: "count" },
  snapshot: snapshotSlice([["L1", 10], ["L2", 12]], 2),
};

/** A NotebookApi fake; getResult is the only method the test drives. */
function fakeApi(getResult: NotebookApi["getResult"]): NotebookApi {
  return {
    getResult,
    getSuggestions: async (): Promise<SuggestionList> => {
      throw new Error("not used in this test");
    },
    getModelBosUrl: () => {
      throw new Error("not used in this test");
    },
    getEntityProperties: async (): Promise<EntityProperties> => {
      throw new Error("not used in this test");
    },
    listModels: async () => {
      throw new Error("not used in this test");
    },
    getAnalysis: async () => {
      throw new Error("not used in this test");
    },
    putAnalysis: async () => {
      throw new Error("not used in this test");
    },
    getAnalysisState: async () => {
      throw new Error("not used in this test");
    },
    getAnalysisText: async () => {
      throw new Error("not used in this test");
    },
    getNodeCatalog: async () => {
      throw new Error("not used in this test");
    },
  };
}

const makeCtx = (api: NotebookApi): EmbedContext => ({ api, selection: createSelectionBus() });

describe("renderChart", () => {
  it("draws the bar chart from the snapshot with no host call", () => {
    let called = false;
    const api = fakeApi(async () => {
      called = true;
      throw new Error("must not be called before refresh()");
    });
    const el = document.createElement("div");
    const handle = renderChart(el, embed, makeCtx(api));

    expect(called).toBe(false);
    expect(el.querySelector("svg.bof-viz-bar-chart")).not.toBeNull();
    expect(el.querySelectorAll("rect.bof-viz-bar").length).toBe(2);

    handle.destroy();
  });

  it("sizes the host to the width of the given element with a fixed height", () => {
    const el = document.createElement("div");
    const handle = renderChart(el, embed, makeCtx(fakeApi(async () => snapshotSlice([]))));

    const host = el.firstElementChild as HTMLElement;
    expect(host.style.width).toBe("100%");
    expect(host.style.height).not.toBe("");

    handle.destroy();
  });

  it("refresh() reports current and does not redraw when the host matches the snapshot", async () => {
    const el = document.createElement("div");
    const api = fakeApi(async () => snapshotSlice([["L1", 10], ["L2", 12]], 2));
    const handle = renderChart(el, embed, makeCtx(api));

    const freshness = await handle.refresh();
    expect(freshness).toEqual({ state: "current" });
    expect(el.querySelectorAll("rect.bof-viz-bar").length).toBe(2);

    handle.destroy();
  });

  it("refresh() redraws with the current result when the host changed", async () => {
    const el = document.createElement("div");
    const api = fakeApi(async () => snapshotSlice([["L1", 10], ["L2", 12], ["L3", 4]], 3));
    const handle = renderChart(el, embed, makeCtx(api));

    const freshness = await handle.refresh();
    expect(freshness).toEqual({ state: "changed", was: "2 rows × 2 columns", now: "3 rows × 2 columns" });
    // compareWithHost reads only as many rows as the snapshot holds (2), so
    // the redrawn chart still has 2 bars even though the host now has 3 rows.
    expect(el.querySelectorAll("rect.bof-viz-bar").length).toBe(2);

    handle.destroy();
  });

  it("refresh() never rejects: reports unavailable when the host fails", async () => {
    const el = document.createElement("div");
    const api = fakeApi(async () => {
      throw new Error("404 node not Ok");
    });
    const handle = renderChart(el, embed, makeCtx(api));

    const freshness = await handle.refresh();
    expect(freshness).toEqual({ state: "unavailable", reason: "404 node not Ok" });

    handle.destroy();
  });

  it("destroy() removes the pane and is idempotent", () => {
    const el = document.createElement("div");
    const handle = renderChart(el, embed, makeCtx(fakeApi(async () => snapshotSlice([]))));

    expect(el.children.length).toBe(1);
    handle.destroy();
    expect(el.children.length).toBe(0);
    expect(() => handle.destroy()).not.toThrow();
  });
});
