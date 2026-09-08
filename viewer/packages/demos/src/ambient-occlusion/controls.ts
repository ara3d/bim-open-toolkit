// The settings panel as data: one description per setting drives both the controls the page
// builds and the parsing of what they hold. Pure.
//
// A control's value is always a string, because that is what a DOM input holds. Parsing goes
// through the render package's own check, so the page can never send a renderer a value the
// package would refuse.

import {
  checkAmbientOcclusion,
  defaultAmbientOcclusion,
  leastResolutionScale,
  mostSamples,
  type AmbientOcclusionSettings,
} from '@bim-open-toolkit/render';
import { diagnostic, failure, type Result } from '@bim-open-toolkit/model';

// A setting the panel shows: a switch, a choice between named values, or a number on a slider.
export type ControlSpec =
  | { readonly kind: 'toggle'; readonly key: 'enabled'; readonly label: string }
  | {
      readonly kind: 'choice';
      readonly key: 'output' | 'resolutionScale';
      readonly label: string;
      readonly options: readonly { readonly value: string; readonly label: string }[];
    }
  | {
      readonly kind: 'number';
      readonly key: 'radius' | 'intensity' | 'samples';
      readonly label: string;
      readonly min: number;
      readonly max: number;
      readonly step: number;
    };

// The key of a setting the panel controls.
export type ControlKey = ControlSpec['key'];

// The panel, top to bottom.
export const controls: readonly ControlSpec[] = [
  { kind: 'toggle', key: 'enabled', label: 'Ambient occlusion' },
  {
    kind: 'choice',
    key: 'output',
    label: 'Show',
    options: [
      { value: 'shaded', label: 'Shaded picture' },
      { value: 'occlusion', label: 'Occlusion only' },
    ],
  },
  { kind: 'number', key: 'radius', label: 'Radius (0 picks one from the model)', min: 0, max: 5, step: 0.05 },
  { kind: 'number', key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.05 },
  { kind: 'number', key: 'samples', label: 'Samples per pixel', min: 1, max: mostSamples, step: 1 },
  {
    kind: 'choice',
    key: 'resolutionScale',
    label: 'Occlusion buffer',
    options: [
      { value: '1', label: 'Full size' },
      { value: '0.5', label: 'Half size' },
      { value: String(leastResolutionScale), label: 'Quarter size' },
    ],
  },
];

// The control values that show these settings.
export const valuesOf = (settings: AmbientOcclusionSettings): Readonly<Record<ControlKey, string>> => ({
  enabled: String(settings.enabled),
  output: settings.output,
  radius: String(settings.radius),
  intensity: String(settings.intensity),
  samples: String(settings.samples),
  resolutionScale: String(settings.resolutionScale),
});

// The values the page opens with.
export const defaultValues = valuesOf(defaultAmbientOcclusion);

const numberOf = (values: Readonly<Record<ControlKey, string>>, key: ControlKey): number =>
  values[key].trim() === '' ? Number.NaN : Number(values[key]);

// The settings these control values describe, checked by the render package. A value that is not
// a number or not one of the named choices is a diagnostic naming the control.
export const settingsFromValues = (
  values: Readonly<Record<ControlKey, string>>,
): Result<AmbientOcclusionSettings> => {
  if (values.enabled !== 'true' && values.enabled !== 'false')
    return failure([diagnostic('bad-toggle', 'Ambient occlusion is either on or off', ['enabled'])]);
  if (values.output !== 'shaded' && values.output !== 'occlusion')
    return failure([diagnostic('bad-output', 'The output must be shaded or occlusion', ['output'])]);
  return checkAmbientOcclusion({
    enabled: values.enabled === 'true',
    output: values.output,
    radius: numberOf(values, 'radius'),
    intensity: numberOf(values, 'intensity'),
    samples: numberOf(values, 'samples'),
    resolutionScale: numberOf(values, 'resolutionScale'),
  });
};
