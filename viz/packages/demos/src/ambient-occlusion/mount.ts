// The impure half of the page: a stage, a scene binding, the settings panel, navigation, a frame
// loop and a status line. Everything above this file is a pure function of its input.

import { defaultView, emptyBounds, type Bounds, type Result } from '@bim-open-toolkit/model';
import { diagnostic, failure, success } from '@bim-open-toolkit/model';
import { attachNavigation, fitState, navSession, navState, type NavController } from '@bim-open-toolkit/interact';
import {
  FrameTimer,
  SceneBinding,
  applyAmbientOcclusion,
  type AmbientOcclusionSettings,
  type SceneStatistics,
} from '@bim-open-toolkit/render';
import { defaultValues, settingsFromValues, type ControlKey } from './controls.js';
import { defaultFixtureName, demoFixture, isFixtureName, fixtureNames, type FixtureName } from './fixtures.js';
import { buildPanel } from './panel.js';
import { luminanceStatistics, type LuminanceStatistics } from './pixels.js';
import { statusLine, type DemoCounts } from './readout.js';
import { applyView, createStage } from './stage.js';

// What the page reports about itself, for the status line and for a browser test.
export type DemoReport = DemoCounts & {
  readonly enabled: boolean;
  readonly output: string;
};

// What a mounted page offers besides its picture.
export type DemoPage = {
  readonly report: () => DemoReport;
  // Shows these control values and applies the settings they describe.
  readonly apply: (patch: Partial<Readonly<Record<ControlKey, string>>>) => Result<AmbientOcclusionSettings>;
  // Draws one frame and reads it back as luminance statistics.
  readonly measure: () => LuminanceStatistics;
  // Replaces the model with another fixture and frames it.
  readonly open: (name: string) => Result<FixtureName>;
};

// How to mount. `onReport` runs about four times a second; `onReady` runs once, after the first
// frame is drawn.
export type DemoOptions = {
  readonly onReport?: ((report: DemoReport) => void) | undefined;
  readonly onReady?: ((page: DemoPage) => void) | undefined;
};

// The dark viewport of the gallery's look.
const viewportColor = 0x1b1d22;

const describeAll = (result: { readonly diagnostics: readonly { readonly message: string }[] }): string =>
  result.diagnostics.map((one) => one.message).join('; ');

