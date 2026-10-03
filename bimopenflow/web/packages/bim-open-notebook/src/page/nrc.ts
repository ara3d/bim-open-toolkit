// Entry point of nrc.html, the landing page of the NRC work: lists the sample
// notebooks (samples/notebooks) and the NRC graphs (samples/nrc-analyses),
// each linked to the page that opens it. The lists come from the dev server's
// sample routes (vite.config.ts); the host, when reachable, says which graphs
// its store holds.

import { ApiClient } from "@bimopenflow/api-client";
import { mountHostBanner, watchHost } from "@bimopenflow/client/host";
import { editorUrl, viewer3dUrl } from "./editorLinks";
import { fetchSample, listSamples } from "./files";
import { notebookEntry, orderNotebooks, parseGraphTable, type GraphEntry, type NotebookEntry } from "./nrcCatalog";
import { renderNrcPage } from "./nrcView";
import { ensureNotebookStyles } from "./styles";

/** Where the dev server serves the README of samples/nrc-analyses (vite.config.ts). */
export const GRAPHS_ROUTE = "/__nrc/graphs.md";

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

async function loadNotebooks(problems: string[]): Promise<NotebookEntry[]> {
  try {
    const names = await listSamples();
    const entries = await Promise.all(
      names.map(async (file) => {
        const entry = notebookEntry(file, await fetchSample(file));
        if ("errors" in entry) {
          problems.push(`${file}: ${entry.errors.join("; ")}`);
          return undefined;
        }
        return entry;
      }),
    );
    return orderNotebooks(entries.filter((e): e is NotebookEntry => e !== undefined));
  } catch (e) {
    problems.push(`The sample notebooks could not be listed: ${message(e)}`);
    return [];
  }
}

async function loadGraphs(problems: string[]): Promise<GraphEntry[]> {
  try {
    const response = await fetch(GRAPHS_ROUTE);
    if (!response.ok) throw new Error(`GET ${GRAPHS_ROUTE} -> ${response.status}`);
    return parseGraphTable(await response.text());
  } catch (e) {
    problems.push(`The graph list could not be read: ${message(e)}`);
    return [];
  }
}

/** The ids in the host's store, or undefined when the host does not answer. */
async function loadSeeded(api: ApiClient): Promise<Set<string> | undefined> {
  try {
    return new Set((await api.listAnalyses()).map((a) => a.id));
  } catch {
    return undefined;
  }
}

async function start(): Promise<void> {
  // Same-origin API: the dev server proxies /api to the host (vite.config.ts).
  const { api, host } = watchHost((fetchFn) => new ApiClient({ baseUrl: "", fetch: fetchFn }));
  mountHostBanner(document, host);
  ensureNotebookStyles(document);
  const problems: string[] = [];
  const [notebooks, graphs, seeded] = await Promise.all([loadNotebooks(problems), loadGraphs(problems), loadSeeded(api)]);
  renderNrcPage(
    document.getElementById("nrc")!,
    { notebooks, graphs, seeded, problems },
    { notebook: (name) => `notebook.html?notebook=${encodeURIComponent(name)}`, editor: editorUrl, viewer3d: viewer3dUrl },
  );
}

void start();
