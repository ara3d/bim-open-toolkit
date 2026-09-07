import { objectKey, type Appearance, type Color, type ObjectRecord, type ObjectRef, type StyleRule } from './contracts.js';

export type Category = string | number | boolean;
export type CategoryLegendEntry = { readonly value: Category; readonly label: string; readonly color: Color };

/** Unknown categories, null, undefined and NaN all use the missing color. */
export function createCategoricalColorMap(entries: readonly CategoryLegendEntry[], missingColor: Color) {
  const legend = entries.map(entry => ({ ...entry, color: [...entry.color] as Color }));
  const colors = new Map(legend.map(entry => [entry.value, entry.color]));
  if (colors.size !== legend.length) throw new Error('Duplicate category');
  const missing = [...missingColor] as Color;
  return {
    legend: { entries: legend as readonly CategoryLegendEntry[], missing: { label: 'Missing', color: missing } },
    color: (value: Category | null | undefined): Color => value == null || (typeof value === 'number' && !Number.isFinite(value))
      ? missing : colors.get(value) ?? missing,
  };
}

export type NumericColorOptions = { readonly min: number; readonly max: number; readonly low: Color; readonly high: Color; readonly missingColor: Color };

/** Clamp finite values to the range; a constant range uses its midpoint color. */
export function createNumericColorMap(options: NumericColorOptions) {
  const { min, max } = options;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min || !Number.isFinite(max - min)) {
    throw new Error('Numeric color range must be finite and ordered');
  }
  const low = [...options.low] as Color;
  const high = [...options.high] as Color;
  const missing = [...options.missingColor] as Color;
  return {
    legend: { min, max, low, high, missing: { label: 'Missing', color: missing } },
    color(value: number | null | undefined): Color {
      if (value == null || !Number.isFinite(value)) return missing;
      const fraction = max === min ? 0.5 : Math.max(0, Math.min(1, (value - min) / (max - min)));
      return low.map((channel, index) => channel + (high[index]! - channel) * fraction) as unknown as Color;
    },
  };
}

export type AppearanceOptions = {
  readonly rules?: readonly StyleRule[];
  /** An omitted filter shows all eligible objects; an empty filter hides all. */
  readonly visible?: readonly ObjectRef[];
  readonly selection?: readonly ObjectRef[];
  readonly selectionColor?: Color;
};

/** Rules and selection cannot resurrect hidden base/edit objects or earlier rule hides. */
export function composeAppearance(objects: readonly ObjectRecord[], options: AppearanceOptions = {}): readonly ObjectRecord[] {
  const styles = new Map<string, Partial<Appearance>>();
  const hidden = new Set<string>();
  for (const rule of options.rules ?? []) {
    for (const ref of rule.members) {
      const key = objectKey(ref);
      styles.set(key, { ...styles.get(key), ...rule.style });
      if (rule.style.visible === false) hidden.add(key);
    }
  }
  const visible = options.visible === undefined ? undefined : new Set(options.visible.map(objectKey));
  const selected = new Set((options.selection ?? []).map(objectKey));
  return objects.map(object => {
    const key = objectKey(object.ref);
    const appearance = { ...object.appearance, ...styles.get(key) };
    appearance.visible = object.appearance.visible && !hidden.has(key) && (visible?.has(key) ?? true);
    if (appearance.visible && selected.has(key) && options.selectionColor) appearance.color = options.selectionColor;
    return { ...object, appearance };
  });
}
