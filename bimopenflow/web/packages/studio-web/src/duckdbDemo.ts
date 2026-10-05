// The DuckDB demo, the analysis context of docs/proposals/demo-contexts.md: the
// shared graph-demo shell (same as 3d.html) over the sample workflows, plus an
// Ask box. The "public" workflows run over bim-open-data's Schependomlaan
// export, which every checkout has; the "snowdon" ones need the private typed
// export and are simply absent when prepare skipped them. Typing a request in
// the Ask box posts it to the studio host's /api/ask, which has an agent build
// the graph through the MCP tools; the transcript streams in below the top bar
// and the new graph opens when it is done.
import { ApiClient } from '@bimopenflow/api-client';
import type { App } from '@bimopenflow/app';
import { createAskTransport, mountHostBanner, watchHost } from '@bimopenflow/client/host';
import { appendAskLine as sharedAppendAskLine, shortArgs, startOnce } from '@bimopenflow/app/entry';
import './duckdbDemo.css';

/** One entry of samples/duckdb-analyses/workflows.json, loaded lazily below. */
interface Workflow {
  id: string;
  title: string;
  /** Which database the graph reads: "public" (Schependomlaan, always present) or "snowdon" (private). */
  database: 'public' | 'snowdon';
}

const START = 'Run `npm run duckdb:host --prefix bimopenflow/web`, then reload this page.';
const STRAP = 'For an analyst with a question: a table and a chart, with the query behind them. '
  + 'The model is Schependomlaan, a ten-apartment block (CC BY 4.0): 205 doors, 100 spaces, 6 storeys.';
const EXAMPLES = [
  'How many rooms are on each storey? Sort by count, largest first.',
  'A room schedule: room name, use, storey and net floor area, sorted by storey then name.',
  'Which door types are used most often? Show the top ten with counts.',
  'How many doors are external, and how many are internal?',
  'Which windows are on the top storey, and what are their types?',
  'For every table in the database, how many rows does it have? Only tables with more than 100 rows, largest first.',
];
const root = document.querySelector<HTMLDivElement>('#duckdb-demo')!;
root.innerHTML = `<div id="duck-error" role="alert" hidden></div><div id="duck-ask-log" hidden></div><div id="duck-editor"></div>`;
const editor = root.querySelector<HTMLElement>('#duck-editor')!;
const error = root.querySelector<HTMLElement>('#duck-error')!;
const log = root.querySelector<HTMLElement>('#duck-ask-log')!;
// Every host call, including the Ask requests, reports into one host status;
// the page-level banner shows it and a reconnect retries the demo start.
const { api, host } = watchHost(fetchFn => new ApiClient({ fetch: fetchFn }));
mountHostBanner(document, host);
let app: App | undefined;
let downloadUrl: string | undefined;
/** The graph the last Ask built; a follow-up continues its conversation. */
let lastAskId: string | undefined;
// Populated once `start` loads the workflow list and the graph editor; until
// then the topbar shows flow ids, which relabel() leaves alone.
let titles = new Map<string, string>();

function fail(message: string) {
  error.hidden = false;
  error.textContent = message;
}

const picker = () => editor.querySelector<HTMLSelectElement>('select[aria-label="Open flow"]');

// The shared topbar lists flow ids; show the workflow titles instead.
function relabel() {
  for (const option of picker()?.options ?? []) {
    const title = titles.get(option.value);
    if (title && option.textContent !== title) option.textContent = title;
  }
}
const observer = new MutationObserver(relabel);
observer.observe(editor, { childList: true, subtree: true });

async function download() {
  const id = picker()?.value;
  if (!id) return;
  try {
    const document = await api.getAnalysis(id);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    downloadUrl = URL.createObjectURL(new Blob([document], { type: 'application/json' }));
    const link = window.document.createElement('a');
    link.href = downloadUrl;
    link.download = id + '.dfg.json';
    link.click();
  } catch (cause) { fail(`Could not download graph: ${String(cause)}`); }
}

// ── Ask ──────────────────────────────────────────────────────────────────────
// The event shape and the transport live in @bimopenflow/client/host; shortArgs and
// the transcript line live in @bimopenflow/app/entry (askClient.ts), shared with the editor's Ask panel
// (askPanel.ts, TKT-84).

/** Bound to this page's log element and its 'duck-ask' classes, so every
 *  existing caller (including the transcript-height test) is unaffected. */
export function appendAskLine(kind: string, text: string): HTMLElement {
  return sharedAppendAskLine(log, kind, text);
}

