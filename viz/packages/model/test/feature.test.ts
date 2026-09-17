import { describe, expect, it } from 'vitest';
import { command, type Command } from '../src/command.js';
import { disposable, type Disposable } from '../src/event.js';
import { success } from '../src/result.js';
import { integer, object } from '../src/schema.js';
import type { Session } from '../src/session.js';
import { emptyDocument, getSlice, putSlice, stateSlice } from '../src/slices.js';
import {
  checkFeatures, duplicateSliceIds, feature, featureCommandRegistry, featureCommands,
  featureSliceRegistry, featureSlices, installFeatures, installOrder, type AnyFeature,
} from '../src/feature.js';
import { fakeSession } from './session-fixture.js';

const countSlice = (id: string) => stateSlice(id, 1, object({ count: integer() }), { count: 0 });

const noop = (name: string): Command =>
  command({
    name,
    title: name,
    description: name,
    input: object({}),
    run: () => success(undefined),
  });

const plain = (id: string, dependsOn: readonly string[] = [], commands: readonly Command[] = []): AnyFeature =>
  feature(id, countSlice(id), commands, dependsOn);

const codes = (diagnostics: readonly { readonly code: string }[]): readonly string[] =>
  diagnostics.map((item) => item.code);

describe('feature order', () => {
  it('puts every feature after the ones it depends on, keeping declaration order otherwise', () => {
    const features = [plain('hud', ['sets']), plain('sets'), plain('edits', ['sets'])];
    const order = installOrder(features);
    expect(order.ok && order.value.map((item) => item.id)).toEqual(['sets', 'hud', 'edits']);
  });

  it('accepts features that depend on nothing', () => {
    const order = installOrder([plain('a'), plain('b')]);
    expect(order.ok && order.value.map((item) => item.id)).toEqual(['a', 'b']);
    expect(installOrder([]).ok).toBe(true);
  });

  it('reports a dependency that is not installed', () => {
    expect(codes(installOrder([plain('hud', ['clipping'])]).diagnostics)).toEqual(['feature/missing']);
  });

  it('reports features that depend on each other', () => {
    const cycle = installOrder([plain('a', ['b']), plain('b', ['a'])]);
    expect(codes(cycle.diagnostics)).toEqual(['feature/cycle']);
    expect(cycle.diagnostics[0]?.message).toContain('a, b');
  });

  it('reports two features with the same id', () => {
    expect(codes(installOrder([plain('a'), plain('a')]).diagnostics)).toEqual(['feature/duplicate']);
  });
});

describe('what a set of features contributes', () => {
  const features = [plain('sets', [], [noop('sets.select')]), plain('edits', ['sets'], [noop('edits.hide')])];

  it('contributes its slices and its commands', () => {
    expect(featureSlices(features).map((slice) => slice.id)).toEqual(['sets', 'edits']);
    expect(featureCommands(features).map((item) => item.name)).toEqual(['sets.select', 'edits.hide']);
    expect([...featureSliceRegistry(features).keys()]).toEqual(['sets', 'edits']);
    const registry = featureCommandRegistry(features);
    expect(registry.ok && [...registry.value.keys()]).toEqual(['sets.select', 'edits.hide']);
  });

  it('composes a document out of exactly the installed slices', () => {
    const slice = countSlice('sets');
    const document = putSlice(emptyDocument(), slice, { count: 4 });
    expect(getSlice(document, slice)).toEqual({ ok: true, value: { count: 4 }, diagnostics: [] });
  });

  it('reports two features that own the same slice or the same command name', () => {
    const clash: AnyFeature = { ...plain('other'), slice: countSlice('sets') };
    expect(duplicateSliceIds([...features, clash])).toEqual(['sets']);
    expect(codes(checkFeatures([...features, clash]))).toEqual(['feature/slice']);
    expect(codes(checkFeatures([plain('a', [], [noop('x')]), plain('b', [], [noop('x')])]))).toEqual([
      'command/duplicate',
    ]);
    expect(checkFeatures(features)).toEqual([]);
  });
});

describe('installing features', () => {
  const installed: string[] = [];
  const disposed: string[] = [];
  const hooked = (id: string, dependsOn: readonly string[] = []): AnyFeature =>
    feature(id, countSlice(id), [], dependsOn, (_session: Session): Disposable => {
      installed.push(id);
      return disposable(() => disposed.push(id));
    });

  it('installs in dependency order and disposes in reverse', () => {
    installed.length = 0;
    disposed.length = 0;
    const session = fakeSession([]);
    const result = installFeatures([hooked('hud', ['sets']), hooked('sets'), plain('quiet')], session);
    expect(installed).toEqual(['sets', 'hud']);
    expect(result.disposals).toHaveLength(2);
    for (const item of result.disposals) item.dispose();
    expect(disposed).toEqual(['hud', 'sets']);
  });

  it('installs nothing when the features do not make a valid order', () => {
    installed.length = 0;
    const result = installFeatures([hooked('a', ['b'])], fakeSession([]));
    expect(installed).toEqual([]);
    expect(codes(result.diagnostics)).toEqual(['feature/missing']);
  });
});
