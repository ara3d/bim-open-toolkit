// Puts a workflow result into a session through the feature commands: the sets it names, the rules
// it colours by, the overlays it anchors and the view it ends at.
//
// The workflows package names the commands in `workflowCommands`, and this dispatches those names
// with the typed values the result carries rather than the flattened records its recipe writes. Two
// steps are deliberately not the recipe's: a whole colouring goes in one `appearance.addRules` so
// its legend can travel with it, and the overlays go in one `overlays.set` because `overlays.add`
// carries no click action.

import {
  failure,
  resultOf,
  setKeys,
  type Diagnostic,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import { overlayFromWorkflow, overlaysSlice, workflowLayerId } from '@bim-open-toolkit/features';
import type { WorkflowOverlayAnchor, WorkflowOverlayRecord } from '@bim-open-toolkit/features';
import { putLayer } from '@bim-open-toolkit/render';
import type { OverlayAction, OverlayItem, OverlayLayer } from '@bim-open-toolkit/render';
import { workflowCommands } from '@bim-open-toolkit/workflows';
import type { Overlay, OverlayAnchor, WorkflowResult } from '@bim-open-toolkit/workflows';

// The feature command each part of a workflow result is dispatched as.
export const applyCommands = {
  defineSet: workflowCommands.createSet,
  addRules: 'appearance.addRules',
  setOverlays: 'overlays.set',
  saveView: workflowCommands.saveView,
  selectSet: workflowCommands.selectSet,
} as const;

// What applying a result did, so a demo's report and its test read the same numbers.
export type Applied = {
  readonly setIds: readonly string[];
  readonly ruleIds: readonly string[];
  readonly overlayIds: readonly string[];
  readonly viewId: string;
  readonly selectedSetId: string | undefined;
};

// How a demo varies the application: which overlay layer to draw into, what a click on an overlay
// runs, and whether to end by selecting the set the workflow points the reader at.
export type ApplyOptions = {
  readonly layerId?: string | undefined;
  readonly action?: ((overlay: Overlay) => OverlayAction | undefined) | undefined;
  readonly select?: boolean | undefined;
};

// The set the workflow's own recipe ends by selecting, read from the recipe rather than guessed.
export const selectedSetId = (result: WorkflowResult): string | undefined => {
  for (const step of result.recipe.steps) {
    if (step.command !== workflowCommands.selectSet) continue;
    const id = step.input['id'];
    if (typeof id === 'string') return id;
  }
  return undefined;
};

const anchorRecord = (anchor: OverlayAnchor): WorkflowOverlayAnchor =>
  anchor.kind === 'object' ? { kind: 'object', key: anchor.key } : { kind: 'point', position: anchor.position };

// A workflow overlay in the record form the overlays feature reads. Built from the typed overlay
// rather than from `overlayRecord`, whose result is an open record the feature's shape cannot check.
export const overlayRecordOf = (overlay: Overlay): WorkflowOverlayRecord =>
  overlay.kind === 'line'
    ? {
        kind: 'line',
        id: overlay.id,
        text: overlay.text,
        outcome: overlay.outcome,
        from: anchorRecord(overlay.from),
        to: anchorRecord(overlay.to),
      }
    : {
        kind: overlay.kind,
        id: overlay.id,
        text: overlay.text,
        outcome: overlay.outcome,
        at: anchorRecord(overlay.at),
      };

// The layer a result's overlays draw into, each carrying the click action the demo gives it.
// An overlay the render package refuses is reported and left out, never drawn at a made-up anchor.
export const workflowOverlayLayer = (
  result: WorkflowResult,
  layerId: string,
  action?: (overlay: Overlay) => OverlayAction | undefined,
): Result<OverlayLayer> => {
  const items: OverlayItem[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const overlay of result.overlays) {
    const built = overlayFromWorkflow(overlayRecordOf(overlay));
    diagnostics.push(...built.diagnostics);
    if (!built.ok) continue;
    const chosen = action?.(overlay);
    items.push(chosen === undefined ? built.value : { ...built.value, action: chosen });
  }
  return resultOf({ id: layerId, name: result.title, visible: true, items }, diagnostics);
};

// Dispatches one command, keeping its diagnostics whether or not it was accepted.
const run = (session: Session, name: string, input: unknown, diagnostics: Diagnostic[]): boolean => {
  const result = session.dispatch(name, input);
  diagnostics.push(...result.diagnostics);
  return result.ok;
};

// Applies a whole workflow result: its sets, its colouring, its overlays, its view, and the
// selection it ends at.
//
// The saved view keeps the camera the session is on now. A workflow states no camera of its own -
// an input of tables says nothing about where a building is - so its `view.view` is the default one
// and saving that would send the reader somewhere the result never asked for.
export const applyWorkflowResult = (
  session: Session,
  result: WorkflowResult,
  options: ApplyOptions = {},
): Result<Applied> => {
  const diagnostics: Diagnostic[] = [];
  let ok = true;
  for (const set of result.sets)
    ok =
      run(session, applyCommands.defineSet, { id: set.id, name: set.name, members: setKeys(set.members) }, diagnostics) &&
      ok;

  if (result.rules.length > 0)
    ok = run(session, applyCommands.addRules, { rules: result.rules }, diagnostics) && ok;

  const layerId = options.layerId ?? workflowLayerId;
  const layer = workflowOverlayLayer(result, layerId, options.action);
  diagnostics.push(...layer.diagnostics);
  const overlayIds = layer.ok ? layer.value.items.map((item) => item.id) : [];
  if (layer.ok && layer.value.items.length > 0) {
    const state = session.read(overlaysSlice);
    ok =
      run(
        session,
        applyCommands.setOverlays,
        { layers: putLayer(state.layers, layer.value), legends: state.legends },
        diagnostics,
      ) && ok;
  }

  ok =
    run(
      session,
      applyCommands.saveView,
      {
        id: result.view.id,
        name: result.view.name,
        selection: [...result.view.selection],
        rules: [...result.view.rules],
      },
      diagnostics,
    ) && ok;

  const selected = selectedSetId(result);
  if (selected !== undefined && options.select !== false)
    ok = run(session, applyCommands.selectSet, { id: selected }, diagnostics) && ok;

  const applied: Applied = {
    setIds: result.sets.map((set) => set.id),
    ruleIds: result.rules.map((rule) => rule.id),
    overlayIds,
    viewId: result.view.id,
    selectedSetId: selected,
  };
  return ok ? resultOf(applied, diagnostics) : failure(diagnostics);
};
