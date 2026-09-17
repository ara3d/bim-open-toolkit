// Reading one slice of session state from React, and re-rendering on that slice alone.
//
// A session publishes one event per commit naming every slice that changed, so a component that
// wants the appearance rules can ignore every event that did not touch them. That filter is the
// whole point of this hook: a table over ten thousand rows must not re-render because the camera
// moved.
//
// `session.read` hands back the stored object itself when it checks - the schema narrows, it does
// not rebuild - so the snapshot keeps its identity between commits and `useSyncExternalStore` sees
// no change where there was none.

import { useCallback, useSyncExternalStore } from 'react';
import { didChange, type StateSlice } from '@bim-open-toolkit/model';
import type { ViewerSession } from '@bim-open-toolkit/viewer';
import { useViewerSession } from './connection.js';

// Subscribes to the commits that touched one slice, and returns the way to stop.
export const subscribeToSlice = (
  session: ViewerSession,
  sliceId: string,
  notify: () => void,
): (() => void) => {
  const held = session.subscribe((event) => {
    if (didChange(event, sliceId)) notify();
  });
  return () => {
    held.dispose();
  };
};

// The value of a slice of a session held outside the tree, for a component given its own session.
export const useSliceOf = <S>(session: ViewerSession, slice: StateSlice<S>): S => {
  const subscribe = useCallback(
    (notify: () => void) => subscribeToSlice(session, slice.id, notify),
    [session, slice.id],
  );
  const read = useCallback(() => session.read(slice), [session, slice]);
  return useSyncExternalStore(subscribe, read, read);
};

// The value of a slice of the connected session, re-read whenever a commit changed it.
export const useSlice = <S>(slice: StateSlice<S>): S => useSliceOf(useViewerSession(), slice);