// Draws a synthetic model on the canvas with ambient occlusion, puts the settings panel into
// `panelHost`, and returns the way to take all of it away again. Throws when the canvas has no
// WebGL or the first fixture cannot be bound.
export const mountDemo = (canvas: HTMLCanvasElement, panelHost: HTMLElement, options: DemoOptions = {}): (() => void) => {
  const stage = createStage(canvas, viewportColor);
  const applySize = (): void => {
    stage.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio, 2));
  };
  applySize();
  const binding = new SceneBinding(stage.scene);

  // Model: one fixture at a time; opening another removes the one before it.
  let fixture: FixtureName = defaultFixtureName;
  let bounds: Bounds = emptyBounds;
  let statistics: SceneStatistics = binding.statistics();
  let controller: NavController | undefined;
  const frame = (): void => {
    const aspect = canvas.clientHeight > 0 ? canvas.clientWidth / canvas.clientHeight : 1;
    const fitted = fitState(navState(defaultView, 'orbit'), bounds, { aspect, padding: 1.05 });
    controller?.dispose();
    controller = attachNavigation(canvas, {
      session: navSession(fitted),
      onChange: (session) => {
        applyView(stage.camera, session.nav.view);
      },
    });
    applyView(stage.camera, fitted.view);
  };
  const open = (name: string): Result<FixtureName> => {
    if (!isFixtureName(name))
      return failure([diagnostic('unknown-fixture', `No fixture is called ${name}`, ['name'])]);
    const next = demoFixture(name);
    for (const model of binding.models) binding.removeModel(model.modelId);
    const bound = binding.addModel(next.modelId, next.geometry, next.keys);
    if (!bound.ok) return failure(bound.diagnostics);
    fixture = name;
    bounds = binding.bounds();
    statistics = binding.statistics();
    stage.setClipBox(bounds);
    frame();
    return success(name);
  };
  const opened = open(fixture);
  if (!opened.ok) throw new Error(`Could not bind the ${fixture} fixture: ${describeAll(opened)}`);

  // Panel: the settings controls, then the fixture picker and the compare button below them.
  const document = panelHost.ownerDocument;
  const status = document.createElement('p');
  status.className = 'ao-status';
  const note = document.createElement('p');
  note.className = 'ao-status';
  let settings: AmbientOcclusionSettings | undefined;
  const applySettings = (next: AmbientOcclusionSettings): Result<AmbientOcclusionSettings> => {
    const applied = applyAmbientOcclusion(stage, next, bounds);
    if (!applied.ok) return failure(applied.diagnostics);
    settings = next;
    return success(next);
  };
  // What the panel holds, applied; a refused value is said in the note and changes nothing.
  const applyValues = (): Result<AmbientOcclusionSettings> => {
    const parsed = settingsFromValues(panel.values());
    const applied = parsed.ok ? applySettings(parsed.value) : parsed;
    note.textContent = applied.ok ? '' : `Not applied: ${describeAll(applied)}`;
    return applied;
  };
  const panel = buildPanel(panelHost, defaultValues, applyValues);
  applyValues();

  const picker = document.createElement('label');
  const pickerText = document.createElement('span');
  pickerText.textContent = 'Fixture';
  const select = document.createElement('select');
  for (const name of fixtureNames) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = demoFixture(name).title;
    select.append(option);
  }
  select.value = fixture;
  picker.append(pickerText, select);
  const compare = document.createElement('button');
  compare.type = 'button';
  compare.textContent = 'Compare (hold, or press a)';
  panelHost.append(picker, compare, note);
  canvas.parentElement?.append(status);

  // Compare: the plain picture while held, the settings back when released.
  let comparing = false;
  const setComparing = (on: boolean): void => {
    if (on === comparing) return;
    comparing = on;
    if (on) stage.setAmbientOcclusion(undefined);
    else if (settings !== undefined) applySettings(settings);
  };

  const listeners = new AbortController();
  const signal = listeners.signal;
  select.addEventListener('change', () => {
    const result = open(select.value);
    if (!result.ok) note.textContent = describeAll(result);
    else if (settings !== undefined) applySettings(settings);
  }, { signal });
  compare.addEventListener('pointerdown', () => setComparing(true), { signal });
  compare.addEventListener('pointerup', () => setComparing(false), { signal });
  compare.addEventListener('pointerleave', () => setComparing(false), { signal });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'a' && !event.repeat && !(event.target instanceof HTMLInputElement)) setComparing(true);
  }, { signal });
  window.addEventListener('keyup', (event) => {
    if (event.key === 'a') setComparing(false);
  }, { signal });

  // Resize: only when the size actually changed, so nothing feeds back into the observer.
  const frames = new FrameTimer();
  let lastWidth = canvas.clientWidth;
  let lastHeight = canvas.clientHeight;
  const sizes = new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth && canvas.clientHeight === lastHeight) return;
    lastWidth = canvas.clientWidth;
    lastHeight = canvas.clientHeight;
    applySize();
    frames.reset();
  });
  sizes.observe(canvas);

  // Report: the counts now.
  let lastFrameMs = 0;
  const counts = (): DemoReport => ({
    fixture,
    objects: statistics.sourceObjects,
    instances: statistics.renderedInstances,
    triangles: statistics.renderedTriangles,
    lastFrameMs,
    renderer: stage.renderer,
    pass: stage.pass(),
    enabled: settings?.enabled ?? false,
    output: settings?.output ?? 'shaded',
  });
  const report = (): void => {
    status.textContent = statusLine(counts());
    options.onReport?.(counts());
  };

  // The frame loop, which is also where the frame interval is measured.
  let handle = 0;
  let lastPaint = 0;
  const step = (now: number): void => {
    handle = window.requestAnimationFrame(step);
    const interval = frames.mark(now);
    if (interval !== undefined) lastFrameMs = interval;
    stage.render();
    if (now - lastPaint > 250) {
      lastPaint = now;
      report();
    }
  };
  stage.render();
  report();
  handle = window.requestAnimationFrame(step);
  // What a test drives. Each action reports before it returns, so what the window shows is current.
  options.onReady?.({
    report: counts,
    apply: (patch) => {
      panel.show({ ...panel.values(), ...patch });
      const applied = applyValues();
      report();
      return applied;
    },
    measure: () => {
      stage.render();
      return luminanceStatistics(stage.readPixels());
    },
    open: (name) => {
      const result = open(name);
      if (result.ok) {
        select.value = name;
        if (settings !== undefined) applySettings(settings);
      }
      report();
      return result;
    },
  });

  return () => {
    window.cancelAnimationFrame(handle);
    sizes.disconnect();
    listeners.abort();
    controller?.dispose();
    panel.dispose();
    picker.remove();
    compare.remove();
    note.remove();
    status.remove();
    binding.dispose();
    stage.dispose();
  };
};
