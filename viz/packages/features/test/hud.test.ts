import { describe, expect, it } from 'vitest';
import {
  checkFeatures,
  featureCommandRegistry,
  emptyDocument,
  getSlice,
  installOrder,
  putSlice,
} from '@bim-open-toolkit/model';
import { FrameTimer, type GpuFrameTimer } from '@bim-open-toolkit/render';
import {
  defaultHud,
  hudCommands,
  hudFeature,
  hudHook,
  hudSlice,
  isDue,
  type HudSource,
} from '../src/hud.js';
import { clippingFeature } from '../src/clipping.js';
import { environmentFeature } from '../src/environment.js';
import { layoutsFeature } from '../src/layouts.js';
import { navigationAidsFeature, navigationCommands } from '../src/navigation-aids.js';
import { building, buildingGeometry, buildingTable } from './navigation-aids-fixture.js';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { fakeSession } from './support/fake-session.js';

const model = building();

const session = () => fakeSession([...hudCommands, ...navigationCommands]);

// A GPU timer whose completed measurements are handed out one poll at a time.
const gpuTimer = (values: readonly number[]): GpuFrameTimer => {
  let at = 0;
  return {
    availability: { state: 'available' },
    begin: () => undefined,
    end: () => undefined,
    poll: () => {
      const next = values[at];
      at += 1;
      return next;
    },
  };
};

const source = (gpu?: GpuFrameTimer): HudSource => {
  const geometry = buildingGeometry(model);
  return {
    table: buildingTable(model, geometry),
    geometry,
    frames: new FrameTimer(),
    ...(gpu === undefined ? {} : { gpu }),
    camera: () => 'perspective',
  };
};

describe('the HUD slice', () => {
  it('round-trips a reading through a document', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source())(live);
    installed.sample(0);
    const saved = live.read(hudSlice);
    expect(saved.reading).toBeDefined();
    const read = getSlice(putSlice(emptyDocument(), hudSlice, saved), hudSlice);
    expect(read.ok && read.value).toEqual(saved);
    installed.dispose();
  });

  it('reads its default out of a document that has no HUD', () => {
    const read = getSlice(emptyDocument(), hudSlice);
    expect(read.ok && read.value).toEqual(defaultHud);
  });

  it('refuses a value written at a version it does not know', () => {
    const read = getSlice(
      { ...emptyDocument(), slices: { hud: { version: 2, value: defaultHud } } },
      hudSlice,
    );
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/version']);
  });
});

describe('the HUD command', () => {
  it('flips the display when it is given nothing', () => {
    const live = session();
    live.dispatch('hud.toggle', {});
    expect(live.read(hudSlice).visible).toBe(true);
    live.dispatch('hud.toggle', {});
    expect(live.read(hudSlice).visible).toBe(false);
    expect(live.events).toEqual(['hud.toggle:hud', 'hud.toggle:hud']);
  });

  it('sets the sampling rate and refuses a negative one', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true, intervalMs: 1000 });
    expect(live.read(hudSlice).intervalMs).toBe(1000);
    const wrong = live.dispatch('hud.toggle', { intervalMs: -1 });
    expect(wrong.diagnostics.map((item) => item.code)).toEqual(['hud/interval']);
    expect(live.read(hudSlice).intervalMs).toBe(1000);
  });

  it('is due when nothing has been read, and not again until the interval has passed', () => {
    const state = { visible: true, intervalMs: 250, reading: undefined };
    expect(isDue(state, 0)).toBe(true);
    const read = { ...state, reading: { at: 100, data: { ...defaultReading } } };
    expect(isDue(read, 200)).toBe(false);
    expect(isDue(read, 350)).toBe(true);
  });
});

// A reading's data shape, for the pacing test, which does not care what is in it.
const defaultReading = {
  frames: { count: 0, medianMs: 0, p95Ms: 0, minMs: 0, maxMs: 0 },
  framesPerSecond: 0,
  withinBudget: false,
  gpu: { state: 'unavailable', reason: 'none' },
  scene: {
    sourceObjects: 0,
    groups: 0,
    renderedInstances: 0,
    visibleInstances: 0,
    renderedTriangles: 0,
  },
  camera: 'perspective',
} as const;

