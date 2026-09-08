import { emptyDocument, getSlice, putSlice } from '@bim-open-toolkit/model';
import { pngFormat, type CaptureTarget } from '@bim-open-toolkit/render';
import { describe, expect, it } from 'vitest';
import {
  captureCommands,
  captureFeature,
  captureFeatureWith,
  captureRecord,
  captureSlice,
  noCaptures,
  pendingCapture,
  thumbnailKeys,
  thumbnailOf,
  toBase64,
  type CaptureState,
} from '../src/capture.js';
import { fakeSession } from './support/fake-session.js';

// A capture target that records what it was asked to do and encodes the size it drew at, so a test
// can tell a thumbnail from a full-size image without decoding a PNG.
const fakeTarget = (width = 800, height = 400) => {
  const calls: string[] = [];
  let size = { width, height };
  const target: CaptureTarget = {
    size: () => size,
    resize: (nextWidth, nextHeight) => {
      calls.push(`resize ${nextWidth}x${nextHeight}`);
      size = { width: nextWidth, height: nextHeight };
    },
    renderFrame: () => void calls.push('render'),
    encode: async () => Uint8Array.from([size.width, size.height, 1, 2]),
  };
  return { target, calls, current: () => size };
};

describe('base64', () => {
  it('encodes with the padding the length calls for', () => {
    expect(toBase64(Uint8Array.from([]))).toBe('');
    expect(toBase64(Uint8Array.from([77]))).toBe('TQ==');
    expect(toBase64(Uint8Array.from([77, 97]))).toBe('TWE=');
    expect(toBase64(Uint8Array.from([77, 97, 110]))).toBe('TWFu');
    expect(toBase64(Uint8Array.from([0, 0, 0, 255, 255, 255]))).toBe('AAAA////');
  });

  it('makes a data URL a browser would accept', () => {
    const record = captureRecord({ bytes: Uint8Array.from([77, 97, 110]), width: 2, height: 1, format: pngFormat });
    expect(record.dataUrl).toBe('data:image/png;base64,TWFu');
    expect(record).toMatchObject({ width: 2, height: 1, format: pngFormat });
  });
});

describe('capture slice', () => {
  it('round trips through a document', () => {
    const state: CaptureState = {
      thumbnails: { 'view-1': { dataUrl: 'data:image/png;base64,TWFu', width: 2, height: 1, format: pngFormat } },
    };
    const document = putSlice(emptyDocument(), captureSlice, state);
    const read = getSlice(document, captureSlice);
    expect(read.ok && read.value).toEqual(state);
    expect(read.ok && thumbnailOf(read.value, 'view-1')?.width).toBe(2);
  });

  it('refuses a format nothing encodes', () => {
    const broken = { thumbnails: { a: { dataUrl: 'x', width: 1, height: 1, format: 'image/webp' } } };
    const document = { ...emptyDocument(), slices: { capture: { version: 1, value: broken } } };
    expect(getSlice(document, captureSlice).ok).toBe(false);
  });
});

