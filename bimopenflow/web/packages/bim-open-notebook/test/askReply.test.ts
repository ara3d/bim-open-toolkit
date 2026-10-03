import { describe, expect, it } from "vitest";
import type { EvalUpdate, NodeCatalog, NodeDescriptor, NodeStatus, TableSlice } from "@bimopenflow/contracts";
import type { AskEvent } from "@bimopenflow/client/host";
import { chartEmbedDraft, embedsForAnalysis, graphEmbedDraft, replyFromAsk } from "../src/ask/reply";
import type { NotebookApi } from "../src/embeds/contract";

// Shaped like samples/nrc-analyses/nrc-q1-building-total.json (a value answer)
// and nrc-storey-carbon-chart.json (a chart answer), in one graph.
const document = JSON.stringify({
  formatVersion: "0.1.0",
  structure: {
    nodes: [
      { id: "elements", kind: "rel.csv", version: 1 },
      { id: "total", kind: "rel.aggregate", version: 1 },
      { id: "storeys", kind: "csv.read", version: 1 },
      { id: "chart", kind: "chart.bar", version: 1 },
    ],
    edges: [
      { from: "elements.relation", to: "total.input" },
      { from: "storeys.table", to: "chart.table" },
    ],
  },
  values: {
    elements: { path: "nrc_analytics_elements.csv", source: "nrc" },
    total: { aggregates: "sum(OperationalCarbon_kgCO2e_per_year) as Total", groupBy: "" },
    storeys: { path: "{SAMPLES}/nrc_analytics_storeys.csv" },
    chart: {
      labelColumn: "Container",
      valueColumns: "EmbodiedCarbon_A1A3_kgCO2e,OperationalCarbon_kgCO2e_per_year",
      title: "Carbon per storey (synthetic)",
      sort: "desc",
    },
  },
  layout: {},
});

const port = (name: string, type: "Table" | "Relation") => ({ name, type, optional: false });
const descriptor = (
  kind: string,
  inputs: NodeDescriptor["inputs"],
  outputs: NodeDescriptor["outputs"],
): NodeDescriptor => ({ kind, version: 1, capability: "Pure", inputs, outputs, params: [], description: "" });
const catalog: NodeCatalog = {
  nodes: [
    descriptor("rel.csv", [], [port("relation", "Relation")]),
    descriptor("rel.aggregate", [port("input", "Relation")], [port("relation", "Relation")]),
    descriptor("csv.read", [], [port("table", "Table")]),
    descriptor("chart.bar", [port("table", "Table")], [port("table", "Table"), port("legend", "Table")]),
  ],
};

const totalSlice: TableSlice = {
  columns: [{ name: "Total", type: "Number" }],
  rows: [[37196.2]],
  totalRows: 1,
  skip: 0,
};
const storeySlice: TableSlice = {
  columns: [
    { name: "Container", type: "Text" },
    { name: "EmbodiedCarbon_A1A3_kgCO2e", type: "Number" },
    { name: "OperationalCarbon_kgCO2e_per_year", type: "Number" },
  ],
  rows: [
    ["Level 1", 51234.5, 19876.1],
    ["Level 2", 40111.0, 17320.1],
    ["Roof", 3120.4, 0],
  ],
  totalRows: 3,
  skip: 0,
};

const ANALYSIS = "ask-operational-carbon";
const graphText = `${ANALYSIS}\n  elements = rel.csv(...)\n  total = rel.aggregate(elements)`;

/** A host holding one analysis; `status` overrides a node's state (all Ok otherwise). */
function fakeApi(options: { status?: Record<string, NodeStatus>; total?: TableSlice } = {}) {
  const reads: string[] = [];
  const results: Record<string, TableSlice> = {
    "total.relation": options.total ?? totalSlice,
    "chart.table": storeySlice,
  };
  const unused = () => Promise.reject(new Error("not used here"));
  const api: NotebookApi = {
    getResult: async (analysisId, nodeId, port, skip = 0, take = 200) => {
      reads.push(`${analysisId}/${nodeId}.${port} skip=${skip} take=${take}`);
      const slice = results[`${nodeId}.${port}`];
      if (!slice) throw new Error(`404 ${nodeId}.${port}`);
      return { ...slice, rows: slice.rows.slice(skip, skip + take), skip };
    },
    getSuggestions: unused,
    getModelBosUrl: () => "",
    getEntityProperties: unused,
    listModels: unused,
    getAnalysis: async (id) => (id === ANALYSIS ? document : Promise.reject(new Error(`404 ${id}`))),
    putAnalysis: unused,
    getAnalysisState: async (id): Promise<EvalUpdate> => ({
      analysisId: id,
      graphHash: "sha256:9f2c",
      nodes: ["elements", "total", "storeys", "chart"].map((nodeId) => ({
        nodeId,
        status: options.status?.[nodeId] ?? "Ok",
        warnings: [],
      })),
    }),
    getAnalysisText: async () => graphText,
    getNodeCatalog: async () => catalog,
  };
  return { api, reads };
}

