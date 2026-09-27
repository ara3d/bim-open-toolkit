// Draws one turn: the request, the reply text with its tool calls folded, and
// each embed in a frame with its caption and freshness badge.

import type { Embed, Reply, Turn } from "../document/format";
import type { EmbedContext, EmbedRegistry, Freshness } from "../embeds/contract";
import { renderEmbed } from "../embeds/registry";
import { ensureNotebookStyles } from "./styles";

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

/** Splits reply text into paragraphs on blank lines; no markdown is parsed. */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function agentSummary(reply: Reply): string | undefined {
  const info = reply.agent;
  if (!info) return undefined;
  const parts: string[] = [];
  if (info.model) parts.push(info.model);
  if (info.effort) parts.push(info.effort);
  if (info.turns !== undefined) parts.push(`${info.turns} turn${info.turns === 1 ? "" : "s"}`);
  if (info.inputTokens !== undefined || info.outputTokens !== undefined) {
    parts.push(`${info.inputTokens ?? 0} in / ${info.outputTokens ?? 0} out tokens`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function badgeText(freshness: Freshness): string {
  switch (freshness.state) {
    case "snapshot":
      return "as recorded";
    case "current":
      return "current";
    case "changed":
      return `${freshness.was} → ${freshness.now}`;
    case "unavailable":
      return "unavailable";
  }
}

function applyBadge(badge: HTMLElement, freshness: Freshness): void {
  badge.className = `nb-badge nb-badge-${freshness.state}`;
  badge.textContent = badgeText(freshness);
  if (freshness.state === "unavailable") {
    badge.title = freshness.reason;
  } else {
    badge.removeAttribute("title");
  }
}

interface EmbedFrame {
  readonly badge: HTMLElement;
  readonly handle: ReturnType<typeof renderEmbed>;
}

export function renderTurn(el: HTMLElement, turn: Turn, ctx: TurnContext): TurnHandle {
  const doc = el.ownerDocument ?? document;
  ensureNotebookStyles(doc);

  const root = doc.createElement("article");
  root.className = "nb-turn";
  root.dataset.turnId = turn.id;

  const requestSection = renderRequest(doc, turn, ctx);
  root.appendChild(requestSection);

  const replySection = doc.createElement("div");
  replySection.className = "nb-reply";
  root.appendChild(replySection);

  if (turn.reply.error) {
    const error = doc.createElement("div");
    error.className = "nb-error";
    error.textContent = turn.reply.error;
    replySection.appendChild(error);
  }

  for (const paragraph of splitParagraphs(turn.reply.text)) {
    const p = doc.createElement("p");
    p.textContent = paragraph;
    replySection.appendChild(p);
  }

  if (turn.reply.tools.length > 0) {
    const details = doc.createElement("details");
    details.className = "nb-tools";
    const summary = doc.createElement("summary");
    summary.textContent = `${turn.reply.tools.length} tool call${turn.reply.tools.length === 1 ? "" : "s"}`;
    details.appendChild(summary);
    const list = doc.createElement("ul");
    for (const tool of turn.reply.tools) {
      const item = doc.createElement("li");
      item.className = tool.ok ? "nb-tool-ok" : "nb-tool-failed";
      const mark = doc.createElement("span");
      mark.className = "nb-tool-mark";
      mark.textContent = tool.ok ? "✓" : "✗";
      item.appendChild(mark);
      item.appendChild(doc.createTextNode(`${tool.name}: ${tool.summary}`));
      list.appendChild(item);
    }
    details.appendChild(list);
    replySection.appendChild(details);
  }

  const embedFrames: EmbedFrame[] = [];
  for (const embed of turn.reply.embeds) {
    const frame = renderEmbedFrame(doc, embed, ctx);
    replySection.appendChild(frame.el);
    embedFrames.push({ badge: frame.badge, handle: frame.handle });
  }

  const agentLine = agentSummary(turn.reply);
  if (agentLine) {
    const info = doc.createElement("div");
    info.className = "nb-agent-info";
    info.textContent = agentLine;
    replySection.appendChild(info);
  }

  if (turn.stale) {
    root.appendChild(renderStaleNote(doc, turn, ctx));
  }

  if (turn.earlier && turn.earlier.length > 0) {
    root.appendChild(renderEarlier(doc, turn));
  }

  el.appendChild(root);

  let destroyed = false;
  return {
    async refresh(): Promise<void> {
      await Promise.all(
        embedFrames.map(async ({ badge, handle }) => {
          const freshness = await handle.refresh();
          applyBadge(badge, freshness);
        }),
      );
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      for (const { handle } of embedFrames) handle.destroy();
      root.remove();
    },
  };
}

function renderRequest(doc: Document, turn: Turn, ctx: TurnContext): HTMLElement {
  const section = doc.createElement("div");
  section.className = "nb-request";

  const showView = (): void => {
    section.innerHTML = "";

    const text = doc.createElement("div");
    text.className = "nb-request-text";
    text.textContent = turn.request.text;
    section.appendChild(text);

    const controls = doc.createElement("div");
    controls.className = "nb-controls";

    const editButton = doc.createElement("button");
    editButton.type = "button";
    editButton.className = "nb-edit";
    editButton.textContent = "Edit";
    editButton.disabled = !ctx.canAsk;
    editButton.addEventListener("click", showEdit);
    controls.appendChild(editButton);

    const deleteButton = doc.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "nb-delete";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => ctx.actions.remove(turn.id));
    controls.appendChild(deleteButton);

    section.appendChild(controls);
  };

  const showEdit = (): void => {
    section.innerHTML = "";

    const textarea = doc.createElement("textarea");
    textarea.className = "nb-request-edit";
    textarea.value = turn.request.text;
    section.appendChild(textarea);

    const controls = doc.createElement("div");
    controls.className = "nb-controls";

    const resendButton = doc.createElement("button");
    resendButton.type = "button";
    resendButton.className = "nb-resend";
    resendButton.textContent = "Resend";
    resendButton.disabled = !ctx.canAsk;
    resendButton.addEventListener("click", () => ctx.actions.resend(turn.id, textarea.value));
    controls.appendChild(resendButton);

    const cancelButton = doc.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "nb-cancel";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", showView);
    controls.appendChild(cancelButton);

    section.appendChild(controls);
  };

  showView();
  return section;
}

function renderStaleNote(doc: Document, turn: Turn, ctx: TurnContext): HTMLElement {
  const note = doc.createElement("div");
  note.className = "nb-stale";
  note.textContent = "This turn's answer may no longer match the request. ";

  const continueButton = doc.createElement("button");
  continueButton.type = "button";
  continueButton.className = "nb-continue";
  continueButton.textContent = "Continue from here";
  continueButton.disabled = !ctx.canAsk;
  continueButton.addEventListener("click", () => ctx.actions.continueFrom(turn.id));
  note.appendChild(continueButton);

  return note;
}

function renderEarlier(doc: Document, turn: Turn): HTMLElement {
  const wrap = doc.createElement("div");
  wrap.className = "nb-earlier";
  (turn.earlier ?? []).forEach((entry, index) => {
    const details = doc.createElement("details");
    details.className = "nb-earlier-entry";
    const summary = doc.createElement("summary");
    summary.textContent = `Earlier version ${index + 1}`;
    details.appendChild(summary);

    const request = doc.createElement("div");
    request.className = "nb-earlier-request";
    request.textContent = entry.request.text;
    details.appendChild(request);

    const reply = doc.createElement("div");
    reply.className = "nb-earlier-reply";
    reply.textContent = entry.reply.text;
    details.appendChild(reply);

    wrap.appendChild(details);
  });
  return wrap;
}

function renderEmbedFrame(
  doc: Document,
  embed: Embed,
  ctx: TurnContext,
): { el: HTMLElement; badge: HTMLElement; handle: ReturnType<typeof renderEmbed> } {
  const frame = doc.createElement("div");
  frame.className = "nb-embed";
  frame.dataset.embedId = embed.id;
  frame.dataset.embedKind = embed.kind;

  const header = doc.createElement("div");
  header.className = "nb-embed-header";

  const caption = doc.createElement("span");
  caption.className = "nb-embed-caption";
  caption.textContent = embed.caption ?? "";
  header.appendChild(caption);

  const kindLabel = doc.createElement("span");
  kindLabel.className = "nb-embed-kind";
  kindLabel.textContent = embed.kind;
  header.appendChild(kindLabel);

  const badge = doc.createElement("span");
  applyBadge(badge, { state: "snapshot" });
  header.appendChild(badge);

  frame.appendChild(header);

  const body = doc.createElement("div");
  body.className = "nb-embed-body";
  frame.appendChild(body);

  const handle = renderEmbed(body, embed, ctx.embeds, ctx.renderers);

  return { el: frame, badge, handle };
}
