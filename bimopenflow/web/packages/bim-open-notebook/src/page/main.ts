// Entry point of notebook.html: connects to the host, decides whether the
// request box can ask, loads ?notebook=<sample> or starts an empty notebook,
// and mounts the page on #notebook. The static site (site.ts, HOSTLESS) has no
// host: it skips the connection and its banner and says so in the page.

import { ApiClient } from "@bimopenflow/api-client";
import { createAskTransport, mountHostBanner, watchHost, type AskTransport } from "@bimopenflow/client/host";
import type { Notebook } from "../document/format";
import { parseNotebook } from "../document/io";
import { fetchSample } from "./files";
import { defaultRenderers, withRenderers } from "../embeds/registry";
import { mountNotebook, renderProblems } from "./notebookView";
import { HOSTLESS, HOSTLESS_NOTE } from "./site";
import { renderView3d } from "./view3dEmbed";

/** The API of a page with no host: every call fails at once with a plain reason, and nothing is fetched. */
function hostlessApi(): ApiClient {
  const fetchFn = (async () => {
    throw new Error("This copy has no host.");
  }) as typeof fetch;
  return new ApiClient({ baseUrl: "", fetch: fetchFn });
}

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

/** Watches the host behind /api, with the banner that says when it is down. */
function connect(): { readonly api: ApiClient; readonly fetch: typeof fetch } {
  // Same-origin API: the dev server proxies /api to the host (vite.config.ts).
  const { api, host } = watchHost((fetchFn) => new ApiClient({ baseUrl: "", fetch: fetchFn }));
  mountHostBanner(document, host);
  return { api, fetch: host.fetch };
}

async function start(): Promise<void> {
  const sample = new URLSearchParams(location.search).get("notebook");
  const connected = HOSTLESS ? undefined : connect();
  const [ask, opened] = await Promise.all([
    connected ? askIfConfigured(connected.fetch) : Promise.resolve(undefined),
    sample ? startingNotebook(sample) : Promise.resolve<Opened>({}),
  ]);
  const root = document.getElementById("notebook")!;
  mountNotebook(root, {
    api: connected?.api ?? hostlessApi(),
    ask,
    hostless: HOSTLESS ? HOSTLESS_NOTE : undefined,
    initial: opened.notebook,
    renderers: withRenderers(defaultRenderers, { view3d: renderView3d }),
  });
  if (opened.errors) root.prepend(renderProblems(document, `Could not open the sample ${sample}`, opened.errors));
}

void start();
