import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { adaptDoorSchedule, type DoorSchedule, type NumericFact } from '../../src/building-model.js';
import { SceneStorage } from '../../src/storage.js';
import { restoreSceneDocument } from '../../src/persistence.js';
import { objectKey, type SceneDocument } from '../../src/contracts.js';
import type { DemoContext } from '../gallery/contracts.js';
import { filterDoorRows, selectedDoorKeys, type DoorSort, type ReviewController } from './controller.js';

const widthText = (fact: NumericFact) => fact.state === 'known' ? `${fact.value.toFixed(3)} m` : `${fact.reason} — ${fact.explanation}`;
export function ReviewApp({ context, controller }: { readonly context: DemoContext; readonly controller: ReviewController }) {
  const selected = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [schedule, setSchedule] = useState<DoorSchedule>();
  const [query, setQuery] = useState(''), [sort, setSort] = useState<DoorSort>('name'), [coverage, setCoverage] = useState(true);
  const [focused, setFocused] = useState<string>(), [error, setError] = useState(''), [message, setMessage] = useState('Loading actual BuildingModel facts…');
  const [saveName, setSaveName] = useState('react-door-selection');
  const lifetime = useRef<AbortController>();
  useEffect(() => {
    const abort = new AbortController(); lifetime.current = abort;
    void (async () => {
      try {
        const response = await fetch('/__fixtures/snowdon-workflows.json', { signal: abort.signal });
        if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error(`Workflow endpoint unavailable: HTTP ${response.status}`);
        const result = adaptDoorSchedule(await response.json(), { modelId: context.model.ref.id, contentFingerprint: context.model.ref.revision, availableObjects: context.base.map(object => object.ref) });
        if (abort.signal.aborted) return;
        if (!result.ok) throw new Error(result.diagnostics.map(item => item.message).join('; '));
        controller.setSchedule(result.value); setSchedule(result.value);
        setError(result.diagnostics.map(item => item.message).join('; ')); setMessage('Source-backed facts; coverage is not a compliance decision.');
      } catch (failure) { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : String(failure)); }
    })();
    return () => abort.abort();
  }, [context, controller]);
  const rows = useMemo(() => schedule ? filterDoorRows(schedule.rows, query, sort) : [], [schedule, query, sort]);
  const selectedKeys = useMemo(() => selectedDoorKeys(selected), [selected]);
  const row = schedule?.rows.find(row => row.ref && selectedKeys.has(objectKey(row.ref))) ?? schedule?.rows.find(row => row.id === focused);
  const storage = () => new SceneStorage(window.localStorage, 'bim-open-toolkit:react-review');
  const save = () => {
    try {
      const document: SceneDocument = { schemaVersion: 1, models: [context.model.ref], sets: [{ id: 'selected', name: 'Door review', members: selected }], layers: [], views: [] };
      const result = storage().save(saveName, document);
      if (!result.ok) throw new Error(result.diagnostics.map(item => item.message).join('; '));
      setError(''); setMessage(`Saved ${selected.length} selected references as ${saveName}. Use a new name to retain another selection.`);
    } catch (failure) { setError(String(failure)); }
  };
  const restore = async () => {
    try {
      const loaded = storage().load(saveName);
      if (!loaded.ok) throw new Error(loaded.diagnostics.map(item => item.message).join('; '));
      const signal = lifetime.current?.signal;
      if (!signal || signal.aborted) return;
      const restored = await restoreSceneDocument(loaded.value, async ref => ref.id === context.model.ref.id ? context.model : undefined, { signal });
      if (signal.aborted) return;
      if (!restored.ok || restored.diagnostics.length) throw new Error(restored.diagnostics.map(item => item.message).join('; '));
      context.selection.replace(loaded.value.sets[0]?.members ?? []); setError(''); setMessage('Saved selection restored against the loaded source revision.');
    } catch (failure) { if (!lifetime.current?.signal.aborted) setError(String(failure)); }
  };
  return <section aria-label="React BuildingModel review">
    <p role="status">{message}</p>{error && <p role="alert" style={{ color: '#ffb5b5' }}>{error}</p>}
    <p>{selected.length} selected · {rows.length}/{schedule?.rows.length ?? 0} doors</p>
    {schedule && <p>Nominal width: {schedule.coverage.nominalWidth.known} known / {schedule.coverage.nominalWidth.conflicting} conflicting / {schedule.coverage.nominalWidth.missing} missing. Clear width: {schedule.coverage.clearWidth.known} known.</p>}
    <label>Filter doors<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    <label>Sort<select value={sort} onChange={event => setSort(event.target.value as DoorSort)}><option value="name">Name</option><option value="width">Nominal width</option></select></label>
    <label><input type="checkbox" checked={coverage} onChange={event => { setCoverage(event.target.checked); controller.setCoverage(event.target.checked); }} />Color nominal-width coverage</label>
    <button onClick={() => controller.clear()}>Clear selection</button>
    <div role="group" aria-label="Door schedule" style={{ maxHeight: '30vh', overflow: 'auto' }}>
      {rows.map(item => <button key={item.id} aria-pressed={item.ref ? selectedKeys.has(objectKey(item.ref)) : false} onClick={event => { setFocused(item.id); if (item.ref) controller.select(item.ref, event.ctrlKey || event.metaKey); else controller.clear(); }}>
        {item.name} · {widthText(item.nominalWidth)}{!item.ref ? ' · unresolved geometry identity' : ''}
      </button>)}
    </div>
    {row && <details open><summary>Selected door evidence</summary><p>Nominal: {widthText(row.nominalWidth)}<br />Clear: {widthText(row.clearWidth)}</p><p style={{ overflowWrap: 'anywhere' }}>Snapshot {schedule!.snapshotId}<br />Object {row.id}</p>{row.evidenceIds.map(id => { const evidence = schedule!.evidence.find(item => item.id === id); return <p key={id} style={{ overflowWrap: 'anywhere' }}>{evidence ? `${evidence.method}: ${evidence.explanation}` : `${id}: unavailable`}</p>; })}</details>}
    <label>Saved selection name<input value={saveName} onChange={event => setSaveName(event.target.value)} /></label>
    <button onClick={save}>Save selection as new</button><button onClick={() => { void restore(); }}>Restore selection</button>
    <p>React owns this table and application state. Camera movement does not subscribe to React updates. Second-view controls are deferred to a reusable comparison host.</p>
  </section>;
}
