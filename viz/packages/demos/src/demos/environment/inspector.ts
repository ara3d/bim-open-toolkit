// What the sidebar shows: the preset in force and every value behind it.
//
// The sheet is a pure function of the session, so the host re-runs it after each change event and
// a test builds one from a known state without a canvas. Grid spacing of zero is reported as
// missing rather than as the number zero, because zero means "render chooses it from the model".

import { environmentSlice } from '@bim-open-toolkit/features';
import type { Session, Vec3 } from '@bim-open-toolkit/model';
import {
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertySheet,
  type PropertyValue,
} from '@bim-open-toolkit/ui-gratify';
import { presetDescriptions, presetOf, presetTitles } from './presets.js';

// A flag as a value, until the Gratify layer publishes one.
const flagValue = (on: boolean): PropertyValue => ({ kind: 'flag', text: on ? 'yes' : 'no', state: 'known' });

// A vector printed the way a light direction reads.
const vectorText = (vector: Vec3): string => vector.map((value) => value.toFixed(2)).join(', ');

// A colour printed as its three channels.
const colorText = (color: Vec3): string => color.map((value) => value.toFixed(2)).join(', ');

// The environment sheet: preset, light rig, background and ground, grid.
export const environmentSheet = (session: Session): PropertySheet => {
  const { settings } = session.read(environmentSlice);
  const choice = presetOf(settings);
  return propertySheet(
    'Environment',
    [
      propertyGroup('preset', 'Preset', [
        propertyRow('name', 'In force', knownValue(presetTitles[choice])),
        propertyRow('description', 'What it is for', knownValue(presetDescriptions[choice])),
      ]),
      propertyGroup('rig', 'Light rig', [
        propertyRow('ambient', 'Sky intensity', knownNumber(settings.rig.ambientIntensity)),
        propertyRow('sun', 'Sun intensity', knownNumber(settings.rig.sunIntensity)),
        propertyRow('direction', 'Sun direction', knownValue(vectorText(settings.rig.sunDirection))),
        propertyRow('warmth', 'Warmth', knownNumber(settings.rig.warmth)),
      ]),
      propertyGroup('ground', 'Background and ground', [
        propertyRow('background', 'Background', knownValue(colorText(settings.background))),
        propertyRow('groundPlane', 'Ground plane', flagValue(settings.groundPlane)),
        propertyRow('axes', 'Axes', flagValue(settings.axes)),
        propertyRow('up', 'Up axis', knownValue(settings.up)),
      ]),
      propertyGroup('grid', 'Grid', [
        propertyRow('enabled', 'Drawn', flagValue(settings.grid.enabled)),
        propertyRow(
          'spacing',
          'Spacing',
          settings.grid.spacing === 0
            ? missingValue('render chooses a spacing from the size of the model')
            : knownNumber(settings.grid.spacing, 'm'),
        ),
        propertyRow('emphasisEvery', 'Emphasis every', knownNumber(settings.grid.emphasisEvery, 'lines', 0)),
      ]),
    ],
    presetDescriptions[choice],
  );
};
