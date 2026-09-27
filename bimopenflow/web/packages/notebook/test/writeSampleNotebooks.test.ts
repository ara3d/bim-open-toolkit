// Offline tests for the host-calling helpers of scripts/write-sample-notebooks.ts
// that a fake NotebookApi can drive without a running host.

import { describe, expect, it } from "vitest";
import { emptyDocument, serializeDocument, type GraphDocument } from "@bimopenflow/state";
import type { EvalUpdate } from "@bimopenflow/contracts";
import type { NotebookApi } from "../src/embeds/contract";
import { toolCallsFor, waitSettled } from "../scripts/write-sample-notebooks";

/** A NotebookApi whose members throw unless overridden. */
function fakeApi(overrides: Partial<NotebookApi> = {}): NotebookApi {
  const notBuilt = (name: string) => () => {
    throw new Error(`not wired in this test: ${name}`);
  };
  return {
    getResult: notBuilt("getResult") as unknown as NotebookApi["getResult"],
    getSuggestions: notBuilt("getSuggestions") as unknown as NotebookApi["getSuggestions"],
    getModelBosUrl: notBuilt("getModelBosUrl") as unknown as NotebookApi["getModelBosUrl"],
    getEntityProperties: notBuilt("getEntityProperties") as unknown as NotebookApi["getEntityProperties"],
    listModels: notBuilt("listModels") as unknown as NotebookApi["listModels"],
    getAnalysis: notBuilt("getAnalysis") as unknown as NotebookApi["getAnalysis"],
    putAnalysis: notBuilt("putAnalysis") as unknown as NotebookApi["putAnalysis"],
    getAnalysisState: notBuilt("getAnalysisState") as unknown as NotebookApi["getAnalysisState"],
    getAnalysisText: notBuilt("getAnalysisText") as unknown as NotebookApi["getAnalysisText"],
    getNodeCatalog: notBuilt("getNodeCatalog") as unknown as NotebookApi["getNodeCatalog"],
    ...overrides,
  };
}

function docWith(...nodeIds: string[]): GraphDocument {
  return { ...emptyDocument, structure: { nodes: nodeIds.map((id) => ({ id, kind: "x", version: 1 })), edges: [] } };
}

function stateWith(graphHash: string, nodes: EvalUpdate["nodes"]): EvalUpdate {
  return { analysisId: "a", graphHash, nodes };
}

describe("waitSettled", () => {
  it("returns once every node reports and the graph hash matches", async () => {
    const api = fakeApi({
      getAnalysisState: async () => stateWith("h1", [{ nodeId: "n1", status: "Ok", warnings: [] }]),
    });
    await expect(waitSettled(api, "a", docWith("n1"), "h1")).resolves.toBeUndefined();
  });

  it("allows a node left EffectPending: nothing writes until Run", async () => {
    const api = fakeApi({
      getAnalysisState: async () =>
        stateWith("h1", [
          { nodeId: "n1", status: "Ok", warnings: [] },
          { nodeId: "n2", status: "EffectPending", warnings: [] },
        ]),
    });
    await expect(waitSettled(api, "a", docWith("n1", "n2"), "h1")).resolves.toBeUndefined();
  });

  it("throws naming a node left in Error, with its error text", async () => {
    const api = fakeApi({
      getAnalysisState: async () =>
        stateWith("h1", [{ nodeId: "n1", status: "Error", error: "bad path", warnings: [] }]),
    });
    await expect(waitSettled(api, "a", docWith("n1"), "h1")).rejects.toThrow(/n1 \(Error: bad path\)/);
  });

  it("throws naming a node left Unavailable", async () => {
    const api = fakeApi({
      getAnalysisState: async () => stateWith("h1", [{ nodeId: "n1", status: "Unavailable", warnings: [] }]),
    });
    await expect(waitSettled(api, "a", docWith("n1"), "h1")).rejects.toThrow(/n1 \(Unavailable\)/);
  });
});

describe("toolCallsFor", () => {
  it("counts an EffectPending node as ok, naming it in the evaluate summary", async () => {
    const api = fakeApi({
      getAnalysis: async () => serializeDocument(docWith("answer", "sink")),
      getAnalysisState: async () =>
        stateWith("h1", [
          { nodeId: "answer", status: "Ok", warnings: [] },
          { nodeId: "sink", status: "EffectPending", warnings: [] },
        ]),
    });
    const calls = await toolCallsFor([], ["nb-x"], api);
    const evaluate = calls.find((c) => c.name === "evaluate")!;
    expect(evaluate.ok).toBe(true);
    expect(evaluate.summary).toBe("1 of 2 nodes Ok, 1 node EffectPending (sink)");
  });

  it("marks evaluate not ok when a node is left in Error, distinct from EffectPending", async () => {
    const api = fakeApi({
      getAnalysis: async () => serializeDocument(docWith("answer")),
      getAnalysisState: async () => stateWith("h1", [{ nodeId: "answer", status: "Error", warnings: [] }]),
    });
    const calls = await toolCallsFor([], ["nb-x"], api);
    const evaluate = calls.find((c) => c.name === "evaluate")!;
    expect(evaluate.ok).toBe(false);
    expect(evaluate.summary).toBe("0 of 1 nodes Ok");
  });
});
