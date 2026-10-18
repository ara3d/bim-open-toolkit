// Entry point of nrc.html, the landing page of the NRC work: lists the sample
// notebooks (samples/notebooks) and the NRC graphs (samples/nrc-analyses),
// each linked to the page that opens it. The lists come from the dev server's
// sample routes (vite.config.ts); the host, when reachable, says which graphs
// its store holds. The static build (vite.pages.config.ts) has no host: it
// reads the same lists from files, says what it leaves out and how to run a
// host, and links each graph to the notebooks that show it.

import { ApiClient } from "@bimopenflow/api-client";
import { mountHostBanner, watchHost } from "@bimopenflow/client/host";
import {
  editorUrl,
  ensureNotebookStyles,
  fetchSample,
  listSamples,
  notebookEntry,
  orderNotebooks,
  parseNotebook,
  viewer3dUrl,
  type NotebookEntry,
} from "@bimopenflow/bim-open-notebook";
import { NRC_LEAD, analysesShownBy, parseGraphTable, type GraphEntry } from "./nrcCatalog";
import { renderNrcPage, type StaticSiteInfo } from "./nrcView";

/** True in the static build (`vite build --mode pages`); Vite replaces MODE at build time. */
const STATIC_SITE = import.meta.env.MODE === "pages";

/** Where the README of samples/nrc-analyses is served: by the dev server (vite.config.ts), or as a file beside nrc.html. */
export const GRAPHS_ROUTE = STATIC_SITE ? "graphs.md" : "/__nrc/graphs.md";

/** The one notebook the static site leaves out, and why. */
const OMITTED =
  "One notebook is left out of this copy: s10-snowdon works on the Snowdon Towers model, which is private " +
  "(Autodesk, CC BY-NC-SA 3.0, not redistributed with the toolkit). Its transcript is in the repository's samples/notebooks.";

/** The commands for a local host; the handover notebook (s13-handover) gives the same. */
const HOST_COMMANDS = [
  "node deps.mjs",
  "node scripts/start-bim-flow.mjs",
  "npm ci --prefix bimopenflow/web && BOF_HOST=http://127.0.0.1:5214 npm run notebook --prefix bimopenflow/web",
];

const STATIC_INFO: StaticSiteInfo = { omitted: OMITTED, commands: HOST_COMMANDS };

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** The notebooks in landing-page order, and for each analysis id the notebooks that show it. */
interface Notebooks {
  readonly entries: NotebookEntry[];
  readonly shownIn: Map<string, NotebookEntry[]>;
}

async function loadNotebooks(problems: string[]): Promise<Notebooks> {
  const shownIn = new Map<string, NotebookEntry[]>();
  try {
    const names = await listSamples();
    const entries = await Promise.all(
      names.map(async (file) => {
        const text = await fetchSample(file);
        const entry = notebookEntry(file, text);
        if ("errors" in entry) {
          problems.push(`${file}: ${entry.errors.join("; ")}`);
          return undefined;
        }
        const parsed = parseNotebook(text);
        if (parsed.ok) for (const id of analysesShownBy(parsed.notebook)) shownIn.set(id, [...(shownIn.get(id) ?? []), entry]);
        return entry;
      }),
    );
    return { entries: orderNotebooks(entries.filter((e): e is NotebookEntry => e !== undefined), NRC_LEAD), shownIn };
  } catch (e) {
    problems.push(`The sample notebooks could not be listed: ${message(e)}`);
    return { entries: [], shownIn };
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
  ensureNotebookStyles(document);
  const problems: string[] = [];
  const root = document.getElementById("nrc")!;
  const notebook = (name: string) => `notebook.html?notebook=${encodeURIComponent(name)}`;
  if (STATIC_SITE) {
    const [loaded, graphs] = await Promise.all([loadNotebooks(problems), loadGraphs(problems)]);
    renderNrcPage(root, { notebooks: loaded.entries, graphs, problems, staticSite: STATIC_INFO, shownIn: loaded.shownIn }, { notebook });
    return;
  }
  // Same-origin API: the dev server proxies /api to the host (vite.config.ts).
  const { api, host } = watchHost((fetchFn) => new ApiClient({ baseUrl: "", fetch: fetchFn }));
  mountHostBanner(document, host);
  const [loaded, graphs, seeded] = await Promise.all([loadNotebooks(problems), loadGraphs(problems), loadSeeded(api)]);
  renderNrcPage(root, { notebooks: loaded.entries, graphs, seeded, problems }, { notebook, editor: editorUrl, viewer3d: viewer3dUrl });
}

void start();
