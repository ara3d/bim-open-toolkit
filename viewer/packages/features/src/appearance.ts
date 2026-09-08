// Style rules, legends and the composition that turns them into what a renderer draws.
//
// A rule is a change applied to the objects it names, at a priority. Colouring by a category or by
// a numeric column is not a different kind of rule: it is a builder that reads a table once and
// produces ordinary rules plus a legend, so the slice stays plain data, a saved document carries
// exactly what was applied, and a UI draws the legend from the same value the rules came from.
//
// A numeric scale is banded rather than continuous because a rule carries one colour. The band
// count is in the legend, so the swatches a UI draws are the colours the objects actually got.
// Values that are absent, not a number or outside the scale get the legend's missing colour, which
// is always stated rather than defaulted, because "no data" and "the low end of the scale" are
// different answers.
//
// The composition order is M1's: base appearances, then edit layers, then ordered rules, then the
// isolation filter, then the selection. This feature does not re-implement it; it reads the sets
// and edits slices and hands the pieces to `styleComposition`.

import {
  array,
  boolean,
  command,
  diagnostic,
  failure,
  feature,
  literal,
  numberAt,
  numericColumnOf,
  object,
  onSlices,
  optional,
  resolveStyles,
  stateSlice,
  string,
  stringAt,
  stringColumnOf,
  styleComposition,
  success,
  union,
  type Appearance,
  type Color,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type ObjectKey,
  type ResolvedStyles,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type StyleComposition,
  type StyleRule,
  type Table,
} from '@bim-open-toolkit/model';
import {
  colorSchema,
  finiteNumber,
  noInput,
  styleRuleSchema,
} from './appearance-schemas.js';
import { editEffectOf, editLayers, editsSlice } from './edits.js';
import { effectiveSelection, isolationOf, setsSlice } from './sets.js';
import type { RenderTarget } from './appearance-render.js';

// One swatch of a legend: what it means, what it is called, and the colour it got.
export type LegendEntry = { readonly value: string; readonly label: string; readonly color: Color };

// What a colouring means, as data a panel draws without asking the renderer anything.
// A category legend names its swatches; a numeric one names its ends, its range and its bands.
export type Legend =
  | {
      readonly kind: 'category';
      readonly id: string;
      readonly title: string;
      readonly entries: readonly LegendEntry[];
      readonly missing: LegendEntry;
    }
  | {
      readonly kind: 'numeric';
      readonly id: string;
      readonly title: string;
      readonly min: number;
      readonly max: number;
      readonly bands: number;
      readonly low: Color;
      readonly high: Color;
      readonly missing: LegendEntry;
    };

// What the appearance feature owns: the ordered rules and the legends that explain them.
export type AppearanceState = { readonly rules: readonly StyleRule[]; readonly legends: readonly Legend[] };

// One legend swatch as plain data.
export const legendEntrySchema: Schema<LegendEntry> = object({
  value: string(),
  label: string(),
  color: colorSchema,
});

// A legend as plain data.
export const legendSchema: Schema<Legend> = union<Legend>(
  object({
    kind: literal('category'),
    id: string(),
    title: string(),
    entries: array(legendEntrySchema),
    missing: legendEntrySchema,
  }),
  object({
    kind: literal('numeric'),
    id: string(),
    title: string(),
    min: finiteNumber(),
    max: finiteNumber(),
    bands: finiteNumber(),
    low: colorSchema,
    high: colorSchema,
    missing: legendEntrySchema,
  }),
);

// The saved shape of the appearance feature.
export const appearanceStateSchema: Schema<AppearanceState> = object({
  rules: array(styleRuleSchema),
  legends: array(legendSchema),
});

// Nothing styled.
export const noAppearanceState: AppearanceState = { rules: [], legends: [] };

// Version 1 has nothing to migrate from; a later version adds its step here.
export const appearanceMigrations: readonly Migration[] = [];

// The rules and legends, as a document holds them.
export const appearanceSlice: StateSlice<AppearanceState> = stateSlice(
  'appearance',
  1,
  appearanceStateSchema,
  noAppearanceState,
  appearanceMigrations,
);

// A colouring: the rules that apply it and the legend that explains it, made together from one
// table so they can never disagree.
export type Styling = { readonly rules: readonly StyleRule[]; readonly legend: Legend };

// What a category colouring is given: the value to colour, what to call it, and what unlisted or
// absent values get.
export type CategoryPalette = {
  readonly title: string;
  readonly entries: readonly LegendEntry[];
  readonly missing: LegendEntry;
};

// What a numeric colouring is given: a fixed range so two models compare, the colours of its ends,
// how many bands to divide it into, and what a value that is not a number gets.
export type NumericScale = {
  readonly title: string;
  readonly min: number;
  readonly max: number;
  readonly low: Color;
  readonly high: Color;
  readonly bands: number;
  readonly missing: LegendEntry;
};

