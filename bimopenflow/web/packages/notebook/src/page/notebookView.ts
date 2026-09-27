// The notebook page: a toolbar, the turns, and the request box. Owns the
// notebook and its undo history; every change goes through document/edits.
//
// Turns are drawn keyed by Turn object identity. edits.ts leaves untouched
// turns reference-equal, so after an edit only the turns it replaced are
// destroyed and redrawn; the others keep their DOM and their embeds, which
// matters for 3D views and charts that are costly to rebuild.

import { EMBED_KINDS, type Embed, type Notebook, type Reply, type Request, type Turn } from "../document/format";
import { emptyNotebook, parseNotebook, serializeNotebook } from "../document/io";
import {
  appendTurn,
  commit,
  continuationOf,
  redo,
  removeTurn,
  resendTurn,
  startHistory,
  undo,
  type History,
} from "../document/edits";
import { replyFromAsk } from "../ask/reply";
import type { AskEvent, AskTransport } from "../ask/events";
import type { EmbedContext, EmbedRegistry, EmbedRenderer, Freshness, NotebookApi } from "../embeds/contract";
import { defaultRenderers } from "../embeds/registry";
import { createSelectionBus } from "../embeds/selection";
import { renderTurn, type TurnContext, type TurnHandle } from "./turnView";
import { ensureNotebookStyles } from "./styles";
import { ensureShellStyles } from "./shellStyles";
import { downloadText, fetchSample, listSamples, notebookFileName, readFileText } from "./files";

export interface NotebookViewOptions {
  readonly api: NotebookApi;
  /** Absent when the host has no /api/ask; the request box is then disabled with a note. */
  readonly ask?: AskTransport;
  readonly renderers?: EmbedRegistry;
  readonly initial?: Notebook;
  /** The clock, for request timestamps; injectable for tests. */
  readonly now?: () => string;
}

export interface NotebookView {
  notebook(): Notebook;
  load(notebook: Notebook): void;
  refreshAll(): Promise<void>;
  destroy(): void;
}

/** The title a notebook gets when none is given. */
export const UNTITLED = "Untitled notebook";

export const NO_ASK_NOTE =
  "Asking needs the studio host, which serves /api/ask with a configured model. This page can still read, re-evaluate, edit, and save notebooks.";

/** A list of problems under a heading, e.g. the validation errors of a file that did not open. */
export function renderProblems(doc: Document, heading: string, problems: readonly string[]): HTMLElement {
  const box = el(doc, "div", "nb-problems");
  box.setAttribute("role", "alert");
  box.append(el(doc, "div", "nb-problems-heading", heading));
  const list = el(doc, "ul");
  for (const problem of problems) list.append(el(doc, "li", undefined, problem));
  box.append(list);
  return box;
}

