import { describe, expect, it, vi } from "vitest";
import type { AnalysisSummary, EvalUpdate, ModelSummary, NodeCatalog, TableSlice } from "@bimopenflow/contracts";
import { createSelectionBus } from "../src/embeds/selection";
import { renderValue, formatNumber } from "../src/embeds/value";
import { renderTable } from "../src/embeds/table";
import type { NotebookApi, EmbedContext } from "../src/embeds/contract";
import type { TableEmbed, ValueEmbed } from "../src/document/format";

const source = { analysisId: "a1", nodeId: "n1", port: "table" };

const slice = (
  columns: readonly [string, "Number" | "Text"][],
  rows: readonly unknown[][],
  totalRows = rows.length,
): TableSlice => ({
  columns: columns.map(([name, type]) => ({ name, type })),
  rows: [...rows.map((r) => [...r])],
  totalRows,
  skip: 0,
});

function fakeApi(overrides: Partial<NotebookApi> = {}): NotebookApi {
  return {
    getResult: vi.fn(async () => {
      throw new Error("getResult not stubbed");
    }),
    getSuggestions: async () => ({ status: "Ok", values: [] }),
    getModelBosUrl: (id: string) => `model:${id}`,
    getEntityProperties: async () => ({ localId: 0, parameters: [] }),
    listModels: async (): Promise<ModelSummary[]> => [],
    getAnalysis: async () => "{}",
    putAnalysis: async (): Promise<AnalysisSummary> => ({ id: "a1", graphHash: "h" }),
    getAnalysisState: async (): Promise<EvalUpdate> => ({ analysisId: "a1", nodes: [] }),
    getAnalysisText: async () => "",
    getNodeCatalog: async (): Promise<NodeCatalog> => ({ nodes: [] }),
    ...overrides,
  };
}

function makeCtx(api: NotebookApi): EmbedContext {
  return { api, selection: createSelectionBus() };
}

