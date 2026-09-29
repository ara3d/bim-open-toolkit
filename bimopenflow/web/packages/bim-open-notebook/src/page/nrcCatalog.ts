// What the NRC landing page (nrc.html) lists: the sample notebooks in
// samples/notebooks and the graphs in samples/nrc-analyses. The graph list is
// read from that folder's README table, so the README stays the one place a
// graph's one-line description lives. Pure functions; nrc.ts fetches.

import type { Notebook } from "../document/format";
import { parseNotebook } from "../document/io";

/** One sample notebook as the landing page shows it. */
export interface NotebookEntry {
  /** File name without `.notebook.json`, the value of `?notebook=`. */
  readonly name: string;
  readonly title: string;
  readonly profile?: string;
  readonly turns: number;
  /** The first request, as a taste of the session. */
  readonly firstRequest?: string;
  /** True for a session an agent replayed rather than a recorded one (`host.note`). */
  readonly reconstructed: boolean;
}

/** One row of the README table in samples/nrc-analyses. */
export interface GraphEntry {
  /** The analysis id, the value of `?analysis=`. */
  readonly id: string;
  /** The "Answers" column, code spans dropped. */
  readonly answers: string;
  /** The "Runs in profile" column, e.g. "tables, bim" or "bim only (view3d.color)". */
  readonly profiles: string;
  /** True when the graph ends in a 3D view, so the 3D page is the better link. */
  readonly viewer3d: boolean;
}

/** The three recorded NRC notebooks lead, in reading order; the reconstructed sessions follow by name. */
const LEAD_NOTEBOOKS = ["nrc-eight-questions", "nrc-test-kit", "nrc-door-check"];

const notebookName = (file: string): string => file.replace(/\.notebook\.json$/, "");

/** A notebook file as a list entry, or the parse errors. */
export function notebookEntry(file: string, text: string): NotebookEntry | { readonly errors: readonly string[] } {
  const parsed = parseNotebook(text);
  if (!parsed.ok) return { errors: parsed.errors };
  return entryOf(notebookName(file), parsed.notebook);
}

function entryOf(name: string, notebook: Notebook): NotebookEntry {
  return {
    name,
    title: notebook.title,
    profile: notebook.host?.profile,
    turns: notebook.turns.length,
    firstRequest: notebook.turns[0]?.request.text,
    reconstructed: /reconstructed/i.test(notebook.host?.note ?? ""),
  };
}

/** Entries in reading order: LEAD_NOTEBOOKS first, then the rest in the order given. */
export function orderNotebooks(entries: readonly NotebookEntry[]): NotebookEntry[] {
  const rank = (e: NotebookEntry): number => {
    const i = LEAD_NOTEBOOKS.indexOf(e.name);
    return i < 0 ? LEAD_NOTEBOOKS.length : i;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

/** Splits one markdown table row into trimmed cells. */
const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

const dropCodeSpans = (cell: string): string => cell.replace(/`/g, "");

/**
 * The rows of the README's first table whose header cell is "Graph": one entry
 * per graph, in the README's order. Empty when there is no such table.
 */
export function parseGraphTable(readme: string): GraphEntry[] {
  const lines = readme.split("\n");
  const header = lines.findIndex((l) => /^\|\s*Graph\s*\|/.test(l));
  if (header < 0) return [];
  const rows: GraphEntry[] = [];
  for (let i = header + 2; i < lines.length && lines[i]!.startsWith("|"); i++) {
    const [id = "", answers = "", profiles = ""] = cells(lines[i]!);
    rows.push({
      id: dropCodeSpans(id),
      answers: dropCodeSpans(answers),
      profiles: dropCodeSpans(profiles),
      viewer3d: /view3d\./.test(profiles),
    });
  }
  return rows;
}
