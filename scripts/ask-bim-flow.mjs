// Asks the studio host for graphs from the command line, without the web page:
//   node scripts/ask-bim-flow.mjs "How many rooms are on each storey?" ["another request" ...]
//   node scripts/ask-bim-flow.mjs --file requests.txt      (one request per line)
//   node scripts/ask-bim-flow.mjs --continue ask-rooms-storey "now sort by name"
// Streams each tool call as the agent makes it, then prints the first rows of
// the answer table and a one-line verdict per request. BOF_STUDIO_URL selects
// the host (default http://127.0.0.1:5218); BOF_ASK_ROWS the rows to show.
import { readFile } from 'node:fs/promises';

const base = (process.env.BOF_STUDIO_URL ?? 'http://127.0.0.1:5218').replace(/\/$/, '');
const rowsToShow = Number(process.env.BOF_ASK_ROWS ?? 8);
const args = process.argv.slice(2);
let continueId = null;
if (args[0] === '--continue') { continueId = args[1]; args.splice(0, 2); }
const requests = args[0] === '--file'
  ? (await readFile(args[1], 'utf8')).split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  : args;
if (requests.length === 0) {
  console.error('Usage: node scripts/ask-bim-flow.mjs [--continue <analysisId>] "request" ["request" ...] | --file requests.txt');
  process.exit(2);
}

const info = await fetch(`${base}/api/ask/model`).then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status} from ${base}/api/ask/model; is the studio host running?`)));
if (!info.configured) { console.error(`FAIL: ${info.problem}`); process.exit(1); }
console.log(`Studio at ${base}, model ${info.model}\n`);

function shortArgs(args) {
  if (!args) return '';
  const shown = Object.entries(args).filter(([k]) => k !== 'id')
    .map(([k, v]) => `${k}=${typeof v === 'string' ? JSON.stringify(v) : String(v)}`).join(', ');
  return shown.length > 150 ? shown.slice(0, 150) + '…' : shown;
}

async function* events(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = chunk.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
      if (data) yield JSON.parse(data);
    }
  }
}

async function answerRows(id) {
  const response = await fetch(`${base}/api/analyses/${encodeURIComponent(id)}/results/answer/table?take=${rowsToShow}`);
  if (!response.ok) return { error: `${response.status} ${response.statusText}` };
  return response.json();
}

const verdicts = [];
for (const request of requests) {
  console.log(`━━ ${request}`);
  const started = Date.now();
  const verdict = { request, ok: false, id: null, turns: 0, tools: 0, failedTools: 0, seconds: 0, rows: null, text: '' };
  try {
    const response = await fetch(`${base}/api/ask`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(continueId ? { request, analysisId: continueId } : { request }),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    for await (const event of events(response)) {
      switch (event.type) {
        case 'start': verdict.id = event.analysisId; console.log(`   id ${event.analysisId}`); break;
        case 'tool':
          verdict.tools++;
          if (!event.ok) verdict.failedTools++;
          console.log(`   ${event.ok ? '→' : '✗'} ${event.name}(${shortArgs(event.args)})${event.summary ? `  · ${event.summary}` : ''}`);
          break;
        case 'text': console.log(`   agent: ${event.text}`); break;
        case 'done':
          verdict.turns = event.turns; verdict.text = event.text; verdict.ok = event.built;
          verdict.tokens = `${event.inputTokens} in / ${event.outputTokens} out`;
          console.log(`   done: ${event.text}`);
          break;
        case 'error': verdict.text = `ERROR ${event.message}`; console.log(`   error: ${event.message}`); break;
      }
    }
    if (verdict.id) {
      const table = await answerRows(verdict.id);
      if (table.error) { verdict.rows = null; verdict.ok = false; console.log(`   answer table: ${table.error}`); }
      else {
        verdict.rows = table.totalRows;
        console.log(`   answer: ${table.totalRows} rows · ${table.columns.map(c => c.name).join(' | ')}`);
        for (const row of table.rows) console.log(`     ${row.map(v => v ?? 'NULL').join(' | ')}`);
      }
    }
  } catch (error) {
    verdict.text = `ERROR ${error.message}`;
    console.log(`   error: ${error.message}`);
  }
  verdict.seconds = Math.round((Date.now() - started) / 1000);
  verdicts.push(verdict);
  console.log('');
}

// OK: a graph with rows. ANSWERED: the agent replied without building (a
// question back, or the data is not in this export). FAIL: an error, an empty
// answer table, or a graph that did not evaluate.
const verdictOf = v => (v.ok && v.rows ? 'OK      ' : !v.ok && v.turns > 0 && !v.text.startsWith('ERROR') ? 'ANSWERED' : 'FAIL    ');
console.log('━━ Summary');
for (const v of verdicts)
  console.log(`${verdictOf(v)} ${v.seconds}s ${v.turns} turns ${v.tools} tools (${v.failedTools} failed) ${v.rows ?? '-'} rows ${v.tokens ?? ''} · ${v.id ?? ''} · ${v.request}`);
process.exit(verdicts.every(v => verdictOf(v) !== 'FAIL    ') ? 0 : 1);
