import { loadBosModel } from '../../src/loading.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const loadingChecksDemo: FeatureDemo = {
  id: 'loading-checks', title: 'Loading failure checks',
  description: 'Exercise HTML rejection, truncated ZIP rejection and cancellation without replacing the loaded model.',
  source: 'examples/features/loading-checks.ts', tests: 'test/loading.test.ts',
  mount(context) {
    const output = document.createElement('p');
    output.setAttribute('role', 'status'); output.setAttribute('aria-live', 'polite');
    output.textContent = 'Choose a check. Expected failures are reported as PASS. The original scene stays loaded.';
    context.panel.append(output);
    const buttons: HTMLButtonElement[] = [];
    let controller: AbortController | undefined, disposed = false;
    const run = async (label: string, source: string | ArrayBuffer, expected: 'aborted' | 'load-failed', preabort = false) => {
      if (disposed || controller) return;
      const request = new AbortController(); controller = request;
      for (const button of buttons) button.disabled = true;
      output.setAttribute('role', 'status'); output.textContent = `Checking ${label}…`;
      const groupCount = context.viewer.scene.groups.length;
      try {
        if (preabort) request.abort();
        const result = await loadBosModel(source, { id: 'loading-check', revision: '1' }, { signal: request.signal });
        if (disposed) return;
        const codes = result.diagnostics.map(diagnostic => diagnostic.code);
        const rejected = !result.ok && codes.includes(expected);
        const htmlRejected = label !== 'HTML response' || result.diagnostics.some(diagnostic => /HTML/i.test(diagnostic.message));
        const sceneIntact = context.viewer.scene.groups.length === groupCount;
        const pass = rejected && htmlRejected && sceneIntact;
        output.setAttribute('role', pass ? 'status' : 'alert');
        output.textContent = `${pass ? 'PASS' : 'FAIL'} — ${label}: ${result.ok ? 'unexpectedly accepted input' : codes.join(', ')}. `
          + `${sceneIntact ? 'Original scene group count unchanged; no scene edits were submitted.' : 'Scene group count changed unexpectedly.'} `
          + result.diagnostics.map(diagnostic => diagnostic.message).join(' ');
      } catch (error) {
        if (!disposed) {
          output.setAttribute('role', 'alert');
          output.textContent = `FAIL — ${label}: unexpected exception: ${error instanceof Error ? error.message : String(error)}`;
        }
      } finally {
        if (controller === request) controller = undefined;
        if (!disposed) for (const button of buttons) button.disabled = false;
      }
    };
    buttons.push(context.button('Check HTML response', () => run('HTML response', '/', 'load-failed')));
    buttons.push(context.button('Check truncated ZIP', () => run('truncated ZIP', new Uint8Array([0x50, 0x4b, 3, 4]).buffer, 'load-failed')));
    buttons.push(context.button('Check pre-aborted load', () => run('pre-aborted load', '/', 'aborted', true)));
    return () => {
      disposed = true; controller?.abort();
      for (const button of buttons) button.remove();
      output.remove();
    };
  },
};
