// A session over the real feature commands, with no viewer, no canvas and no renderer.
//
// The workflow demos are tested by dispatching what they would dispatch and reading the slices back,
// so this records every dispatch as well as running it. It is the demos' own copy: the features
// package keeps an equivalent one beside its tests, and a test fixture is not a public API to share
// across packages.

import {
  changeEvent,
  changedSlices,
  commandRegistry,
  disposable,
  failure,
  runCommand,
  type Command,
  type Disposable,
  type Listener,
  type Result,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';
import {
  animationCommands,
  appearanceCommands,
  comparisonCommands,
  navigationCommands,
  overlayCommands,
  setsCommands,
} from '@bim-open-toolkit/features';

// One dispatch a demo made: what it ran, what it was given, and whether it was accepted.
export type Dispatched = { readonly name: string; readonly input: unknown; readonly ok: boolean };

// A session that also remembers what was dispatched through it.
export type FakeSession = Session & {
  readonly dispatched: readonly Dispatched[];
  readonly ran: (name: string) => readonly Dispatched[];
};

// Every feature command the workflow demos drive.
export const workflowDemoCommands: readonly Command[] = [
  ...setsCommands,
  ...appearanceCommands,
  ...overlayCommands,
  ...navigationCommands,
  ...animationCommands,
  ...comparisonCommands,
];

// A session over the given commands, each slice starting from its default.
export const fakeSession = (commands: readonly Command[] = workflowDemoCommands): FakeSession => {
  const values = new Map<string, unknown>();
  const listeners: Listener[] = [];
  const dispatched: Dispatched[] = [];
  const registry = commandRegistry(commands);
  const read = <S>(slice: StateSlice<S>): S => {
    const stored = values.get(slice.id);
    if (stored === undefined) return slice.default;
    const checked = slice.schema.check(stored, []);
    return checked.ok ? checked.value : slice.default;
  };
  const write = <S>(slice: StateSlice<S>, value: S): void => {
    values.set(slice.id, value);
  };
  const dispatch = (name: string, input: unknown): Result<unknown> => {
    if (!registry.ok) return failure(registry.diagnostics);
    const before = new Map(values);
    const result = runCommand(registry.value, session, name, input);
    dispatched.push({ name, input, ok: result.ok });
    const event = changeEvent(name, changedSlices(before, values), result.diagnostics);
    for (const listener of [...listeners]) listener(event);
    return result;
  };
  const subscribe = (listener: Listener): Disposable => {
    listeners.push(listener);
    return disposable(() => listeners.splice(listeners.indexOf(listener), 1));
  };
  const session: FakeSession = {
    read,
    write,
    dispatch,
    subscribe,
    dispatched,
    ran: (name) => dispatched.filter((item) => item.name === name),
  };
  return session;
};
