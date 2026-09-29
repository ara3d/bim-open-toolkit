import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { AskEvent, AskTransport } from "../src/ask/events";
import type { Embed, Notebook, Reply, Turn } from "../src/document/format";
import { parseNotebook, serializeNotebook } from "../src/document/io";
import type { EmbedContext, EmbedRegistry, EmbedRenderer, Freshness, NotebookApi } from "../src/embeds/contract";
import { readFileText } from "../src/page/files";
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  mountNotebook,
  NO_ASK_NOTE,
  TOOLKIT_URL,
  UNTITLED,
  type NotebookView,
  type NotebookViewOptions,
} from "../src/page/notebookView";

// --- Fakes -----------------------------------------------------------------

/** An api no test path should reach: replies here are built from events with built: false. */
const api = new Proxy({} as NotebookApi, {
  get: (_, name) => () => Promise.reject(new Error(`unexpected api.${String(name)}`)),
});

/** Draws each embed as a span, records the context it got, and answers refresh from `freshness`. */
function fakeRegistry(freshness: Record<string, Freshness> = {}) {
  const contexts: EmbedContext[] = [];
  let destroyed = 0;
  const render: EmbedRenderer<Embed> = (el, embed, ctx) => {
    contexts.push(ctx);
    const span = el.ownerDocument.createElement("span");
    span.className = "fake-embed";
    span.textContent = embed.id;
    el.append(span);
    return {
      refresh: async () => freshness[embed.id] ?? { state: "snapshot" },
      destroy: () => {
        destroyed++;
        span.remove();
      },
    };
  };
  const registry = Object.fromEntries(
    ["value", "table", "chart", "graph", "view3d", "picture", "file"].map((k) => [k, render]),
  ) as unknown as EmbedRegistry;
  return { registry, contexts, destroyed: () => destroyed };
}

/** Emits a scripted event list; `gate` holds the request open until released. */
function fakeAsk(script: (request: string) => AskEvent[]) {
  const calls: { request: string; analysisId: string | undefined }[] = [];
  let release: () => void = () => undefined;
  let gate: Promise<void> | undefined;
  const transport: AskTransport = {
    async ask(request, analysisId, onEvent, signal) {
      calls.push({ request, analysisId });
      const events = script(request);
      onEvent(events[0]);
      if (gate) {
        await Promise.race([
          gate,
          new Promise<never>((_, reject) => signal?.addEventListener("abort", () => reject(signal.reason))),
        ]);
      }
      for (const event of events.slice(1)) onEvent(event);
    },
  };
  return {
    transport,
    calls,
    hold() {
      gate = new Promise((resolve) => (release = resolve));
    },
    release: () => release(),
  };
}

const answered = (text: string, analysisId = "ask-doors"): AskEvent[] => [
  { type: "start", analysisId, model: "haiku" },
  { type: "tool", name: "editGraph", ok: true, summary: "3 nodes" },
  { type: "done", analysisId, text, built: false },
];

const reply = (text: string, extra: Partial<Reply> = {}): Reply => ({ text, tools: [], embeds: [], ...extra });

const valueEmbed = (id: string): Embed => ({
  kind: "value",
  id,
  source: { analysisId: "a", nodeId: "n", port: "out" },
  snapshot: { columns: [{ name: "v", type: "Number" }], rows: [[1]], totalRows: 1, skip: 0 },
});

const turn = (id: string, extra: Partial<Turn> = {}): Turn => ({
  id,
  request: { text: `question ${id}` },
  reply: reply(`answer ${id}`, { analysisId: "ask-doors", embeds: [valueEmbed(`${id}-e1`)] }),
  ...extra,
});

const sample = (turns: Turn[] = [turn("t1"), turn("t2"), turn("t3")]): Notebook => ({
  format: "bimopen-notebook/0.1",
  title: "Door check",
  createdUtc: "2026-09-27T00:00:00Z",
  turns,
});

// --- Harness ---------------------------------------------------------------

