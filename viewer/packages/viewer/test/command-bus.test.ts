import { describe, expect, it } from 'vitest';
import { commandBus } from '../src/command-bus.js';
import { createSession } from '../src/session.js';
import { addCommand, counterSlice, namedCommand, readCommand } from './support/fixtures.js';

const started = () => {
  const made = commandBus([addCommand]);
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  return made.value;
};

describe('commandBus', () => {
  it('refuses to start with a repeated name', () => {
    expect(commandBus([addCommand, addCommand]).ok).toBe(false);
  });

  it('holds the commands it was given', () => {
    const held = started();
    expect(held.names()).toEqual(['test.add']);
    expect(held.has('test.add')).toBe(true);
    expect(held.has('test.read')).toBe(false);
  });

  it('adds commands and refuses one whose name is taken, changing nothing', () => {
    const held = started();
    expect(held.add([readCommand]).ok).toBe(true);
    const refused = held.add([namedCommand('test.read')]);
    expect(refused.ok).toBe(false);
    expect(held.names()).toEqual(['test.add', 'test.read']);
  });

  it('refuses a batch that repeats a name inside itself', () => {
    const held = started();
    expect(held.add([namedCommand('a'), namedCommand('a')]).ok).toBe(false);
    expect(held.names()).toEqual(['test.add']);
  });

  it('removes commands and reports which were there', () => {
    const held = started();
    held.add([readCommand]);
    expect(held.remove(['test.read', 'test.absent'])).toEqual(['test.read']);
    expect(held.registry().has('test.read')).toBe(false);
  });

  it('describes every command from its own input schema', () => {
    const held = started();
    const described = held.describe();
    expect(described.map((one) => one.name)).toEqual(['test.add']);
    expect(described[0]?.inputSchema.properties?.['amount']).toBeDefined();
    expect(held.describeOne('test.add')?.title).toBe('Add');
    expect(held.describeOne('test.absent')).toBeUndefined();
  });

  it('runs a command against a session', () => {
    const made = createSession({ slices: [counterSlice] });
    if (!made.ok) throw new Error('no session');
    const result = started().run(made.value, 'test.add', { amount: 2 });
    expect(result.ok && result.value).toBe(2);
    expect(made.value.read(counterSlice)).toEqual({ count: 2 });
  });
});
