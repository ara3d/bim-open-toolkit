// The session the Inspect demo tests drive: model's `Session` over a list of commands, recording
// every dispatch so a test can assert the opening sequence a demo sends.
//
// It follows the pattern of `features/test/support/fake-session.ts` rather than importing it: a
// package's test support is not part of its public API, and the demo tracks may not reach into it.

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

// One dispatch as it was made, with what it changed and whether it was accepted.
export type Dispatched = {
  readonly command: string;
  readonly input: unknown;
  readonly ok: boolean;
  readonly changed: readonly string[];
};

export type RecordingSession = Session & { readonly dispatched: readonly Dispatched[] };

// A session over the given commands, starting from each slice's default.
export const recordingSession = (commands: readonly Command[]): RecordingSession => {
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
    const event = changeEvent(name, changedSlices(before, values), result.diagnostics);
    dispatched.push({ command: name, input, ok: result.ok, changed: event.changed });
    for (const listener of listeners) listener(event);
    return result;
  };
  const subscribe = (listener: Listener): Disposable => {
    listeners.push(listener);
    return disposable(() => listeners.splice(listeners.indexOf(listener), 1));
  };
  const session: RecordingSession = { read, write, dispatch, subscribe, dispatched };
  return session;
};

// The names of the commands that were dispatched, in order.
export const commandNames = (session: RecordingSession): readonly string[] =>
  session.dispatched.map((item) => item.command);
