// Entry point of notebook.html: connects to the host, decides whether the
// request box can ask, loads ?notebook=<sample> or starts an empty notebook,
// and mounts the page on #notebook.

import { ApiClient } from "@bimopenflow/api-client";
// By path: see the plan's Debt section (deep imports from @bimopenflow/app).
import { watchHost } from "@bimopenflow/app/src/hostStatus";
import { mountHostBanner } from "@bimopenflow/app/src/topbar";
import { createAskTransport, type AskTransport } from "../ask/events";
import type { Notebook } from "../document/format";
import { parseNotebook } from "../document/io";
import { fetchSample } from "./files";
import { mountNotebook, renderProblems } from "./notebookView";

/** GET /api/ask/model's answer, the part this page reads. */
interface AskModelInfo {
  readonly configured?: boolean;
  readonly problem?: string | null;
}

/** The ask transport when the host serves /api/ask with a configured model; undefined otherwise. */
async function askIfConfigured(fetchFn: typeof fetch): Promise<AskTransport | undefined> {
  try {
    const response = await fetchFn("/api/ask/model");
    if (!response.ok) return undefined;
    const info = (await response.json()) as AskModelInfo;
    if (info.configured === true) return createAskTransport(fetchFn);
    console.info(`Ask is off: ${info.problem ?? "the host has no model configured."}`);
  } catch (e) {
    console.info(`Ask is off: ${e instanceof Error ? e.message : String(e)}`);
  }
  return undefined;
}

/** The ?notebook=<name> sample, or the errors that kept it from opening. */
interface Opened {
  readonly notebook?: Notebook;
  readonly errors?: readonly string[];
}

async function startingNotebook(name: string): Promise<Opened> {
  try {
    const parsed = parseNotebook(await fetchSample(name));
    return parsed.ok ? { notebook: parsed.notebook } : { errors: parsed.errors };
  } catch (e) {
    return { errors: [e instanceof Error ? e.message : String(e)] };
  }
}

async function start(): Promise<void> {
  // Same-origin API: the dev server proxies /api to the host (vite.config.ts).
  const { api, host } = watchHost((fetchFn) => new ApiClient({ baseUrl: "", fetch: fetchFn }));
  mountHostBanner(document, host);
  const sample = new URLSearchParams(location.search).get("notebook");
  const [ask, opened] = await Promise.all([
    askIfConfigured(host.fetch),
    sample ? startingNotebook(sample) : Promise.resolve<Opened>({}),
  ]);
  const root = document.getElementById("notebook")!;
  mountNotebook(root, {
    api,
    ask,
    initial: opened.notebook,
  });
  if (opened.errors) root.prepend(renderProblems(document, `Could not open the sample ${sample}`, opened.errors));
}

void start();
