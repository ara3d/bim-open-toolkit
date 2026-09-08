// Demo 6, "Pull it apart so I can see every part".
//
// The opening sequence is a plain function of the session so it can be run and asserted without a
// canvas; `start` is the contract's wrapper around it. Nothing here moves an object's own transform:
// `layouts.explode` and `layouts.grid` write parameters only, and the render side reads them back
// each frame, which is what makes `layouts.reset` an exact undo.

import { layoutsFeature, layoutsSlice } from '@bim-open-toolkit/features';
import { disposable, failure, success, type Disposable, type Result, type Session } from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, DemoFixture, ModelSource } from '../../gallery/contracts.js';
import { explodeSheet } from './inspector.js';
import { explodePanels } from './panels.js';

// The synthetic building, three storeys of rooms and services, which is what a viewer pulls apart.
const building: DemoFixture = {
  id: 'building',
  title: 'Synthetic building',
  basis: 'synthetic',
  source: async (): Promise<Result<ModelSource>> => {
    const built = generateBuilding(defaultBuildingOptions);
    return success({ kind: 'data', id: 'building', data: built.model, geometry: built.geometry });
  },
};

// A small opening strength, by storey, so the demo shows what it is about at a glance.
const openingLayout = { by: 'storey' as const, strength: 0.35 };

// Separates the model a little and hands back the way to put it back together.
export const startExplode = (session: Session): Result<Disposable> => {
  const applied = session.dispatch('layouts.explode', openingLayout);
  if (!applied.ok) return failure(applied.diagnostics);
  return success(
    disposable(() => {
      session.dispatch('layouts.reset', {});
    }),
    applied.diagnostics,
  );
};

// True once the model is separated or arranged, rather than left exactly as placed.
export const explodeReady = (session: Session): boolean => session.read(layoutsSlice).layout.kind !== 'none';

// What a browser smoke reads back: the layout in force and every parameter it carries.
export const explodeReport = (session: Session): DemoReport => {
  const { layout } = session.read(layoutsSlice);
  return {
    layoutKind: layout.kind,
    by: layout.kind === 'explode' ? layout.by : '',
    strength: layout.kind === 'explode' ? layout.strength : 0,
    gridSpacing: layout.kind === 'grid' ? layout.spacing : 0,
    gridColumns: layout.kind === 'grid' ? layout.columns : 0,
  };
};

export const demo: Demo = {
  id: 'explode-and-grid',
  chapter: 'cut-and-arrange',
  title: 'Explode and grid',
  question: 'Pull it apart so I can see every part.',
  briefIds: ['F13'],
  features: [layoutsFeature],
  fixtures: [building],
  panels: explodePanels,
  inspector: explodeSheet,
  start: (viewer) => Promise.resolve(startExplode(viewer)),
  ready: explodeReady,
  report: explodeReport,
  source: 'viewer/packages/demos/src/demos/explode-and-grid',
  verify: 'npx vitest run --root packages/demos test/demos/explode-and-grid',
};