function mountEl(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("renderValue", () => {
  const embed = (overrides: Partial<ValueEmbed> = {}): ValueEmbed => ({
    id: "v1",
    kind: "value",
    source,
    caption: "Total",
    unit: "kgCO2e/yr",
    snapshot: slice([["total", "Number"]], [[37196.2]]),
    ...overrides,
  });

  it("draws at once from the snapshot, with no host call", () => {
    const api = fakeApi();
    const el = mountEl();
    const handle = renderValue(el, embed(), makeCtx(api));
    expect(api.getResult).not.toHaveBeenCalled();
    expect(el.textContent).toContain("Total");
    expect(el.textContent).toContain("37,196.2");
    expect(el.textContent).toContain("kgCO2e/yr");
    handle.destroy();
  });

  it("formats numbers with thousands separators and keeps their precision", () => {
    expect(formatNumber(37196.2)).toBe("37,196.2");
    expect(formatNumber(142)).toBe("142");
    expect(formatNumber(-1234567)).toBe("-1,234,567");
    expect(formatNumber(1000000.125)).toBe("1,000,000.125");
  });

  it("shows Not available for an empty snapshot, not an error", () => {
    const el = mountEl();
    const handle = renderValue(
      el,
      embed({ snapshot: slice([["total", "Number"]], [], 0) }),
      makeCtx(fakeApi()),
    );
    expect(el.textContent).toContain("Not available");
    handle.destroy();
  });

  it("reads embed.column when several columns are present", () => {
    const el = mountEl();
    const handle = renderValue(
      el,
      embed({
        column: "area",
        unit: undefined,
        snapshot: slice(
          [["name", "Text"], ["area", "Number"]],
          [["Room 1", 12.5]],
        ),
      }),
      makeCtx(fakeApi()),
    );
    expect(el.textContent).toContain("12.5");
    expect(el.textContent).not.toContain("Room 1");
    handle.destroy();
  });

  it("refresh reports current, changed (redrawing), and unavailable, and never rejects", async () => {
    const total = slice([["total", "Number"]], [[37196.2]]);
    const currentApi = fakeApi({ getResult: vi.fn(async () => total) });
    const el1 = mountEl();
    const h1 = renderValue(el1, embed({ snapshot: total }), makeCtx(currentApi));
    expect(await h1.refresh()).toEqual({ state: "current" });
    h1.destroy();

    const changedApi = fakeApi({ getResult: vi.fn(async () => slice([["total", "Number"]], [[40000]])) });
    const el2 = mountEl();
    const h2 = renderValue(el2, embed({ snapshot: total }), makeCtx(changedApi));
    const changed = await h2.refresh();
    expect(changed.state).toBe("changed");
    expect(el2.textContent).toContain("40,000");
    h2.destroy();

    const failingApi = fakeApi({
      getResult: vi.fn(async () => {
        throw new Error("offline");
      }),
    });
    const el3 = mountEl();
    const h3 = renderValue(el3, embed({ snapshot: total }), makeCtx(failingApi));
    await expect(h3.refresh()).resolves.toEqual({ state: "unavailable", reason: "offline" });
    h3.destroy();
  });

  it("destroy is idempotent and removes what it added", () => {
    const el = mountEl();
    const handle = renderValue(el, embed(), makeCtx(fakeApi()));
    expect(el.children.length).toBeGreaterThan(0);
    handle.destroy();
    expect(el.children.length).toBe(0);
    expect(() => handle.destroy()).not.toThrow();
  });
});

describe("renderTable", () => {
  const plainSnapshot = () =>
    slice(
      [["name", "Text"], ["area", "Number"]],
      [["Room 1", 10], ["Room 2", 20]],
      2,
    );

  const verdictSnapshot = () =>
    slice(
      [
        ["globalId", "Text"],
        ["verdict", "Text"],
        ["checkId", "Text"],
        ["checkTitle", "Text"],
        ["citation", "Text"],
      ],
      [
        ["g1", "Pass", "NBC-1", "Doors", "9.5.1"],
        ["g2", "Fail", "NBC-1", "Doors", "9.5.1"],
      ],
      2,
    );

  const embed = (overrides: Partial<TableEmbed> = {}): TableEmbed => ({
    id: "t1",
    kind: "table",
    source,
    snapshot: plainSnapshot(),
    ...overrides,
  });

  it("mounts a table pane and shows how many of how many rows", () => {
    const el = mountEl();
    const api = fakeApi();
    const handle = renderTable(el, embed(), makeCtx(api));
    expect(api.getResult).not.toHaveBeenCalled();
    expect(el.querySelectorAll("tbody tr").length).toBe(2);
    expect(el.textContent).toContain("showing 2 of 2 rows");
    handle.destroy();
  });

  it("mounts the verdict pane when columns are checkId and verdict", () => {
    const el = mountEl();
    const handle = renderTable(el, embed({ snapshot: verdictSnapshot() }), makeCtx(fakeApi()));
    expect(el.querySelectorAll(".bof-panes-check").length).toBe(1);
    expect(el.querySelectorAll("tbody tr").length).toBe(0);
    handle.destroy();
  });

  it("Show more fetches the next page through getResult and appends rows", async () => {
    const first = plainSnapshot();
    const partial = { ...first, rows: first.rows.slice(0, 1), totalRows: 3 };
    const nextPage = slice([["name", "Text"], ["area", "Number"]], [["Room 3", 30]], 3);
    const getResult = vi.fn(async () => nextPage);
    const el = mountEl();
    const handle = renderTable(el, embed({ snapshot: partial }), makeCtx(fakeApi({ getResult })));
    expect(el.textContent).toContain("showing 1 of 3 rows");

    const more = el.querySelector("button") as HTMLButtonElement;
    more.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(getResult).toHaveBeenCalledWith(source.analysisId, source.nodeId, source.port, 1, 50);
    expect(el.querySelectorAll("tbody tr").length).toBe(2);
    expect(el.textContent).toContain("showing 2 of 3 rows");
    handle.destroy();
  });

  it("publishes a row click as a selection with the embed id as origin", () => {
    const el = mountEl();
    const ctx = makeCtx(fakeApi());
    const handle = renderTable(el, embed(), ctx);
    (el.querySelectorAll("tbody tr")[0] as HTMLElement).click();
    expect(ctx.selection.current()).toEqual(["Room 1"]);
    handle.destroy();
  });

  it("pushes a selection from another origin into the pane", () => {
    const el = mountEl();
    const ctx = makeCtx(fakeApi());
    const handle = renderTable(el, embed(), ctx);
    ctx.selection.publish(["Room 2"], "graph-embed");
    const rows = el.querySelectorAll("tbody tr");
    expect(rows[1].classList.contains("bof-panes-selected")).toBe(true);
    expect(rows[0].classList.contains("bof-panes-selected")).toBe(false);
    handle.destroy();
  });

  it("refresh redraws on changed and reports unavailable without throwing", async () => {
    const changedApi = fakeApi({
      getResult: vi.fn(async () => slice([["name", "Text"], ["area", "Number"]], [["Room 1", 99]], 2)),
    });
    const el = mountEl();
    const handle = renderTable(el, embed(), makeCtx(changedApi));
    const freshness = await handle.refresh();
    expect(freshness.state).toBe("changed");
    handle.destroy();

    const failingApi = fakeApi({
      getResult: vi.fn(async () => {
        throw new Error("404 analysis missing");
      }),
    });
    const el2 = mountEl();
    const handle2 = renderTable(el2, embed(), makeCtx(failingApi));
    await expect(handle2.refresh()).resolves.toEqual({
      state: "unavailable",
      reason: "404 analysis missing",
    });
    handle2.destroy();
  });

  it("destroy is idempotent and unsubscribes from selection", () => {
    const el = mountEl();
    const ctx = makeCtx(fakeApi());
    const handle = renderTable(el, embed(), ctx);
    handle.destroy();
    expect(el.children.length).toBe(0);
    expect(() => handle.destroy()).not.toThrow();
    // No listener left to throw or act on this publish.
    expect(() => ctx.selection.publish(["x"], "other")).not.toThrow();
  });
});
