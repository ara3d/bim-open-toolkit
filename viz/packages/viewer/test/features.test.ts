import { describe, expect, it } from 'vitest';
import { feature, integer, object, stateSlice } from '@bim-open-toolkit/model';
import { featureHost } from '../src/features.js';
import { createSession, type ViewerSession } from '../src/session.js';
import { brokenFeature, counterFeature, counterSlice, noteFeature, noteSlice } from './support/fixtures.js';

const started = (): ViewerSession => {
  const made = createSession();
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  return made.value;
};

describe('featureHost', () => {
  it('installs in dependency order and puts slices and commands in place', () => {
    const session = started();
    const host = featureHost(session);
    const log: string[] = [];
    const installed = host.install([noteFeature(log), counterFeature]);
    expect(installed.ok && [...installed.value]).toEqual(['test.counter', 'test.note']);
    expect(host.features().map((one) => one.id)).toEqual(['test.counter', 'test.note']);
    expect([...session.sliceRegistry().keys()].sort()).toEqual(['test.counter', 'test.note']);
    expect([...session.commands.names()].sort()).toEqual(['test.add', 'test.note', 'test.read']);
    expect(log).toEqual(['install test.note']);
  });

  it('refuses a feature whose dependency is not installed', () => {
    const host = featureHost(started());
    const refused = host.install([noteFeature([])]);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('feature/missing');
    expect(host.features()).toHaveLength(0);
  });

  it('satisfies a dependency from an earlier install', () => {
    const host = featureHost(started());
    expect(host.install([counterFeature]).ok).toBe(true);
    expect(host.install([noteFeature([])]).ok).toBe(true);
    expect(host.installed('test.note')).toBe(true);
  });

  it('reports a cycle', () => {
    const host = featureHost(started());
    const a = feature('a', stateSlice('a', 1, object({}), {}), [], ['b']);
    const b = feature('b', stateSlice('b', 1, object({}), {}), [], ['a']);
    const refused = host.install([a, b]);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('feature/cycle');
  });

  it('refuses a feature whose slice id is already registered', () => {
    const session = started();
    const host = featureHost(session);
    expect(host.install([counterFeature]).ok).toBe(true);
    const other = feature('test.other', stateSlice('test.counter', 1, object({ count: integer() }), { count: 0 }));
    expect(host.install([other]).ok).toBe(false);
    expect(host.installed('test.other')).toBe(false);
  });

  it('refuses a feature whose command name is taken, and leaves no slice behind', () => {
    const session = started();
    const host = featureHost(session);
    expect(host.install([counterFeature]).ok).toBe(true);
    const clash = feature('test.clash', stateSlice('test.clash', 1, object({}), {}), [...counterFeature.commands]);
    expect(host.install([clash]).ok).toBe(false);
    expect(session.sliceRegistry().has('test.clash')).toBe(false);
    expect([...session.commands.names()].sort()).toEqual(['test.add', 'test.read']);
  });

  it('installs all or nothing when a hook throws', () => {
    const session = started();
    const host = featureHost(session);
    const log: string[] = [];
    const broken = brokenFeature(stateSlice('test.broken', 1, object({}), {}), ['test.note']);
    const refused = host.install([counterFeature, noteFeature(log), broken]);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/install-failed');
    expect(host.features()).toHaveLength(0);
    expect(session.sliceRegistry().size).toBe(0);
    expect(session.commands.names()).toEqual([]);
    expect(log).toEqual(['install test.note', 'dispose test.note']);
  });

  it('removes a feature and everything it brought', () => {
    const session = started();
    const host = featureHost(session);
    const log: string[] = [];
    host.install([counterFeature, noteFeature(log)]);
    session.write(noteSlice, { text: 'held' });
    expect(host.remove(['test.note']).ok).toBe(true);
    expect(log).toContain('dispose test.note');
    expect(session.sliceRegistry().has('test.note')).toBe(false);
    expect(session.stored().has('test.note')).toBe(false);
    expect(session.commands.has('test.note')).toBe(false);
    expect(session.commands.has('test.add')).toBe(true);
  });

  it('refuses to remove a feature another installed feature depends on', () => {
    const host = featureHost(started());
    host.install([counterFeature, noteFeature([])]);
    const refused = host.remove(['test.counter']);
    expect(refused.ok).toBe(false);
    expect(refused.diagnostics.map((one) => one.code)).toContain('viewer/still-needed');
    expect(host.installed('test.counter')).toBe(true);
  });

  it('disposes in the reverse of the install order and leaves nothing behind', () => {
    const session = started();
    const host = featureHost(session);
    const log: string[] = [];
    host.install([counterFeature, noteFeature(log)]);
    session.write(counterSlice, { count: 2 });
    host.dispose();
    expect(log).toEqual(['install test.note', 'event test.note', 'dispose test.note']);
    expect(host.features()).toHaveLength(0);
    expect(session.sliceRegistry().size).toBe(0);
    expect(session.stored().size).toBe(0);
    // The disposed feature's subscription is gone, so a later write reaches nobody.
    session.write(counterSlice, { count: 3 });
    expect(log).toEqual(['install test.note', 'event test.note', 'dispose test.note']);
    expect(session.commands.names()).toEqual([]);
  });

  it('installs nothing for an empty list', () => {
    const host = featureHost(started());
    const done = host.install([]);
    expect(done.ok && done.value).toEqual([]);
  });
});