let root: HTMLElement;
let view: NotebookView | undefined;

beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(["a.notebook.json"]))));
});

afterEach(() => {
  view?.destroy();
  view = undefined;
  root.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(options: Partial<NotebookViewOptions> = {}) {
  const fake = fakeRegistry();
  view = mountNotebook(root, { api, renderers: fake.registry, now: () => "2026-09-27T12:00:00Z", ...options });
  return { view, fake };
}

const q = <E extends Element>(selector: string) => root.querySelector<E>(selector)!;
const turnSlots = () => [...root.querySelectorAll<HTMLElement>(".nb-column .nb-turn")];
const turnIds = () => turnSlots().map((t) => t.dataset.turnId);
const click = (selector: string, within: ParentNode = root) =>
  within.querySelector<HTMLButtonElement>(selector)!.click();
const turnEl = (id: string) => q<HTMLElement>(`.nb-turn[data-turn-id="${id}"]`);

async function ask(text: string) {
  q<HTMLTextAreaElement>(".nb-ask-input").value = text;
  q<HTMLFormElement>(".nb-ask").requestSubmit();
}

// --- Tests -----------------------------------------------------------------

/** jsdom has no document.scrollingElement; stands one in for a test, removed afterwards. */
function fakeScrollingElement(page: { scrollTop: number; scrollHeight: number; clientHeight: number }): void {
  Object.defineProperty(document, "scrollingElement", { configurable: true, get: () => page });
  onTestFinished(() => {
    delete (document as { scrollingElement?: unknown }).scrollingElement;
  });
}

describe("mountNotebook", () => {
  it("loads a notebook and renders every turn in a column, with one selection bus for all embeds", () => {
    const { fake } = mount({ initial: sample() });
    expect(turnIds()).toEqual(["t1", "t2", "t3"]);
    expect(q<HTMLInputElement>(".nb-title").value).toBe("Door check");
    expect(fake.contexts).toHaveLength(3);
    expect(new Set(fake.contexts.map((c) => c.selection)).size).toBe(1);
  });

  it("starts empty and untitled without an initial notebook", () => {
    mount();
    expect(view!.notebook().title).toBe("Untitled notebook");
    expect(turnIds()).toEqual([]);
    expect(q<HTMLElement>(".nb-empty").hidden).toBe(false);
    expect(q<HTMLElement>(".nb-note").hidden).toBe(true);
    expect(document.title).toBe(BRAND_NAME);
  });

  it("shows a brand bar naming BIM Open Notebook, linked to the toolkit repository", () => {
    mount({ initial: sample() });
    const brand = q<HTMLElement>(".nb-brand");
    expect(brand.querySelector(".nb-brand-name")!.textContent).toBe(BRAND_NAME);
    const link = brand.querySelector<HTMLAnchorElement>(".nb-brand-link")!;
    expect(link.textContent).toBe(BRAND_TAGLINE);
    expect(link.href).toBe(TOOLKIT_URL);
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener");
  });

  it("sets the document title from the notebook title, and back to the brand alone when untitled", () => {
    mount({ initial: sample() });
    expect(document.title).toBe(`Door check · ${BRAND_NAME}`);
    view!.load({ ...sample(), title: UNTITLED });
    expect(document.title).toBe(BRAND_NAME);
    const title = q<HTMLInputElement>(".nb-title");
    title.value = "Renamed";
    title.dispatchEvent(new Event("change"));
    expect(document.title).toBe(`Renamed · ${BRAND_NAME}`);
  });

  it("shows the notebook's host note above the turns, such as a reconstructed session's label", () => {
    mount({ initial: { ...sample(), host: { profile: "bim", note: "Reconstructed session: replies written by an agent." } } });
    const note = q<HTMLElement>(".nb-note");
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe("Reconstructed session: replies written by an agent.");
  });

  it("lists the samples and loads one", async () => {
    const text = serializeNotebook(sample([turn("t1")]));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        new Response(url === "/__notebooks/" ? JSON.stringify(["doors.notebook.json"]) : text),
      ),
    );
    mount();
    const select = q<HTMLSelectElement>(".nb-samples");
    await vi.waitFor(() => expect(select.options).toHaveLength(2));
    select.value = "doors.notebook.json";
    select.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(turnIds()).toEqual(["t1"]));
    expect(fetch).toHaveBeenCalledWith("/__notebooks/doors.notebook.json");
  });

  it("appends a turn from a request, passing the continuation and showing events live", async () => {
    const asker = fakeAsk((r) => answered(`Answered: ${r}`));
    mount({ initial: sample(), ask: asker.transport });
    asker.hold();
    await ask("How many doors?");
    await vi.waitFor(() => expect(q<HTMLElement>(".nb-live").hidden).toBe(false));
    expect(q<HTMLElement>(".nb-live").textContent).toContain("How many doors?");
    expect(q<HTMLButtonElement>(".nb-send").disabled).toBe(true);
    expect(q<HTMLButtonElement>(".nb-edit").disabled).toBe(true);
    asker.release();
    await vi.waitFor(() => expect(turnIds()).toEqual(["t1", "t2", "t3", "t4"]));
    expect(asker.calls).toEqual([{ request: "How many doors?", analysisId: "ask-doors" }]);
    const added = view!.notebook().turns[3];
    expect(added.request).toEqual({ text: "How many doors?", atUtc: "2026-09-27T12:00:00Z" });
    expect(added.reply.text).toBe("Answered: How many doors?");
    expect(added.reply.tools).toEqual([{ name: "editGraph", ok: true, summary: "3 nodes" }]);
    expect(q<HTMLElement>(".nb-live").hidden).toBe(true);
    expect(q<HTMLButtonElement>(".nb-send").disabled).toBe(false);
  });

  // TKT-127: a question about the toolkit is answered in text from its documents, with no graph.
  it("shows a text-only answer about the toolkit as a reply with no embeds", async () => {
    const text = "Run `npm run nrc:walkthrough` (from README.md).";
    const asker = fakeAsk(() => [
      { type: "start", analysisId: "ask-run-nrc-walkthrough", model: "haiku" },
      { type: "tool", name: "searchDocs", ok: true, summary: "3 files" },
      { type: "tool", name: "readDoc", ok: true, summary: "README.md" },
      { type: "done", analysisId: "ask-run-nrc-walkthrough", text, built: false, verified: false },
    ]);
    mount({ ask: asker.transport });
    await ask("How do I run the NRC walkthrough?");
    await vi.waitFor(() => expect(turnSlots()).toHaveLength(1));
    const added = view!.notebook().turns[0];
    expect(added.reply).toMatchObject({ text, embeds: [] });
    expect(added.reply.error).toBeUndefined();
    expect(added.reply.tools.map((t) => t.name)).toEqual(["searchDocs", "readDoc"]);
    expect(turnSlots()[0].querySelector(".nb-reply")!.textContent).toContain("from README.md");
    expect(turnSlots()[0].querySelector(".fake-embed")).toBeNull();
  });

  it("scrolls to the end on send and after the reply, so the request box covers nothing new", async () => {
    // jsdom does no layout: fake a page 2000 px tall in a 600 px window.
    const page = { scrollTop: 0, scrollHeight: 2000, clientHeight: 600 };
    fakeScrollingElement(page);
    const asker = fakeAsk((r) => answered(r));
    mount({ initial: sample(), ask: asker.transport });
    asker.hold();
    await ask("How many doors?");
    await vi.waitFor(() => expect(page.scrollTop).toBe(2000));
    page.scrollHeight = 2600;
    asker.release();
    await vi.waitFor(() => expect(turnIds()).toHaveLength(4));
    expect(page.scrollTop).toBe(2600);
  });

  it("leaves the scroll alone after the reply when the reader scrolled up meanwhile", async () => {
    const page = { scrollTop: 0, scrollHeight: 2000, clientHeight: 600 };
    fakeScrollingElement(page);
    const asker = fakeAsk((r) => answered(r));
    mount({ initial: sample(), ask: asker.transport });
    asker.hold();
    await ask("How many doors?");
    await vi.waitFor(() => expect(page.scrollTop).toBe(2000));
    page.scrollTop = 300;
    asker.release();
    await vi.waitFor(() => expect(turnIds()).toHaveLength(4));
    expect(page.scrollTop).toBe(300);
  });

  it("records a stopped request as a turn whose reply carries the error", async () => {
    const asker = fakeAsk((r) => answered(r));
    mount({ ask: asker.transport });
    asker.hold();
    await ask("Slow question");
    await vi.waitFor(() => expect(q<HTMLButtonElement>(".nb-stop").hidden).toBe(false));
    click(".nb-stop");
    await vi.waitFor(() => expect(view!.notebook().turns).toHaveLength(1));
    expect(view!.notebook().turns[0].reply.error).toBe("Stopped by the user.");
  });

  it("drops a running request's reply when another notebook is loaded", async () => {
    const asker = fakeAsk((r) => answered(r));
    mount({ initial: sample(), ask: asker.transport });
    asker.hold();
    await ask("Question for the old notebook");
    await vi.waitFor(() => expect(q<HTMLButtonElement>(".nb-send").disabled).toBe(true));
    view!.load(sample([turn("t7")]));
    expect(q<HTMLButtonElement>(".nb-undo").disabled).toBe(true);
    expect(q<HTMLButtonElement>(".nb-send").disabled).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(turnIds()).toEqual(["t7"]);
  });

  it("resends an edited turn with the continuation before it and marks later turns stale", async () => {
    const asker = fakeAsk((r) => answered(`Again: ${r}`, "ask-new"));
    const first = turn("t1", { reply: reply("first", { analysisId: "ask-first" }) });
    mount({ initial: sample([first, turn("t2"), turn("t3")]), ask: asker.transport });
    click(".nb-edit", turnEl("t2"));
    turnEl("t2").querySelector<HTMLTextAreaElement>(".nb-request-edit")!.value = "question t2, edited";
    click(".nb-resend", turnEl("t2"));
    await vi.waitFor(() => expect(view!.notebook().turns[1].request.text).toBe("question t2, edited"));
    expect(asker.calls).toEqual([{ request: "question t2, edited", analysisId: "ask-first" }]);
    const [, t2, t3] = view!.notebook().turns;
    expect(t2.earlier?.[0].reply.text).toBe("answer t2");
    expect(t3.stale).toBe(true);
    expect(turnEl("t3").querySelector(".nb-stale")).not.toBeNull();
  });

  it("continues from a stale turn by resending its own request", async () => {
    const asker = fakeAsk((r) => answered(`Again: ${r}`));
    mount({ initial: sample([turn("t1"), turn("t2", { stale: true })]), ask: asker.transport });
    click(".nb-continue", turnEl("t2"));
    await vi.waitFor(() => expect(view!.notebook().turns[1].stale).toBe(false));
    expect(asker.calls[0].request).toBe("question t2");
  });

  it("removes a turn, and undo and redo move through the history with buttons and keys", () => {
    mount({ initial: sample() });
    const undoButton = q<HTMLButtonElement>(".nb-undo");
    const redoButton = q<HTMLButtonElement>(".nb-redo");
    expect(undoButton.disabled).toBe(true);
    click(".nb-delete", turnEl("t2"));
    expect(turnIds()).toEqual(["t1", "t3"]);
    expect(undoButton.disabled).toBe(false);
    undoButton.click();
    expect(turnIds()).toEqual(["t1", "t2", "t3"]);
    expect(redoButton.disabled).toBe(false);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Z", ctrlKey: true, shiftKey: true, bubbles: true }));
    expect(turnIds()).toEqual(["t1", "t3"]);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    expect(turnIds()).toEqual(["t1", "t2", "t3"]);
    // Not while typing in a text field.
    click(".nb-delete", turnEl("t1"));
    q<HTMLTextAreaElement>(".nb-ask-input").dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }),
    );
    expect(turnIds()).toEqual(["t2", "t3"]);
  });

  it("keeps an unchanged turn's DOM and embeds across an edit, and destroys the removed one", () => {
    // t2 has its own analysis, so removing it leaves t3 untouched (not stale).
    const t2 = turn("t2", { reply: reply("answer t2", { analysisId: "ask-other", embeds: [valueEmbed("t2-e1")] }) });
    const { fake } = mount({ initial: sample([turn("t1"), t2, turn("t3")]) });
    const t1 = turnEl("t1");
    const t3 = turnEl("t3");
    click(".nb-delete", turnEl("t2"));
    expect(turnEl("t1")).toBe(t1);
    expect(turnEl("t3")).toBe(t3);
    expect(fake.contexts).toHaveLength(3);
    expect(fake.destroyed()).toBe(1);
  });

  it("Save downloads text that parses back to the same notebook, named from the title", async () => {
    let saved: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return "blob:saved";
    });
    URL.revokeObjectURL = vi.fn();
    let fileName = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      fileName = this.download;
    });
    const notebook = sample();
    mount({ initial: notebook });
    click(".nb-save");
    expect(fileName).toBe("door-check.notebook.json");
    const parsed = parseNotebook(await readFileText(saved!));
    expect(parsed).toEqual({ ok: true, notebook });
  });

  it("Open with an invalid file lists its errors and keeps the notebook", async () => {
    mount({ initial: sample() });
    const input = q<HTMLInputElement>(".nb-open-input");
    const file = new File(['{"format":"bimopen-notebook/0.1","title":3}'], "bad.notebook.json");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelector(".nb-problems")).not.toBeNull());
    const problems = [...root.querySelectorAll(".nb-problems li")].map((li) => li.textContent);
    expect(problems).toContain("title: expected a string");
    expect(turnIds()).toEqual(["t1", "t2", "t3"]);
  });

  it("Open with a valid file loads it", async () => {
    mount({ initial: sample() });
    const input = q<HTMLInputElement>(".nb-open-input");
    const file = new File([serializeNotebook(sample([turn("t9")]))], "good.notebook.json");
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(turnIds()).toEqual(["t9"]));
  });

  it("re-evaluates every turn and counts current, changed, and unavailable", async () => {
    const fake = fakeRegistry({
      "t1-e1": { state: "current" },
      "t2-e1": { state: "changed", was: "1", now: "2" },
      "t3-e1": { state: "unavailable", reason: "offline" },
    });
    view = mountNotebook(root, { api, renderers: fake.registry, initial: sample() });
    await view.refreshAll();
    expect(q<HTMLElement>(".nb-status").textContent).toBe("1 current, 1 changed, 1 unavailable");
  });

  it("edits the title as an undoable step", () => {
    mount({ initial: sample() });
    const title = q<HTMLInputElement>(".nb-title");
    title.value = "Doors, level 2";
    title.dispatchEvent(new Event("change"));
    expect(view!.notebook().title).toBe("Doors, level 2");
    click(".nb-undo");
    expect(view!.notebook().title).toBe("Door check");
    expect(title.value).toBe("Door check");
  });

  it("disables the request box with a note when there is no ask transport", () => {
    mount({ initial: sample() });
    expect(q<HTMLTextAreaElement>(".nb-ask-input").disabled).toBe(true);
    expect(q<HTMLButtonElement>(".nb-send").disabled).toBe(true);
    expect(q<HTMLElement>(".nb-ask-note").textContent).toBe(NO_ASK_NOTE);
    expect(q<HTMLButtonElement>(".nb-edit").disabled).toBe(true);
  });

  it("destroy removes the page and every embed", () => {
    const { fake } = mount({ initial: sample() });
    view!.destroy();
    view = undefined;
    expect(root.childElementCount).toBe(0);
    expect(fake.destroyed()).toBe(3);
  });
});
