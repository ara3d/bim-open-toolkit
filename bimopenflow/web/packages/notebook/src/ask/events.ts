// The /api/ask event stream: its event shape and a reader for it.
// Duplicates the page-local reader in packages/app/src/duckdbDemo.ts; the
// plan (docs/plans/notebook.md, "Debt") says how the two become one.

/** One server-sent event from POST /api/ask (src/studio/BimOpenFlow.Studio/AskHandler.cs). */
export interface AskEvent {
  readonly type: "start" | "tool" | "text" | "check" | "done" | "error";
  readonly analysisId?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly continuing?: boolean;
  readonly name?: string;
  readonly args?: Record<string, unknown> | null;
  readonly ok?: boolean | null;
  readonly summary?: string | null;
  readonly text?: string | null;
  readonly message?: string;
  readonly built?: boolean;
  readonly verified?: boolean;
  readonly problem?: string | null;
  readonly turns?: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

/** Sends one request to the agent and streams its events. */
export interface AskTransport {
  /** Resolves after the last event; rejects when the host refuses the request. */
  ask(
    request: string,
    analysisId: string | undefined,
    onEvent: (event: AskEvent) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}

/** Reads `data: <json>` blocks separated by blank lines until the body ends. */
export function readAskEvents(response: Response, onEvent: (event: AskEvent) => void): Promise<void> {
  throw new Error(`not built: readAskEvents(${response.status}, ${typeof onEvent})`);
}

/** POST /api/ask through `fetchFn` (same origin), body { request, analysisId? }. */
export function createAskTransport(fetchFn: typeof fetch): AskTransport {
  throw new Error(`not built: createAskTransport(${typeof fetchFn})`);
}
