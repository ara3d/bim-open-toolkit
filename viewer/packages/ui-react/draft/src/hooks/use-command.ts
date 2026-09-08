// Running commands from React, and listing them for a menu.
//
// A command is the only way session state changes, so a button is a `useCommand(name)` and nothing
// else. The hook hands back the `Result` unchanged: a component that ignores diagnostics is making
// that choice visibly, rather than being handed a boolean that lost them.

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import {
  describeCommands,
  type CommandDescriptor,
  type CommandRegistry,
  type Result,
} from '@bim-open-toolkit/model';
import type { ViewerSession } from '@bim-open-toolkit/viewer';
import { useViewerSession } from './connection.js';

// One command, ready to run. `known` is false when nothing on the bus answers to that name, which
// is what a menu greys out rather than showing a button that always fails.
export type CommandHandle<I> = {
  readonly name: string;
  readonly known: boolean;
  readonly descriptor: CommandDescriptor | undefined;
  readonly run: (input: I) => Result<unknown>;
};

// Subscribes to every commit, which is when the set of installed commands can have changed.
const subscribeToCommits = (session: ViewerSession, notify: () => void): (() => void) => {
  const held = session.subscribe(notify);
  return () => {
    held.dispose();
  };
};

// The registry as it stands. The bus replaces the whole map when commands are added or removed, so
// its identity is the change signal a snapshot needs.
const useRegistry = (session: ViewerSession): CommandRegistry => {
  const subscribe = useCallback((notify: () => void) => subscribeToCommits(session, notify), [session]);
  const read = useCallback(() => session.commands.registry(), [session]);
  return useSyncExternalStore(subscribe, read, read);
};

// A named command. The input type is the caller's claim about the command's own schema; the command
// checks it again at run time and reports a mismatch as a diagnostic rather than throwing.
export const useCommand = <I = Record<string, never>>(name: string): CommandHandle<I> => {
  const session = useViewerSession();
  const registry = useRegistry(session);
  const run = useCallback((input: I): Result<unknown> => session.dispatch(name, input), [session, name]);
  return useMemo(
    () => ({
      name,
      known: registry.has(name),
      descriptor: session.commands.describeOne(name),
      run,
    }),
    [name, registry, session, run],
  );
};

// Every command the session knows, as the descriptors a menu, a palette or a tool list is built
// from. The list is rebuilt only when the registry itself changed.
export const useCommands = (): readonly CommandDescriptor[] => {
  const registry = useRegistry(useViewerSession());
  return useMemo(() => describeCommands(registry), [registry]);
};
