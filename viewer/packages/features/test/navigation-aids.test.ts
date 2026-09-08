import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  getSlice,
  putSlice,
  type ViewState,
} from '@bim-open-toolkit/model';
import {
  defaultNavigation,
  levelAt,
  levelCenter,
  levelsOf,
  navigationAidsFeature,
  navigationCommands,
  navigationHook,
  navigationSlice,
  viewAtLevel,
  type Level,
} from '../src/navigation-aids.js';
import { building } from './navigation-aids-fixture.js';
import { fakeSession } from './support/fake-session.js';

const levels = (): readonly Level[] => levelsOf(building());

const session = () => fakeSession(navigationCommands);

describe('levels', () => {
  it('reads the storeys of a model, lowest first, with the height to the storey above', () => {
    expect(levels()).toEqual([
      { id: 'storey-0', name: 'Level 1', elevation: 0, height: 3 },
      { id: 'storey-1', name: 'Level 2', elevation: 3 },
    ]);
  });

  it('leaves the topmost storey without a height, because the model does not say', () => {
    expect(levels()[1]?.height).toBeUndefined();
  });

  it('finds the storey a height is on, and none below the lowest', () => {
    expect(levelAt(levels(), 3.5)?.id).toBe('storey-1');
    expect(levelAt(levels(), 0)?.id).toBe('storey-0');
    expect(levelAt(levels(), -1)).toBeUndefined();
  });

  it('looks at the middle of a storey with a height, and at the floor of one without', () => {
    expect(levelCenter({ id: 'a', name: 'a', elevation: 0, height: 3 })).toBe(1.5);
    expect(levelCenter({ id: 'b', name: 'b', elevation: 3 })).toBe(3);
  });

  it('moves a view up to a level without turning it', () => {
    const moved = viewAtLevel(defaultNavigation.view, { id: 'b', name: 'b', elevation: 3 }, 'z');
    expect(moved.camera.target).toEqual([0, 0, 3]);
    expect(moved.camera.position).toEqual([10, -10, 13]);
    expect(moved.projection).toEqual(defaultNavigation.view.projection);
  });
});

describe('the navigation slice', () => {
  it('round-trips through a document', () => {
    const saved = { ...defaultNavigation, level: { id: 'storey-1', name: 'Level 2', elevation: 3 } };
    const document = putSlice(emptyDocument(), navigationSlice, saved);
    const read = getSlice(document, navigationSlice);
    expect(read.ok && read.value).toEqual(saved);
  });

  it('reads its default out of a document written before the feature existed', () => {
    const read = getSlice(emptyDocument(), navigationSlice);
    expect(read.ok && read.value).toEqual(defaultNavigation);
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/absent']);
  });

  it('refuses a value written at a version it does not know', () => {
    const read = getSlice(
      { ...emptyDocument(), slices: { navigation: { version: 2, value: defaultNavigation } } },
      navigationSlice,
    );
    expect(read.ok).toBe(false);
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/version']);
  });
});

describe('the navigation commands', () => {
  it('sends the camera to a level and records which one', () => {
    const live = session();
    const done = live.dispatch('navigation.goToLevel', { level: levels()[1] });
    expect(done.ok).toBe(true);
    const state = live.read(navigationSlice);
    expect(state.level?.name).toBe('Level 2');
    expect(state.view.camera.target).toEqual([0, 0, 3]);
    expect(live.events).toEqual(['navigation.goToLevel:navigation']);
  });

  it('frames the box around a set of points', () => {
    const live = session();
    const done = live.dispatch('navigation.frame', { points: [[0, 0, 0], [10, 10, 10]] });
    expect(done.ok).toBe(true);
    expect(live.read(navigationSlice).view.camera.target).toEqual([5, 5, 5]);
  });

  it('refuses to frame nothing, and refuses an empty box', () => {
    const live = session();
    expect(live.dispatch('navigation.frame', {}).diagnostics.map((item) => item.code)).toEqual([
      'navigation/nothing-to-frame',
    ]);
    const empty = live.dispatch('navigation.frame', { bounds: { min: [1, 1, 1], max: [0, 0, 0] } });
    expect(empty.diagnostics.map((item) => item.code)).toEqual(['navigation/empty-bounds']);
  });

  it('refuses input of the wrong shape rather than guessing', () => {
    const live = session();
    const done = live.dispatch('navigation.goToLevel', { level: { id: 'a', name: 'a' } });
    expect(done.ok).toBe(false);
    expect(done.diagnostics.map((item) => item.code)).toEqual(['schema/missing']);
  });

  it('saves a view and puts the camera back on it', () => {
    const live = session();
    live.dispatch('navigation.goToLevel', { level: levels()[1] });
    const saved = live.read(navigationSlice).view;
    live.dispatch('navigation.saveView', { id: 'top', name: 'Top floor', selection: ['a'] });
    live.dispatch('navigation.frame', { points: [[0, 0, 0], [10, 10, 10]] });
    expect(live.read(navigationSlice).view).not.toEqual(saved);
    live.dispatch('navigation.restoreView', { id: 'top' });
    expect(live.read(navigationSlice).view).toEqual(saved);
    expect(live.read(navigationSlice).views[0]?.selection).toEqual(['a']);
  });

  it('replaces a saved view of the same id rather than keeping two', () => {
    const live = session();
    live.dispatch('navigation.saveView', { id: 'one', name: 'First' });
    live.dispatch('navigation.saveView', { id: 'one', name: 'Second' });
    const views = live.read(navigationSlice).views;
    expect(views).toHaveLength(1);
    expect(views[0]?.name).toBe('Second');
  });

  it('refuses to restore a view it does not have', () => {
    const live = session();
    const done = live.dispatch('navigation.restoreView', { id: 'missing' });
    expect(done.diagnostics.map((item) => item.code)).toEqual(['navigation/unknown-view']);
  });
});

describe('the navigation hook', () => {
  it('hands every new view to the target, and stops when it is disposed', () => {
    const applied: ViewState[] = [];
    const live = session();
    const installed = navigationHook({ setView: (view) => applied.push(view) })(live);
    expect(applied).toHaveLength(1);
    live.dispatch('navigation.goToLevel', { level: levels()[1] });
    expect(applied).toHaveLength(2);
    expect(applied[1]?.camera.target).toEqual([0, 0, 3]);
    installed.dispose();
    live.dispatch('navigation.goToLevel', { level: levels()[0] });
    expect(applied).toHaveLength(2);
  });
});

describe('the feature', () => {
  it('owns the navigation slice and its four commands', () => {
    expect(navigationAidsFeature.id).toBe('navigation-aids');
    expect(navigationAidsFeature.slice.id).toBe('navigation');
    expect(navigationAidsFeature.commands.map((item) => item.name)).toEqual([
      'navigation.goToLevel',
      'navigation.frame',
      'navigation.saveView',
      'navigation.restoreView',
    ]);
  });
});
