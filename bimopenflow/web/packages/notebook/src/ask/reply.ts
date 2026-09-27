// Turning what the agent did into a notebook reply: its text and tool calls
// from the event stream, and embeds for the graph it built.

import type { NodeDescriptor } from "@bimopenflow/contracts";
import { parseDocument, parsePortRef, type GraphDocument, type GraphNode } from "@bimopenflow/state";
// By path: see the plan's Debt section (deep imports from @bimopenflow/app).
import { chartPaneOptions, choosePanes, firstTableOutput } from "@bimopenflow/app/src/paneChoice";
import type { AgentInfo, Embed, NodeRef, Reply, ToolCall } from "../document/format";
import type { NotebookApi } from "../embeds/contract";
import { SNAPSHOT_ROWS, snapshotOf } from "../live/compare";
import type { AskEvent } from "./events";

export interface EmbedOptions {
  /** Rows each table snapshot keeps; SNAPSHOT_ROWS when absent. */
  readonly maxRows?: number;
}

/**
 * The embeds for an analysis as it stands on the host: one embed per answer
 * node (a node no edge reads from) that evaluated Ok, chosen by its catalog
 * descriptor (chart.* gives a chart, a view3d output a 3D view, a one-row
 * one-column table a value, anything else a table), then one graph embed.
 */
export async function embedsForAnalysis(analysisId: string, api: NotebookApi, options?: EmbedOptions): Promise<Embed[]> {
  const [document, state, catalog, text] = await Promise.all([
    api.getAnalysis(analysisId),
    api.getAnalysisState(analysisId),
    api.getNodeCatalog(),
    api.getAnalysisText(analysisId),
  ]);
  const graph = parseDocument(document);
  const ok = new Set(state.nodes.filter((n) => n.status === "Ok").map((n) => n.nodeId));
  const answers = answerNodes(graph).filter((node) => ok.has(node.id));
  const maxRows = options?.maxRows ?? SNAPSHOT_ROWS;
  const nodeEmbeds = await Promise.all(
    answers.map((node) => embedForNode(analysisId, node, graph, describe(catalog.nodes, node), api, maxRows)),
  );
  const graphEmbed: EmbedDraft = {
    kind: "graph",
    analysisId,
    ...(state.graphHash ? { graphHash: state.graphHash } : {}),
    document,
    text,
    focus: answers.filter((_, i) => nodeEmbeds[i]).map((node) => node.id),
  };
  return [...nodeEmbeds.filter((e) => e !== undefined), graphEmbed].map((e, i) => ({ ...e, id: `e${i + 1}` }) as Embed);
}

/** An embed before it is numbered within its reply. */
type Draft<E> = E extends Embed ? Omit<E, "id"> : never;
type EmbedDraft = Draft<Embed>;

/** Nodes no edge reads from, in document order. */
function answerNodes(graph: GraphDocument): GraphNode[] {
  const read = new Set(graph.structure.edges.map((e) => parsePortRef(e.from).nodeId));
  return graph.structure.nodes.filter((n) => !read.has(n.id));
}

function describe(catalog: readonly NodeDescriptor[], node: GraphNode): NodeDescriptor | undefined {
  return (
    catalog.find((d) => d.kind === node.kind && d.version === node.version) ??
    catalog.find((d) => d.kind === node.kind)
  );
}

/** The embed for one Ok answer node; undefined when it has no output the host can page. */
async function embedForNode(
  analysisId: string,
  node: GraphNode,
  graph: GraphDocument,
  desc: NodeDescriptor | undefined,
  api: NotebookApi,
  maxRows: number,
): Promise<EmbedDraft | undefined> {
  const port = firstTableOutput(desc) ?? desc?.outputs[0];
  if (!port) return undefined;
  const source: NodeRef = { analysisId, nodeId: node.id, port: port.name };
  const caption = `${node.id} (${node.kind})`;
  const panes = choosePanes(desc);
  const read = async () => snapshotOf(await api.getResult(analysisId, node.id, port.name, 0, maxRows), maxRows);
  if (node.kind.startsWith("chart."))
    return {
      kind: "chart",
      source,
      caption,
      chart: chartPaneOptions(node.kind, graph.values[node.id] ?? {}),
      snapshot: await read(),
    };
  if (panes.includes("view3d")) return { kind: "view3d", source, caption };
  const snapshot = await read();
  const scalar = snapshot.totalRows === 1 && snapshot.columns.length === 1;
  return { kind: scalar ? "value" : "table", source, caption, snapshot };
}

/**
 * A reply from one request's events: the done event's text (or the error),
 * the tool calls, the agent info, the analysisId, and embedsForAnalysis for
 * it when the agent built or changed a graph.
 */
export async function replyFromAsk(events: readonly AskEvent[], api: NotebookApi, options?: EmbedOptions): Promise<Reply> {
  const start = events.find((e) => e.type === "start");
  const done = findLast(events, "done");
  const said = done?.text ?? findLast(events, "text")?.text ?? "";
  const error = errorOf(events, done);
  const analysisId = done?.analysisId ?? start?.analysisId;
  const tools: ToolCall[] = events
    .filter((e) => e.type === "tool")
    .map((e) => ({ name: e.name ?? "", ok: e.ok ?? false, summary: e.summary ?? "" }));
  const base = {
    tools,
    ...(analysisId ? { analysisId } : {}),
    ...agentOf(start, done),
  };
  if (error !== undefined)
    return { ...base, text: joinText(said, `Error: ${error}`), embeds: [], error };
  if (!analysisId || !done?.built) return { ...base, text: said, embeds: [] };
  try {
    return { ...base, text: said, embeds: await embedsForAnalysis(analysisId, api, options) };
  } catch (e) {
    // The agent's work stands; only the notebook's read-back failed.
    const reason = e instanceof Error ? e.message : String(e);
    return { ...base, text: joinText(said, `(The graph's results could not be read: ${reason})`), embeds: [] };
  }
}

function findLast(events: readonly AskEvent[], type: AskEvent["type"]): AskEvent | undefined {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === type) return events[i];
  return undefined;
}

/** The error event's message, else the host's check problem, else a stream that never finished. */
function errorOf(events: readonly AskEvent[], done: AskEvent | undefined): string | undefined {
  const failed = findLast(events, "error");
  if (failed) return failed.message ?? "The host reported an error without a message.";
  if (!done) return "The agent stopped before it finished.";
  return done.problem ? `The host's check of the graph failed: ${done.problem}` : undefined;
}

function agentOf(start: AskEvent | undefined, done: AskEvent | undefined): { agent?: AgentInfo } {
  const agent: AgentInfo = {
    ...defined("model", done?.model ?? start?.model),
    ...defined("effort", done?.effort ?? start?.effort),
    ...defined("turns", done?.turns),
    ...defined("inputTokens", done?.inputTokens),
    ...defined("outputTokens", done?.outputTokens),
  };
  return Object.keys(agent).length > 0 ? { agent } : {};
}

function defined<K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };
}

const joinText = (said: string, note: string): string => (said ? `${said}\n\n${note}` : note);