describe('the HUD sampler', () => {
  it('writes nothing while the HUD is hidden', () => {
    const live = session();
    const installed = hudHook(source())(live);
    expect(installed.sample(0)).toBe(false);
    expect(live.read(hudSlice).reading).toBeUndefined();
    installed.dispose();
  });

  it('counts the scene from the instance table', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source())(live);
    expect(installed.sample(0)).toBe(true);
    const scene = live.read(hudSlice).reading?.data.scene;
    expect(scene).toEqual({
      sourceObjects: 6,
      groups: 1,
      renderedInstances: 4,
      visibleInstances: 4,
      renderedTriangles: 48,
    });
    installed.dispose();
  });

  it('samples no more often than the interval asks, and reports the frame rate', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source())(live);
    expect(installed.sample(0)).toBe(true);
    expect(installed.sample(16)).toBe(false);
    expect(installed.sample(300)).toBe(true);
    const data = live.read(hudSlice).reading?.data;
    expect(data?.frames.medianMs).toBe(16);
    expect(data?.framesPerSecond).toBeCloseTo(62.5);
    expect(data?.withinBudget).toBe(false);
    installed.dispose();
  });

  it('says why there is no GPU timing rather than reporting a CPU number', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source())(live);
    installed.sample(0);
    expect(live.read(hudSlice).reading?.data.gpu).toEqual({
      state: 'unavailable',
      reason: 'no GPU timer was supplied',
    });
    installed.dispose();
  });

  it('reports GPU timing when the renderer has a timer for it', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source(gpuTimer([4, 6])))(live);
    installed.sample(0);
    const gpu = live.read(hudSlice).reading?.data.gpu;
    expect(gpu?.state).toBe('available');
    expect(gpu?.state === 'available' && gpu.stats.count).toBe(2);
    installed.dispose();
  });

  it('shows the level navigation sent the camera to', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    live.dispatch('navigation.goToLevel', {
      level: { id: 'storey-1', name: 'Level 2', elevation: 3 },
    });
    const installed = hudHook(source())(live);
    installed.sample(0);
    expect(live.read(hudSlice).reading?.level).toBe('Level 2');
    installed.dispose();
  });

  it('leaves the level out when nothing has navigated to one', () => {
    const live = session();
    live.dispatch('hud.toggle', { visible: true });
    const installed = hudHook(source())(live);
    installed.sample(0);
    expect(live.read(hudSlice).reading?.level).toBeUndefined();
    installed.dispose();
  });
});

describe('the five features together', () => {
  const all = [clippingFeature, layoutsFeature, environmentFeature, navigationAidsFeature, hudFeature];

  it('install in an order that puts navigation aids before the HUD, with nothing shared', () => {
    expect(checkFeatures(all)).toEqual([]);
    const order = installOrder(all);
    const ids = order.ok ? order.value.map((item) => item.id) : [];
    expect(ids.indexOf('navigation-aids')).toBeLessThan(ids.indexOf('hud'));
    expect(new Set(all.map((item) => item.slice.id)).size).toBe(all.length);
  });

  it('offer thirteen commands, every one of them named for its feature', () => {
    const registry = featureCommandRegistry(all);
    const names = registry.ok ? [...registry.value.keys()] : [];
    expect(names).toEqual([
      'clipping.setPlanes',
      'clipping.setBox',
      'clipping.sectionAt',
      'clipping.clear',
      'layouts.explode',
      'layouts.grid',
      'layouts.reset',
      'environment.set',
      'navigation.goToLevel',
      'navigation.frame',
      'navigation.saveView',
      'navigation.restoreView',
      'hud.toggle',
    ]);
  });
});

describe('the feature', () => {
  it('owns the HUD slice, its one command, and depends on navigation aids', () => {
    expect(hudFeature.id).toBe('hud');
    expect(hudFeature.slice.id).toBe('hud');
    expect(hudFeature.commands.map((item) => item.name)).toEqual(['hud.toggle']);
    expect(hudFeature.dependsOn).toEqual(['navigation-aids']);
  });
});

// A real viewer session with the HUD and the navigation aids it depends on installed.
const installed = () => {
  const created = createSession();
  if (!created.ok) throw new Error(created.diagnostics.map((item) => item.message).join('; '));
  const host = featureHost(created.value);
  const done = host.install([navigationAidsFeature, hudFeature]);
  if (!done.ok) throw new Error(done.diagnostics.map((item) => item.message).join('; '));
  return { session: created.value, host };
};

describe('through the viewer session', () => {
  it('installs beside the feature it depends on, and samples into its slice', () => {
    const { session: live, host } = installed();
    expect(live.dispatch('hud.toggle', { visible: true }).ok).toBe(true);
    const sampler = hudHook(source())(live);
    expect(sampler.sample(0)).toBe(true);
    expect(live.read(hudSlice).reading?.data.scene.renderedInstances).toBe(4);
    sampler.dispose();
    host.dispose();
  });
});
