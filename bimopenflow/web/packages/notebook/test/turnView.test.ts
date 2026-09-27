import { describe, expect, it } from "vitest";
import type { Embed, Reply, Request, Turn } from "../src/document/format";
import type {
  EmbedContext,
  EmbedHandle,
  EmbedRegistry,
  EmbedRenderer,
  Freshness,
} from "../src/embeds/contract";
import type { SelectionBus } from "../src/embeds/selection";
import { createSelectionBus } from "../src/embeds/selection";
import type { TurnActions, TurnContext } from "../src/page/turnView";
import { renderTurn } from "../src/page/turnView";

// A fake registry that records every call and hands out a controllable
// handle per embed id, so tests can drive refresh() and count destroy().
interface FakeHandle extends EmbedHandle {
  readonly refreshCalls: number;
  readonly destroyCalls: number;
}

function makeFakeRegistry(results: Record<string, Freshness | (() => Promise<Freshness>)> = {}) {
  const renderCalls: { embedId: string; el: HTMLElement; ctx: EmbedContext }[] = [];
  const handles = new Map<string, FakeHandle>();

  const render: EmbedRenderer<Embed> = (el, embed, ctx) => {
    renderCalls.push({ embedId: embed.id, el, ctx });
    let refreshCalls = 0;
    let destroyCalls = 0;
    const handle: FakeHandle = {
      async refresh() {
        refreshCalls++;
        const result = results[embed.id] ?? { state: "snapshot" as const };
        return typeof result === "function" ? result() : result;
      },
      destroy() {
        destroyCalls++;
      },
      get refreshCalls() {
        return refreshCalls;
      },
      get destroyCalls() {
        return destroyCalls;
      },
    };
    handles.set(embed.id, handle);
    return handle;
  };

  const registry: EmbedRegistry = {
    value: render,
    table: render,
    chart: render,
    graph: render,
    view3d: render,
    picture: render,
    file: render,
  };

  return { registry, renderCalls, handles };
}

function makeSelectionBus(): SelectionBus {
  return createSelectionBus();
}

function makeEmbedContext(selection: SelectionBus = makeSelectionBus()): EmbedContext {
  return { api: {} as EmbedContext["api"], selection };
}

const request = (text: string): Request => ({ text });

const reply = (overrides: Partial<Reply> = {}): Reply => ({
  text: "The reply.",
  tools: [],
  embeds: [],
  ...overrides,
});

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: "t1",
    request: request("What is the total?"),
    reply: reply(),
    ...overrides,
  };
}

function makeActions(): TurnActions & {
  resendCalls: [string, string][];
  removeCalls: string[];
  continueCalls: string[];
} {
  const resendCalls: [string, string][] = [];
  const removeCalls: string[] = [];
  const continueCalls: string[] = [];
  return {
    resend: (id, text) => resendCalls.push([id, text]),
    remove: (id) => removeCalls.push(id),
    continueFrom: (id) => continueCalls.push(id),
    resendCalls,
    removeCalls,
    continueCalls,
  };
}

function makeContext(opts: {
  canAsk?: boolean;
  registry?: EmbedRegistry;
  actions?: TurnActions;
} = {}): TurnContext {
  return {
    embeds: makeEmbedContext(),
    renderers: opts.registry ?? makeFakeRegistry().registry,
    actions: opts.actions ?? makeActions(),
    canAsk: opts.canAsk ?? true,
  };
}

