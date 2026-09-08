// Demo 9, "Give me a picture for the report".
//
// The demo opens with the heads-up display shown and one picture already taken, because the point it
// makes is that the picture is not a screenshot: the readout is on the screen and never in the file.
// Everything else waits for a press.
//
// The opening picture is drawn through the viewer rather than by asking the capture feature to draw
// one. The viewer is the only thing here that has a renderer; the feature this demo declares has
// none and refuses to draw rather than storing a blank picture. `capture.image` in its `store` form
// is how an image somebody else encoded reaches the scene document, so that is the one dispatched,
// and what the sheet and the report read back afterwards is a file that exists.

import {
  captureFeature,
  captureImageCommand,
  captureRecord,
  captureSlice,
  hudFeature,
  hudSlice,
  navigationAidsFeature,
  type CaptureRecord,
} from '@bim-open-toolkit/features';
import {
  disposable,
  failure,
  note,
  success,
  type Disposable,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import { pngFormat } from '@bim-open-toolkit/render';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo, GalleryViewer } from '../../gallery/contracts.js';
import { snowdonThenSynthetic } from '../_shared/snowdon.js';
import { captureSheet } from './inspector.js';
import { forgetOpening, openingNote, recordOpening, takenNote } from './opening.js';
import { capturePanels } from './panels.js';
import {
  captureSizeTitles,
  captureSizes,
  captureViewKey,
  dataUrlBytes,
  lastCapture,
  openingSize,
  sizeOfRecord,
  type CaptureSizeName,
} from './request.js';

// What this demo needs of the viewer: a session, and something that can draw a picture. Narrower
// than `GalleryViewer` so the opening move can be run and asserted without a canvas.
export type CapturingViewer = Session & Pick<GalleryViewer, 'capture'>;

// Draws one picture at a stated size and puts it in the scene document.
//
// The stored size is the one that was asked for rather than one measured off the image: the viewer
// hands back bytes, and a record has to say how big the picture is. Asking for both dimensions is
// what makes that true, which is why every size this demo offers states both.
export const takePicture = async (
  viewer: CapturingViewer,
  size: CaptureSizeName,
): Promise<Result<CaptureRecord>> => {
  const wanted = captureSizes[size];
  const image = await viewer.capture({ width: wanted.width, height: wanted.height, format: pngFormat });
  if (!image.ok) return failure(image.diagnostics);
  const record = captureRecord({
    bytes: image.value,
    width: wanted.width,
    height: wanted.height,
    format: pngFormat,
  });
  const stored = viewer.dispatch(captureImageCommand, {
    kind: 'store',
    viewId: captureViewKey,
    image: record,
  });
  return stored.ok ? success(record, stored.diagnostics) : failure(stored.diagnostics);
};

// Shows the heads-up display, takes the opening picture, and hands back the way to put both back.
//
// A picture that could not be drawn does not stop the demo: the model, the bar and the sheet are
// still worth looking at. The reason is kept instead, so the sheet and the report say what happened
// rather than reporting the same emptiness as a demo nobody has pressed anything on.
export const startCapture = async (viewer: CapturingViewer): Promise<Result<Disposable>> => {
  const before = viewer.read(hudSlice).visible;
  const shown = viewer.dispatch('hud.toggle', { visible: true });
  if (!shown.ok) return failure(shown.diagnostics);
  const taken = await takePicture(viewer, openingSize);
  const why = taken.ok ? takenNote : taken.diagnostics.map((one) => one.message).join('; ');
  recordOpening(why);
  return success(
    disposable(() => {
      viewer.dispatch('hud.toggle', { visible: before });
      viewer.dispatch('capture.forget', { keys: [captureViewKey] });
      forgetOpening();
    }),
    [
      ...shown.diagnostics,
      ...(taken.ok
        ? taken.diagnostics
        : [note('capture/no-opening-picture', `The opening picture could not be taken: ${why}`, ['capture'])]),
    ],
  );
};

// True once the readout the picture will not contain is on the screen. A picture that could not be
// drawn is reported rather than waited for, so a machine with no working renderer still shows the
// demo and says what it could not do.
export const captureReady = (session: Session): boolean => session.read(hudSlice).visible;

// What a browser smoke reads back: whether a picture exists, what it is, and what became of the one
// the demo took on the way in.
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
    opening: openingNote(),
  };
};

export const demo: Demo = {
  id: 'capture',
  chapter: 'cut-and-arrange',
  title: 'Capture',
  question: 'Give me a picture for the report.',
  briefIds: ['F20'],
  features: [navigationAidsFeature, hudFeature, captureFeature],
  fixtures: snowdonThenSynthetic,
  panels: capturePanels,
  inspector: captureSheet,
  start: startCapture,
  ready: captureReady,
  report: captureReport,
  source: 'viewer/packages/demos/src/demos/capture',
  verify: 'npx vitest run --root packages/demos test/demos/capture',
};