async function ask(request: string, form: HTMLFormElement, followUp: HTMLInputElement) {
  const controls = form.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button');
  controls.forEach(control => { control.disabled = true; });
  const continuing = followUp.checked && lastAskId ? lastAskId : undefined;
  log.hidden = false;
  if (!continuing) log.replaceChildren();
  appendAskLine('you', `You: ${request}`);
  let analysisId: string | undefined;
  try {
    await createAskTransport(host.fetch).ask(request, continuing, async event => {
      switch (event.type) {
        case 'start':
          analysisId = event.analysisId;
          lastAskId = event.analysisId;
          appendAskLine('note', `${continuing ? 'Continuing' : 'Building'} "${event.analysisId}" with ${event.model}…`);
          break;
        case 'tool':
          appendAskLine(event.ok ? 'tool' : 'bad', `→ ${event.name}(${shortArgs(event.args)})${event.summary ? `  · ${event.summary}` : ''}`);
          break;
        case 'text':
          appendAskLine('agent', `Agent: ${event.text}`);
          break;
        case 'check':
          appendAskLine('bad', `Check: ${event.summary}`);
          break;
        case 'done': {
          const verdict = event.built ? (event.verified ? 'Done, checked' : `Done, unverified (${event.problem ?? 'see above'})`) : 'Answered';
          appendAskLine(event.built && !event.verified ? 'bad' : 'done', `${verdict} in ${event.turns} turns (${event.inputTokens} in, ${event.outputTokens} out): ${event.text}`);
          if (event.built && event.analysisId && app) {
            await app.refreshAnalyses();
            await app.openAnalysis(event.analysisId);
          }
          break;
        }
        case 'error':
          appendAskLine('bad', `Error: ${event.message}`);
          break;
      }
    });
  } catch (cause) {
    appendAskLine('bad', `Error: ${String(cause)}${analysisId ? ` (graph ${analysisId} may be partial)` : ''}`);
  } finally {
    controls.forEach(control => { control.disabled = false; });
    followUp.disabled = !lastAskId;
    followUp.parentElement!.title = lastAskId ? `Continue the conversation about ${lastAskId}` : 'Ask something first';
  }
}

function mountAsk() {
  const form = document.createElement('form');
  form.className = 'duck-ask';
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Describe the graph you want…';
  input.setAttribute('list', 'duck-ask-examples');
  input.setAttribute('aria-label', 'Ask for a graph');
  input.autocomplete = 'off';
  const examples = document.createElement('datalist');
  examples.id = 'duck-ask-examples';
  for (const example of EXAMPLES) {
    const option = document.createElement('option');
    option.value = example;
    examples.append(option);
  }
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = 'Ask';
  button.title = 'Have an agent build this graph through the MCP tools';
  const followUpLabel = document.createElement('label');
  followUpLabel.className = 'duck-ask-followup';
  followUpLabel.title = 'Ask something first';
  const followUp = document.createElement('input');
  followUp.type = 'checkbox';
  followUp.disabled = true;
  followUp.setAttribute('aria-label', 'Follow up on the last graph');
  followUpLabel.append(followUp, ' follow-up');
  form.append(input, examples, button, followUpLabel);
  // With the suggestion list open, Enter would only close it; submit outright.
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const request = input.value.trim();
    if (request) void ask(request, form, followUp);
  });
  editor.querySelector('.bof-app-conn')!.before(form);
  void host.fetch('/api/ask/model').then(async response => {
    if (!response.ok) throw new Error('This host has no /api/ask; start the studio host (npm run duckdb:host).');
    const info = await response.json() as { model: string; provider?: string; configured: boolean; problem: string | null };
    input.title = `Model: ${info.model}${info.provider ? ` (${info.provider})` : ''}`;
    if (!info.configured) { log.hidden = false; appendAskLine('bad', info.problem ?? 'No model key is configured.'); }
  }).catch(cause => { log.hidden = false; appendAskLine('bad', `Ask is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`); });
}

async function start() {
  try {
    const available = await api.listAnalyses();
    // The graph editor (app.js) and the sample workflow list are the heavy
    // part of this page; loading them only once the host answers keeps an
    // offline load (and a test that stubs a failing fetch) from paying for
    // code neither one will use.
    const [{ createApp }, { default: workflows }] = await Promise.all([
      import('@bimopenflow/app'),
      import('../../../../../samples/duckdb-analyses/workflows.json') as Promise<{ default: Workflow[] }>,
    ]);
    // The public graphs must be in the store; the Snowdon ones are absent when prepare
    // found no private export, and the picker then simply does not list them.
    const seeded = workflows.filter(workflow => available.some(item => item.id === workflow.id));
    const publicFlows = workflows.filter(workflow => workflow.database === 'public');
    if (publicFlows.some(workflow => !seeded.includes(workflow)))
      throw new Error('Demo workflows are missing.');
    titles = new Map(seeded.map(workflow => [workflow.id, workflow.title]));
    app = createApp(editor, api, { graphDemo: true, tableOnly: true, autoLayout: true, initialAnalysis: publicFlows[0]!.id, heading: 'BimOpenFlow · Analysis', host });
    error.hidden = true;
    const strap = document.createElement('p');
    strap.className = 'duck-strap';
    strap.textContent = STRAP;
    editor.before(strap);
    mountAsk();
    const button = document.createElement('button');
    button.textContent = 'Download';
    button.title = 'Download the current graph as a .dfg.json document';
    button.addEventListener('click', () => void download());
    editor.querySelector('.bof-app-conn')!.before(button);
  } catch (cause) {
    // While the host is unreachable the banner says so; the start is retried on reconnect.
    if (host.get().status === 'connected') fail(`Could not open the DuckDB demo. ${String(cause)} ${START}`);
  }
}
// The page load and the first "connected" report both trigger a start; one attempt at a time.
const startDemo = startOnce(start, () => app !== undefined);
void startDemo();
host.subscribe(state => {
  if (state.status === 'connected') void startDemo();
});
window.addEventListener('pagehide', () => {
  observer.disconnect();
  app?.dispose();
  host.dispose();
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
}, { once: true });
