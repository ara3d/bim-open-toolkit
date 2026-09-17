// Replacing an object's geometry while its identity stays.
//
// A replacement records that an object is drawn as a named representation, and nothing more. The
// object keeps its key, its record and its place in every set; the shared prototype other instances
// draw from is untouched; the object's own rows are hidden and the substitute is drawn beside them.
// That is what makes undoing a replacement cost one visibility write rather than a batch rebuild.
//
// The slice is ephemeral. The alpha shipped replacement as a separate transaction, not an F15
// persisted geometry edit (`visualization/docs/replacement.md`), and V2 keeps that: `ephemeralSlices`
// names it, so a saved document does not carry it. The schema still describes the state faithfully,
// because the session reads a slice back through it; a later version that decides replacements are
// worth saving adds a migration and takes the id out of `ephemeralSlices`.

import {
  array,
  boolColumn,
  command,
  diagnostic,
  failure,
  feature,
  identityMatrix,
  isVisible,
  object,
  onSlices,
  optional,
  stateSlice,
  string,
  stringColumn,
  success,
  table,
  type Appearance,
  type Command,
  type Disposable,
  type Feature,
  type Matrix4,
  type Migration,
  type ObjectKey,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type Table,
} from '@bim-open-toolkit/model';
import {
  changedReplacements,
  drawnReplacements,
  noReplacements,
  replaceObject,
  replacedKeys,
  restoreObject,
  type DrawnRepresentation,
  type Replacement,
  type ReplacementState,
  type RepresentationRegistry,
  type RepresentationTarget,
} from '@bim-open-toolkit/render';
import { matrix4Schema, objectKeySchema } from './appearance-schemas.js';
import { resolveAppearance } from './appearance.js';
import type { RenderTarget } from './appearance-render.js';

// What the replacement feature owns: which objects are drawn as something else, in key order.
export type ReplacementsState = { readonly replacements: readonly Replacement[] };

// One replacement as plain data: the object it stands for, what it is drawn as, and where it sits.
export const replacementSchema: Schema<Replacement> = object({
  key: objectKeySchema,
  representationId: string(),
  transform: matrix4Schema,
});

// The shape of the replacement state.
export const replacementsStateSchema: Schema<ReplacementsState> = object({
  replacements: array(replacementSchema),
});

// Nothing replaced.
export const noReplacementsState: ReplacementsState = { replacements: [] };

// Version 1 has nothing to migrate from; a version that decides to persist replacements adds a
// step here and takes the slice id out of `ephemeralSlices`.
export const replacementMigrations: readonly Migration[] = [];

// The replacements in force. Ephemeral: see `ephemeralSlices`.
export const replacementSlice: StateSlice<ReplacementsState> = stateSlice(
  'replacement',
  1,
  replacementsStateSchema,
  noReplacementsState,
  replacementMigrations,
);

// The slices a saved document leaves out, whatever a session holds in them.
export const ephemeralSlices: readonly string[] = [replacementSlice.id];

// The replacements as the render package addresses them, by object key.
export const replacementStateOf = (state: ReplacementsState): ReplacementState =>
  new Map(state.replacements.map((item) => [item.key, item]));

// The replacements as a slice holds them, in the order the render state lists them.
export const savedReplacements = (state: ReplacementState): ReplacementsState => ({
  replacements: [...state.values()],
});

// The same, read straight from a session.
export const replacementsOf = (session: Session): ReplacementState =>
  replacementStateOf(session.read(replacementSlice));

// Records that an object is drawn as a representation, keeping its identity and its base reference.
export type SetReplacementInput = {
  readonly key: ObjectKey;
  readonly representationId: string;
  readonly transform?: Matrix4 | undefined;
};

// Puts one object, or every object, back to its own geometry.
export type ClearReplacementInput = { readonly key?: ObjectKey | undefined };

const setReplacementInput: Schema<SetReplacementInput> = object({
  key: objectKeySchema,
  representationId: string(),
  transform: optional(matrix4Schema),
});

const clearReplacementInput: Schema<ClearReplacementInput> = object({ key: optional(objectKeySchema) });

// Draws an object as a representation. Replacing an already replaced object replaces the
// substitute, never the original, so the base geometry is always one restore away.
export const setReplacementCommand: Command = command<SetReplacementInput>({
  name: 'replacement.set',
  title: 'Replace an object',
  description: 'Draws one object as a named representation while its identity and record stay.',
  input: setReplacementInput,
  run: (session, input) => {
    const before = replacementsOf(session);
    const after = replaceObject(before, input.key, input.representationId, input.transform ?? identityMatrix);
    session.write(replacementSlice, savedReplacements(after));
    return success(input.key);
  },
});

