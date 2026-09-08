import { describe, expect, it } from 'vitest';
import { namedSet, setOf } from '@bim-open-toolkit/model';
import { keyOf, suggestedView } from '../src/keys.js';
import { groupByOutcome, outcomeRules } from '../src/outcome.js';
import { marker, onObject } from '../src/overlay.js';
import { recipeCommands, standardRecipe, step, workflowCommands } from '../src/recipe.js';
import { workflowResult } from '../src/result.js';
import { resultTable } from '../src/values.js';
import { fixtureModel } from './fixtures.js';

const key = keyOf(fixtureModel, 'a');
const rules = outcomeRules('w', groupByOutcome([[key, 'missing']]));
const parts = {
  model: fixtureModel,
  tables: [resultTable('rows', 'Rows', [])],
  sets: [namedSet('w/exceptions', 'Exceptions', setOf([key]))],
  rules,
  overlays: [marker('m', 'a is unmeasured', 'missing', onObject(key))],
  view: suggestedView('w', 'W', [key], rules),
  selectSetId: 'w/exceptions',
  extraSteps: [step(workflowCommands.linkViews, { views: [] }, 'Compare side by side.')],
};

describe('a recipe', () => {
  it('dispatches only public command names, in the order a demonstration runs them', () => {
    expect(recipeCommands(standardRecipe('w', 'W', parts))).toEqual([
      'model.open',
      'results.showTable',
      'sets.create',
      'style.addRule',
      'overlays.add',
      'views.link',
      'selection.setFromSet',
      'views.save',
      'capture.image',
    ]);
  });

  it('carries every step input as plain JSON, so a command bus can take it unchanged', () => {
    const steps = standardRecipe('w', 'W', parts).steps;
    expect(JSON.parse(JSON.stringify(steps))).toEqual(steps);
    expect(steps[0]?.input).toEqual({ id: 'fixture', revision: '1' });
    expect(steps.every((item) => item.note !== '')).toBe(true);
  });

  it('is built from the result own sets, rules, overlays and view', () => {
    const result = workflowResult({
      id: 'w',
      title: 'W',
      model: fixtureModel,
      tables: parts.tables,
      exceptions: [],
      rules,
      sets: parts.sets,
      overlays: parts.overlays,
      view: parts.view,
      selectSetId: 'w/exceptions',
    });
    expect(recipeCommands(result.recipe)).toEqual([
      'model.open',
      'results.showTable',
      'results.showTable',
      'sets.create',
      'style.addRule',
      'overlays.add',
      'selection.setFromSet',
      'views.save',
      'capture.image',
    ]);
    expect(result.recipe.id).toBe('w');
  });
});
