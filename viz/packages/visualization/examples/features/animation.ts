import { sceneBounds } from '@ara3d/viewer-core';
import { advancePlayback, createPlayback, pausePlayback, playPlayback, resetPlayback, sampleCircularTranslation, seekPlayback, setPlaybackRate } from '../../src/animation.js';
import { objectKey, type Matrix4 } from '../../src/contracts.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const animationDemo: FeatureDemo = {
  id: 'animation', title: 'Time-driven movement',
  description: 'Play, pause, seek and change the speed of a synthetic circular movement for one model object.',
  source: 'examples/features/animation.ts', tests: 'vitest run test/animation.test.ts',
  mount(context) {
    const group = context.viewer.scene.groups.find(item => item.instanceCount > 0);
    const binding = group && context.render.resolveInstance(group, 0);
    const object = binding && context.base.find(item => objectKey(item.ref) === objectKey(binding.ref));
    if (!object) { context.status('No bound object is available for animation.'); return () => {}; }
    const bounds = sceneBounds(context.viewer.scene);
    const radius = bounds ? Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]) * 0.05 : 1;
    const now = () => performance.now() / 1000;
    let state = createPlayback(12, { loop: true, timestamp: now() });
    let frame: number | undefined;
    let disposed = false;
    const seekLabel = document.createElement('label'); seekLabel.textContent = 'Timeline (seconds)';
    const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '12'; seek.step = '0.01'; seek.value = '0'; seekLabel.append(seek);
    const speedLabel = document.createElement('label'); speedLabel.textContent = 'Playback speed';
    const speed = document.createElement('select');
    for (const rate of [0.25, 0.5, 1, 2, 4]) { const option = document.createElement('option'); option.value = String(rate); option.textContent = `${rate}×`; speed.append(option); }
    speed.value = '1'; speedLabel.append(speed);
    const progress = document.createElement('p'); progress.setAttribute('aria-live', 'off');
    context.panel.append(seekLabel, speedLabel, progress);
    const apply = () => {
      const delta = sampleCircularTranslation(state.time, { period: state.duration, radius });
      const transform = [...object.transform];
      transform[12]! += delta[0]; transform[13]! += delta[1]; transform[14]! += delta[2];
      context.render.update([{ ...object, transform: transform as unknown as Matrix4 }]);
      seek.value = String(state.time);
      progress.textContent = `${state.time.toFixed(2)} / ${state.duration} seconds · ${state.playing ? 'Playing' : 'Paused'}`;
    };
    const cancel = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
    const tick = () => {
      frame = undefined;
      if (disposed || !state.playing) return;
      state = advancePlayback(state, now());
      apply();
      if (state.playing) frame = requestAnimationFrame(tick);
    };
    const buttons = [
      context.button('Play', () => { state = playPlayback(state, now()); if (frame === undefined) frame = requestAnimationFrame(tick); }),
      context.button('Pause', () => { state = pausePlayback(state, now()); cancel(); apply(); }),
      context.button('Reset movement', () => { state = resetPlayback(state, now()); cancel(); context.render.update([object]); seek.value = '0'; progress.textContent = '0 / 12 seconds · Paused'; }),
    ];
    seek.oninput = () => { state = seekPlayback(state, Number(seek.value), now()); apply(); };
    speed.onchange = () => { state = setPlaybackRate(state, Number(speed.value), now()); apply(); };
    progress.textContent = '0 / 12 seconds · Paused';
    context.status(`Synthetic movement demonstration: ${object.name ?? object.ref.objectId}. This is not a construction schedule; the original placement is restored on reset.`);
    return () => {
      disposed = true; cancel(); context.render.update([object]);
      for (const element of [...buttons, seekLabel, speedLabel, progress]) element.remove();
    };
  },
};
