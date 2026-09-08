// What is selected, and the four ways a control changes it.
//
// The selection lives in the viewer's appearance slice, so a table row, a tree node and a click on
// the canvas are all reading and writing the same one value. Every change goes through the
// `appearance.select` command rather than writing the slice, which is what keeps a selection made
// from React indistinguishable from one made by a script or by an assistant.

import { useCallback, useMemo } from 'react';
import { setOf, type ObjectKey, type ObjectSet, type Result } from '@bim-open-toolkit/model';
import { appearanceSlice } from '@bim-open-toolkit/viewer';
import { useSlice } from './use-slice.js';
import { useCommand } from './use-command.js';

// The selection and the ways to change it. `set` is the same members as `keys`, for the membership
// test a table does once per visible row.
export type SelectionHandle = {
  readonly keys: readonly ObjectKey[];
  readonly set: ObjectSet;
  readonly has: (key: ObjectKey) => boolean;
  // Replaces the selection.
  readonly select: (keys: readonly ObjectKey[]) => Result<unknown>;
  // Adds keys that are not selected already, keeping the order they were first selected in.
  readonly add: (keys: readonly ObjectKey[]) => Result<unknown>;
  readonly remove: (keys: readonly ObjectKey[]) => Result<unknown>;
  // Selects the key alone, or adds and removes it when `extend` is true, which is what a
  // control-click on a row means.
  readonly toggle: (key: ObjectKey, extend?: boolean) => Result<unknown>;
  readonly clear: () => Result<unknown>;
};

// The keys with the additions that are not already there, in first-selected order.
export const withKeys = (
  keys: readonly ObjectKey[],
  added: readonly ObjectKey[],
): readonly ObjectKey[] => {
  const held = new Set(keys);
  return [...keys, ...added.filter((key) => !held.has(key))];
};

// The keys without the ones named.
export const withoutKeys = (
  keys: readonly ObjectKey[],
  removed: readonly ObjectKey[],
): readonly ObjectKey[] => {
  const gone = new Set(removed);
  return keys.filter((key) => !gone.has(key));
};

// The selection of the connected session.
export const useSelection = (): SelectionHandle => {
  const state = useSlice(appearanceSlice);
  const command = useCommand<{ readonly keys: readonly ObjectKey[] }>('appearance.select');
  const keys = state.selection;
  const set = useMemo(() => setOf(keys), [keys]);
  const select = useCallback((next: readonly ObjectKey[]) => command.run({ keys: next }), [command]);
  return useMemo(
    () => ({
      keys,
      set,
      has: (key: ObjectKey) => set.has(key),
      select,
      add: (added: readonly ObjectKey[]) => select(withKeys(keys, added)),
      remove: (removed: readonly ObjectKey[]) => select(withoutKeys(keys, removed)),
      toggle: (key: ObjectKey, extend = false) =>
        extend ? select(set.has(key) ? withoutKeys(keys, [key]) : withKeys(keys, [key])) : select([key]),
      clear: () => select([]),
    }),
    [keys, set, select],
  );
};
