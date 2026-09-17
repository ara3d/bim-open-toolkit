import { describe, expect, it } from 'vitest';
import { objectKey, objectRef, type ModelRef, type StyleRule } from '@bim-open-toolkit/model';
import { appearanceSlice, navigationSlice, overlaysSlice, setsSlice } from '@bim-open-toolkit/features';
import {
  marker,
  missingException,
  namedObjectSet,
  onObject,
  outcomeRule,
  resultTable,
  suggestedView,
  workflowResult,
  type WorkflowResult,
} from '@bim-open-toolkit/workflows';
import { applyWorkflowResult, selectedSetId } from '../../../src/demos/_workflows/apply-result.js';
import { focusAction, focusSetId, focusSets } from '../../../src/demos/_workflows/actions.js';
import { fakeSession } from './fake-session.js';

const model: ModelRef = { id: 'test-model', revision: 'r1' };
const keyOf = (id: string): string => objectKey(objectRef(model, id));

const rules: readonly StyleRule[] = [outcomeRule('test/missing', 'test missing', 'missing', [keyOf('b')])];

const result: WorkflowResult = workflowResult({
  id: 'test-workflow',
  title: 'Test workflow',
  model,
  tables: [resultTable('rows', 'Rows', [{ objectId: 'a' }, { objectId: 'b' }])],
  exceptions: [missingException(['b'], 'fireRating', 'not-provided')],
  rules,
  sets: [
    namedObjectSet('test/all', 'All', model, ['a', 'b']),
    namedObjectSet('test/exceptions', 'Exceptions', model, ['b']),
  ],
  overlays: [marker('test/b/fireRating', 'b: fireRating missing', 'missing', onObject(keyOf('b')))],
  view: suggestedView('test-workflow', 'Test exceptions', [keyOf('b')], rules),
  selectSetId: 'test/exceptions',
});

describe('applying a workflow result through the feature commands', () => {
  it('reads the set to select from the workflow\'s own recipe', () => {
    expect(selectedSetId(result)).toBe('test/exceptions');
  });

  it('defines the sets, adds the rules, draws the overlays, saves the view and selects', () => {
    const session = fakeSession();
    const applied = applyWorkflowResult(session, result);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    expect(session.read(setsSlice).sets.map((set) => set.id)).toEqual(['test/all', 'test/exceptions']);
    expect(session.read(appearanceSlice).rules.map((rule) => rule.id)).toEqual(['test/missing']);
    expect(session.read(navigationSlice).views.map((view) => view.id)).toEqual(['test-workflow']);
    expect(session.read(setsSlice).selection).toEqual([keyOf('b')]);

    const layers = session.read(overlaysSlice).layers;
    expect(layers.map((layer) => layer.id)).toEqual(['workflow']);
    expect(layers[0]?.items.map((item) => item.id)).toEqual(['test/b/fireRating']);
    expect(applied.value.overlayIds).toEqual(['test/b/fireRating']);
    expect(applied.value.selectedSetId).toBe('test/exceptions');
  });

  it('gives each overlay the click action the demo chose', () => {
    const session = fakeSession();
    const applied = applyWorkflowResult(session, result, { action: () => focusAction('test', 'b') });
    expect(applied.ok).toBe(true);
    expect(session.read(overlaysSlice).layers[0]?.items[0]?.action).toEqual({
      command: 'sets.selectSet',
      input: { id: focusSetId('test', 'b') },
    });
  });

  it('draws into the layer the demo named, leaving other layers alone', () => {
    const session = fakeSession();
    session.dispatch('overlays.set', {
      layers: [{ id: 'other', name: 'Other', visible: true, items: [] }],
      legends: [],
    });
    applyWorkflowResult(session, result, { layerId: 'schedule' });
    expect(session.read(overlaysSlice).layers.map((layer) => layer.id)).toEqual(['other', 'schedule']);
  });

  it('leaves the selection alone when the demo asks it to', () => {
    const session = fakeSession();
    applyWorkflowResult(session, result, { select: false });
    expect(session.read(setsSlice).selection).toEqual([]);
  });

  it('reports the refusal when a rule is already there rather than claiming success', () => {
    const session = fakeSession();
    expect(applyWorkflowResult(session, result).ok).toBe(true);
    const second = applyWorkflowResult(session, result);
    expect(second.ok).toBe(false);
    expect(second.diagnostics.map((item) => item.code)).toContain('appearance/repeated-rule');
  });

  it('makes one selectable set per object so a row click can name exactly one', () => {
    const session = fakeSession();
    for (const set of focusSets('test', model, ['a', 'b', 'a']))
      session.dispatch('sets.define', { id: set.id, name: set.name, members: [...set.members] });
    expect(session.read(setsSlice).sets).toHaveLength(2);
    const focused = session.dispatch('sets.selectSet', focusAction('test', 'a').input);
    expect(focused.ok).toBe(true);
    expect(session.read(setsSlice).selection).toEqual([keyOf('a')]);
  });
});
