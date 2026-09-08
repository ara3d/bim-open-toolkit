import { type ModelRef, type NamedSet, type SavedView, type StyleRule } from '@bim-open-toolkit/model';
import { exceptionTable, type WorkflowException } from './exception.js';
import { type Overlay } from './overlay.js';
import { standardRecipe, type Recipe, type RecipeStep } from './recipe.js';
import { rowsOf, type ResultRecord, type ResultRow, type ResultTable } from './values.js';

// Everything one workflow says about its input: what it could decide, what it could not, and how to
// show both. Nothing here renders, fetches or depends on a browser; it is all plain data.
export type WorkflowResult = {
  readonly id: string;
  readonly title: string;
  readonly model: ModelRef;
  readonly tables: readonly ResultTable[];
  readonly summary: ResultRecord;
  readonly exceptions: readonly WorkflowException[];
  readonly rules: readonly StyleRule[];
  readonly sets: readonly NamedSet[];
  readonly overlays: readonly Overlay[];
  readonly view: SavedView;
  readonly recipe: Recipe;
};

// The pieces a workflow assembles its result from. The exceptions table and the recipe are built.
export type WorkflowResultParts = {
  readonly id: string;
  readonly title: string;
  readonly model: ModelRef;
  readonly tables: readonly ResultTable[];
  readonly summary?: ResultRecord;
  readonly exceptions: readonly WorkflowException[];
  readonly rules: readonly StyleRule[];
  readonly sets: readonly NamedSet[];
  readonly overlays?: readonly Overlay[];
  readonly view: SavedView;
  readonly selectSetId: string;
  readonly extraSteps?: readonly RecipeStep[];
};

// A workflow result with its exceptions table appended and its recipe written from its own parts.
export const workflowResult = (parts: WorkflowResultParts): WorkflowResult => {
  const tables = [...parts.tables, exceptionTable(parts.exceptions)];
  const overlays = parts.overlays ?? [];
  return {
    id: parts.id,
    title: parts.title,
    model: parts.model,
    tables,
    summary: parts.summary ?? {},
    exceptions: parts.exceptions,
    rules: parts.rules,
    sets: parts.sets,
    overlays,
    view: parts.view,
    recipe: standardRecipe(parts.id, parts.title, {
      model: parts.model,
      tables,
      sets: parts.sets,
      rules: parts.rules,
      overlays,
      view: parts.view,
      selectSetId: parts.selectSetId,
      extraSteps: parts.extraSteps ?? [],
    }),
  };
};

// The rows of one of the result's tables, or none when it has no table of that name.
export const resultRows = (result: WorkflowResult, id: string): readonly ResultRow[] => rowsOf(result.tables, id);

// The exception rows: the table that states what could not be decided and never guesses.
export const exceptionRows = (result: WorkflowResult): readonly ResultRow[] => resultRows(result, 'exceptions');