export function mountNotebook(root: HTMLElement, options: NotebookViewOptions): NotebookView {
  const doc = root.ownerDocument;
  ensureNotebookStyles(doc);
  ensureShellStyles(doc);
  const now = options.now ?? (() => new Date().toISOString());
  const ask = options.ask;

  let history: History = startHistory(options.initial ?? emptyNotebook(UNTITLED, now()));
  /** The running request's abort control; undefined when idle. */
  let running: AbortController | undefined;
  let refreshing = false;
  /** Counts loads; a request that finishes after a load belongs to a notebook no longer shown. */
  let loads = 0;
  let destroyed = false;
  /** Freshness results collected while "Re-evaluate all" runs. */
  let tally: Freshness["state"][] | undefined;

  const embeds: EmbedContext = { api: options.api, selection: createSelectionBus() };
  const turnContext: TurnContext = {
    embeds,
    renderers: tallying(options.renderers ?? defaultRenderers, (f) => tally?.push(f.state)),
    actions: {
      resend: (turnId, text) => void send(text, turnId),
      remove: (turnId) => {
        if (!running) edit(removeTurn(history.present, turnId));
      },
      continueFrom: (turnId) => {
        const turn = history.present.turns.find((t) => t.id === turnId);
        if (turn) void send(turn.request.text, turnId);
      },
    },
    // A getter: renderTurn reads it again whenever it shows a turn's edit box.
    get canAsk() {
      return canAsk();
    },
  };
  const canAsk = (): boolean => ask !== undefined && !running && !destroyed;

  // --- The page's parts --------------------------------------------------

  root.replaceChildren();
  const shell = el(doc, "div", "nb-shell");
  const toolbar = buildToolbar();
  const problemsSlot = el(doc, "div");
  const column = el(doc, "main", "nb-column");
  const empty = el(doc, "div", "nb-empty", "No turns yet. Ask something below, or open a sample.");
  const turnsEl = el(doc, "div", "nb-turns");
  const live = el(doc, "div", "nb-live");
  live.hidden = true;
  const box = buildRequestBox();
  column.append(empty, turnsEl, live, box.form);
  shell.append(toolbar.el, problemsSlot, column);
  root.append(shell);

  /** Each drawn turn by object identity, with the element that holds it. */
  const drawn = new Map<Turn, { readonly slot: HTMLElement; readonly handle: TurnHandle }>();

  const onKey = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z" || isTextField(event.target)) return;
    event.preventDefault();
    step(event.shiftKey ? redo : undo);
  };
  doc.addEventListener("keydown", onKey);

  render();
  void fillSamples();

  // --- Rendering -----------------------------------------------------------

  function render(): void {
    const notebook = history.present;
    const keep = new Set(notebook.turns);
    for (const [turn, { slot, handle }] of drawn) {
      if (keep.has(turn)) continue;
      handle.destroy();
      slot.remove();
      drawn.delete(turn);
    }
    // Insert new turns in order, moving an existing one only when it is out of place.
    let cursor = turnsEl.firstElementChild;
    for (const turn of notebook.turns) {
      let entry = drawn.get(turn);
      if (!entry) {
        const slot = el(doc, "div", "nb-turn-slot");
        entry = { slot, handle: renderTurn(slot, turn, turnContext) };
        drawn.set(turn, entry);
      }
      if (entry.slot === cursor) cursor = cursor.nextElementSibling;
      else turnsEl.insertBefore(entry.slot, cursor);
    }
    empty.hidden = notebook.turns.length > 0 || running !== undefined;
    if (doc.activeElement !== toolbar.title) toolbar.title.value = notebook.title;
    syncControls();
  }

  /** Enables and disables every control from the current state. */
  function syncControls(): void {
    const busy = running !== undefined;
    toolbar.undo.disabled = busy || history.past.length === 0;
    toolbar.redo.disabled = busy || history.future.length === 0;
    for (const b of [toolbar.samples, toolbar.open, toolbar.fresh]) b.disabled = busy;
    toolbar.samples.disabled ||= toolbar.samples.options.length <= 1;
    toolbar.refresh.disabled = busy || refreshing;
    box.input.disabled = !ask;
    box.send.disabled = !canAsk();
    box.stop.hidden = !busy;
    // Turn controls were drawn with the state at their drawing; bring them up to date.
    for (const b of turnsEl.querySelectorAll<HTMLButtonElement>(".nb-edit, .nb-resend, .nb-continue")) b.disabled = !canAsk();
    for (const b of turnsEl.querySelectorAll<HTMLButtonElement>(".nb-delete")) b.disabled = busy;
  }

  function edit(next: Notebook): void {
    history = commit(history, next);
    render();
  }

  function step(move: (h: History) => History): void {
    if (running) return;
    history = move(history);
    render();
  }

  function load(notebook: Notebook): void {
    loads++;
    running?.abort(new Error("Another notebook was opened."));
    running = undefined;
    live.hidden = true;
    history = startHistory(notebook);
    showProblems(undefined);
    render();
  }

  function showProblems(problems: { heading: string; list: readonly string[] } | undefined): void {
    problemsSlot.replaceChildren(...(problems ? [renderProblems(doc, problems.heading, problems.list)] : []));
  }

  function setStatus(text: string): void {
    toolbar.status.textContent = text;
  }

  // --- Toolbar -------------------------------------------------------------

  function buildToolbar() {
    const bar = el(doc, "header", "nb-toolbar");
    const title = el(doc, "input", "nb-title");
    title.type = "text";
    title.setAttribute("aria-label", "Notebook title");
    title.addEventListener("change", () => {
      if (title.value !== history.present.title) edit({ ...history.present, title: title.value });
    });
    const samples = el(doc, "select", "nb-samples");
    samples.setAttribute("aria-label", "Open a sample notebook");
    samples.append(option(doc, "Samples…", ""));
    samples.addEventListener("change", () => {
      const name = samples.value;
      samples.value = "";
      if (name) void openSample(name);
    });
    const fileInput = el(doc, "input", "nb-open-input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (file) void openFile(file);
    });
    const open = button(doc, "nb-open", "Open…", () => fileInput.click());
    const save = button(doc, "nb-save", "Save", () =>
      downloadText(doc, notebookFileName(history.present.title), serializeNotebook(history.present)),
    );
    const fresh = button(doc, "nb-new", "New", () => load(emptyNotebook(UNTITLED, now())));
    const refresh = button(doc, "nb-refresh", "Re-evaluate all", () => void refreshAll());
    const undoButton = button(doc, "nb-undo", "Undo", () => step(undo));
    undoButton.title = "Undo (Ctrl+Z)";
    const redoButton = button(doc, "nb-redo", "Redo", () => step(redo));
    redoButton.title = "Redo (Ctrl+Shift+Z)";
    const status = el(doc, "div", "nb-status");
    status.setAttribute("aria-live", "polite");
    const sep = () => el(doc, "span", "nb-toolbar-sep");
    bar.append(title, samples, open, fileInput, save, fresh, sep(), refresh, sep(), undoButton, redoButton, status);
    return { el: bar, title, samples, open, fresh, refresh, undo: undoButton, redo: redoButton, status };
  }

  async function fillSamples(): Promise<void> {
    try {
      const names = await listSamples();
      for (const name of names) toolbar.samples.append(option(doc, name, name));
    } catch (e) {
      toolbar.samples.title = `No samples: ${message(e)}`;
    }
    if (!destroyed) syncControls();
  }

  async function openSample(name: string): Promise<void> {
    try {
      openText(name, await fetchSample(name));
    } catch (e) {
      showProblems({ heading: `Could not open the sample ${name}`, list: [message(e)] });
    }
  }

  async function openFile(file: File): Promise<void> {
    try {
      openText(file.name, await readFileText(file));
    } catch (e) {
      showProblems({ heading: `Could not read ${file.name}`, list: [message(e)] });
    }
  }

  /** Loads a notebook file's text, or lists its problems and keeps the current notebook. */
  function openText(name: string, text: string): void {
    const parsed = parseNotebook(text);
    if (!parsed.ok) {
      showProblems({ heading: `${name} is not a notebook this page can open`, list: parsed.errors });
      return;
    }
    load(parsed.notebook);
    setStatus(`Opened ${name}.`);
  }

  async function refreshAll(): Promise<void> {
    if (refreshing || destroyed) return;
    refreshing = true;
    tally = [];
    syncControls();
    const handles = [...drawn.values()].map((d) => d.handle);
    let done = 0;
    setStatus(`Re-evaluating 0 of ${handles.length} turns…`);
    try {
      await Promise.all(
        handles.map(async (handle) => {
          // A renderer reports trouble as "unavailable"; a throw here is a bug, counted but not fatal.
          await handle.refresh().catch(() => tally?.push("unavailable"));
          setStatus(`Re-evaluating ${++done} of ${handles.length} turns…`);
        }),
      );
      setStatus(tallyText(tally));
    } finally {
      tally = undefined;
      refreshing = false;
      if (!destroyed) syncControls();
    }
  }

  // --- Request box and the request loop -------------------------------------

  function buildRequestBox() {
    const form = el(doc, "form", "nb-ask");
    const input = el(doc, "textarea", "nb-ask-input");
    input.placeholder = "Ask about the model… (Ctrl+Enter sends)";
    input.setAttribute("aria-label", "Request");
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    });
    const sendButton = el(doc, "button", "nb-send", "Send");
    sendButton.type = "submit";
    const stop = button(doc, "nb-stop", "Stop", () => running?.abort(new Error("Stopped by the user.")));
    const row = el(doc, "div", "nb-ask-row");
    if (!ask) row.append(el(doc, "span", "nb-ask-note", NO_ASK_NOTE));
    row.append(stop, sendButton);
    form.append(input, row);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text || !canAsk()) return;
      input.value = "";
      void send(text);
    });
    return { form, input, send: sendButton, stop };
  }

  /**
   * Sends one request and records the result as a turn: appended, or in place
   * of `turnId` when resending. A failed or stopped request still becomes a
   * turn, whose reply carries the error.
   */
  async function send(text: string, turnId?: string): Promise<void> {
    if (!ask || !canAsk()) return;
    const request: Request = { text, atUtc: now() };
    const controller = new AbortController();
    const loadsAtStart = loads;
    running = controller;
    const progress = startProgress(text, turnId);
    render();
    const events: AskEvent[] = [];
    try {
      await ask.ask(text, continuationOf(history.present, turnId), (event) => {
        events.push(event);
        progress.event(event);
      }, controller.signal);
    } catch (e) {
      events.push({ type: "error", message: controller.signal.aborted ? message(controller.signal.reason) : message(e) });
    }
    progress.note("Reading the results…");
    const reply = await replyOrError(events);
    if (running === controller) running = undefined;
    if (destroyed || loads !== loadsAtStart) return;
    live.hidden = true;
    const notebook = history.present;
    const target = turnId !== undefined && notebook.turns.some((t) => t.id === turnId);
    edit(target ? resendTurn(notebook, turnId!, request, reply) : appendTurn(notebook, request, reply));
  }

  async function replyOrError(events: readonly AskEvent[]): Promise<Reply> {
    try {
      return await replyFromAsk(events, options.api);
    } catch (e) {
      const error = message(e);
      return { text: `Error: ${error}`, tools: [], embeds: [], error };
    }
  }

  /** Shows a running request and each event as it arrives. */
  function startProgress(text: string, turnId: string | undefined) {
    const lines = el(doc, "ul");
    const heading = turnId ? `Resending ${turnId}: ${text}` : text;
    live.replaceChildren(el(doc, "div", "nb-live-request", heading), lines);
    live.hidden = false;
    const line = (cls: string, content: string) => lines.append(el(doc, "li", cls, content));
    return {
      event(event: AskEvent) {
        const shown = eventLine(event);
        if (shown) line(shown.cls, shown.text);
      },
      note: (content: string) => line("nb-live-note", content),
    };
  }

  return {
    notebook: () => history.present,
    load,
    refreshAll,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      running?.abort(new Error("The page was closed."));
      doc.removeEventListener("keydown", onKey);
      for (const { handle } of drawn.values()) handle.destroy();
      drawn.clear();
      root.replaceChildren();
    },
  };
}

