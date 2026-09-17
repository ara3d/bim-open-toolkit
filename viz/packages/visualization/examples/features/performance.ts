import { objectKey, type ObjectRecord, type Matrix4 } from '../../src/contracts.js';
import { measureOperation, summarizeMeasurements, MeasurementError } from '../../src/benchmarks.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const performanceDemo: FeatureDemo = {
  id: 'performance', title: 'Measure bulk object updates',
  description: 'Measure 10,000 distinct represented objects on the loaded scene. CPU submission and command-to-next-frame timings are reported separately; GPU and display completion are unmeasured.',
  source: 'examples/features/performance.ts', tests: 'test/benchmarks.test.ts · test/render.test.ts',
  mount(context) {
    const keys = new Set<string>();
    for (const group of context.viewer.scene.groups) {
      for (let index = 0; index < group.instanceCount && keys.size < 10_000; index++) {
        const binding = context.render.resolveInstance(group, index);
        if (binding) keys.add(objectKey(binding.ref));
      }
      if (keys.size === 10_000) break;
    }
    const affected = context.base.filter(object => keys.has(objectKey(object.ref)));
    const groups = context.viewer.scene.groups;
    const counts = { objects: affected.length, sceneObjects: context.base.length, sceneInstances: groups.reduce((sum, group) => sum + group.instanceCount, 0), sceneTriangles: groups.reduce((sum, group) => sum + (group.mesh.indices?.length ?? group.mesh.positions.length / 3) / 3 * group.instanceCount, 0) };
    const output = document.createElement('pre'); output.style.whiteSpace = 'pre-wrap'; context.panel.append(output);
    let active: AbortController | undefined, disposed = false;
    const warmups = 5, samples = 20;
    const buttons: HTMLButtonElement[] = [];
    const run = async (mode: 'color' | 'visibility' | 'transform') => {
      if (active) return;
      if (!affected.length) { context.status('No represented objects available for measurement.'); return; }
      const controller = new AbortController(); active = controller;
      for (const button of buttons) button.disabled = true;
      cancel.disabled = false;
      const cpu: number[] = [];
      let iteration = 0;
      try {
        const result = await measureOperation(async signal => {
          const alternate = iteration++ % 2 === 0;
          const patch: ObjectRecord[] = affected.map(object => mode === 'transform'
            ? { ...object, transform: object.transform.map((value, index) => index === 12 ? value + (alternate ? 1 : -1) : value) as unknown as Matrix4 }
            : { ...object, appearance: { ...object.appearance, ...(mode === 'color' ? { color: alternate ? [0.9, 0.2, 0.1] as const : [0.1, 0.3, 0.9] as const } : { visible: !alternate }) } });
          const start = performance.now();
          const submitted = context.render.update(patch);
          cpu.push(performance.now() - start);
          if (!submitted.ok || submitted.diagnostics.length) throw new Error(submitted.diagnostics.map(item => item.message).join('; '));
          context.viewer.renderFrame();
          await new Promise<void>((resolve, reject) => {
            const onAbort = () => { signal?.removeEventListener('abort', onAbort); cancelAnimationFrame(frame); reject(new MeasurementError('cancelled', 'Measurement cancelled')); };
            const frame = requestAnimationFrame(() => { signal?.removeEventListener('abort', onAbort); resolve(); });
            signal?.addEventListener('abort', onAbort, { once: true });
            if (signal?.aborted) onAbort();
          });
        }, { name: mode, counts, warmups, samples, signal: controller.signal, onProgress: progress => context.status(`${mode} · ${progress.phase} ${progress.completed}/${progress.total} · ${affected.length.toLocaleString()} objects`) });
        if (disposed) return;
        const submission = summarizeMeasurements(cpu.slice(warmups));
        output.textContent = `${mode} · ${counts.objects.toLocaleString()} distinct objects\nFull scene: ${counts.sceneObjects.toLocaleString()} objects / ${counts.sceneInstances.toLocaleString()} instances / ${counts.sceneTriangles.toLocaleString()} triangles\n${warmups} warmups / ${samples} samples · nearest-rank percentiles\nCPU patch submission: p50 ${submission.p50.toFixed(2)} ms / p95 ${submission.p95.toFixed(2)} ms\nCommand → next animation frame: p50 ${result.p50.toFixed(2)} ms / p95 ${result.p95.toFixed(2)} ms\nIncludes patch creation and explicit rendering; excludes guaranteed GPU/display completion.\nViewport ${context.canvas.clientWidth} × ${context.canvas.clientHeight}; drawing buffer ${context.canvas.width} × ${context.canvas.height}; device DPR ${devicePixelRatio}\n${navigator.userAgent}\nGPU/CPU model, RAM, driver and presentation timing: not collected.`;
        context.status('Measurement complete; source state restored. Timings are observations, not a display-latency acceptance result.');
      } catch (error) { if (!disposed) context.status(error instanceof Error ? error.message : String(error)); }
      finally {
        active = undefined;
        if (!disposed) {
          const restored = context.render.update(affected);
          if (!restored.ok || restored.diagnostics.length) context.status(`Restore failed: ${restored.diagnostics.map(item => item.message).join('; ')}`);
          context.viewer.renderFrame();
          for (const button of buttons) button.disabled = false;
          cancel.disabled = true;
        }
      }
    };
    for (const mode of ['color', 'visibility', 'transform'] as const) buttons.push(context.button(`Measure ${mode} updates`, () => run(mode)));
    const cancel = context.button('Cancel measurement', () => { active?.abort(); }); cancel.disabled = true;
    context.status(`${affected.length.toLocaleString()} distinct represented objects available; ${counts.sceneTriangles.toLocaleString()} full-scene triangles. Each action runs 5 warmups and 20 changing samples.`);
    return () => { disposed = true; active?.abort(); output.remove(); };
  },
};
