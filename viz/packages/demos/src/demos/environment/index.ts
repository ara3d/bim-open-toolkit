// Demo 7, "Make it readable: light, ground, grid".
//
// The opening sequence is a plain function of the session so it can be run and asserted without a
// canvas; `start` is the contract's wrapper around it. Nothing here draws: the environment feature's
// own hook puts the settings on a renderer, and this demo only chooses which settings.

import { environmentFeature, environmentSlice } from '@bim-open-toolkit/features';
import { disposable, failure, success, type Disposable, type Result, type Session } from '@bim-open-toolkit/model';
import { snowdonThenSynthetic } from '../_shared/snowdon.js';
import type { DemoReport } from '../../feature-demos/_shared/protocol.js';
import type { Demo } from '../../gallery/contracts.js';
import { environmentSheet } from './inspector.js';
import { environmentPanels } from './panels.js';
import { openingPreset, presetOf, presets, presetTitles } from './presets.js';

// Applies the opening preset and hands back the way to put the environment back as it was.
export const startEnvironment = (session: Session): Result<Disposable> => {
  const before = session.read(environmentSlice);
  const applied = session.dispatch('environment.set', presets[openingPreset]);
  if (!applied.ok) return failure(applied.diagnostics);
  return success(
    disposable(() => {
      session.dispatch('environment.set', before.settings);
    }),
    applied.diagnostics,
  );
};

// True once an environment this demo offers is in force.
export const environmentReady = (session: Session): boolean =>
  presetOf(session.read(environmentSlice).settings) !== 'custom';

// What a browser smoke reads back: the preset and the values that make it different from the others.
export const environmentReport = (session: Session): DemoReport => {
  const { settings } = session.read(environmentSlice);
  return {
    preset: presetTitles[presetOf(settings)],
    sunIntensity: settings.rig.sunIntensity,
    skyIntensity: settings.rig.ambientIntensity,
    groundPlane: settings.groundPlane,
    axes: settings.axes,
    grid: settings.grid.enabled,
    up: settings.up,
  };
};

export const demo: Demo = {
  id: 'environment',
  chapter: 'cut-and-arrange',
  title: 'Environment',
  question: 'Make it readable: light, ground, grid.',
  briefIds: ['F10'],
  features: [environmentFeature],
  fixtures: snowdonThenSynthetic,
  panels: environmentPanels,
  inspector: environmentSheet,
  start: (viewer) => Promise.resolve(startEnvironment(viewer)),
  ready: environmentReady,
  report: environmentReport,
  source: 'viewer/packages/demos/src/demos/environment',
  verify: 'npx vitest run --root packages/demos test/demos/environment',
};
