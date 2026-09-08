import { type ModelRef, type NamedSet, type SavedView, type StyleRule } from '@bim-open-toolkit/model';
import { overlayRecord, type Overlay } from './overlay.js';
import { modelRecord, namedSetRecord, savedViewRecord, styleRuleRecord } from './records.js';
import { type ResultRecord, type ResultTable } from './values.js';

// The public command names a workflow demonstration dispatches.
// The commands themselves land with the feature packages in wave 3; these names are the contract
// between a workflow and its demonstration, and this is the one place they are written down.
export const workflowCommands = {
  openModel: 'model.open',
  showTable: 'results.showTable',
  createSet: 'sets.create',
  selectSet: 'selection.setFromSet',
  isolateSet: 'sets.isolate',
  addRule: 'style.addRule',
  addOverlay: 'overlays.add',
  saveView: 'views.save',
  linkViews: 'views.link',
  setTimelineDate: 'timeline.setDate',
  setSectionBox: 'clipping.setBox',
  captureImage: 'capture.image',
} as const;

// One dispatch of a recipe: the command to run and the input it is given.
export type RecipeStep = { readonly command: string; readonly input: ResultRecord; readonly note: string };

// The ordered dispatches that demonstrate one workflow, from opening the model to the saved view.
export type Recipe = { readonly id: string; readonly title: string; readonly steps: readonly RecipeStep[] };

// One dispatch.
export const step = (command: string, input: ResultRecord, note: string): RecipeStep => ({ command, input, note });

// What the standard recipe needs from a workflow result to write its steps.
export type RecipeParts = {
  readonly model: ModelRef;
  readonly tables: readonly ResultTable[];
  readonly sets: readonly NamedSet[];
  readonly rules: readonly StyleRule[];
  readonly overlays: readonly Overlay[];
  readonly view: SavedView;
  readonly selectSetId: string;
  readonly extraSteps: readonly RecipeStep[];
};

// The ordered commands a demonstration dispatches: open the model, show the tables, make the sets,
// colour by result, add the overlays, run whatever the workflow adds, select and save the view.
export const standardRecipe = (id: string, title: string, parts: RecipeParts): Recipe => ({
  id,
  title,
  steps: [
    step(workflowCommands.openModel, modelRecord(parts.model), 'Open the model the results are about.'),
    ...parts.tables.map((table) =>
      step(workflowCommands.showTable, { id: table.id, title: table.title }, `Show the ${table.title} table.`),
    ),
    ...parts.sets.map((set) => step(workflowCommands.createSet, namedSetRecord(set), `Create the ${set.name} set.`)),
    ...parts.rules.map((rule) => step(workflowCommands.addRule, styleRuleRecord(rule), `Colour by ${rule.name}.`)),
    ...parts.overlays.map((overlay) =>
      step(workflowCommands.addOverlay, overlayRecord(overlay), `Add the ${overlay.id} overlay.`),
    ),
    ...parts.extraSteps,
    step(workflowCommands.selectSet, { setId: parts.selectSetId }, 'Select what the reader should look at.'),
    step(workflowCommands.saveView, savedViewRecord(parts.view), 'Save the view this workflow ends at.'),
    step(workflowCommands.captureImage, { name: id }, 'Capture the image the demonstration ends with.'),
  ],
});

// The command names a recipe dispatches, in order, which is what wave 3 wires up.
export const recipeCommands = (recipe: Recipe): readonly string[] => recipe.steps.map((item) => item.command);