// Puts one object, or every object, back to its own geometry. An unknown key is refused.
export const clearReplacementCommand: Command = command<ClearReplacementInput>({
  name: 'replacement.clear',
  title: 'Restore replaced geometry',
  description: 'Draws one object, or every replaced object, as its own geometry again.',
  input: clearReplacementInput,
  run: (session, input) => {
    const before = replacementsOf(session);
    if (input.key === undefined) {
      session.write(replacementSlice, noReplacementsState);
      return success(replacedKeys(before));
    }
    if (!before.has(input.key))
      return failure([
        diagnostic('replacement/unknown-key', `Object "${input.key}" is not replaced.`, ['key']),
      ]);
    session.write(replacementSlice, savedReplacements(restoreObject(before, input.key)));
    return success([input.key]);
  },
});

// The change table that hides the rows of every replaced object, so the substitute is what is seen
// and the shared prototype other instances draw from is untouched, and shows again the rows of an
// object that stopped being replaced, at whatever visibility the styling resolved for it. It names
// exactly the keys whose rows have to change and no others, which is the whole point of doing this
// as a change table rather than a whole restyle.
export const replacementChanges = (
  state: ReplacementState,
  restored: readonly ObjectKey[] = [],
  shown: (key: ObjectKey) => boolean = () => true,
): Table => {
  const hidden = replacedKeys(state);
  return table([
    ['key', stringColumn([...hidden, ...restored])],
    ['visible', boolColumn([...hidden.map(() => false), ...restored.map((key) => shown(key))])],
  ]);
};

// What a renderer is handed: the substitutes to draw, in the state's own order. A replacement
// naming a representation the registry does not hold is reported, never guessed at.
export const drawnFor = (
  registry: RepresentationRegistry,
  state: ReplacementState,
  appearanceOf?: (key: ObjectKey) => Appearance,
): Result<readonly DrawnRepresentation[]> =>
  appearanceOf === undefined
    ? drawnReplacements(registry, state)
    : drawnReplacements(registry, state, appearanceOf);

// Keys whose rows have to be shown or hidden again between two states.
export const replacementDelta = (before: ReplacementState, after: ReplacementState): readonly ObjectKey[] =>
  changedReplacements(before, after);

// The slices a drawn replacement depends on: its own, and the appearance the substitute takes.
export const replacementInputSlices: readonly string[] = [replacementSlice.id, 'appearance', 'sets', 'edits'];

// Draws the substitutes and hides what they stand for, whenever a slice they depend on changes.
//
// It runs after the appearance hook because the replacement feature depends on the appearance
// feature, and install order follows dependencies: the appearance write puts every row back to what
// the styling says, and this hides the replaced rows again on top of it.
export const replacementRenderHook =
  (
    registry: RepresentationRegistry,
    representations: RepresentationTarget,
    target: RenderTarget,
    appearanceOf?: (key: ObjectKey) => Appearance,
  ) =>
  (session: Session): Disposable => {
    let previous: ReplacementState = noReplacements;
    const draw = (): void => {
      const state = replacementsOf(session);
      const drawn = drawnFor(registry, state, appearanceOf);
      representations.setDrawn(drawn.ok ? drawn.value : []);
      const restored = [...previous.keys()].filter((key) => !state.has(key));
      previous = state;
      if (state.size === 0 && restored.length === 0) return;
      for (const model of target.styledModels()) {
        const resolved = resolveAppearance(session, model.keys);
        target.applyChanges(
          model.modelId,
          replacementChanges(state, restored, (key) => isVisible(resolved, key)),
        );
      }
    };
    draw();
    return session.subscribe(onSlices(replacementInputSlices, draw));
  };

// The public command names of this feature.
export const replacementCommands: readonly Command[] = [setReplacementCommand, clearReplacementCommand];

// Geometry replacement. It depends on the appearance feature because a substitute is drawn with the
// appearance the object it stands for resolved to.
export const replacementFeature: Feature<ReplacementsState> = feature(
  'replacement',
  replacementSlice,
  replacementCommands,
  ['appearance'],
);

// The same feature with its render hook installed against a registry and a bound scene.
export const replacementFeatureFor = (
  registry: RepresentationRegistry,
  representations: RepresentationTarget,
  target: RenderTarget,
  appearanceOf?: (key: ObjectKey) => Appearance,
): Feature<ReplacementsState> =>
  feature(
    'replacement',
    replacementSlice,
    replacementCommands,
    ['appearance'],
    replacementRenderHook(registry, representations, target, appearanceOf),
  );
