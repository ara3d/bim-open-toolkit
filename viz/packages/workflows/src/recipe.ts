import { type ModelRef, type NamedSet, type SavedView, type StyleRule } from '@bim-open-toolkit/model';
import { overlayRecord, type Overlay } from './overlay.js';
import { modelRecord, namedSetRecord, styleRuleRecord } from './records.js';
import { resultRecord, type ResultRecord, type ResultTable } from './values.js';

// The public command names a workflow demonstration dispatches, matched to the feature packages'
// own `command({ name: ... })` calls (`features/docs/CHECKPOINT-FA.md`, `FB.md`, `FC.md`, "Command
// names"; the source wins over a checkpoint). `model.open` and `results.showTable` are not feature
// commands: they belong to the viewer host that opens a model and renders a table, outside
// `features`. This is still the one place every name a recipe dispatches is written down.
export const workflowCommands = {
  openModel: 'model.open',
  showTable: 'results.showTable',
  createSet: 'sets.define',
  selectSet: 'sets.selectSet',
  isolateSet: 'sets.isolate',
  addRule: 'appearance.addRule',
  addOverlay: 'overlays.add',
  saveView: 'navigation.saveView',
  linkViews: 'comparison.link',
  setTimelineDate: 'animation.seek',
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

// navigation.saveView saves the camera the session currently holds; it takes no camera in its
// input. Only the name, the selection and the rules a saved view carries travel in the command.
const saveViewInput = (view: SavedView): ResultRecord =>
  resultRecord({ id: view.id, name: view.name, selection: view.selection, rules: view.rules.map(styleRuleRecord) });

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
    ...parts.rules.map((rule) =>
      step(workflowCommands.addRule, { rule: styleRuleRecord(rule) }, `Colour by ${rule.name}.`),
    ),
    ...parts.overlays.map((overlay) =>
      step(workflowCommands.addOverlay, overlayRecord(overlay), `Add the ${overlay.id} overlay.`),
    ),
    ...parts.extraSteps,
    step(workflowCommands.selectSet, { id: parts.selectSetId }, 'Select what the reader should look at.'),
    step(workflowCommands.saveView, saveViewInput(parts.view), 'Save the view this workflow ends at.'),
    step(workflowCommands.captureImage, { name: id }, 'Capture the image the demonstration ends with.'),
  ],
});

// The command names a recipe dispatches, in order, which is what wave 3 wires up.
export const recipeCommands = (recipe: Recipe): readonly string[] => recipe.steps.map((item) => item.command);
