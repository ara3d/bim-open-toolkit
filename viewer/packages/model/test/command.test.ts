import { describe, expect, it } from 'vitest';
import {
  command, commandRegistry, describeCommand, describeCommands, runCommand, type Command,
} from '../src/command.js';
import { success, type Result } from '../src/result.js';
import { integer, object, string } from '../src/schema.js';
import { stateSlice } from '../src/slices.js';
import { fakeSession } from './session-fixture.js';

const counter = stateSlice('counter', 1, object({ count: integer() }), { count: 0 });

const add: Command = command({
  name: 'counter.add',
  title: 'Add',
  description: 'Adds a number to the counter.',
  input: object({ by: integer() }),
  run: (session, input) => {
    const next = { count: session.read(counter).count + input.by };
    session.write(counter, next);
    return success(next);
  },
});

const rename: Command = command({
  name: 'counter.rename',
  title: 'Rename',
  description: 'Names the counter without changing it.',
  input: object({ name: string() }),
  run: (_session, input) => success(input.name),
});

const codes = <T>(result: Result<T>): readonly string[] => result.diagnostics.map((item) => item.code);

describe('commands', () => {
  it('checks its input before running, and reports where the input was wrong', () => {
    const session = fakeSession([add]);
    expect(codes(add.run(session, { by: 'two' }))).toEqual(['schema/type']);
    expect(session.values.size).toBe(0);
  });

  it('runs with a checked input and changes state through the session', () => {
    const session = fakeSession([add]);
    expect(add.run(session, { by: 3 })).toEqual(success({ count: 3 }));
    expect(session.read(counter)).toEqual({ count: 3 });
  });

  it('describes itself as plain data a tool descriptor is built from', () => {
    expect(describeCommand(add)).toEqual({
      name: 'counter.add',
      title: 'Add',
      description: 'Adds a number to the counter.',
      inputSchema: { type: 'object', properties: { by: { type: 'integer' } }, required: ['by'] },
    });
  });
});

describe('command registry', () => {
  it('holds commands by name and describes all of them', () => {
    const registry = commandRegistry([add, rename]);
    expect(registry.ok && [...registry.value.keys()]).toEqual(['counter.add', 'counter.rename']);
    expect(registry.ok && describeCommands(registry.value).map((item) => item.name)).toEqual([
      'counter.add',
      'counter.rename',
    ]);
  });

  it('refuses two commands of the same name rather than replacing one silently', () => {
    expect(codes(commandRegistry([add, { ...rename, name: 'counter.add' }]))).toEqual(['command/duplicate']);
  });

  it('reports a name it does not know', () => {
    const registry = commandRegistry([add]);
    const session = fakeSession([add]);
    expect(registry.ok && codes(runCommand(registry.value, session, 'counter.remove', {}))).toEqual([
      'command/unknown',
    ]);
  });
});

describe('a session as commands see it', () => {
  it('reads a slice default until something writes it', () => {
    const session = fakeSession([add]);
    expect(session.read(counter)).toEqual({ count: 0 });
  });

  it('publishes which slices a dispatched command changed', () => {
    const session = fakeSession([add, rename]);
    const seen: string[] = [];
    const subscription = session.subscribe((event) => seen.push(`${event.command}:${event.changed.join(',')}`));
    session.dispatch('counter.add', { by: 1 });
    session.dispatch('counter.rename', { name: 'a' });
    subscription.dispose();
    session.dispatch('counter.add', { by: 1 });
    expect(seen).toEqual(['counter.add:counter', 'counter.rename:']);
    expect(session.events).toEqual(['counter.add:counter', 'counter.rename:', 'counter.add:counter']);
  });
});
