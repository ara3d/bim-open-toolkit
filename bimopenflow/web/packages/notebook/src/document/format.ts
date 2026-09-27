// The notebook file format: the transcript of one session with the agent, with
// the things it produced embedded where they appeared. A notebook is a record,
// so every embed carries a snapshot of what was shown; an embed backed by a
// node can be re-evaluated against the host and compared with it.

import type { TableSlice } from "@bimopenflow/contracts";
import type { ChartPaneOptions } from "@bimopenflow/panes";

/** The format tag every notebook file starts with; bump on a breaking change. */
export const NOTEBOOK_FORMAT = "bimopen-notebook/0.1" as const;

/** File-name suffix of a saved notebook. */
export const NOTEBOOK_EXTENSION = ".notebook.json";

/** A whole notebook: its turns, oldest first. */
export interface Notebook {
  readonly format: typeof NOTEBOOK_FORMAT;
  readonly title: string;
  readonly createdUtc: string;
  /** What host the embeds expect, for the reader: e.g. { profile: "tables" }. */
  readonly host?: HostHint;
  readonly turns: readonly Turn[];
}

export interface HostHint {
  readonly profile?: string;
  readonly note?: string;
}

/** One request and the agent's reply to it. */
export interface Turn {
  /** Unique within the notebook; never reused after a delete. */
  readonly id: string;
  readonly request: Request;
  readonly reply: Reply;
  /** True when an earlier turn was edited and resent after this reply was made. */
  readonly stale?: boolean;
  /** Replies this turn had before its request was edited and resent, oldest first. */
  readonly earlier?: readonly EarlierReply[];
}

/** What the user asked. */
export interface Request {
  readonly text: string;
  readonly atUtc?: string;
  /** Paths of files the user attached, relative to the notebook. */
  readonly files?: readonly string[];
}

/** A reply that an edit replaced, with the request it answered. */
export interface EarlierReply {
  readonly request: Request;
  readonly reply: Reply;
}

/** What the agent answered. */
export interface Reply {
  /** The agent's final text. */
  readonly text: string;
  /** The tool calls it made, in order; folded under the text. */
  readonly tools: readonly ToolCall[];
  readonly embeds: readonly Embed[];
  /** The analysis the agent built or continued; a follow-up request continues it. */
  readonly analysisId?: string;
  readonly agent?: AgentInfo;
  /** Set when the turn failed; the text then says what happened. */
  readonly error?: string;
}

export interface ToolCall {
  readonly name: string;
  readonly ok: boolean;
  readonly summary: string;
}

export interface AgentInfo {
  readonly model?: string;
  readonly effort?: string;
  readonly turns?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** One output port of one node of one analysis in the host's store. */
export interface NodeRef {
  readonly analysisId: string;
  readonly nodeId: string;
  readonly port: string;
}

/**
 * A result as it was shown: the host's own TableSlice (columns, the first
 * rows, the total count). A scalar is a 1x1 slice, as the host sends it; an
 * empty slice is an honest "not available".
 */
export type TableSnapshot = TableSlice;

interface EmbedBase {
  /** Unique within its reply. */
  readonly id: string;
  readonly caption?: string;
}

/** One number or word, read from the first row of a node's output. */
export interface ValueEmbed extends EmbedBase {
  readonly kind: "value";
  readonly source: NodeRef;
  /** The column to show; the first column when absent. */
  readonly column?: string;
  readonly unit?: string;
  readonly snapshot: TableSnapshot;
}

/** Rows of a node's output. Verdict tables (checkId, verdict) render as verdicts. */
export interface TableEmbed extends EmbedBase {
  readonly kind: "table";
  readonly source: NodeRef;
  readonly snapshot: TableSnapshot;
}

/** A bar or line chart of a node's output, with the chart pane's own options. */
export interface ChartEmbed extends EmbedBase {
  readonly kind: "chart";
  readonly source: NodeRef;
  readonly chart: ChartPaneOptions;
  readonly snapshot: TableSnapshot;
}

/** The graph behind an answer. */
export interface GraphEmbed extends EmbedBase {
  readonly kind: "graph";
  readonly analysisId: string;
  readonly graphHash?: string;
  /** The graph document as the host returned it, so the notebook can restore a missing analysis. */
  readonly document?: string;
  /** The graph as text (GET /api/analyses/{id}/text) when it was shown. */
  readonly text?: string;
  /** Node ids the reply is about, highlighted first. */
  readonly focus?: readonly string[];
}

/** A 3D view of a view3d node's output over its model. */
export interface View3dEmbed extends EmbedBase {
  readonly kind: "view3d";
  readonly source: NodeRef;
  /** A still of the view as shown: a path relative to the notebook, or a data: URL. */
  readonly still?: string;
}

/** A picture the agent made or the user attached. */
export interface PictureEmbed extends EmbedBase {
  readonly kind: "picture";
  /** A path relative to the notebook, or a data: URL. */
  readonly src: string;
  readonly alt: string;
}

/** A file read or written during the turn. The notebook keeps its path and hash, not its bytes. */
export interface FileEmbed extends EmbedBase {
  readonly kind: "file";
  readonly path: string;
  readonly mediaType?: string;
  readonly bytes?: number;
  readonly sha256?: string;
  /** The first lines of a text file, as shown. */
  readonly preview?: string;
}

export type Embed =
  | ValueEmbed
  | TableEmbed
  | ChartEmbed
  | GraphEmbed
  | View3dEmbed
  | PictureEmbed
  | FileEmbed;

export type EmbedKind = Embed["kind"];

/** Every embed kind, in the order a reply lists them when it has several. */
export const EMBED_KINDS: readonly EmbedKind[] = [
  "value",
  "table",
  "chart",
  "view3d",
  "graph",
  "picture",
  "file",
];
