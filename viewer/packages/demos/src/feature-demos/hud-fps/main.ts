// Is it keeping up, and where does the time go?
//
// The building by default, the stress scene by a picker. The `hud` feature samples once a frame
// through its own hook and writes a reading into its slice; this page paints that reading onto a
// corner panel and keeps its own ring of frame intervals for the sparkline. Two controls put the
// renderer under load: a button that writes a random colour to every object through the render
// binding's change table, and a checkbox that orbits the camera every frame.

import {
  diagnostic,
  f32Column,
  failure,
  i32Column,
  success,
  table,
  upVector,
  type Result,
} from '@bim-open-toolkit/model';
import { FrameTimer, updateColumns } from '@bim-open-toolkit/render';
import {
  hudFeature,
  hudHook,
  hudSlice,
  navigationAidsFeature,
  navigationHook,
  type HudSampler,
} from '@bim-open-toolkit/features';
import { orbitPose } from '@bim-open-toolkit/interact';
import { defaultBuildingOptions, defaultStressOptions, generateBuilding, generateStressScene } from '@bim-open-toolkit/synthetic';
import { addButton, addCheckbox, addSelect, addStatus } from '../_shared/controls.js';
import type { OpenedModel } from '../_shared/host.js';
import { overlayPanel } from '../_shared/overlay.js';
import { mountFeatureDemo } from '../_shared/page.js';
import { paintDrawing } from './drawing.js';
import { fpsDrawing, fpsPanelSize } from './panel.js';

// The two fixtures the picker offers: a small building and the ten-thousand-instance stress scene.
const fixtureNames = ['building', 'stress'] as const;
type FixtureName = (typeof fixtureNames)[number];

const isFixtureName = (value: unknown): value is FixtureName =>
  typeof value === 'string' && fixtureNames.some((name) => name === value);

// How many recent frame intervals the sparkline holds.
const rememberedIntervals = 120;

// How far the camera swings each frame while "spin" is ticked, in radians.
const spinPerFrame = 0.008;

