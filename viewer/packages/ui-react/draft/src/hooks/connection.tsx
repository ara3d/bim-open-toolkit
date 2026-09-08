// What a React tree is connected to: a session, and the composed viewer when there is one.
//
// Every hook below `ViewerProvider` reads this and nothing else, which is why the same components
// work over `createViewer` in a browser and over `createSession` in a test with no canvas. The
// provider renders its children only once it has a connection, so no hook has to answer for a
// session that is not there yet and no component has to be written twice.

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { Viewer, ViewerSession } from '@bim-open-toolkit/viewer';

// The session a tree reads and writes, and the viewer that composed it when one did.
export type ViewerConnection = {
  readonly session: ViewerSession;
  // Absent for a headless session: there is no canvas, no renderer and no camera to reach.
  readonly viewer: Viewer | undefined;
};

const connectionContext = createContext<ViewerConnection | undefined>(undefined);

// How a tree is connected. Give a `viewer`, or a `session` for the headless half; `fallback` is
// what shows while neither has been made yet, which is the first render of any page that creates
// its viewer in an effect.
export type ViewerProviderProps = {
  readonly viewer?: Viewer | undefined;
  readonly session?: ViewerSession | undefined;
  readonly fallback?: ReactNode;
  readonly children?: ReactNode;
};

// Connects a subtree. Nothing below it renders until there is a session to read.
export const ViewerProvider = (props: ViewerProviderProps): ReactElement | null => {
  const session = props.viewer?.session ?? props.session;
  const connection = useMemo<ViewerConnection | undefined>(
    () => (session === undefined ? undefined : { session, viewer: props.viewer }),
    [session, props.viewer],
  );
  if (connection === undefined) return <>{props.fallback ?? null}</>;
  return <connectionContext.Provider value={connection}>{props.children}</connectionContext.Provider>;
};

// The connection this subtree was given. Throws when there is no `ViewerProvider` above, because a
// hook with no session has no honest value to return and a silent default would hide the mistake.
export const useViewerConnection = (): ViewerConnection => {
  const connection = useContext(connectionContext);
  if (connection === undefined)
    throw new Error('This hook needs a <ViewerProvider> above it; none was found.');
  return connection;
};

// The session this subtree reads and writes.
export const useViewerSession = (): ViewerSession => useViewerConnection().session;

// The composed viewer, or undefined when the tree is over a headless session.
export const useViewerHere = (): Viewer | undefined => useViewerConnection().viewer;
