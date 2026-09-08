// Saying what is known about a value, in words, without ever inventing one.
//
// A component must not print an unknown width as a blank cell or as zero. These functions turn the
// model package's `Observation` into text that names the state first: a reader sees "missing
// (not-measured)" or "conflicting: EI90 vs EI60", never a number that was not observed.

import type { Color, Coverage, Evidence, FactValue, Observation } from '@bim-open-toolkit/model';

// One value as text. A quantity keeps its unit, because a number without one says nothing.
export const factValueText = (value: FactValue): string => {
  switch (value.kind) {
    case 'quantity':
      return `${String(value.quantity.value)} ${value.quantity.unit}`;
    case 'text':
      return value.text;
    case 'flag':
      return value.value ? 'yes' : 'no';
    case 'reference':
      return value.ref.objectId;
    case 'bounds':
      return `${value.bounds.min.join(', ')} to ${value.bounds.max.join(', ')}`;
  }
};

// What is known about a value, as one line. The state is always first.
export const observationText = (observation: Observation): string => {
  switch (observation.kind) {
    case 'known':
      return factValueText(observation.value);
    case 'missing':
      return `missing (${observation.reason})`;
    case 'conflicting':
      return observation.values.length === 0
        ? 'conflicting (the disputed values were not carried)'
        : `conflicting: ${observation.values.map(factValueText).join(' vs ')}`;
  }
};

// Where an observation came from, as one line per source.
export const evidenceText = (evidence: readonly Evidence[]): readonly string[] =>
  evidence.map((one) => (one.reference === undefined ? one.source : `${one.source} (${one.reference})`));

// How complete a set of observations is, as one line.
export const coverageText = (coverage: Coverage): string =>
  `${String(coverage.known)} known, ${String(coverage.missing)} missing, ` +
  `${String(coverage.conflicting)} conflicting of ${String(coverage.total)}`;

// A model colour as CSS. Components never write colour numbers of their own: every swatch in this
// package is the colour a rule actually applies, so a legend cannot drift from the picture.
export const cssColor = (color: Color): string => {
  const channel = (value: number): number => Math.round(Math.min(Math.max(value, 0), 1) * 255);
  return `rgb(${String(channel(color[0]))}, ${String(channel(color[1]))}, ${String(channel(color[2]))})`;
};
