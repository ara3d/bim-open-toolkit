import { describe, expect, it } from 'vitest';
import { captureImage, captureSize, pngFormat, thumbnailSize, type CaptureTarget } from '../src/capture.js';

type Fake = CaptureTarget & {
  readonly sizes: { width: number; height: number }[];
  readonly frames: () => number;
};

const fakeTarget = (options: {
  width?: number;
  height?: number;
  bytes?: Uint8Array;
  renderThrows?: boolean;
  encodeRejects?: boolean;
} = {}): Fake => {
  let width = options.width ?? 800;
  let height = options.height ?? 600;
  let frames = 0;
  const sizes: { width: number; height: number }[] = [];
  return {
    sizes,
    frames: () => frames,
    size: () => ({ width, height }),
    resize: (nextWidth, nextHeight) => {
      width = nextWidth;
      height = nextHeight;
      sizes.push({ width, height });
    },
    renderFrame: () => {
      if (options.renderThrows === true) throw new Error('context lost');
      frames++;
    },
    encode: async () => {
      if (options.encodeRejects === true) throw new Error('tainted canvas');
      return options.bytes ?? Uint8Array.of(137, 80, 78, 71);
    },
  };
};

describe('captureSize', () => {
  const view = { width: 800, height: 600 };

  it('captures at the view size when nothing is asked for', () => {
    const size = captureSize(view, {});
    expect(size.ok && size.value).toEqual(view);
  });

  it('keeps the aspect ratio when one dimension is asked for', () => {
    const wide = captureSize(view, { width: 400 });
    expect(wide.ok && wide.value).toEqual({ width: 400, height: 300 });
    const tall = captureSize(view, { height: 300 });
    expect(tall.ok && tall.value).toEqual({ width: 400, height: 300 });
  });

  it('takes both dimensions as given', () => {
    const size = captureSize(view, { width: 100, height: 100 });
    expect(size.ok && size.value).toEqual({ width: 100, height: 100 });
  });

  it('refuses a view or a capture that is not a picture', () => {
    expect(captureSize({ width: 0, height: 600 }, {}).ok).toBe(false);
    expect(captureSize(view, { width: 0 }).ok).toBe(false);
    expect(captureSize(view, { width: 100_000 }).ok).toBe(false);
    expect(captureSize(view, { width: Number.NaN }).ok).toBe(false);
  });
});

describe('thumbnailSize', () => {
  it('fits the longest edge', () => {
    const wide = thumbnailSize({ width: 800, height: 600 }, 200);
    expect(wide.ok && wide.value).toEqual({ width: 200, height: 150 });
    const tall = thumbnailSize({ width: 600, height: 800 }, 200);
    expect(tall.ok && tall.value).toEqual({ width: 150, height: 200 });
  });
});

describe('captureImage', () => {
  it('draws immediately before encoding and reports the size it drew at', async () => {
    const target = fakeTarget();
    const result = await captureImage(target);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(target.frames()).toBe(1);
    expect(result.value.width).toBe(800);
    expect(result.value.format).toBe(pngFormat);
    expect(result.value.bytes.length).toBe(4);
  });

  it('puts the view back to the size it had, so a thumbnail does not disturb it', async () => {
    const target = fakeTarget();
    const result = await captureImage(target, { width: 200 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.width).toBe(200);
    expect(result.value.height).toBe(150);
    expect(target.sizes).toEqual([
      { width: 200, height: 150 },
      { width: 800, height: 600 },
    ]);
    expect(target.size()).toEqual({ width: 800, height: 600 });
  });

  it('does not resize at all when the view is already the right size', async () => {
    const target = fakeTarget();
    await captureImage(target, { width: 800, height: 600 });
    expect(target.sizes).toHaveLength(0);
  });

  it('reports a failed frame and restores the size', async () => {
    const target = fakeTarget({ renderThrows: true });
    const result = await captureImage(target, { width: 200 });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('render-failed');
    expect(result.diagnostics[0]?.message).toContain('context lost');
    expect(target.size()).toEqual({ width: 800, height: 600 });
  });

  it('reports a refused encoding rather than an unexplained blank', async () => {
    const result = await captureImage(fakeTarget({ encodeRejects: true }));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('encode-failed');
    expect(result.diagnostics[0]?.message).toContain('tainted canvas');
  });

  it('reports an empty image instead of returning zero bytes', async () => {
    const result = await captureImage(fakeTarget({ bytes: new Uint8Array(0) }));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('empty-image');
  });

  it('refuses a size that is not a picture without touching the renderer', async () => {
    const target = fakeTarget();
    const result = await captureImage(target, { width: -5 });
    expect(result.ok).toBe(false);
    expect(target.frames()).toBe(0);
    expect(target.sizes).toHaveLength(0);
  });
});