/** One live line for an event from /api/ask; undefined for events not worth a line. */
function eventLine(event: AskEvent): { cls: string; text: string } | undefined {
  switch (event.type) {
    case "start": {
      const who = [event.model, event.effort].filter(Boolean).join(", ");
      const what = event.continuing && event.analysisId ? `continuing ${event.analysisId}` : "starting";
      return { cls: "nb-live-note", text: `Agent ${who ? `(${who}) ` : ""}${what}` };
    }
    case "tool":
      return {
        cls: event.ok === false ? "nb-live-failed" : "nb-live-ok",
        text: `${event.ok === false ? "✗" : "✓"} ${event.name ?? "tool"}${event.summary ? `: ${event.summary}` : ""}`,
      };
    case "check":
      return event.problem
        ? { cls: "nb-live-failed", text: `Check failed: ${event.problem}` }
        : { cls: "nb-live-note", text: event.verified ? "Graph checked" : "Graph not checked" };
    case "error":
      return { cls: "nb-live-failed", text: event.message ?? "Error" };
    case "done":
      return { cls: "nb-live-note", text: "Agent finished" };
    case "text":
      return undefined;
  }
}

/** "5 current, 1 changed, 0 unavailable", plus embeds with nothing on the host when there are any. */
function tallyText(states: readonly Freshness["state"][]): string {
  const count = (state: Freshness["state"]) => states.filter((s) => s === state).length;
  const recorded = count("snapshot");
  const main = `${count("current")} current, ${count("changed")} changed, ${count("unavailable")} unavailable`;
  return recorded > 0 ? `${main}, ${recorded} with nothing to re-evaluate` : main;
}