const keysOfColumn = (source: Table, keyColumn: string): readonly ObjectKey[] | undefined => {
  const column = stringColumnOf(source, keyColumn);
  if (column === undefined) return undefined;
  return Array.from({ length: source.rowCount }, (_unused, row) => stringAt(column, row) ?? '');
};

const mix = (low: Color, high: Color, fraction: number): Color => [
  (low[0] ?? 0) + ((high[0] ?? 0) - (low[0] ?? 0)) * fraction,
  (low[1] ?? 0) + ((high[1] ?? 0) - (low[1] ?? 0)) * fraction,
  (low[2] ?? 0) + ((high[2] ?? 0) - (low[2] ?? 0)) * fraction,
];

// The colour of one band's midpoint, which is the colour every value in that band gets.
export const bandColor = (scale: NumericScale, band: number): Color =>
  mix(scale.low, scale.high, scale.bands <= 1 ? 0.5 : (band + 0.5) / scale.bands);

// Which band a value falls in, clamped to the ends, or undefined when it is not a number.
export const bandOf = (scale: NumericScale, value: number | undefined): number | undefined => {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  if (scale.max === scale.min) return Math.floor((scale.bands - 1) / 2);
  const fraction = (value - scale.min) / (scale.max - scale.min);
  return Math.min(scale.bands - 1, Math.max(0, Math.floor(fraction * scale.bands)));
};

// Rules and a legend that colour objects by a string column, one rule per legend swatch plus one
// for the objects the palette does not name. A value the palette does not list is missing, not a
// silently invented colour.
export const categoryStyling = (
  id: string,
  source: Table,
  keyColumn: string,
  valueColumn: string,
  palette: CategoryPalette,
  priority = 0,
): Result<Styling> => {
  const keys = keysOfColumn(source, keyColumn);
  const values = stringColumnOf(source, valueColumn);
  if (keys === undefined || values === undefined)
    return failure([
      diagnostic(
        'appearance/missing-column',
        `Colouring by category needs string columns "${keyColumn}" and "${valueColumn}".`,
        ['columns'],
      ),
    ]);
  const listed = new Set(palette.entries.map((entry) => entry.value));
  const targets = new Map<string, ObjectKey[]>();
  const absent: ObjectKey[] = [];
  for (let row = 0; row < source.rowCount; row++) {
    const key = keys[row];
    if (key === undefined || key === '') continue;
    const value = stringAt(values, row);
    if (value === undefined || !listed.has(value)) {
      absent.push(key);
      continue;
    }
    const held = targets.get(value);
    if (held === undefined) targets.set(value, [key]);
    else held.push(key);
  }
  const rules: StyleRule[] = palette.entries.map((entry) => ({
    id: `${id}/${entry.value}`,
    name: entry.label,
    enabled: true,
    priority,
    targets: targets.get(entry.value) ?? [],
    change: { color: entry.color },
  }));
  rules.push({
    id: `${id}/missing`,
    name: palette.missing.label,
    enabled: true,
    priority,
    targets: absent,
    change: { color: palette.missing.color },
  });
  return success({
    rules,
    legend: {
      kind: 'category',
      id,
      title: palette.title,
      entries: palette.entries,
      missing: palette.missing,
    },
  });
};

// Rules and a legend that colour objects by a numeric column, one rule per band plus one for the
// objects whose value is absent or not a number. The range is given rather than measured, so two
// models coloured with the same scale compare.
export const numericStyling = (
  id: string,
  source: Table,
  keyColumn: string,
  valueColumn: string,
  scale: NumericScale,
  priority = 0,
): Result<Styling> => {
  const keys = keysOfColumn(source, keyColumn);
  const values = numericColumnOf(source, valueColumn);
  if (keys === undefined || values === undefined)
    return failure([
      diagnostic(
        'appearance/missing-column',
        `Colouring by number needs a string column "${keyColumn}" and a numeric column "${valueColumn}".`,
        ['columns'],
      ),
    ]);
  if (!Number.isFinite(scale.min) || !Number.isFinite(scale.max) || scale.max < scale.min)
    return failure([diagnostic('appearance/bad-scale', 'A numeric scale needs a finite, ordered range.', ['scale'])]);
  if (!Number.isInteger(scale.bands) || scale.bands < 1)
    return failure([diagnostic('appearance/bad-scale', 'A numeric scale needs at least one band.', ['scale', 'bands'])]);
  const banded: ObjectKey[][] = Array.from({ length: scale.bands }, () => []);
  const absent: ObjectKey[] = [];
  for (let row = 0; row < source.rowCount; row++) {
    const key = keys[row];
    if (key === undefined || key === '') continue;
    const band = bandOf(scale, numberAt(values, row));
    if (band === undefined) absent.push(key);
    else (banded[band] ?? absent).push(key);
  }
  const rules: StyleRule[] = banded.map((targets, band) => ({
    id: `${id}/${band}`,
    name: `${scale.title} band ${band + 1}`,
    enabled: true,
    priority,
    targets,
    change: { color: bandColor(scale, band) },
  }));
  rules.push({
    id: `${id}/missing`,
    name: scale.missing.label,
    enabled: true,
    priority,
    targets: absent,
    change: { color: scale.missing.color },
  });
  return success({
    rules,
    legend: {
      kind: 'numeric',
      id,
      title: scale.title,
      min: scale.min,
      max: scale.max,
      bands: scale.bands,
      low: scale.low,
      high: scale.high,
      missing: scale.missing,
    },
  });
};

