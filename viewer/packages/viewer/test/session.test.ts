import { describe, expect, it } from 'vitest';
import { integer, object, stateSlice, type ChangeEvent, type Disposable } from '@bim-open-toolkit/model';
import { createSession, directWrite } from '../src/session.js';
import { addCommand, counterSlice, noteCommand, noteSlice, readCommand } from './support/fixtures.js';

const started = () => {
  const made = createSession({ slices: [counterSlice, noteSlice], commands: [addCommand, noteCommand, readCommand] });
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  return made.value;
};

const recorded = (): { readonly events: ChangeEvent[]; readonly listener: (event: ChangeEvent) => void } => {
  const events: ChangeEvent[] = [];
  return { events, listener: (event) => events.push(event) };
};

describe('createSession', () => {
  it('reads a slice that was never written as its default', () => {
    expect(started().read(counterSlice)).toEqual({ count: 0 });
  });

  it('reads back what was written', () => {
    const session = started();
    session.write(counterSlice, { count: 7 });
    expect(session.read(counterSlice)).toEqual({ count: 7 });
  });

  it('reads a stored value that no longer checks as the default, and says so', () => {
    const session = started();
    const wrong = stateSlice('test.counter', 1, object({ count: integer() }), { count: -1 });
    session.write(wrong, { count: 3 });
    const other = stateSlice('test.counter', 1, object({ label: integer() }), { label: 0 });
    expect(session.read(other)).toEqual({ label: 0 });
    expect(session.diagnostics().some((one) => one.code === 'viewer/repeated-slice')).toBe(true);
  });

  it('publishes one event per direct write', () => {
    const session = started();
    const { events, listener } = recorded();
    session.subscribe(listener);
    session.write(counterSlice, { count: 1 });
    expect(events).toHaveLength(1);
    expect(events[0]?.command).toBe(directWrite);
    expect(events[0]?.changed).toEqual(['test.counter']);
  });

  it('does not publish a write of the value already there', () => {
    const session = started();
    const value = { count: 1 };
    session.write(counterSlice, value);
    const { events, listener } = recorded();
    session.subscribe(listener);
    session.write(counterSlice, value);
    expect(events).toHaveLength(0);
  });

  it('runs a command and publishes what it changed', () => {
    const session = started();
    const { events, listener } = recorded();
    session.subscribe(listener);
    const result = session.dispatch('test.add', { amount: 4 });
    expect(result.ok && result.value).toBe(4);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ command: 'test.add', changed: ['test.counter'] });
  });

  it('treats a nested dispatch as part of the outer commit', () => {
    const session = started();
    const { events, listener } = recorded();
    session.subscribe(listener);
    session.dispatch('test.note', { text: 'hello' });
    expect(events).toHaveLength(1);
    expect(events[0]?.command).toBe('test.note');
    expect([...(events[0]?.changed ?? [])].sort()).toEqual(['test.counter', 'test.note']);
    expect(session.read(counterSlice)).toEqual({ count: 1 });
  });

  it('publishes nothing for a command that changed nothing and reported nothing', () => {
    const session = started();
    const { events, listener } = recorded();
    session.subscribe(listener);
    expect(session.dispatch('test.read', {}).ok).toBe(true);
    expect(events).toHaveLength(0);
  });

  it('reports an unknown command rather than raising', () => {
    const result = started().dispatch('test.missing', {});
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((one) => one.code)).toContain('command/unknown');
  });

  it('reports input that does not match the command schema', () => {
    const result = started().dispatch('test.add', { amount: 'four' });
    expect(result.ok).toBe(false);
  });

  it('stops calling a listener that unsubscribed', () => {
    const session = started();
    const { events, listener } = recorded();
    const watching = session.subscribe(listener);
    session.dispatch('test.add', { amount: 1 });
    watching.dispose();
    session.dispatch('test.add', { amount: 1 });
    expect(events).toHaveLength(1);
  });

  it('does not call a listener added while an event is being delivered', () => {
    const session = started();
    const late: ChangeEvent[] = [];
    session.subscribe(() => {
      session.subscribe((event) => late.push(event));
    });
    session.dispatch('test.add', { amount: 1 });
    expect(late).toHaveLength(0);
  });

  it('does not call a listener removed while an event is being delivered', () => {
    const session = started();
    const seen: string[] = [];
    let second: Disposable = { dispose: () => {} };
    session.subscribe(() => second.dispose());
    second = session.subscribe(() => seen.push('second'));
    session.dispatch('test.add', { amount: 1 });
    expect(seen).toEqual([]);
  });

  it('refuses commands after disposal and drops its listeners', () => {
    const session = started();
    const { events, listener } = recorded();
    session.subscribe(listener);
    session.dispose();
    expect(session.disposed()).toBe(true);
    expect(session.dispatch('test.add', { amount: 1 }).ok).toBe(false);
    session.write(counterSlice, { count: 9 });
    expect(events).toHaveLength(0);
    expect(session.diagnostics().some((one) => one.code === 'viewer/disposed')).toBe(true);
  });

  it('keeps its stored values after disposal so a scene can still be saved', () => {
    const session = started();
    session.write(counterSlice, { count: 5 });
    session.dispose();
    expect(session.read(counterSlice)).toEqual({ count: 5 });
  });

  it('registers slices and refuses a second slice with an id already taken', () => {
    const session = started();
    expect([...session.sliceRegistry().keys()].sort()).toEqual(['test.counter', 'test.note']);
    const other = stateSlice('test.counter', 1, object({ count: integer() }), { count: 0 });
    expect(session.register([other]).ok).toBe(false);
    expect(session.register([counterSlice]).ok).toBe(true);
  });

  it('forgets a slice and its stored value', () => {
    const session = started();
    session.write(counterSlice, { count: 3 });
    expect(session.forget(['test.counter', 'test.absent'])).toEqual(['test.counter']);
    expect(session.stored().has('test.counter')).toBe(false);
    expect(session.sliceRegistry().has('test.counter')).toBe(false);
  });

  it('refuses to start with two commands of the same name', () => {
    const made = createSession({ commands: [addCommand, addCommand] });
    expect(made.ok).toBe(false);
  });
});
