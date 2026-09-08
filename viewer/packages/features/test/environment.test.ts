import { describe, expect, it } from 'vitest';
import { emptyBounds, emptyDocument, getSlice, putSlice, type Bounds } from '@bim-open-toolkit/model';
import { defaultEnvironment, type EnvironmentDrawing, type LineSegment } from '@bim-open-toolkit/render';
import {
  boundsLines,
  defaultEnvironmentState,
  environmentCommands,
  environmentFeature,
  environmentHook,
  environmentSlice,
  withPatch,
} from '../src/environment.js';
import { fakeSession } from './support/fake-session.js';

const bounds: Bounds = { min: [0, 0, 0], max: [10, 10, 4] };

const session = () => fakeSession(environmentCommands);

describe('environment settings', () => {
  it('keeps every value a patch does not mention', () => {
    const patched = withPatch(defaultEnvironment, { rig: { warmth: 0.5 }, axes: false });
    expect(patched.rig.warmth).toBe(0.5);
    expect(patched.rig.sunIntensity).toBe(defaultEnvironment.rig.sunIntensity);
    expect(patched.axes).toBe(false);
    expect(patched.grid).toEqual(defaultEnvironment.grid);
  });

  it('draws the twelve edges of a box, and nothing for an empty one', () => {
    const lines = boundsLines(bounds);
    expect(lines).toHaveLength(12);
    expect(lines[0]).toEqual({ from: [0, 0, 0], to: [10, 0, 0], color: lines[0]?.color });
    expect(boundsLines(emptyBounds)).toEqual([]);
  });
});

describe('the environment slice', () => {
  it('round-trips through a document', () => {
    const saved = { settings: withPatch(defaultEnvironment, { axes: false }), boundsDisplay: true };
    const document = putSlice(emptyDocument(), environmentSlice, saved);
    const read = getSlice(document, environmentSlice);
    expect(read.ok && read.value).toEqual(saved);
  });

  it('reads its default out of a document that has no environment', () => {
    const read = getSlice(emptyDocument(), environmentSlice);
    expect(read.ok && read.value).toEqual(defaultEnvironmentState);
  });

  it('refuses a value written at a version it does not know', () => {
    const read = getSlice(
      { ...emptyDocument(), slices: { environment: { version: 2, value: defaultEnvironmentState } } },
      environmentSlice,
    );
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/version']);
  });
});

describe('the environment command', () => {
  it('changes what it is given and leaves the rest alone', () => {
    const live = session();
    const done = live.dispatch('environment.set', { background: [0, 0, 0], grid: { enabled: false } });
    expect(done.ok).toBe(true);
    const state = live.read(environmentSlice);
    expect(state.settings.background).toEqual([0, 0, 0]);
    expect(state.settings.grid.enabled).toBe(false);
    expect(state.settings.rig).toEqual(defaultEnvironment.rig);
    expect(live.events).toEqual(['environment.set:environment']);
  });

  it('refuses a value a renderer could not draw, and leaves the slice as it was', () => {
    const live = session();
    expect(
      live.dispatch('environment.set', { background: [2, 0, 0] }).diagnostics.map((item) => item.code),
    ).toEqual(['bad-color']);
    expect(
      live.dispatch('environment.set', { rig: { warmth: 2 } }).diagnostics.map((item) => item.code),
    ).toEqual(['bad-warmth']);
    expect(live.read(environmentSlice)).toEqual(defaultEnvironmentState);
  });

  it('turns the bounding-box display on without touching the settings', () => {
    const live = session();
    live.dispatch('environment.set', { boundsDisplay: true });
    const state = live.read(environmentSlice);
    expect(state.boundsDisplay).toBe(true);
    expect(state.settings).toEqual(defaultEnvironment);
  });
});

describe('the environment hook', () => {
  it('draws the environment, follows every change, and clears on disposal', () => {
    const drawings: (EnvironmentDrawing | undefined)[] = [];
    const boxes: (readonly LineSegment[])[] = [];
    const live = session();
    const installed = environmentHook({
      target: { setEnvironment: (drawing) => drawings.push(drawing) },
      bounds: () => bounds,
      setBoundsDisplay: (lines) => boxes.push(lines),
    })(live);
    expect(drawings[0]?.grid.length).toBeGreaterThan(0);
    expect(drawings[0]?.groundHeight).toBe(0);
    expect(boxes[0]).toEqual([]);

    live.dispatch('environment.set', { grid: { enabled: false }, boundsDisplay: true });
    expect(drawings[drawings.length - 1]?.grid).toEqual([]);
    expect(boxes[boxes.length - 1]).toHaveLength(12);

    installed.dispose();
    expect(drawings[drawings.length - 1]).toBeUndefined();
    expect(boxes[boxes.length - 1]).toEqual([]);
  });

  it('costs nothing when the host draws no bounding box', () => {
    const drawings: (EnvironmentDrawing | undefined)[] = [];
    const live = session();
    const installed = environmentHook({
      target: { setEnvironment: (drawing) => drawings.push(drawing) },
      bounds: () => bounds,
    })(live);
    live.dispatch('environment.set', { boundsDisplay: true });
    expect(drawings).toHaveLength(2);
    installed.dispose();
  });
});

describe('the feature', () => {
  it('owns the environment slice and its one command', () => {
    expect(environmentFeature.id).toBe('environment');
    expect(environmentFeature.slice.id).toBe('environment');
    expect(environmentFeature.commands.map((item) => item.name)).toEqual(['environment.set']);
  });
});
