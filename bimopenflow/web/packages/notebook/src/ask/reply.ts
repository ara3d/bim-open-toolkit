// Turning what the agent did into a notebook reply: its text and tool calls
// from the event stream, and embeds for the graph it built.

import type { Embed, Reply } from "../document/format";
import type { NotebookApi } from "../embeds/contract";
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
export function embedsForAnalysis(analysisId: string, api: NotebookApi, options?: EmbedOptions): Promise<Embed[]> {
  throw new Error(`not built: embedsForAnalysis(${analysisId}, ${typeof api}, ${options?.maxRows})`);
}

/**
 * A reply from one request's events: the done event's text (or the error),
 * the tool calls, the agent info, the analysisId, and embedsForAnalysis for
 * it when the agent built or changed a graph.
 */
export function replyFromAsk(events: readonly AskEvent[], api: NotebookApi, options?: EmbedOptions): Promise<Reply> {
  throw new Error(`not built: replyFromAsk(${events.length}, ${typeof api}, ${options?.maxRows})`);
}