function mount(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("renderTurn: structure", () => {
  it("renders the request text and reply paragraphs split on blank lines", () => {
    const el = mount();
    const turn = makeTurn({
      request: request("Q1"),
      reply: reply({ text: "First paragraph.\n\nSecond paragraph." }),
    });
    renderTurn(el, turn, makeContext());

    expect(el.querySelector(".nb-request-text")?.textContent).toBe("Q1");
    const paragraphs = el.querySelectorAll(".nb-reply p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].textContent).toBe("First paragraph.");
    expect(paragraphs[1].textContent).toBe("Second paragraph.");
  });

  it("shows reply.error as an error", () => {
    const el = mount();
    const turn = makeTurn({ reply: reply({ error: "The host is offline." }) });
    renderTurn(el, turn, makeContext());
    expect(el.querySelector(".nb-error")?.textContent).toBe("The host is offline.");
  });

  it("folds tool calls in a details with a count, marks, and summaries", () => {
    const el = mount();
    const turn = makeTurn({
      reply: reply({
        tools: [
          { name: "getResult", ok: true, summary: "read 12 rows" },
          { name: "putAnalysis", ok: false, summary: "409 conflict" },
        ],
      }),
    });
    renderTurn(el, turn, makeContext());

    const details = el.querySelector("details.nb-tools");
    expect(details).toBeTruthy();
    expect(details?.querySelector("summary")?.textContent).toBe("2 tool calls");
    const items = details?.querySelectorAll("li") ?? [];
    expect(items).toHaveLength(2);
    expect(items[0].className).toBe("nb-tool-ok");
    expect(items[0].textContent).toContain("getResult: read 12 rows");
    expect(items[1].className).toBe("nb-tool-failed");
    expect(items[1].textContent).toContain("putAnalysis: 409 conflict");
  });

  it("shows the agent info as one quiet line", () => {
    const el = mount();
    const turn = makeTurn({
      reply: reply({
        agent: { model: "claude", effort: "medium", turns: 3, inputTokens: 100, outputTokens: 40 },
      }),
    });
    renderTurn(el, turn, makeContext());
    const line = el.querySelector(".nb-agent-info")?.textContent ?? "";
    expect(line).toContain("claude");
    expect(line).toContain("medium");
    expect(line).toContain("3 turns");
    expect(line).toContain("100 in / 40 out tokens");
  });

  it("omits the agent line when reply.agent is absent", () => {
    const el = mount();
    renderTurn(el, makeTurn(), makeContext());
    expect(el.querySelector(".nb-agent-info")).toBeNull();
  });

  it("draws each embed in a frame with caption, kind label, badge, and a body handed to renderEmbed", () => {
    const el = mount();
    const { registry, renderCalls } = makeFakeRegistry();
    const embed: Embed = {
      kind: "value",
      id: "e1",
      caption: "Total kgCO2e/yr",
      source: { analysisId: "a1", nodeId: "n1", port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[37196.2]], totalRows: 1, skip: 0 },
    };
    const turn = makeTurn({ reply: reply({ embeds: [embed] }) });
    renderTurn(el, turn, makeContext({ registry }));

    const frame = el.querySelector('.nb-embed[data-embed-id="e1"]');
    expect(frame).toBeTruthy();
    expect(frame?.querySelector(".nb-embed-caption")?.textContent).toBe("Total kgCO2e/yr");
    expect(frame?.querySelector(".nb-embed-kind")?.textContent).toBe("value");
    expect(frame?.querySelector(".nb-badge")).toBeTruthy();
    expect(frame?.querySelector(".nb-embed-body")).toBeTruthy();

    expect(renderCalls).toHaveLength(1);
    expect(renderCalls[0].embedId).toBe("e1");
    expect(renderCalls[0].el.className).toBe("nb-embed-body");
  });
});

describe("renderTurn: actions", () => {
  it("Edit turns the request into a textarea with Resend and Cancel", () => {
    const el = mount();
    renderTurn(el, makeTurn(), makeContext());

    (el.querySelector(".nb-edit") as HTMLButtonElement).click();
    expect(el.querySelector(".nb-request-edit")).toBeTruthy();
    expect(el.querySelector(".nb-resend")).toBeTruthy();
    expect(el.querySelector(".nb-cancel")).toBeTruthy();
    expect(el.querySelector(".nb-request-text")).toBeNull();
  });

  it("Resend calls actions.resend with the turn id and edited text", () => {
    const el = mount();
    const actions = makeActions();
    renderTurn(el, makeTurn({ id: "t7" }), makeContext({ actions }));

    (el.querySelector(".nb-edit") as HTMLButtonElement).click();
    const textarea = el.querySelector(".nb-request-edit") as HTMLTextAreaElement;
    textarea.value = "A better question";
    (el.querySelector(".nb-resend") as HTMLButtonElement).click();

    expect(actions.resendCalls).toEqual([["t7", "A better question"]]);
  });

  it("Cancel returns to the read-only request view", () => {
    const el = mount();
    renderTurn(el, makeTurn(), makeContext());

    (el.querySelector(".nb-edit") as HTMLButtonElement).click();
    (el.querySelector(".nb-cancel") as HTMLButtonElement).click();

    expect(el.querySelector(".nb-request-text")).toBeTruthy();
    expect(el.querySelector(".nb-request-edit")).toBeNull();
  });

  it("Delete calls actions.remove with the turn id", () => {
    const el = mount();
    const actions = makeActions();
    renderTurn(el, makeTurn({ id: "t3" }), makeContext({ actions }));

    (el.querySelector(".nb-delete") as HTMLButtonElement).click();
    expect(actions.removeCalls).toEqual(["t3"]);
  });

  it("a stale turn shows a note with Continue from here, calling actions.continueFrom", () => {
    const el = mount();
    const actions = makeActions();
    renderTurn(el, makeTurn({ id: "t2", stale: true }), makeContext({ actions }));

    const button = el.querySelector(".nb-continue") as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(actions.continueCalls).toEqual(["t2"]);
  });

  it("shows no stale note or earlier list when absent", () => {
    const el = mount();
    renderTurn(el, makeTurn(), makeContext());
    expect(el.querySelector(".nb-stale")).toBeNull();
    expect(el.querySelector(".nb-earlier")).toBeNull();
  });

  it("earlier replies are folded, showing their request and reply text but no embeds", () => {
    const el = mount();
    const embed: Embed = {
      kind: "value",
      id: "old-embed",
      source: { analysisId: "a1", nodeId: "n1", port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    };
    const turn = makeTurn({
      earlier: [
        { request: request("Old question"), reply: reply({ text: "Old answer", embeds: [embed] }) },
      ],
    });
    renderTurn(el, turn, makeContext());

    const entry = el.querySelector(".nb-earlier-entry");
    expect(entry).toBeTruthy();
    expect(entry?.querySelector("summary")?.textContent).toBe("Earlier version 1");
    expect(entry?.querySelector(".nb-earlier-request")?.textContent).toBe("Old question");
    expect(entry?.querySelector(".nb-earlier-reply")?.textContent).toBe("Old answer");
    expect(el.querySelector('[data-embed-id="old-embed"]')).toBeNull();
  });

  it("disables Edit, Resend, and Continue when canAsk is false, but not Delete or Cancel", () => {
    const el = mount();
    renderTurn(el, makeTurn({ stale: true }), makeContext({ canAsk: false }));

    expect((el.querySelector(".nb-edit") as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector(".nb-delete") as HTMLButtonElement).disabled).toBe(false);
    expect((el.querySelector(".nb-continue") as HTMLButtonElement).disabled).toBe(true);
  });

  it("a disabled Edit button does not open the edit view (canAsk false)", () => {
    const el = mount();
    renderTurn(el, makeTurn(), makeContext({ canAsk: false }));

    (el.querySelector(".nb-edit") as HTMLButtonElement).click();

    expect(el.querySelector(".nb-request-edit")).toBeNull();
    expect(el.querySelector(".nb-request-text")).toBeTruthy();
  });
});

describe("renderTurn: badges", () => {
  it("shows the snapshot badge before any refresh", () => {
    const el = mount();
    const embed: Embed = {
      kind: "value",
      id: "e1",
      source: { analysisId: "a1", nodeId: "n1", port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    };
    renderTurn(el, makeTurn({ reply: reply({ embeds: [embed] }) }), makeContext());
    const badge = el.querySelector(".nb-badge") as HTMLElement;
    expect(badge.classList.contains("nb-badge-snapshot")).toBe(true);
    expect(badge.textContent).toBe("as recorded");
  });

  it("refresh() updates each badge for all four freshness states", async () => {
    const el = mount();
    const embeds: Embed[] = ["snap", "same", "diff", "gone"].map((id) => ({
      kind: "value",
      id,
      source: { analysisId: "a1", nodeId: id, port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    }));
    const { registry } = makeFakeRegistry({
      snap: { state: "snapshot" },
      same: { state: "current" },
      diff: { state: "changed", was: "37,196.2", now: "40,000.0" },
      gone: { state: "unavailable", reason: "analysis missing" },
    });
    const turn = makeTurn({ reply: reply({ embeds }) });
    const handle = renderTurn(el, turn, makeContext({ registry }));

    await handle.refresh();

    const badgeFor = (id: string) => el.querySelector(`[data-embed-id="${id}"] .nb-badge`) as HTMLElement;

    expect(badgeFor("snap").classList.contains("nb-badge-snapshot")).toBe(true);

    expect(badgeFor("same").classList.contains("nb-badge-current")).toBe(true);
    expect(badgeFor("same").textContent).toBe("current");

    expect(badgeFor("diff").classList.contains("nb-badge-changed")).toBe(true);
    expect(badgeFor("diff").textContent).toContain("37,196.2");
    expect(badgeFor("diff").textContent).toContain("40,000.0");

    expect(badgeFor("gone").classList.contains("nb-badge-unavailable")).toBe(true);
    expect(badgeFor("gone").title).toBe("analysis missing");
  });
});

describe("renderTurn: refresh and destroy", () => {
  it("refresh() calls every embed handle's refresh concurrently", async () => {
    const el = mount();
    const order: string[] = [];
    const slow = (id: string, ms: number): (() => Promise<Freshness>) => async () => {
      order.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${id}-end`);
      return { state: "current" };
    };
    const embeds: Embed[] = ["a", "b"].map((id) => ({
      kind: "value",
      id,
      source: { analysisId: "a1", nodeId: id, port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    }));
    const { registry } = makeFakeRegistry({
      a: slow("a", 10),
      b: slow("b", 1),
    });
    const turn = makeTurn({ reply: reply({ embeds }) });
    const handle = renderTurn(el, turn, makeContext({ registry }));

    await handle.refresh();

    // Both started before either finished: concurrent, not sequential.
    expect(order.indexOf("a-start")).toBeLessThan(order.indexOf("b-end"));
    expect(order).toEqual(["a-start", "b-start", "b-end", "a-end"]);
  });

  it("refresh() is safe to call twice", async () => {
    const el = mount();
    const embed: Embed = {
      kind: "value",
      id: "e1",
      source: { analysisId: "a1", nodeId: "n1", port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    };
    const { registry, handles } = makeFakeRegistry({ e1: { state: "current" } });
    const turn = makeTurn({ reply: reply({ embeds: [embed] }) });
    const handle = renderTurn(el, turn, makeContext({ registry }));

    await handle.refresh();
    await handle.refresh();

    expect(handles.get("e1")?.refreshCalls).toBe(2);
  });

  it("destroy() destroys every embed handle and removes the turn's DOM; safe to call twice", () => {
    const el = mount();
    const embeds: Embed[] = ["a", "b"].map((id) => ({
      kind: "value",
      id,
      source: { analysisId: "a1", nodeId: id, port: "out" },
      snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
    }));
    const { registry, handles } = makeFakeRegistry();
    const turn = makeTurn({ id: "t9", reply: reply({ embeds }) });
    const handle = renderTurn(el, turn, makeContext({ registry }));

    expect(el.querySelector('[data-turn-id="t9"]')).toBeTruthy();

    handle.destroy();
    expect(handles.get("a")?.destroyCalls).toBe(1);
    expect(handles.get("b")?.destroyCalls).toBe(1);
    expect(el.querySelector('[data-turn-id="t9"]')).toBeNull();

    handle.destroy();
    expect(handles.get("a")?.destroyCalls).toBe(1);
    expect(handles.get("b")?.destroyCalls).toBe(1);
  });
});

describe("ensureNotebookStyles via renderTurn", () => {
  it("injects one style element into the document, idempotently", () => {
    const el = mount();
    renderTurn(el, makeTurn({ id: "s1" }), makeContext());
    renderTurn(el, makeTurn({ id: "s2" }), makeContext());
    expect(document.querySelectorAll("#nb-styles")).toHaveLength(1);
  });
});