describe("embedsForAnalysis", () => {
  it("gives a value for a one-cell answer, a chart for chart.*, then the graph", async () => {
    const { api, reads } = fakeApi();
    expect(await embedsForAnalysis(ANALYSIS, api)).toEqual([
      {
        id: "e1",
        kind: "value",
        caption: "total (rel.aggregate)",
        source: { analysisId: ANALYSIS, nodeId: "total", port: "relation" },
        snapshot: totalSlice,
      },
      {
        id: "e2",
        kind: "chart",
        caption: "chart (chart.bar)",
        source: { analysisId: ANALYSIS, nodeId: "chart", port: "table" },
        chart: {
          chart: "bar",
          categoryColumn: "Container",
          seriesColumns: ["EmbodiedCarbon_A1A3_kgCO2e", "OperationalCarbon_kgCO2e_per_year"],
          title: "Carbon per storey (synthetic)",
        },
        snapshot: storeySlice,
      },
      {
        id: "e3",
        kind: "graph",
        analysisId: ANALYSIS,
        graphHash: "sha256:9f2c",
        document,
        text: graphText,
        focus: ["total", "chart"],
      },
    ]);
    expect(reads).toEqual([`${ANALYSIS}/total.relation skip=0 take=50`, `${ANALYSIS}/chart.table skip=0 take=50`]);
  });

  it("keeps maxRows rows and the true total", async () => {
    const [, chart] = await embedsForAnalysis(ANALYSIS, fakeApi().api, { maxRows: 2 });
    expect(chart).toMatchObject({ kind: "chart", snapshot: { ...storeySlice, rows: storeySlice.rows.slice(0, 2) } });
  });

  it("gives a table for an answer with more than one column", async () => {
    const total: TableSlice = {
      columns: [...totalSlice.columns, { name: "Elements", type: "Integer" }],
      rows: [[37196.2, 224]],
      totalRows: 1,
      skip: 0,
    };
    const [first] = await embedsForAnalysis(ANALYSIS, fakeApi({ total }).api);
    expect(first).toMatchObject({ id: "e1", kind: "table", snapshot: total });
  });

  it("skips an answer node that is not Ok and leaves it out of the focus", async () => {
    const { api, reads } = fakeApi({ status: { chart: "Error" } });
    const embeds = await embedsForAnalysis(ANALYSIS, api);
    expect(embeds.map((e) => `${e.id}:${e.kind}`)).toEqual(["e1:value", "e2:graph"]);
    expect(embeds[1]).toMatchObject({ focus: ["total"] });
    expect(reads.some((r) => r.includes("chart"))).toBe(false);
  });
});

// graphEmbedDraft and chartEmbedDraft are the pieces of embedsForAnalysis a
// script or another caller can reuse without duplicating the graph or chart
// embed shape (plan, Debt: scripts/write-sample-notebooks.ts uses both).
describe("graphEmbedDraft", () => {
  it("builds the same draft embedsForAnalysis would, given an explicit focus, with only 3 host calls", async () => {
    const { api, reads } = fakeApi();
    const draft = await graphEmbedDraft(ANALYSIS, api, ["total", "chart"]);
    expect(draft).toEqual({
      kind: "graph",
      analysisId: ANALYSIS,
      graphHash: "sha256:9f2c",
      document,
      text: graphText,
      focus: ["total", "chart"],
    });
    expect(reads).toEqual([]); // no getResult, and no getNodeCatalog: unlike embedsForAnalysis
  });

  it("defaults focus to every answer node when none is given", async () => {
    const draft = await graphEmbedDraft(ANALYSIS, fakeApi().api);
    expect(draft.focus).toEqual(["total", "chart"]);
  });
});

