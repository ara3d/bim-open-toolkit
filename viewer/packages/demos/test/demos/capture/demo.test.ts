import {
  captureFeatureWith,
  captureRecord,
  captureSlice,
  hudFeature,
  hudSlice,
  navigationAidsFeature,
  pendingCapture,
} from '@bim-open-toolkit/features';
import { pngFormat, type CaptureTarget } from '@bim-open-toolkit/render';
import { describe, expect, it } from 'vitest';
import { captureReady, captureReport, demo, startCapture } from '../../../src/demos/capture/index.js';
import { captureSheet } from '../../../src/demos/capture/inspector.js';
import { captureApp, capturePanelSpec, pictureText } from '../../../src/demos/capture/panels.js';
import { captureViewKey, dataUrlBytes } from '../../../src/demos/capture/request.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

// A renderer that draws nothing and encodes a fixed number of bytes, so a test measures the demo
// rather than an encoder.
const fakeTarget = (bytes = 4096): CaptureTarget => {
  let size = { width: 800, height: 500 };
  return {
    size: () => size,
    resize: (width, height) => {
      size = { width, height };
    },
    renderFrame: () => undefined,
    encode: () => Promise.resolve(new Uint8Array(bytes)),
  };
};

// The features the demo declares, with the capture feature given the renderer it will have in the
// gallery. `demo.features` carries the target-less capture feature; see CHECKPOINT-D2.md.
const session = (target: CaptureTarget = fakeTarget()) =>
  sessionForFeatures([navigationAidsFeature, hudFeature, captureFeatureWith(target)]);

describe('the capture demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('capture');
    expect(demo.chapter).toBe('cut-and-arrange');
    expect(demo.briefIds).toContain('F20');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
  });

  it('shows the readout the picture will not contain, and puts it back', () => {
    const live = session();
    expect(captureReady(live)).toBe(false);
    const started = startCapture(live);
    if (started.ok !== true) throw new Error('the demo did not start');
    expect(captureReady(live)).toBe(true);
    started.value.dispose();
    expect(live.read(hudSlice).visible).toBe(false);
  });
});

describe('taking a picture', () => {
  it('asks for the chosen size and stores what came back', async () => {
    const live = session(fakeTarget(4096));
    const result = live.dispatch('capture.image', { viewId: captureViewKey, width: 480, height: 300 });
    const pending = pendingCapture(result);
    expect(pending).toBeDefined();
    const image = await pending?.image;
    expect(image?.ok).toBe(true);
    const stored = live.read(captureSlice).thumbnails[captureViewKey];
    expect(stored?.width).toBe(480);
    expect(stored?.height).toBe(300);
    expect(dataUrlBytes(stored?.dataUrl ?? '')).toBe(4096);
  });

  it('reports the picture it has, and says so when it has none', async () => {
    const live = session(fakeTarget(2048));
    expect(captureReport(live).captured).toBe(false);
    const pending = pendingCapture(live.dispatch('capture.image', { viewId: captureViewKey, width: 1600, height: 1000 }));
    await pending?.image;
    const report = captureReport(live);
    expect(report.captured).toBe(true);
    expect(report.size).toBe('Report 1600×1000');
    expect(report.bytes).toBe(2048);
  });
});

describe('the inspector sheet', () => {
  it('says no picture has been taken', () => {
    const sheet = captureSheet(session());
    const picture = sheet.groups.find((group) => group.id === 'picture');
    expect(picture?.rows[0]?.value.state).toBe('missing');
  });

  it('reports size, bytes and format, and does not invent a time', () => {
    const live = session();
    live.dispatch('capture.image', {
      kind: 'store',
      viewId: captureViewKey,
      image: captureRecord({ bytes: new Uint8Array(1024), width: 1280, height: 800, format: pngFormat }),
    });
    const sheet = captureSheet(live);
    const rows = sheet.groups.find((group) => group.id === 'picture')?.rows ?? [];
    expect(rows.find((row) => row.key === 'size')?.value.text).toBe('Slide 1280×800');
    expect(rows.find((row) => row.key === 'bytes')?.value.text).toBe('1024');
    expect(rows.find((row) => row.key === 'format')?.value.text).toBe('image/png');
    const elapsed = rows.find((row) => row.key === 'elapsed');
    expect(elapsed?.value.state).toBe('missing');
    expect(elapsed?.value.missingReason).toContain('not how long it took');
  });

  it('says a picture is of the model and not of the screen', () => {
    const shown = captureSheet(session()).groups.find((group) => group.id === 'shown');
    expect(shown?.rows.find((row) => row.key === 'panels')?.value.state).toBe('missing');
  });
});

describe('the capture bar', () => {
  it('offers every size, the button and the switch', () => {
    const panel = headlessPanel(captureApp);
    expect(panel.controls().map((node) => node.label)).toEqual([
      'Report 1600×1000',
      'Slide 1280×800',
      'Thumbnail 480×300',
      'Capture',
      'HUD',
    ]);
    panel.dispose();
  });

  it('chooses a size and counts the captures it asked for', () => {
    const panel = headlessPanel(captureApp);
    expect(panel.press('Thumbnail 480×300')).toBe(true);
    expect(panel.doc().size).toBe('thumbnail');
    expect(panel.press('Capture')).toBe(true);
    expect(panel.doc().asked).toBe(1);
    panel.dispose();
  });

  it('asks the feature for the chosen size, and shows and hides the readout', () => {
    const live = session(fakeTarget());
    capturePanelSpec.onCommit?.({ size: 'slide', hud: true, asked: 1 }, { size: 'slide', hud: false, asked: 0 }, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['hud.toggle', 'capture.image']);
    expect(live.dispatched[1]?.input).toEqual({ viewId: captureViewKey, width: 1280, height: 800 });
    expect(live.read(hudSlice).visible).toBe(true);
  });

  it('reads the picture back out of the slice', () => {
    const live = session();
    live.dispatch('capture.image', {
      kind: 'store',
      viewId: captureViewKey,
      image: captureRecord({ bytes: new Uint8Array(3072), width: 480, height: 300, format: pngFormat }),
    });
    const synced = capturePanelSpec.sync?.(live, { size: 'report', hud: false, asked: 1 });
    expect(synced?.picture).toEqual({ width: 480, height: 300, bytes: 3072 });
    expect(pictureText(synced?.picture)).toBe('480×300, 3 kB');
  });
});
