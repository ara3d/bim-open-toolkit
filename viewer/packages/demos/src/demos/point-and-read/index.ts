// Demo 1, Inspect: point at an object and read what is actually known about it.
//
// Pointing selects, clicking pins. The walls are taken away as the demo opens, because a model that
// cuts no openings leaves a door leaf sitting entirely inside its wall; a model that records no
// category has no walls to take away, and then the rule hides nothing. The README says so.
//
// What the demo reads is the model the viewer opened, whichever fixture that was. `start` is run
// after the fixture is open, so it is where the model is looked at and where the derivations are
// built; disposing the demo forgets them again.

import {
  appearanceFeature,
  appearanceSlice,
  editsFeature,
  setsFeature,
  setsSlice,
} from '@bim-open-toolkit/features';
import {
  coverageOf,
  diagnostic,
  disposable,
  failure,
  success,
  type AnyFeature,
  type Disposable,
  type ObjectKey,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import { snowdonThenSynthetic } from '../_shared/snowdon.js';
import type { Demo, GalleryViewer } from '../../gallery/contracts.js';
import {
  documentOf,
  factsOf,
  hideWallsRuleId,
  inspectIndex,
  inspectIndexOf,
  propertiesOf,
  propertyCountOf,
  runCalls,
  storeyOfObject,
  useInspectIndex,
  wallKeys,
} from './building.js';
import { pointAndReadSheet, propertyGroupsOf, readingValue } from './inspector.js';
import { pointAndReadPanels } from './panels.js';
import { hoverCalls, openingCalls, pinCalls, pinnedSetId, resetCalls, shownKey } from './pinning.js';

// The features the demo installs: rules to hide the walls, sets to hold the pin and the selection.
export const pointAndReadFeatures: readonly AnyFeature[] = [editsFeature, setsFeature, appearanceFeature];

// True once the walls have been taken away, which is the first thing the demo does.
export const pointAndReadReady = (session: Session): boolean =>
  session.read(appearanceSlice).rules.some((rule) => rule.id === hideWallsRuleId);

// The first property of the shown object that was recorded with a unit, printed the way the sheet
// prints it. It is in the report so the browser smoke records a real reading with its real unit
// rather than only a count: nothing here converts, so what the smoke prints is what the file says.
const shownQuantity = (index: ReturnType<typeof inspectIndex>, key: ObjectKey | undefined): string => {
  if (key === undefined) return 'none';
  const found = propertiesOf(index, key).find((reading) => reading.units !== undefined && reading.kind === 'number');
  if (found === undefined) return 'none';
  const value = readingValue(index, found);
  return value.state === 'known' ? `${found.name ?? '?'} ${value.text} ${found.units ?? ''}`.trim() : 'none';
};

// The counts the README quotes and the browser smoke reads back: what the file records over the
// whole model, and what the sheet is showing for the object being read.
export const pointAndReadReport = (session: Session): DemoReport => {
  const index = inspectIndex();
  const key = shownKey(session);
  const coverage = coverageOf(index.recorded.map((item) => item.observation));
  const storey = key === undefined ? undefined : storeyOfObject(index, key);
  return {
    objects: index.model.objects.length,
    wallsHidden: wallKeys(index).length,
    facts: coverage.total,
    factsKnown: coverage.known,
    factsMissing: coverage.missing,
    factsConflicting: coverage.conflicting,
    // What the file records beyond its geometry, and none of which is an observation.
    properties: index.properties.rows,
    propertyDescriptors: index.properties.descriptors.count,
    propertiesDropped: index.properties.dropped,
    documents: index.documents.count,
    storeyLinks: index.storeyOf.size,
    shown: key === undefined ? 'none' : (index.records.get(key)?.ref.objectId ?? 'none'),
    shownCategory: (key === undefined ? undefined : index.records.get(key)?.category) ?? 'none',
    shownFacts: key === undefined ? 0 : factsOf(index, key).length,
    shownProperties: key === undefined ? 0 : propertyCountOf(index, key),
    shownPropertyGroups: key === undefined ? 0 : propertyGroupsOf(index, key).length,
    shownDocument: (key === undefined ? undefined : documentOf(index, key)?.title) ?? 'none',
    shownStorey: storey?.name ?? 'none',
    shownStoreyVia: storey?.via ?? 'none',
    shownQuantity: shownQuantity(index, key),
    pinned: session.read(setsSlice).sets.some((set) => set.id === pinnedSetId),
  };
};

const start = (viewer: GalleryViewer): Promise<Result<Disposable>> => {
  const model = viewer.opened()[0];
  if (model === undefined)
    return Promise.resolve(
      failure([diagnostic('point-and-read/no-model', 'The demo reads the model the viewer opened, and it opened none.')]),
    );
  useInspectIndex(inspectIndexOf(model.data, model.geometry, { properties: model.properties, documents: model.documents }));
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
        useInspectIndex(undefined);
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
  fixtures: snowdonThenSynthetic,
  panels: pointAndReadPanels,
  inspector: pointAndReadSheet,
  start,
  ready: pointAndReadReady,
  report: pointAndReadReport,
  source: 'viewer/packages/demos/src/demos/point-and-read',
  verify: 'npx vitest run --root packages/demos test/demos/point-and-read',
};
