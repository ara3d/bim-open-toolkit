import { resolveEdits, type EditEffect, type EditState } from './edits.js';
import type { ObjectKey } from './identity.js';
import type { Color } from './math.js';
import { contains, emptySet, type ObjectSet } from './sets.js';

// Extra appearance properties a feature adds without changing this package. Plain data only.
export type AppearanceExtras = Readonly<Record<string, string | number | boolean>>;

// How an object looks. Opacity is 0 (invisible) to 1 (opaque); `visible` false removes it entirely.
export type Appearance = {
  readonly color: Color;
  readonly opacity: number;
  readonly visible: boolean;
  readonly extras?: AppearanceExtras | undefined;
};

// A change to an appearance. Absent properties are left as they were; extras merge by name.
export type AppearanceChange = {
  readonly color?: Color | undefined;
  readonly opacity?: number | undefined;
  readonly visible?: boolean | undefined;
  readonly extras?: AppearanceExtras | undefined;
};

// A change applied to whichever objects it names. Rules never delete or move anything.
export type StyleRule = {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly targets: readonly ObjectKey[];
  readonly change: AppearanceChange;
};

// Everything that decides how objects look, in the order it applies:
// base appearances, then edit layers, then ordered rules, then the filter, then the selection.
export type StyleComposition = {
  readonly base: ReadonlyMap<ObjectKey, Appearance>;
  readonly edits: EditEffect;
  readonly rules: readonly StyleRule[];
  readonly filter?: ObjectSet | undefined;
  readonly selection: ObjectSet;
  readonly selectionChange: AppearanceChange;
};

// The appearance of every object that ended up different from `fallback`, plus what was deleted.
// Objects absent from `byKey` and from `deleted` look like `fallback`. It is the difference from
// `fallback`, not a list of the scene's objects, and it shrinks as styling is removed.
export type ResolvedStyles = {
  readonly fallback: Appearance;
  readonly byKey: ReadonlyMap<ObjectKey, Appearance>;
  readonly deleted: ObjectSet;
};

// The appearance an object has when nothing has styled it.
export const defaultAppearance: Appearance = { color: [0.8, 0.8, 0.8], opacity: 1, visible: true };

// How a selected object is marked. It is a change, so it never makes a hidden object visible.
export const defaultSelectionChange: AppearanceChange = { color: [1, 0.6, 0.1] };

// Extras with the change merged over them by name, or undefined when neither side has any.
const mergeExtras = (
  base: AppearanceExtras | undefined,
  change: AppearanceExtras | undefined,
): AppearanceExtras | undefined =>
  base === undefined ? change : change === undefined ? base : { ...base, ...change };

// An appearance with a change applied over it.
export const applyAppearance = (base: Appearance, change: AppearanceChange): Appearance => ({
  color: change.color ?? base.color,
  opacity: change.opacity ?? base.opacity,
  visible: change.visible ?? base.visible,
  extras: mergeExtras(base.extras, change.extras),
});

// True when two appearances describe the same look.
export const sameAppearance = (a: Appearance, b: Appearance): boolean =>
  a.visible === b.visible &&
  a.opacity === b.opacity &&
  a.color[0] === b.color[0] &&
  a.color[1] === b.color[1] &&
  a.color[2] === b.color[2] &&
  sameExtras(a.extras, b.extras);

// True when two sets of extras have the same names and values.
export const sameExtras = (a: AppearanceExtras | undefined, b: AppearanceExtras | undefined): boolean => {
  const left = a ?? {};
  const right = b ?? {};
  const names = Object.keys(left);
  return names.length === Object.keys(right).length && names.every((name) => left[name] === right[name]);
};

// A rule of the given priority. Higher priority applies later, so it wins over a lower one.
export const styleRule = (
  id: string,
  name: string,
  targets: readonly ObjectKey[],
  change: AppearanceChange,
  priority = 0,
): StyleRule => ({ id, name, enabled: true, priority, targets, change });

// The rules that apply, in order.
export const enabledRules = (rules: readonly StyleRule[]): readonly StyleRule[] =>
  rules.filter((rule) => rule.enabled);

// The rules in the order they apply: by rising priority, and by position within one priority.
export const orderRules = (rules: readonly StyleRule[]): readonly StyleRule[] =>
  rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => a.rule.priority - b.rule.priority || a.index - b.index)
    .map((entry) => entry.rule);

