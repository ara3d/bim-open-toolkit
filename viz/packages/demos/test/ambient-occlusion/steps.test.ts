import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import { boundsSize } from '@bim-open-toolkit/model';
import {
  SceneBinding,
  ambientOcclusionPass,
  defaultAmbientOcclusion,
  occlusionRadiusFor,
  occlusionRadiusShare,
} from '@bim-open-toolkit/render';
import { controls, defaultValues, settingsFromValues, valuesOf, type ControlKey } from '../../src/ambient-occlusion/controls.js';
import { demoFixture, demoStressOptions, fixtureNames, isFixtureName } from '../../src/ambient-occlusion/fixtures.js';
import { luminanceOf, luminanceStatistics } from '../../src/ambient-occlusion/pixels.js';
import { describePass, statusLine } from '../../src/ambient-occlusion/readout.js';

// A binding over a scene that draws nothing: `ViewerScene` is bookkeeping, so this needs no browser.
const bound = (name: (typeof fixtureNames)[number]) => {
  const fixture = demoFixture(name);
  const binding = new SceneBinding(new ViewerScene());
  const added = binding.addModel(fixture.modelId, fixture.geometry, fixture.keys);
  if (!added.ok) throw new Error(added.diagnostics.map((one) => one.message).join('; '));
  return { fixture, binding, diagnostics: added.diagnostics };
};

describe('the fixtures the page offers', () => {
  it('all bind without an error diagnostic and draw something', () => {
    for (const name of fixtureNames) {
      const { binding, diagnostics } = bound(name);
      expect(diagnostics.filter((one) => one.severity === 'error')).toEqual([]);
      expect(binding.statistics().renderedInstances).toBeGreaterThan(0);
    }
  });

  it('opens on the building the slice page also shows, so the two can be checked against each other', () => {
    expect(bound('building').binding.statistics()).toEqual({
      sourceObjects: 150,
      groups: 8,
      renderedInstances: 123,
      visibleInstances: 123,
      renderedTriangles: 1476,
    });
  });

  it('cuts the stress scene down to what a software renderer draws', () => {
    const { binding } = bound('stress');
    expect(demoStressOptions.instances).toBe(2000);
    expect(binding.statistics().renderedInstances).toBe(2000);
    expect(binding.statistics().renderedTriangles).toBeLessThanOrEqual(demoStressOptions.triangleBudget);
  });

  it('span three scales, so an automatic radius is actually exercised', () => {
    const radii = fixtureNames.map((name) => occlusionRadiusFor(bound(name).binding.bounds()));
    expect(new Set(radii.map((radius) => radius.toPrecision(3))).size).toBe(fixtureNames.length);
    for (const name of fixtureNames) {
      const bounds = bound(name).binding.bounds();
      const size = boundsSize(bounds);
      const widest = Math.max(...(size ?? [0]));
      const pass = ambientOcclusionPass(defaultAmbientOcclusion, bounds);
      expect(pass.ok && pass.value?.radius).toBeCloseTo(widest * occlusionRadiusShare);
    }
  });

  it('knows its own names and nothing else', () => {
    for (const name of fixtureNames) expect(isFixtureName(name)).toBe(true);
    expect(isFixtureName('snowdon')).toBe(false);
  });
});

describe('the settings panel', () => {
  it('has one control per setting and no setting without a control', () => {
    const keys = controls.map((spec) => spec.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual(Object.keys(valuesOf(defaultAmbientOcclusion)).sort());
  });

  it('opens on the render package’s default and reads it back unchanged', () => {
    const parsed = settingsFromValues(defaultValues);
    expect(parsed.ok && parsed.value).toEqual(defaultAmbientOcclusion);
  });

  it('round-trips every choice a control offers', () => {
    for (const spec of controls) {
      if (spec.kind !== 'choice') continue;
      for (const option of spec.options) {
        const parsed = settingsFromValues({ ...defaultValues, [spec.key]: option.value });
        expect(parsed.ok, `${spec.key} = ${option.value}`).toBe(true);
        expect(parsed.ok && String(parsed.value[spec.key])).toBe(option.value);
      }
    }
  });

  it('refuses what the render package refuses, naming the control', () => {
    const cases: readonly [ControlKey, string, string][] = [
      ['samples', '0', 'samples'],
      ['samples', 'many', 'samples'],
      ['intensity', '2', 'intensity'],
      ['radius', '-1', 'radius'],
      ['resolutionScale', '0.1', 'resolutionScale'],
      ['enabled', 'maybe', 'enabled'],
      ['output', 'normals', 'output'],
    ];
    for (const [key, value, path] of cases) {
      const parsed = settingsFromValues({ ...defaultValues, [key]: value });
      expect(parsed.ok, `${key} = ${value}`).toBe(false);
      expect(parsed.diagnostics[0]?.path[0]).toBe(path);
    }
  });

  it('treats an empty number as not a number rather than as zero', () => {
    expect(settingsFromValues({ ...defaultValues, intensity: '' }).ok).toBe(false);
  });
});

describe('luminance statistics', () => {
  const rgba = (...pixels: readonly (readonly [number, number, number])[]): Uint8Array =>
    Uint8Array.from(pixels.flatMap(([r, g, b]) => [r, g, b, 255]));

  it('is one for white, zero for black and in between for grey', () => {
    expect(luminanceOf(255, 255, 255)).toBeCloseTo(1);
    expect(luminanceOf(0, 0, 0)).toBe(0);
    expect(luminanceOf(128, 128, 128)).toBeCloseTo(128 / 255);
  });

  it('reports the mean, the extremes and the dark share', () => {
    const found = luminanceStatistics(rgba([255, 255, 255], [0, 0, 0], [255, 255, 255], [255, 255, 255]));
    expect(found.pixels).toBe(4);
    expect(found.mean).toBeCloseTo(0.75);
    expect(found.min).toBe(0);
    expect(found.max).toBeCloseTo(1);
    expect(found.darkShare).toBe(0.25);
  });

  it('is all zero for an empty buffer', () => {
    expect(luminanceStatistics(new Uint8Array(0))).toEqual({ pixels: 0, mean: 0, min: 0, max: 0, darkShare: 0 });
  });
});

describe('what the page says', () => {
  const pass = { radius: 0.8, intensity: 0.8, samples: 16, resolutionScale: 1, output: 'shaded' as const };

  it('describes the pass in force, or says it is off', () => {
    expect(describePass(undefined)).toBe('ambient occlusion off');
    expect(describePass(pass)).toContain('radius 0.800');
    expect(describePass(pass)).toContain('16 samples');
    expect(describePass({ ...pass, output: 'occlusion' })).toContain('term only');
  });

  it('puts the counts, the pass and the renderer in the status line', () => {
    const line = statusLine({
      fixture: 'building',
      objects: 150,
      instances: 123,
      triangles: 1476,
      lastFrameMs: 16.42,
      renderer: 'SwiftShader',
      pass,
    });
    expect(line).toContain('building: 150 objects');
    expect(line).toContain('123 instances');
    expect(line).toContain('ambient occlusion on');
    expect(line).toContain('last frame 16.4 ms');
    expect(line).toContain('SwiftShader');
  });
});
