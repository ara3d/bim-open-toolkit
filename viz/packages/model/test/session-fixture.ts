import { commandRegistry, runCommand, type Command } from '../src/command.js';
import { changeEvent, changedSlices, disposable, type Disposable, type Listener } from '../src/event.js';
import { diagnostic, failure, type Result } from '../src/result.js';
import type { Session } from '../src/session.js';
import type { StateSlice } from '../src/slices.js';

// The smallest thing that satisfies `Session`, so the contract is exercised without the viewer.
// State lives in a map of slice id to value; a command that writes publishes what changed.
export type FakeSession = Session & {
  readonly values: ReadonlyMap<string, unknown>;
  readonly events: readonly string[];
};

// A session over the given commands, starting from each slice's default.
export const fakeSession = (commands: readonly Command[]): FakeSession => {
  const values = new Map<string, unknown>();
  const listeners: Listener[] = [];
  const events: string[] = [];
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
    events.push(`${name}:${event.changed.join(',')}`);
    for (const listener of listeners) listener(event);
    return result;
  };
  const subscribe = (listener: Listener): Disposable => {
    listeners.push(listener);
    return disposable(() => listeners.splice(listeners.indexOf(listener), 1));
  };
  const session: FakeSession = { read, write, dispatch, subscribe, values, events };
  return session;
};

// A result that reports a command could not do what it was asked.
export const refused = (message: string): Result<unknown> => failure([diagnostic('test/refused', message)]);