describe('capture.image', () => {
  it('refuses to draw when no capture target is installed', () => {
    const session = fakeSession(captureCommands());
    expect(session.dispatch('capture.image', {}).diagnostics.map((item) => item.code)).toEqual(['capture/no-target']);
  });

  it('draws, encodes and hands the pending image back', async () => {
    const { target, calls } = fakeTarget();
    const session = fakeSession(captureCommands(target));
    const started = session.dispatch('capture.image', {});
    expect(started.ok).toBe(true);
    const waiting = pendingCapture(started);
    expect(waiting).toBeDefined();
    const image = await waiting?.image;
    expect(image?.ok).toBe(true);
    expect(image?.ok === true && image.value.bytes).toEqual(Uint8Array.from([800, 400, 1, 2]));
    expect(calls).toEqual(['render']);
  });

  it('draws a thumbnail at the longest edge and puts the view back', async () => {
    const { target, calls, current } = fakeTarget();
    const session = fakeSession(captureCommands(target));
    const started = session.dispatch('capture.image', { maxEdge: 200, viewId: 'view-1' });
    const image = await pendingCapture(started)?.image;
    expect(image?.ok === true && [image.value.width, image.value.height]).toEqual([200, 100]);
    expect(calls).toEqual(['resize 200x100', 'render', 'resize 800x400']);
    expect(current()).toEqual({ width: 800, height: 400 });
  });

  it('stores a finished thumbnail against the view it was asked for', async () => {
    const { target } = fakeTarget();
    const session = fakeSession(captureCommands(target));
    const started = session.dispatch('capture.image', { viewId: 'view-1', maxEdge: 100 });
    await pendingCapture(started)?.image;
    expect(thumbnailOf(session.read(captureSlice), 'view-1')?.width).toBe(100);
    expect(session.events).toContain('capture.image:capture');
  });

  it('takes the name a workflow recipe writes as the view it belongs to', async () => {
    const { target } = fakeTarget();
    const session = fakeSession(captureCommands(target));
    const started = session.dispatch('capture.image', { name: 'door-schedule' });
    await pendingCapture(started)?.image;
    expect(thumbnailKeys(session.read(captureSlice))).toEqual(['door-schedule']);
  });

  it('stores nothing when no view was named', async () => {
    const { target } = fakeTarget();
    const session = fakeSession(captureCommands(target));
    const started = session.dispatch('capture.image', {});
    await pendingCapture(started)?.image;
    expect(session.read(captureSlice)).toEqual(noCaptures);
  });

  it('stores an image somebody else encoded', () => {
    const session = fakeSession(captureCommands());
    const image = { dataUrl: 'data:image/png;base64,TWFu', width: 2, height: 1, format: pngFormat };
    expect(session.dispatch('capture.image', { kind: 'store', viewId: 'view-2', image }).ok).toBe(true);
    expect(thumbnailOf(session.read(captureSlice), 'view-2')).toEqual(image);
  });

  it('refuses a store form that is missing what it needs, rather than drawing instead', () => {
    const session = fakeSession(captureCommands());
    expect(session.dispatch('capture.image', { kind: 'store', viewId: 'view-2' }).ok).toBe(false);
  });

  it('reports a target that will not draw', async () => {
    const failing: CaptureTarget = {
      size: () => ({ width: 10, height: 10 }),
      resize: () => undefined,
      renderFrame: () => {
        throw new Error('context lost');
      },
      encode: async () => Uint8Array.from([1]),
    };
    const session = fakeSession(captureCommands(failing));
    const started = session.dispatch('capture.image', { viewId: 'view-1' });
    const image = await pendingCapture(started)?.image;
    expect(image?.ok).toBe(false);
    expect(image?.diagnostics.map((item) => item.code)).toEqual(['render-failed']);
    expect(session.read(captureSlice)).toEqual(noCaptures);
  });
});

describe('capture.forget', () => {
  it('removes named thumbnails, or all of them', () => {
    const session = fakeSession(captureCommands());
    const image = { dataUrl: 'data:image/png;base64,TWFu', width: 2, height: 1, format: pngFormat };
    session.dispatch('capture.image', { kind: 'store', viewId: 'a', image });
    session.dispatch('capture.image', { kind: 'store', viewId: 'b', image });
    expect(thumbnailKeys(session.read(captureSlice))).toEqual(['a', 'b']);

    session.dispatch('capture.forget', { keys: ['a'] });
    expect(thumbnailKeys(session.read(captureSlice))).toEqual(['b']);

    session.dispatch('capture.forget', {});
    expect(session.read(captureSlice)).toEqual(noCaptures);
  });
});

describe('the feature', () => {
  it('names its commands with and without a target', () => {
    const { target } = fakeTarget();
    expect(captureFeature.id).toBe('capture');
    expect(captureFeature.commands.map((item) => item.name)).toEqual(['capture.image', 'capture.forget']);
    expect(captureFeatureWith(target).slice).toBe(captureSlice);
  });
});
