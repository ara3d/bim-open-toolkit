// The contract every embed renderer implements, and the host services it may
// use. A renderer draws its snapshot at once, with no host; refresh() asks the
// host for the current result and says how it compares (live/compare.ts
// does this for any embed with a NodeRef and a snapshot).

import type {
  AnalysisSummary,
  EvalUpdate,
  ModelSummary,
  NodeCatalog,
  NodeDescriptor,
} from "@bimopenflow/contracts";
import type { ResultApi } from "@bimopenflow/app/src/paneContext";
import type { Embed, EmbedKind } from "../document/format";
import type { SelectionBus } from "./selection";

/** The slice of ApiClient the notebook uses; structural, so tests pass fakes. */
export interface NotebookApi extends ResultApi {
  listModels(): Promise<ModelSummary[]>;
  getAnalysis(id: string): Promise<string>;
  putAnalysis(id: string, body: string): Promise<AnalysisSummary>;
  getAnalysisState(id: string): Promise<EvalUpdate>;
  getAnalysisText(id: string, mode?: string): Promise<string>;
  getNodeCatalog(): Promise<NodeCatalog>;
}

/** How an embed's snapshot compares with the host now. */
export type Freshness =
  /** Not compared yet, or the embed has nothing on the host (a picture, a file). */
  | { readonly state: "snapshot" }
  /** The host's result equals the snapshot. */
  | { readonly state: "current" }
  /**
   * The host's result differs. The embed now draws the current result; `was`
   * and `now` describe the two in a few words ("37,196.2", "12 rows"), and
   * the page shows both.
   */
  | { readonly state: "changed"; readonly was: string; readonly now: string }
  /** The host could not answer: offline, analysis missing, node not Ok. */
  | { readonly state: "unavailable"; readonly reason: string };

/** Services shared by every embed on one page. */
export interface EmbedContext {
  readonly api: NotebookApi;
  readonly selection: SelectionBus;
  /** The host's node catalog by kind, fetched once per page and shared by every graph cell;
   *  a cell draws portless nodes until it resolves, and without one at all. */
  readonly catalog?: () => Promise<ReadonlyMap<string, NodeDescriptor>>;
}

/** A mounted embed. */
export interface EmbedHandle {
  /** Compares the snapshot with the host's current result; draws the current one when it differs. */
  refresh(): Promise<Freshness>;
  /** Removes everything the renderer added and releases its resources. Idempotent. */
  destroy(): void;
}

/** Draws one embed into `el`, which the page created for it and owns. */
export type EmbedRenderer<E extends Embed> = (
  el: HTMLElement,
  embed: E,
  ctx: EmbedContext,
) => EmbedHandle;

/** One renderer per embed kind. */
export type EmbedRegistry = {
  readonly [K in EmbedKind]: EmbedRenderer<Extract<Embed, { kind: K }>>;
};