// The change each rule makes to each object it names, in the order the rules apply.
const ruleChanges = (rules: readonly StyleRule[]): ReadonlyMap<ObjectKey, AppearanceChange> => {
  const changes = new Map<ObjectKey, AppearanceChange>();
  for (const rule of orderRules(enabledRules(rules)))
    for (const key of rule.targets)
      changes.set(key, { ...changes.get(key), ...rule.change });
  return changes;
};

// A composition that styles nothing: every object keeps its base appearance.
export const noStyling: StyleComposition = {
  base: new Map(),
  edits: resolveEdits([]),
  rules: [],
  selection: emptySet,
  selectionChange: defaultSelectionChange,
};

// The composition of a scene's base appearances, edit layers, rules, filter and selection.
// `selectionChange` is how a selected object is marked; it defaults to `defaultSelectionChange`, so
// a host that says nothing gets the colour M1 always used. It stays a change rather than an
// appearance: whatever a host supplies, selection still cannot make a hidden object visible.
export const styleComposition = (
  base: ReadonlyMap<ObjectKey, Appearance>,
  edits: EditState,
  rules: readonly StyleRule[],
  selection: ObjectSet = emptySet,
  filter?: ObjectSet,
  selectionChange: AppearanceChange = defaultSelectionChange,
): StyleComposition => ({
  base,
  edits: resolveEdits(edits),
  rules,
  filter,
  selection,
  selectionChange,
});

// The same composition marking its selection differently. This is what a host that builds a
// composition elsewhere uses, so configuring the selection colour never means rebuilding one.
export const withSelectionChange = (
  composition: StyleComposition,
  selectionChange: AppearanceChange,
): StyleComposition => ({ ...composition, selectionChange });

// The appearance of every object, composed in order: base, edits, rules, filter, then selection.
// Deleted objects are left out. Selection marks an object but never makes a hidden one visible.
// `byKey` holds only the keys whose appearance ended up different from `fallback`: a key that
// resolved to the fallback and a key an edit layer deleted are both absent from it. Iterating
// `byKey` is therefore not iterating the scene, and a renderer that binds from it alone never
// restores an object a rule stopped applying to, because that object simply leaves the map. Address
// the keys you know about and read each one with `styleOf`, which answers `fallback` for anything
// absent; `isRemoved` and `deleted` say what is gone.
export const resolveStyles = (
  composition: StyleComposition,
  keys: Iterable<ObjectKey>,
  fallback: Appearance = defaultAppearance,
): ResolvedStyles => {
  const changes = ruleChanges(composition.rules);
  const byKey = new Map<ObjectKey, Appearance>();
  for (const key of keys) {
    if (composition.edits.deleted.has(key)) continue;
    const withEdits = applyAppearance(
      composition.base.get(key) ?? fallback,
      composition.edits.appearance.get(key) ?? {},
    );
    const withRules = applyAppearance(withEdits, changes.get(key) ?? {});
    const shown =
      withRules.visible &&
      !composition.edits.hidden.has(key) &&
      (composition.filter === undefined || contains(composition.filter, key));
    const marked = composition.selection.has(key)
      ? applyAppearance(withRules, composition.selectionChange)
      : withRules;
    const resolved: Appearance = { ...marked, visible: shown && marked.visible };
    if (!sameAppearance(resolved, fallback)) byKey.set(key, resolved);
  }
  return { fallback, byKey, deleted: composition.edits.deleted };
};

// The appearance of one object: what the composition resolved, or the fallback it never changed.
export const styleOf = (resolved: ResolvedStyles, key: ObjectKey): Appearance =>
  resolved.byKey.get(key) ?? resolved.fallback;

// True when an edit layer removed the object, so nothing can style or select it.
export const isRemoved = (resolved: ResolvedStyles, key: ObjectKey): boolean => resolved.deleted.has(key);

// True when the object draws: it exists, nothing hid it, and it is not fully transparent.
export const isVisible = (resolved: ResolvedStyles, key: ObjectKey): boolean =>
  !isRemoved(resolved, key) && styleOf(resolved, key).visible && styleOf(resolved, key).opacity > 0;
