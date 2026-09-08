import { environmentSlice } from '@bim-open-toolkit/features';
import { describe, expect, it } from 'vitest';
import {
  demo,
  environmentReady,
  environmentReport,
  startEnvironment,
} from '../../../src/demos/environment/index.js';
import { environmentSheet } from '../../../src/demos/environment/inspector.js';
import { presetApp, presetPanel, presetPanelSpec } from '../../../src/demos/environment/panels.js';
import { presetOf, presets } from '../../../src/demos/environment/presets.js';
import { sessionForFeatures } from '../_d2-support/fake-session.js';
import { headlessPanel } from '../_d2-support/panel-harness.js';

const session = () => sessionForFeatures(demo.features);

describe('the environment demo', () => {
  it('states what it is', () => {
    expect(demo.id).toBe('environment');
    expect(demo.chapter).toBe('cut-and-arrange');
    expect(demo.fixtures[0]?.basis).toBe('synthetic');
    expect(demo.briefIds).toContain('F10');
  });

  it('opens the synthetic building', async () => {
    const source = await demo.fixtures[0]?.source();
    expect(source?.ok).toBe(true);
    if (source?.ok !== true) return;
    expect(source.value.kind).toBe('data');
  });
});

describe('starting the demo', () => {
  it('puts a preset in force and is then ready', () => {
    const live = session();
    expect(environmentReady(live)).toBe(false);
    const started = startEnvironment(live);
    expect(started.ok).toBe(true);
    expect(live.dispatched.map((each) => each.name)).toEqual(['environment.set']);
    expect(environmentReady(live)).toBe(true);
    expect(environmentReport(live).preset).toBe('Studio');
  });

  it('opens with a z-up rig', () => {
    const live = session();
    startEnvironment(live);
    expect(live.read(environmentSlice).settings.up).toBe('z');
  });

  it('puts the environment back when the demo is disposed', () => {
    const live = session();
    const before = live.read(environmentSlice).settings;
    const started = startEnvironment(live);
    if (started.ok !== true) throw new Error('the demo did not start');
    started.value.dispose();
    expect(live.read(environmentSlice).settings).toEqual(before);
  });
});

describe('the inspector sheet', () => {
  it('reports the preset and its values from a known state', () => {
    const live = session();
    live.dispatch('environment.set', presets.night);
    const sheet = environmentSheet(live);
    expect(sheet.title).toBe('Environment');
    const preset = sheet.groups.find((group) => group.id === 'preset');
    expect(preset?.rows[0]?.value.text).toBe('Night');
    const ground = sheet.groups.find((group) => group.id === 'ground');
    expect(ground?.rows.find((row) => row.key === 'groundPlane')?.value.text).toBe('no');
  });

  it('says an automatic grid spacing is not a number somebody chose', () => {
    const live = session();
    live.dispatch('environment.set', presets.studio);
    const grid = environmentSheet(live).groups.find((group) => group.id === 'grid');
    const spacing = grid?.rows.find((row) => row.key === 'spacing');
    expect(spacing?.value.state).toBe('missing');
    expect(spacing?.value.missingReason).toContain('size of the model');
  });
});

describe('the preset row', () => {
  it('offers every preset as a control a keyboard can reach', () => {
    const panel = headlessPanel(presetApp);
    expect(panel.controls().map((node) => node.label)).toEqual(['Studio', 'Overcast', 'Night', 'Plan']);
    panel.dispose();
  });

  it('chooses a preset when its chip is pressed', () => {
    const panel = headlessPanel(presetApp);
    expect(panel.press('Night')).toBe(true);
    expect(panel.doc().choice).toBe('night');
    panel.dispose();
  });

  it('sets the environment when the choice changes, and does nothing when it does not', () => {
    const live = session();
    presetPanelSpec.onCommit?.({ choice: 'plan' }, { choice: 'studio' }, live);
    expect(live.dispatched.map((each) => each.name)).toEqual(['environment.set']);
    expect(presetOf(live.read(environmentSlice).settings)).toBe('plan');
    presetPanelSpec.onCommit?.({ choice: 'plan' }, { choice: 'plan' }, live);
    expect(live.dispatched).toHaveLength(1);
  });

  it('reads the preset back out of the slice', () => {
    const live = session();
    live.dispatch('environment.set', presets.overcast);
    expect(presetPanelSpec.sync?.(live, { choice: 'custom' })).toEqual({ choice: 'overcast' });
    expect(presetPanel.id).toBe('environment-presets');
  });
});