// Adds one rule, optionally with the legend that explains it.
export type AddRuleInput = { readonly rule: StyleRule; readonly legend?: Legend | undefined };

// Adds a whole colouring at once, which is what a builder produces.
export type AddRulesInput = { readonly rules: readonly StyleRule[]; readonly legend?: Legend | undefined };

// Names one rule.
export type RuleIdInput = { readonly id: string };

// Switches one rule on or off.
export type EnableRuleInput = { readonly id: string; readonly enabled: boolean };

// The order the rules are held in, which decides ties within one priority.
export type ReorderInput = { readonly ids: readonly string[] };

const addRuleInput: Schema<AddRuleInput> = object({ rule: styleRuleSchema, legend: optional(legendSchema) });

const addRulesInput: Schema<AddRulesInput> = object({
  rules: array(styleRuleSchema),
  legend: optional(legendSchema),
});

const ruleIdInput: Schema<RuleIdInput> = object({ id: string() });

const enableRuleInput: Schema<EnableRuleInput> = object({ id: string(), enabled: boolean() });

const reorderInput: Schema<ReorderInput> = object({ ids: array(string()) });

const withLegend = (legends: readonly Legend[], legend: Legend | undefined): readonly Legend[] => {
  if (legend === undefined) return legends;
  return legends.some((item) => item.id === legend.id)
    ? legends.map((item) => (item.id === legend.id ? legend : item))
    : [...legends, legend];
};

const addRules = (
  session: Session,
  rules: readonly StyleRule[],
  legend: Legend | undefined,
): Result<AppearanceState> => {
  const state = session.read(appearanceSlice);
  const held = new Set(state.rules.map((rule) => rule.id));
  const repeated = rules.filter((rule) => held.has(rule.id)).map((rule) => rule.id);
  if (repeated.length > 0)
    return failure([
      diagnostic('appearance/repeated-rule', `Rules named ${repeated.join(', ')} are already there.`, ['rules']),
    ]);
  const next: AppearanceState = {
    rules: [...state.rules, ...rules],
    legends: withLegend(state.legends, legend),
  };
  session.write(appearanceSlice, next);
  return success(next);
};

// Adds one rule. A repeated id is refused rather than shadowing what is there.
export const addRuleCommand: Command = command<AddRuleInput>({
  name: 'appearance.addRule',
  title: 'Add a style rule',
  description: 'Adds one style rule, and the legend that explains it when there is one.',
  input: addRuleInput,
  run: (session, input) => addRules(session, [input.rule], input.legend),
});

// Adds a whole colouring: the rules a builder produced and the legend that goes with them.
export const addRulesCommand: Command = command<AddRulesInput>({
  name: 'appearance.addRules',
  title: 'Add style rules',
  description: 'Adds a whole colouring at once: its rules and its legend.',
  input: addRulesInput,
  run: (session, input) => addRules(session, input.rules, input.legend),
});

// Removes one rule, and the legend of the same id when there is one.
export const removeRuleCommand: Command = command<RuleIdInput>({
  name: 'appearance.removeRule',
  title: 'Remove a style rule',
  description: 'Removes one style rule and any legend named the same.',
  input: ruleIdInput,
  run: (session, input) => {
    const state = session.read(appearanceSlice);
    if (!state.rules.some((rule) => rule.id === input.id))
      return failure([diagnostic('appearance/unknown-rule', `There is no rule named "${input.id}".`, ['id'])]);
    const next: AppearanceState = {
      rules: state.rules.filter((rule) => rule.id !== input.id),
      legends: state.legends.filter((legend) => legend.id !== input.id),
    };
    session.write(appearanceSlice, next);
    return success(next);
  },
});

