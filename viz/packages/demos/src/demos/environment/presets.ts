// The four environments this demo offers, as whole settings rather than partial edits.
//
// A preset is resolved against render's own default once, here, so the panel can say which preset
// is in force by comparing the settings it reads back. A patch alone could not answer that: two
// different patches can leave the model looking the same, and the slice keeps settings, not patches.

import { withPatch, type EnvironmentPatch } from '@bim-open-toolkit/features';
import { defaultEnvironment, type EnvironmentSettings } from '@bim-open-toolkit/render';

export type PresetName = 'studio' | 'overcast' | 'night' | 'plan';

// What the panel shows when the settings match no preset, because something else changed them.
export type PresetChoice = PresetName | 'custom';

// The presets in the order the row lists them.
export const presetNames: readonly PresetName[] = ['studio', 'overcast', 'night', 'plan'];

// The words on the buttons.
export const presetTitles: Readonly<Record<PresetChoice, string>> = {
  studio: 'Studio',
  overcast: 'Overcast',
  night: 'Night',
  plan: 'Plan',
  custom: 'Custom',
};

// One sentence per preset, for the inspector and the README.
export const presetDescriptions: Readonly<Record<PresetChoice, string>> = {
  studio: 'One warm sun and a soft sky over a neutral ground.',
  overcast: 'Sky light only, so nothing is lost in a shadow.',
  night: 'A dark ground and one cold low sun, for silhouettes.',
  plan: 'Flat light, no ground and a fine grid, for reading a layout.',
  custom: 'Settings that match none of the presets.',
};

// The patches the presets apply over render's default environment. Every preset states the up axis
// so choosing one never leaves the grid in the plane the previous one used.
const patches: Readonly<Record<PresetName, EnvironmentPatch>> = {
  studio: {
    background: [0.9, 0.91, 0.93],
    rig: { ambientIntensity: 0.55, sunIntensity: 1.4, sunDirection: [0.4, 0.35, 0.85], warmth: 0.2 },
    grid: { enabled: true, spacing: 0, emphasisEvery: 5 },
    groundPlane: true,
    axes: true,
    up: 'z',
  },
  overcast: {
    background: [0.86, 0.88, 0.9],
    rig: { ambientIntensity: 1.1, sunIntensity: 0.25, sunDirection: [0.1, 0.1, 1], warmth: 0 },
    grid: { enabled: true, spacing: 0, emphasisEvery: 5 },
    groundPlane: true,
    axes: true,
    up: 'z',
  },
  night: {
    background: [0.06, 0.07, 0.09],
    rig: { ambientIntensity: 0.18, sunIntensity: 0.9, sunDirection: [-0.6, -0.3, 0.2], warmth: 0 },
    grid: { enabled: true, spacing: 0, color: [0.2, 0.21, 0.24], emphasisColor: [0.3, 0.31, 0.35], emphasisEvery: 5 },
    groundPlane: false,
    axes: true,
    up: 'z',
  },
  plan: {
    background: [0.98, 0.98, 0.97],
    rig: { ambientIntensity: 1.3, sunIntensity: 0, sunDirection: [0, 0, 1], warmth: 0 },
    grid: { enabled: true, spacing: 1, color: [0.85, 0.85, 0.83], emphasisColor: [0.6, 0.6, 0.58], emphasisEvery: 10 },
    groundPlane: false,
    axes: false,
    up: 'z',
  },
};

// The whole settings each preset stands for.
export const presets: Readonly<Record<PresetName, EnvironmentSettings>> = {
  studio: withPatch(defaultEnvironment, patches.studio),
  overcast: withPatch(defaultEnvironment, patches.overcast),
  night: withPatch(defaultEnvironment, patches.night),
  plan: withPatch(defaultEnvironment, patches.plan),
};

// The preset a demo opens with.
export const openingPreset: PresetName = 'studio';

const sameNumbers = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length && left.every((value, at) => value === right[at]);

// True when two settings would draw the same environment.
export const sameEnvironment = (left: EnvironmentSettings, right: EnvironmentSettings): boolean =>
  sameNumbers(left.background, right.background) &&
  left.rig.ambientIntensity === right.rig.ambientIntensity &&
  left.rig.sunIntensity === right.rig.sunIntensity &&
  left.rig.warmth === right.rig.warmth &&
  sameNumbers(left.rig.sunDirection, right.rig.sunDirection) &&
  left.grid.enabled === right.grid.enabled &&
  left.grid.spacing === right.grid.spacing &&
  left.grid.emphasisEvery === right.grid.emphasisEvery &&
  sameNumbers(left.grid.color, right.grid.color) &&
  sameNumbers(left.grid.emphasisColor, right.grid.emphasisColor) &&
  left.groundPlane === right.groundPlane &&
  left.axes === right.axes &&
  left.up === right.up;

// Which preset these settings are, or `custom` when they are none of them.
export const presetOf = (settings: EnvironmentSettings): PresetChoice =>
  presetNames.find((name) => sameEnvironment(settings, presets[name])) ?? 'custom';
