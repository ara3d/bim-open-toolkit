// Draws one turn: the request, the reply text with its tool calls folded, and
// each embed in a frame with its caption and freshness badge.

import type { Turn } from "../document/format";
import type { EmbedContext, EmbedRegistry } from "../embeds/contract";

/** What a turn's controls ask the notebook to do; the notebook decides. */
export interface TurnActions {
  /** The user edited the request text and resent it. */
  resend(turnId: string, text: string): void;
  remove(turnId: string): void;
  /** Resend a stale turn's request with the current context. */
  continueFrom(turnId: string): void;
}

export interface TurnContext {
  readonly embeds: EmbedContext;
  readonly renderers: EmbedRegistry;
  readonly actions: TurnActions;
  /** False while a request is running, or when the host has no /api/ask: edit, resend, and continue are disabled. */
  readonly canAsk: boolean;
}

export interface TurnHandle {
  /** Refreshes every embed of the turn and updates their badges. */
  refresh(): Promise<void>;
  destroy(): void;
}

export function renderTurn(el: HTMLElement, turn: Turn, ctx: TurnContext): TurnHandle {
  throw new Error(`not built: renderTurn(${el.tagName}, ${turn.id}, ${typeof ctx})`);
}
