import { adaptDoorSchedule, type DoorSchedule, type NumericFact } from '../../src/building-model.js';
import { composeAppearance, objectKey, serializeSceneDocument, parseSceneDocument, restoreSceneDocument, type SceneDocument } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const doorsDemo: FeatureDemo = {
  id: 'doors', title: 'Source-backed door schedule',
  description: 'Review actual BuildingModel nominal-width coverage and exceptions, linked to exact Snowdon source objects. Missing clear width is explicit; no compliance inference is made.',
  source: 'examples/features/doors.ts', tests: 'test/building-model.test.ts',
  mount(context) {
    const controller = new AbortController();
    let schedule: DoorSchedule | undefined;
    const alert = document.createElement('p'); alert.setAttribute('role', 'alert');
    const summary = document.createElement('p');
    const filter = document.createElement('input'); filter.type = 'search'; filter.placeholder = 'Filter door name'; filter.setAttribute('aria-label', 'Filter door schedule');
    const sort = document.createElement('select'); sort.setAttribute('aria-label', 'Sort door schedule');
    for (const value of ['Name', 'Nominal width']) { const option = document.createElement('option'); option.value = value; option.textContent = value; sort.append(option); }
    const table = document.createElement('div'), details = document.createElement('pre'); details.style.whiteSpace = 'pre-wrap';
    const saved = document.createElement('textarea'); saved.rows = 4; saved.setAttribute('aria-label', 'Saved door selection JSON');
    context.panel.append(alert, summary, filter, sort, table, details, saved);
    const display = (fact: NumericFact) => fact.state === 'known' ? `${fact.value.toFixed(3)} m` : `${fact.reason}: ${fact.explanation}`;
    const refreshTable = () => {
      if (!schedule) return;
      const selected = new Set(context.selection.snapshot().map(objectKey));
      const rows = schedule.rows.filter(row => row.name.toLowerCase().includes(filter.value.toLowerCase()));
      rows.sort((a, b) => sort.value === 'Name' ? a.name.localeCompare(b.name) : (a.nominalWidth.state === 'known' ? a.nominalWidth.value : Infinity) - (b.nominalWidth.state === 'known' ? b.nominalWidth.value : Infinity) || a.name.localeCompare(b.name));
      table.replaceChildren();
      for (const row of rows) {
        const button = document.createElement('button');
        button.textContent = `${row.name} · nominal ${display(row.nominalWidth)} · clear ${row.clearWidth.state === 'known' ? display(row.clearWidth) : row.clearWidth.reason}`;
        button.setAttribute('aria-pressed', String(row.ref ? selected.has(objectKey(row.ref)) : false));
        button.onclick = () => {
          details.textContent = `Nominal width: ${display(row.nominalWidth)}\nClear width: ${display(row.clearWidth)}\nSnapshot: ${schedule!.snapshotId}\nObject: ${row.id}\n${row.evidenceIds.map(id => { const evidence = schedule!.evidence.find(item => item.id === id); return evidence ? `${id}\n${evidence.method}: ${evidence.explanation}\n${evidence.externalReferences.map(link => `${link.authority} / ${link.title} / ${link.version}: ${link.locator}`).join('\n')}` : `${id}: unavailable`; }).join('\n')}`;
          if (row.ref) context.selection.replace([row.ref]); else context.status('This row has unresolved geometry identity; its facts remain inspectable.');
        };
        table.append(button);
      }
      const known = schedule.coverage.nominalWidth;
      summary.textContent = `${rows.length}/${schedule.rows.length} doors · nominal widths ${known.known} known, ${known.conflicting} conflicting, ${known.missing} missing · clear widths ${schedule.coverage.clearWidth.known} known. Orange marks unavailable nominal widths; green marks selection.`;
    };
    const refresh = () => {
      if (!schedule) return;
      refreshTable();
      const rules = schedule.rows.filter(row => row.ref).map(row => ({ id: row.id, members: [row.ref!], style: { color: row.nominalWidth.state === 'known' ? [0.15, 0.5, 0.85] as const : [1, 0.4, 0.05] as const } }));
      context.update(composeAppearance(context.base, { rules, selection: context.selection.snapshot(), selectionColor: [0.1, 1, 0.35] }));
    };
    filter.oninput = refreshTable; sort.onchange = refreshTable;
    context.button('Select nominal-width exceptions', () => { if (schedule) context.selection.replace(schedule.rows.filter(row => row.ref && row.nominalWidth.state === 'missing').map(row => row.ref!)); });
    context.button('Save selected door refs', () => {
      if (!schedule) return;
      const document: SceneDocument = { schemaVersion: 1, models: [context.model.ref], sets: [{ id: 'doors', name: 'Door review selection', members: context.selection.snapshot() }], layers: [], views: [] };
      saved.value = serializeSceneDocument(document); context.status('Selection saved with the exact loaded source revision.');
    });
    context.button('Restore selected door refs', async () => {
      const parsed = parseSceneDocument(saved.value);
      if (!parsed.ok) { alert.textContent = parsed.diagnostics.map(item => item.message).join('; '); return; }
      const restored = await restoreSceneDocument(parsed.value, async reference => reference.id === context.model.ref.id ? context.model : undefined, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!restored.ok || restored.diagnostics.length) { alert.textContent = restored.diagnostics.map(item => item.message).join('; '); return; }
      context.selection.replace(parsed.value.sets[0]?.members ?? []); alert.textContent = '';
    });
    context.button('Reset door review', () => context.reset());
    const unsubscribe = context.selection.subscribe(refresh);
    context.status('Loading source-backed door projection and checking its fingerprint…');
    void (async () => {
      try {
        const response = await fetch('/__fixtures/snowdon-workflows.json', { signal: controller.signal });
        if (!response.ok) throw new Error(`Workflow endpoint failed: HTTP ${response.status}`);
        if (!response.headers.get('content-type')?.includes('json')) throw new Error('Workflow endpoint did not return JSON');
        const result = adaptDoorSchedule(await response.json(), { modelId: context.model.ref.id, contentFingerprint: context.model.ref.revision, availableObjects: context.base.map(object => object.ref) });
        if (controller.signal.aborted) return;
        if (!result.ok) throw new Error(result.diagnostics.map(item => item.message).join('; '));
        schedule = result.value; alert.textContent = result.diagnostics.map(item => item.message).join('; '); refresh();
        context.status('Source-backed door facts loaded. Coverage describes supplied observations, not compliance.');
      } catch (error) { if (!controller.signal.aborted) { alert.textContent = error instanceof Error ? error.message : String(error); context.status(`Door review unavailable: ${alert.textContent}`); } }
    })();
    return () => { controller.abort(); unsubscribe(); filter.oninput = null; sort.onchange = null; table.replaceChildren(); };
  },
};