describe("chartEmbedDraft", () => {
  it("builds a chart embed from a node's kind and parameter values", () => {
    const source = { analysisId: ANALYSIS, nodeId: "chart", port: "table" };
    const values = { labelColumn: "Container", valueColumns: "EmbodiedCarbon_A1A3_kgCO2e", title: "Carbon" };
    expect(chartEmbedDraft(source, "Carbon chart", "chart.bar", values, storeySlice)).toEqual({
      kind: "chart",
      source,
      caption: "Carbon chart",
      chart: { chart: "bar", categoryColumn: "Container", seriesColumns: ["EmbodiedCarbon_A1A3_kgCO2e"], title: "Carbon" },
      snapshot: storeySlice,
    });
  });
});

const start: AskEvent = {
  type: "start",
  analysisId: ANALYSIS,
  model: "claude-haiku-4-5",
  effort: "medium",
  continuing: false,
};
const tool: AskEvent = {
  type: "tool",
  name: "editGraph",
  args: { id: ANALYSIS },
  ok: true,
  summary: "4 nodes, 2 edges",
  text: null,
};
const failedTool: AskEvent = {
  type: "tool",
  name: "evaluate",
  args: { id: ANALYSIS },
  ok: false,
  summary: "chart: unknown column",
  text: null,
};
const said: AskEvent = { type: "text", text: "Working on the chart." };
const done: AskEvent = {
  type: "done",
  analysisId: ANALYSIS,
  built: true,
  verified: true,
  problem: null,
  text: "The building emits 37,196.2 kgCO2e a year; the chart splits it per storey.",
  turns: 5,
  inputTokens: 11020,
  outputTokens: 402,
  model: "claude-haiku-4-5",
  effort: "medium",
};

describe("replyFromAsk", () => {
  it("builds the reply from a finished run", async () => {
    const reply = await replyFromAsk([start, tool, failedTool, said, done], fakeApi().api);
    expect(reply).toMatchObject({
      text: done.text,
      tools: [
        { name: "editGraph", ok: true, summary: "4 nodes, 2 edges" },
        { name: "evaluate", ok: false, summary: "chart: unknown column" },
      ],
      analysisId: ANALYSIS,
      agent: { model: "claude-haiku-4-5", effort: "medium", turns: 5, inputTokens: 11020, outputTokens: 402 },
    });
    expect(reply.error).toBeUndefined();
    expect(reply.embeds.map((e) => e.kind)).toEqual(["value", "chart", "graph"]);
  });

  it("falls back to the last text event when done has no text", async () => {
    const reply = await replyFromAsk([start, said, { ...done, text: null }], fakeApi().api);
    expect(reply.text).toBe("Working on the chart.");
  });

  it("has no embeds when the agent answered without a graph", async () => {
    const reply = await replyFromAsk([start, { ...done, built: false, verified: false }], fakeApi().api);
    expect(reply).toMatchObject({ text: done.text, embeds: [], analysisId: ANALYSIS });
    expect(reply.error).toBeUndefined();
  });

  it("reports an error event, keeping the start's analysis id and no embeds", async () => {
    const failed: AskEvent = { type: "error", message: "claude exited with code 1" };
    const reply = await replyFromAsk([start, tool, failed], fakeApi().api);
    expect(reply).toMatchObject({
      text: "",
      error: "claude exited with code 1",
      analysisId: ANALYSIS,
      agent: { model: "claude-haiku-4-5", effort: "medium" },
      embeds: [],
    });
    expect(reply.tools).toHaveLength(1);
  });

  it("reports a host check that still fails after the agent is done", async () => {
    const problem = "The answer table has no rows.";
    const reply = await replyFromAsk([start, { ...done, verified: false, problem }], fakeApi().api);
    expect(reply.error).toContain(problem);
    expect(reply.text).toBe(done.text);
    expect(reply.embeds).toEqual([]);
  });

  it("reports a stream that ended before the done event", async () => {
    const reply = await replyFromAsk([start, tool], fakeApi().api);
    expect(reply.error).toMatch(/stopped before it finished/);
  });

  it("keeps the agent's text when the results cannot be read back", async () => {
    const reply = await replyFromAsk([{ ...done, analysisId: "ask-missing" }], fakeApi().api);
    expect(reply.text).toBe(`${done.text}\n\n(The graph's results could not be read: 404 ask-missing)`);
    expect(reply).toMatchObject({ embeds: [], analysisId: "ask-missing" });
    expect(reply.error).toBeUndefined();
  });
});
