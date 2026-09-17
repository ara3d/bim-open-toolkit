// Demo 6, "Pull it apart so I can see every part".
//
// The opening sequence is a plain function of the session and the model it opened, so it can be run
// and asserted without a canvas; `start` is the contract's wrapper around it. Nothing here moves an
// object's own transform: `layouts.explode` and `layouts.grid` write parameters only, and the render
// side reads them back each frame, which is what makes `layouts.reset` an exact undo.
//
// The separator is not fixed in advance. The demo surveys what the open model actually offers a
// layout and opens on the separator that moves something; when the model offers neither, the bar,
// the inspector and the report all say how many objects moved and why that number is zero, rather
// than showing a slider that appears to do nothing.

import { layoutsFeature, layoutsSlice, type Placement } from '@bim-open-toolkit/features';
import {
  diagnostic,
  disposable,
  failure,
  success,
  type Disposable,
  type ModelData,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo } from '../../gallery/contracts.js';
import { snowdonThenSynthetic } from '../_shared/snowdon.js';
import { explodeSheet } from './inspector.js';
import { explodePanels } from './panels.js';
import { heldSurvey, holdSurvey, layoutCaveat, movedBy, openingExplode, surveyExplode } from './survey.js';

// Surveys the open model, separates it by whatever that survey says it can be separated by, and
// hands back the way to put it back together.
export const startExplode = (
  session: Session,
  model: ModelData | undefined,
  placements?: readonly Placement[],
): Result<Disposable> => {
  if (model === undefined)
    return failure([
      diagnostic('explode/no-model', 'No model is open, so there is nothing to separate.', []),
    ]);
  const survey = surveyExplode(model, placements);
  const applied = session.dispatch('layouts.explode', openingExplode(survey));
  if (!applied.ok) return failure(applied.diagnostics);
  holdSurvey(survey);
  return success(
    disposable(() => {
      holdSurvey(undefined);
      session.dispatch('layouts.reset', {});
    }),
    applied.diagnostics,
  );
};

// True once a layout is in force and the demo knows what that layout did to the open model. A model
// nothing can separate is an answer the demo gives, not a state it waits in, so readiness is the
// account being available rather than the count being above zero.
export const explodeReady = (session: Session): boolean =>
  heldSurvey() !== undefined && session.read(layoutsSlice).layout.kind !== 'none';

// What a browser smoke reads back: the layout in force, every parameter it carries, what the open
// model offers a layout, and how many objects the layout actually moves.
export const explodeReport = (session: Session): DemoReport => {
  const { layout } = session.read(layoutsSlice);
  const survey = heldSurvey();
  const by = layout.kind === 'explode' ? layout.by : undefined;
  return {
    layoutKind: layout.kind,
    by: by ?? '',
    strength: layout.kind === 'explode' ? layout.strength : 0,
    gridSpacing: layout.kind === 'grid' ? layout.spacing : 0,
    gridColumns: layout.kind === 'grid' ? layout.columns : 0,
    objects: survey?.objects ?? 0,
    storeys: survey?.storeys ?? 0,
    categories: survey?.categories ?? 0,
    placements: survey?.placements ?? 0,
    moved: movedBy(survey, layout),
    caveat: survey === undefined ? '' : (layoutCaveat(survey, layout) ?? ''),
  };
};

export const demo: Demo = {
  id: 'explode-and-grid',
  chapter: 'cut-and-arrange',
  title: 'Explode and grid',
  question: 'Pull it apart so I can see every part.',
  briefIds: ['F13'],
  features: [layoutsFeature],
  fixtures: snowdonThenSynthetic,
  panels: explodePanels,
  inspector: explodeSheet,
  start: (viewer) => Promise.resolve(startExplode(viewer, viewer.opened()[0]?.data, viewer.placements())),
  ready: explodeReady,
  report: explodeReport,
  source: 'viewer/packages/demos/src/demos/explode-and-grid',
  verify: 'npx vitest run --root packages/demos test/demos/explode-and-grid',
};
