import { composeAppearance, objectKey } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const selectionDemo: FeatureDemo = {
  id: 'selection', title: 'Selection and linked table',
  description: 'Pick Snowdon objects or select rows. Filter the table and isolate the current selection.',
  source: 'examples/features/selection.ts', tests: 'test/selection.test.ts · test/identity.test.ts · test/render.test.ts',
  mount(context) {
    let isolated = false;
    const filter = document.createElement('input');
    filter.type = 'search'; filter.placeholder = 'Filter name or object ID'; filter.setAttribute('aria-label', 'Filter objects');
    const count = document.createElement('p');
    const table = document.createElement('div'); table.setAttribute('role', 'group'); table.setAttribute('aria-label', 'Matching objects');
    context.panel.append(filter, count, table);
    const refreshTable = () => {
      const selected = context.selection.snapshot();
      const keys = new Set(selected.map(objectKey));
      const query = filter.value.trim().toLowerCase();
      const matches = context.base.filter(object => `${object.name ?? ''} ${object.ref.objectId}`.toLowerCase().includes(query));
      count.textContent = `${selected.length.toLocaleString()} selected · ${matches.length.toLocaleString()} matches · first ${Math.min(100, matches.length)} shown`;
      const fragment = document.createDocumentFragment();
      for (const object of matches.slice(0, 100)) {
        const row = document.createElement('button');
        row.textContent = object.name || object.ref.objectId;
        row.title = `${object.ref.modelId} / ${object.ref.objectId}`;
        row.setAttribute('aria-pressed', String(keys.has(objectKey(object.ref))));
        row.onclick = event => { event.ctrlKey || event.metaKey ? context.selection.toggle([object.ref]) : context.selection.replace([object.ref]); };
        fragment.append(row);
      }
      table.replaceChildren(fragment);
    };
    const refresh = () => {
      const selected = context.selection.snapshot();
      refreshTable();
      context.update(composeAppearance(context.base, { selection: selected, selectionColor: [0.05, 0.95, 0.5], ...(isolated ? { visible: selected } : {}) }));
    };
    const isolate = context.button('Isolate selected', () => { isolated = !isolated; isolate.textContent = isolated ? 'Show all objects' : 'Isolate selected'; refresh(); });
    context.button('Clear selection', () => { context.selection.replace([]); });
    context.button('Reset selection demo', () => { context.reset(); });
    filter.oninput = refreshTable;
    const unsubscribe = context.selection.subscribe(refresh);
    refresh(); context.status('Click a row or object. Ctrl/Cmd-click toggles membership. Filtering changes the table only.');
    return () => { unsubscribe(); filter.oninput = null; table.replaceChildren(); };
  },
};
