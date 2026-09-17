import { describe, expect, it } from 'vitest';
import { captureCanvas } from '../src/capture.js';

describe('captureCanvas', () => {
  it('renders synchronously immediately before PNG encoding', async () => {
    const calls: string[] = [];
    const blob = new Blob(['png'], { type: 'image/png' });
    const captured = captureCanvas({ width: 10, height: 20, toBlob(callback, type) { calls.push(type!); callback(blob); } }, () => { calls.push('render'); });
    expect(calls).toEqual(['render', 'image/png']);
    expect(await captured).toBe(blob);
  });
  it('supports asynchronous canvas callbacks', async () => {
    let callback!: (blob: Blob | null) => void;
    const capture = captureCanvas({ width: 1, height: 1, toBlob(value) { callback = value; } }, () => {});
    const blob = new Blob(['png']); callback(blob);
    expect(await capture).toBe(blob);
  });
  it('reports empty size, failed render, null encoding and thrown canvas errors', async () => {
    const canvas = { width: 1, height: 1, toBlob(callback: (blob: Blob | null) => void) { callback(null); } };
    await expect(captureCanvas({ ...canvas, width: 0 }, () => {})).rejects.toMatchObject({ code: 'invalid-size' });
    await expect(captureCanvas(canvas, () => { throw new Error('lost context'); })).rejects.toMatchObject({ code: 'render-failed', cause: { message: 'lost context' } });
    await expect(captureCanvas(canvas, () => {})).rejects.toMatchObject({ code: 'encode-failed' });
    await expect(captureCanvas({ ...canvas, toBlob() { throw new Error('tainted'); } }, () => {})).rejects.toMatchObject({ code: 'encode-failed', cause: { message: 'tainted' } });
  });
});
