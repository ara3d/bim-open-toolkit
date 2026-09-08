// Demo 9, "Give me a picture for the report".
//
// The demo opens with the heads-up display shown, because the point it makes is that the picture is
// not a screenshot: the readout is on the screen and never in the file. Everything else waits for a
// press.

import {
  captureFeature,
  captureSlice,
  hudFeature,
  hudSlice,
  navigationAidsFeature,
} from '@bim-open-toolkit/features';
import { disposable, failure, success, type Disposable, type Result, type Session } from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, DemoFixture, ModelSource } from '../../gallery/contracts.js';
import { captureSheet } from './inspector.js';
import { capturePanels } from './panels.js';
import { captureSizeTitles, captureViewKey, dataUrlBytes, lastCapture, sizeOfRecord } from './request.js';

const building: DemoFixture = {
  id: 'building',
  title: 'Synthetic building',
  basis: 'synthetic',
  source: async (): Promise<Result<ModelSource>> => {
    const built = generateBuilding(defaultBuildingOptions);
    return success({ kind: 'data', id: 'building', data: built.model, geometry: built.geometry });
  },
};

// Shows the heads-up display and hands back the way to put it back as it was, picture included.
export const startCapture = (session: Session): Result<Disposable> => {
  const before = session.read(hudSlice).visible;
  const shown = session.dispatch('hud.toggle', { visible: true });
  if (!shown.ok) return failure(shown.diagnostics);
  return success(
    disposable(() => {
      session.dispatch('hud.toggle', { visible: before });
      session.dispatch('capture.forget', { keys: [captureViewKey] });
    }),
    shown.diagnostics,
  );
};

// True once the readout the picture will not contain is on the screen.
export const captureReady = (session: Session): boolean => session.read(hudSlice).visible;

// What a browser smoke reads back: whether a picture exists and what it is.
export const captureReport = (session: Session): DemoReport => {
  const record = lastCapture(session.read(captureSlice));
  const size = record === undefined ? undefined : sizeOfRecord(record);
  return {
    captured: record !== undefined,
    width: record?.width ?? 0,
    height: record?.height ?? 0,
    bytes: record === undefined ? 0 : dataUrlBytes(record.dataUrl),
    size: size === undefined ? 'none' : captureSizeTitles[size],
    hud: session.read(hudSlice).visible,
  };
};

export const demo: Demo = {
  id: 'capture',
  chapter: 'cut-and-arrange',
  title: 'Capture',
  question: 'Give me a picture for the report.',
  briefIds: ['F20'],
  features: [navigationAidsFeature, hudFeature, captureFeature],
  fixtures: [building],
  panels: capturePanels,
  inspector: captureSheet,
  start: (viewer) => Promise.resolve(startCapture(viewer)),
  ready: captureReady,
  report: captureReport,
  source: 'viewer/packages/demos/src/demos/capture',
  verify: 'npx vitest run --root packages/demos test/demos/capture',
};
