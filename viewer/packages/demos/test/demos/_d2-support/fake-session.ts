// A session for the seven demos of track D2, with no viewer, no renderer and no canvas.
//
// A demo's opening sequence, its readiness test, its report and its inspector sheet are all plain
// functions of a `Session`, so this is the whole harness they need. It records every dispatch, which
// is what a test asserts on when a command's effect lives in another package.
//
// Mirrors features/test/support/fake-session.ts; the two are in different packages and neither may
// import the other's tests.

import {
  changeEvent,
  changedSlices,
  commandRegistry,
  disposable,
  failure,
  featureCommands,
  runCommand,
  type AnyFeature,
  type Command,
  type Disposable,
  type Listener,
  type Result,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';

// One dispatch as it happened, so a test can say what a demo asked for and in what order.
export type Dispatched = { readonly name: string; readonly input: unknown; readonly ok: boolean };

export type FakeSession = Session & {
  readonly dispatched: readonly Dispatched[];
  readonly changed: readonly string[];
};

// A session over the given commands, each slice starting from its own default.
export const fakeSession = (commands: readonly Command[]): FakeSession => {
  const values = new Map<string, unknown>();
  const listeners: Listener[] = [];
  const dispatched: Dispatched[] = [];
  const changed: string[] = [];
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
    const event = changeEvent(name, changedSlices(before, values), result.diagnostics);
    dispatched.push({ name, input, ok: result.ok });
    changed.push(...event.changed);
    for (const listener of listeners) listener(event);
    return result;
  };
  const subscribe = (listener: Listener): Disposable => {
    listeners.push(listener);
    return disposable(() => listeners.splice(listeners.indexOf(listener), 1));
  };
  const session: FakeSession = { read, write, dispatch, subscribe, dispatched, changed };
  return session;
};

// A session over exactly the features a demo installs, which is the state a demo actually runs in.
export const sessionForFeatures = (features: readonly AnyFeature[]): FakeSession =>
  fakeSession(featureCommands(features));