/**
 * The registry with every handle's refresh result reported to `record`, so the
 * page can count results without reading the turn view's badges.
 */
function tallying(base: EmbedRegistry, record: (freshness: Freshness) => void): EmbedRegistry {
  const wrap = (render: EmbedRenderer<Embed>): EmbedRenderer<Embed> => (host, embed, ctx) => {
    const handle = render(host, embed, ctx);
    return {
      async refresh() {
        const freshness = await handle.refresh();
        record(freshness);
        return freshness;
      },
      destroy: () => handle.destroy(),
    };
  };
  // Each kind keeps its own renderer; the pairing is asserted once, as in registry.ts.
  return Object.fromEntries(
    EMBED_KINDS.map((kind) => [kind, wrap(base[kind] as EmbedRenderer<Embed>)]),
  ) as unknown as EmbedRegistry;
}

function isTextField(target: EventTarget | null): boolean {
  const node = target as Partial<HTMLElement> | null;
  return node?.isContentEditable === true || ["INPUT", "TEXTAREA", "SELECT"].includes(node?.tagName ?? "");
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function option(doc: Document, label: string, value: string): HTMLOptionElement {
  const o = el(doc, "option", undefined, label);
  o.value = value;
  return o;
}

function button(doc: Document, className: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = el(doc, "button", className, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}
