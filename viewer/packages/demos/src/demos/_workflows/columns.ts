// Reading a synthetic generator's tables back into the observations a workflow adapter takes.
//
// The generators follow one convention: an observed field named `foo` is the columns `foo`,
// `fooUnit`, `fooState`, `fooMissingReason`, `fooConflict` and `fooEvidence`, and the state column
// is the one to read. Turning those six columns back into one observation is the same code for
// every workflow, so it lives here rather than in each demo.

import { rowOf, type CellValue, type MissingReason, type Table } from '@bim-open-toolkit/model';
import { missingReasons, type ObservationJson } from '@bim-open-toolkit/workflows';

// The cells of one row, addressed by column name.
export type Cells = Readonly<Record<string, CellValue>>;

// Every row of a table, in order.
export const rows = (source: Table): readonly Cells[] =>
  Array.from({ length: source.rowCount }, (_unused, row) => rowOf(source, row));

// A cell as text; anything that is not text reads as empty, which is what the generators write.
export const textAt = (value: CellValue | undefined): string => (typeof value === 'string' ? value : '');

// A cell as a number; anything that is not a number reads as NaN, never as zero.
export const numberAt = (value: CellValue | undefined): number => (typeof value === 'number' ? value : Number.NaN);

// A cell as a flag; only a true reads as true.
export const flagAt = (value: CellValue | undefined): boolean => value === true;

// Text, or nothing when the cell is empty, for a field only written when it says something.
export const textOrNothing = (value: string): string | undefined => (value === '' ? undefined : value);

// The stated reason a value is unavailable. A reason the vocabulary does not name reads as
// `not-provided`, which is the weakest claim, rather than as the nearest match.
export const reasonAt = (value: CellValue | undefined): MissingReason =>
  missingReasons.find((reason) => reason === textAt(value)) ?? 'not-provided';

// A text field's observation, rebuilt from its state, value and conflict columns.
export const textObservation = (cells: Cells, name: string): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  if (state === 'known') return { kind: 'known', value: textAt(cells[name]) };
  if (state === 'conflicting') return { kind: 'conflicting', values: textAt(cells[`${name}Conflict`]).split(' vs ') };
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};

// A quantity field's observation, rebuilt from its state, value, unit and conflict columns.
export const quantityObservation = (cells: Cells, name: string): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  const unit = textOrNothing(textAt(cells[`${name}Unit`]));
  if (state === 'known') return { kind: 'known', value: numberAt(cells[name]), unit };
  if (state === 'conflicting')
    return {
      kind: 'conflicting',
      values: textAt(cells[`${name}Conflict`])
        .split(' vs ')
        .map((part) => Number.parseFloat(part)),
      unit,
    };
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};
