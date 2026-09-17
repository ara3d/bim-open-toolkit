// What is on screen, read back out of the session rather than remembered.
//
// A class row is one legend swatch paired with the rule that painted it, so its count is the number
// of objects that rule actually named. Counting any other way could disagree with the picture.

import { appearanceSlice, type Legend } from '@bim-open-toolkit/features';
import type { Color, Session, StyleRule } from '@bim-open-toolkit/model';
import { colourColumns, conflictingLegendId, legendIdOf, type ColourColumnId } from './colouring.js';

// Whether a swatch stands for a recorded value, for no value, or for sources that disagree.
export type ClassState = 'known' | 'missing' | 'conflicting';

// One legend swatch with the rule that painted it.
export type ClassRow = {
  readonly ruleId: string;
  readonly label: string;
  readonly colour: Color;
  readonly count: number;
  readonly enabled: boolean;
  readonly state: ClassState;
};

const mix = (low: Color, high: Color, fraction: number): Color => [
  low[0] + (high[0] - low[0]) * fraction,
  low[1] + (high[1] - low[1]) * fraction,
  low[2] + (high[2] - low[2]) * fraction,
];

// A number without a trailing zero it did not earn.
const round = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1));

// The swatches of one legend, in the order it lists them, with the missing swatch last.
const swatchesOf = (legend: Legend): readonly { readonly id: string; readonly label: string; readonly colour: Color }[] => {
  const missing = { id: `${legend.id}/missing`, label: legend.missing.label, colour: legend.missing.color };
  if (legend.kind === 'category')
    return [
      ...legend.entries.map((entry) => ({ id: `${legend.id}/${entry.value}`, label: entry.label, colour: entry.color })),
      missing,
    ];
  const step = (legend.max - legend.min) / legend.bands;
  return [
    ...Array.from({ length: legend.bands }, (_unused, band) => ({
      id: `${legend.id}/${band}`,
      label: `${round(legend.min + band * step)} to ${round(legend.min + (band + 1) * step)}`,
      colour: mix(legend.low, legend.high, legend.bands <= 1 ? 0.5 : (band + 0.5) / legend.bands),
    })),
    missing,
  ];
};

const stateOf = (legend: Legend, ruleId: string): ClassState =>
  legend.id === conflictingLegendId ? 'conflicting' : ruleId.endsWith('/missing') ? 'missing' : 'known';

// Every swatch of every legend the session holds, with what the matching rule named. A swatch whose
// rule is gone is left out rather than reported with a count of zero it never had.
export const classRows = (session: Session): readonly ClassRow[] => {
  const state = session.read(appearanceSlice);
  const byId = new Map<string, StyleRule>(state.rules.map((rule) => [rule.id, rule]));
  return state.legends.flatMap((legend) =>
    swatchesOf(legend).flatMap((swatch) => {
      const rule = byId.get(swatch.id);
      if (rule === undefined) return [];
      return [
        {
          ruleId: rule.id,
          label: swatch.label,
          colour: swatch.colour,
          count: rule.targets.length,
          enabled: rule.enabled,
          state: stateOf(legend, rule.id),
        },
      ];
    }),
  );
};

// How many objects each swatch state accounts for.
export const classCounts = (rows: readonly ClassRow[]): Readonly<Record<ClassState, number>> => {
  const counts = { known: 0, missing: 0, conflicting: 0 };
  for (const row of rows) counts[row.state] += row.count;
  return counts;
};

// The column the session is coloured by, or undefined when nothing has been applied.
export const chosenColumn = (session: Session): ColourColumnId | undefined => {
  const ids = new Set(session.read(appearanceSlice).legends.map((legend) => legend.id));
  return colourColumns.find((column) => ids.has(legendIdOf(column.id)))?.id;
};