// Switches one rule on or off without losing what it holds.
export const enableRuleCommand: Command = command<EnableRuleInput>({
  name: 'appearance.setRuleEnabled',
  title: 'Enable or disable a style rule',
  description: 'Switches one style rule on or off, which is what legend filtering does.',
  input: enableRuleInput,
  run: (session, input) => {
    const state = session.read(appearanceSlice);
    if (!state.rules.some((rule) => rule.id === input.id))
      return failure([diagnostic('appearance/unknown-rule', `There is no rule named "${input.id}".`, ['id'])]);
    const next: AppearanceState = {
      ...state,
      rules: state.rules.map((rule) => (rule.id === input.id ? { ...rule, enabled: input.enabled } : rule)),
    };
    session.write(appearanceSlice, next);
    return success(next);
  },
});

// Puts the rules in the given order. Rules apply by rising priority first, so this decides ties
// within one priority. Every held rule must be named exactly once, so nothing is lost by omission.
export const reorderRulesCommand: Command = command<ReorderInput>({
  name: 'appearance.reorder',
  title: 'Reorder the style rules',
  description: 'Holds the style rules in the given order, which decides ties within one priority.',
  input: reorderInput,
  run: (session, input) => {
    const state = session.read(appearanceSlice);
    const byId = new Map(state.rules.map((rule) => [rule.id, rule]));
    const named = new Set(input.ids);
    if (named.size !== input.ids.length || named.size !== byId.size || input.ids.some((id) => !byId.has(id)))
      return failure([
        diagnostic('appearance/bad-order', 'Reordering must name every rule exactly once.', ['ids']),
      ]);
    const next: AppearanceState = {
      ...state,
      rules: input.ids.flatMap((id) => {
        const found = byId.get(id);
        return found === undefined ? [] : [found];
      }),
    };
    session.write(appearanceSlice, next);
    return success(next);
  },
});

// Removes every rule and every legend, which is what "reset the appearance" means.
export const clearAppearanceCommand: Command = command({
  name: 'appearance.clear',
  title: 'Clear the styling',
  description: 'Removes every style rule and legend, so objects go back to their base appearance.',
  input: noInput,
  run: (session) => {
    session.write(appearanceSlice, noAppearanceState);
    return success(noAppearanceState);
  },
});

// The public command names of this feature.
export const appearanceCommands: readonly Command[] = [
  addRuleCommand,
  addRulesCommand,
  removeRuleCommand,
  enableRuleCommand,
  reorderRulesCommand,
  clearAppearanceCommand,
];

// Everything that decides how objects look, read from the session in M1's composition order: the
// base appearances a model came with, the edit layers, the rules, the isolation filter, then the
// selection.
export const appearanceComposition = (
  session: Session,
  base: ReadonlyMap<ObjectKey, Appearance> = new Map(),
): StyleComposition => {
  const sets = session.read(setsSlice);
  return styleComposition(
    base,
    editLayers(session.read(editsSlice)),
    session.read(appearanceSlice).rules,
    effectiveSelection(sets, editEffectOf(session)),
    isolationOf(sets),
  );
};

// The appearance of every one of the given objects, which is what a renderer is handed.
export const resolveAppearance = (
  session: Session,
  keys: Iterable<ObjectKey>,
  base?: ReadonlyMap<ObjectKey, Appearance>,
): ResolvedStyles => resolveStyles(appearanceComposition(session, base), keys);

// Resolves and writes the appearance of every model in the target, once per model.
export const writeAppearance = (
  session: Session,
  target: RenderTarget,
  base?: ReadonlyMap<ObjectKey, Appearance>,
): Result<number> => {
  const composition = appearanceComposition(session, base);
  let models = 0;
  for (const model of target.styledModels()) {
    const written = target.applyStyles(model.modelId, resolveStyles(composition, model.keys));
    if (!written.ok) return failure(written.diagnostics);
    models++;
  }
  return success(models);
};

// The slices a resolved appearance depends on. A change to anything else costs a subscriber nothing.
export const appearanceInputSlices: readonly string[] = [appearanceSlice.id, setsSlice.id, editsSlice.id];

// Rewrites the scene's appearance whenever the rules, the sets or the edits change, and never for
// any other slice.
export const appearanceRenderHook =
  (target: RenderTarget, base?: ReadonlyMap<ObjectKey, Appearance>) =>
  (session: Session): Disposable => {
    writeAppearance(session, target, base);
    return session.subscribe(
      onSlices(appearanceInputSlices, () => {
        writeAppearance(session, target, base);
      }),
    );
  };

// Rules and legends. It depends on the sets and edits features because a resolved appearance is
// the composition of all three.
export const appearanceFeature: Feature<AppearanceState> = feature(
  'appearance',
  appearanceSlice,
  appearanceCommands,
  ['sets', 'edits'],
);

// The same feature with its render hook installed against a bound scene.
export const appearanceFeatureFor = (
  target: RenderTarget,
  base?: ReadonlyMap<ObjectKey, Appearance>,
): Feature<AppearanceState> =>
  feature('appearance', appearanceSlice, appearanceCommands, ['sets', 'edits'], appearanceRenderHook(target, base));