void mountFeatureDemo((host, page) => {
  const panel = overlayPanel(page.stage, { corner: 'top-right', ...fpsPanelSize });
  if (panel === undefined)
    return failure([diagnostic('hud-fps/no-2d', 'The browser gave no 2D context for the HUD panel')]);

  const openFixture = (name: FixtureName): Result<OpenedModel> => {
    const built =
      name === 'stress'
        ? generateStressScene(defaultStressOptions)
        : generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });
    return host.open(name, built.model, built.geometry);
  };
  const first = openFixture('building');
  if (!first.ok) return failure(first.diagnostics);

  const sourceOf = (model: OpenedModel): HudSampler =>
    hudHook({
      table: model.table,
      geometry: model.geometry,
      frames: new FrameTimer(),
      gpu: host.gpu,
      camera: host.cameraKind,
    })(host.session);

  const installed = host.features.install([
    { ...navigationAidsFeature, install: navigationHook({ setView: host.setView }) },
    hudFeature,
  ]);
  if (!installed.ok) return failure(installed.diagnostics);
  const shown = host.session.dispatch('hud.toggle', { visible: true });
  if (!shown.ok) return failure(shown.diagnostics);

  let fixture: FixtureName = 'building';
  let current = first.value;
  let sampler = sourceOf(current);
  let spinning = false;
  let recolourings = 0;
  const intervals: number[] = [];
  host.fit();

  const readout = addStatus(page.controls, 'readout', 'The HUD panel updates four times a second.');
  const repaint = (): void => {
    const reading = host.session.read(hudSlice).reading;
    paintDrawing(panel.context, fpsDrawing(reading?.data, intervals, reading?.level));
    const data = reading?.data;
    page.status.textContent =
      data === undefined
        ? 'Measuring.'
        : `${fixture} · ${data.frames.medianMs.toFixed(1)} ms median · ${data.framesPerSecond.toFixed(1)} fps · ` +
          `${data.scene.renderedInstances} instances · ${data.scene.renderedTriangles} triangles · ` +
          `GPU ${data.gpu.state === 'available' ? `${data.gpu.stats.medianMs.toFixed(2)} ms` : data.gpu.reason}`;
  };

  // Every object a random colour, written as one change table so the whole scene moves at once.
  const recolour = (): number => {
    const count = current.keys.length;
    const objects = new Int32Array(count);
    const red = new Float32Array(count);
    const green = new Float32Array(count);
    const blue = new Float32Array(count);
    for (let object = 0; object < count; object += 1) {
      objects[object] = object;
      red[object] = Math.random();
      green[object] = Math.random();
      blue[object] = Math.random();
    }
    const changes = table([
      [updateColumns.object, i32Column(objects)],
      [updateColumns.red, f32Column(red)],
      [updateColumns.green, f32Column(green)],
      [updateColumns.blue, f32Column(blue)],
    ]);
    const applied = host.binding.applyChanges(current.modelId, changes);
    if (applied.ok) recolourings += 1;
    readout.textContent = applied.ok
      ? `Recoloured ${applied.value.rowsWritten} rows of ${applied.value.rowsAddressed}.`
      : applied.diagnostics.map((item) => item.message).join('; ');
    return applied.ok ? applied.value.rowsWritten : 0;
  };

  const showFixture = (name: FixtureName): boolean => {
    if (name === fixture) return true;
    sampler.dispose();
    host.binding.removeModel(current.modelId);
    const opened = openFixture(name);
    if (!opened.ok) {
      readout.textContent = opened.diagnostics.map((item) => item.message).join('; ');
      sampler = sourceOf(current);
      return false;
    }
    fixture = name;
    current = opened.value;
    sampler = sourceOf(current);
    intervals.length = 0;
    host.fit();
    return true;
  };

  addSelect(
    page.controls,
    'fixture',
    'Fixture',
    [
      { value: 'building', label: 'Building (roof and ceilings)' },
      { value: 'stress', label: 'Stress scene (10 000 instances)' },
    ],
    (value) => {
      if (isFixtureName(value)) showFixture(value);
    },
  );
  addButton(page.controls, 'recolour', 'Recolour everything', () => {
    recolour();
  });
  addCheckbox(page.controls, 'spin', 'Spin', false, (checked) => {
    spinning = checked;
  });
  addButton(page.controls, 'fit', 'Fit', () => {
    host.fit(undefined, true);
  });

  const frames = host.onFrame((frame) => {
    if (spinning) {
      const view = host.view();
      host.setView({
        ...view,
        camera: orbitPose(view.camera, upVector(view.coordinates.up), spinPerFrame, 0),
      });
    }
    if (frame.intervalMs > 0) {
      intervals.push(frame.intervalMs);
      if (intervals.length > rememberedIntervals) intervals.shift();
    }
    if (sampler.sample(frame.time)) repaint();
  });

  return success({
    report: () => {
      const data = host.session.read(hudSlice).reading?.data;
      const statistics = host.binding.statistics();
      return {
        fixture,
        framesMeasured: data?.frames.count ?? 0,
        medianMs: data?.frames.medianMs ?? 0,
        p95Ms: data?.frames.p95Ms ?? 0,
        fps: data?.framesPerSecond ?? 0,
        withinBudget: data?.withinBudget ?? false,
        gpuState: data === undefined ? 'not sampled' : data.gpu.state === 'available' ? 'available' : data.gpu.reason,
        gpuMedianMs: data !== undefined && data.gpu.state === 'available' ? data.gpu.stats.medianMs : -1,
        instances: statistics.renderedInstances,
        triangles: statistics.renderedTriangles,
        intervalsHeld: intervals.length,
        recolourings,
        spinning,
      };
    },
    act: (name, input) => {
      if (name === 'recolour') return recolour() > 0;
      if (name === 'spin') {
        spinning = input === true;
        return true;
      }
      if (name === 'fixture') return isFixtureName(input) && showFixture(input);
      if (name === 'fit') {
        host.fit();
        return true;
      }
      return false;
    },
    dispose: () => {
      frames.dispose();
      sampler.dispose();
      panel.dispose();
    },
  });
});
