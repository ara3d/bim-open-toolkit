// Demo 1, Inspect: point at an object and read what is actually known about it.
//
// Pointing selects, clicking pins. The walls are taken away as the demo opens, because the
// generator cuts no openings and a door leaf sits entirely inside its wall; the README says so.

import {
  appearanceFeature,
  appearanceSlice,
  editsFeature,
  setsFeature,
  setsSlice,
} from '@bim-open-toolkit/features';
import {
  coverageOf,
  disposable,
  failure,
  success,
  type AnyFeature,
  type Disposable,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, GalleryViewer } from '../../gallery/contracts.js';
import { buildingFixture, factsOf, hideWallsRuleId, inspectIndex, runCalls, wallKeys } from './building.js';
import { pointAndReadSheet } from './inspector.js';
import { pointAndReadPanels } from './panels.js';
import { hoverCalls, openingCalls, pinCalls, pinnedSetId, resetCalls, shownKey } from './pinning.js';

// The features the demo installs: rules to hide the walls, sets to hold the pin and the selection.
export const pointAndReadFeatures: readonly AnyFeature[] = [editsFeature, setsFeature, appearanceFeature];

// True once the walls have been taken away, which is the first thing the demo does.
export const pointAndReadReady = (session: Session): boolean =>
  session.read(appearanceSlice).rules.some((rule) => rule.id === hideWallsRuleId);

// The counts the README quotes and the browser smoke reads back.
export const pointAndReadReport = (session: Session): DemoReport => {
  const index = inspectIndex();
  const key = shownKey(session);
  const coverage = coverageOf(index.building.facts.map((item) => item.observation));
  return {
    objects: index.building.model.objects.length,
    wallsHidden: wallKeys(index).length,
    facts: coverage.total,
    factsKnown: coverage.known,
    factsMissing: coverage.missing,
    factsConflicting: coverage.conflicting,
    shown: key === undefined ? 'none' : (index.records.get(key)?.ref.objectId ?? 'none'),
    shownFacts: key === undefined ? 0 : factsOf(index, key).length,
    pinned: session.read(setsSlice).sets.some((set) => set.id === pinnedSetId),
  };
};

const start = (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const opened = runCalls(viewer, openingCalls());
  if (!opened.ok) return Promise.resolve(failure(opened.diagnostics));
  const hover = (event: PointerEvent): void => {
    runCalls(viewer, hoverCalls(viewer.pick(event.clientX, event.clientY)));
  };
  const pin = (event: PointerEvent): void => {
    runCalls(viewer, pinCalls(viewer.pick(event.clientX, event.clientY)));
  };
  viewer.canvas.addEventListener('pointermove', hover);
  viewer.canvas.addEventListener('pointerdown', pin);
  return Promise.resolve(
    success(
      disposable(() => {
        viewer.canvas.removeEventListener('pointermove', hover);
        viewer.canvas.removeEventListener('pointerdown', pin);
        runCalls(viewer, resetCalls());
      }),
    ),
  );
};

export const demo: Demo = {
  id: 'point-and-read',
  chapter: 'inspect',
  title: 'Point and read',
  question: 'What is this object, and what do we actually know about it?',
  briefIds: ['F06', 'F07'],
  features: pointAndReadFeatures,
  fixtures: [buildingFixture],
  panels: pointAndReadPanels,
  inspector: pointAndReadSheet,
  start,
  ready: pointAndReadReady,
  report: pointAndReadReport,
  source: 'viewer/packages/demos/src/demos/point-and-read',
  verify: 'npx vitest run --root packages/demos test/demos/point-and-read',
};
