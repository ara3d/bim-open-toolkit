// The page frame every feature demo shares: find the page's elements, make the host, run the
// demo's own setup, and publish `window.demo` for the browser test. A page's `main.ts` is one call.
//
// The page HTML supplies three elements: a `<canvas id="viewport">` inside a positioned
// `<div id="stage">`, a `<div id="controls">` the demo fills, and a `<p id="status">`.

import type { DemoReport } from './protocol.js';
import { demoFailed, describeCause } from './protocol.js';
import { createDemoHost, type DemoHost } from './host.js';
import type { Result } from '@bim-open-toolkit/model';

// The elements a demo draws into and reads from.
export type PageElements = {
  readonly canvas: HTMLCanvasElement;
  // The positioned parent of the canvas, where overlay panels go.
  readonly stage: HTMLElement;
  readonly controls: HTMLElement;
  readonly status: HTMLParagraphElement;
};

// What a demo's setup hands back: how to report, how a test acts on it, and how to undo it.
export type MountedDemo = {
  readonly report: () => DemoReport;
  readonly act?: ((name: string, input?: unknown) => boolean) | undefined;
  readonly dispose?: (() => void) | undefined;
};

// A demo's setup: open its model, install its features, add its controls.
export type DemoSetup = (host: DemoHost, page: PageElements) => Result<MountedDemo> | Promise<Result<MountedDemo>>;

const elementById = <T extends Element>(
  id: string,
  kind: new () => T,
  what: string,
): T => {
  const found = document.getElementById(id);
  if (!(found instanceof kind)) throw new Error(`The page has no ${what} with id "${id}"`);
  return found;
};

// The page's elements, or a thrown explanation of which is missing.
export const pageElements = (): PageElements => ({
  canvas: elementById('viewport', HTMLCanvasElement, 'canvas'),
  stage: elementById('stage', HTMLElement, 'stage element'),
  controls: elementById('controls', HTMLElement, 'controls element'),
  status: elementById('status', HTMLParagraphElement, 'status paragraph'),
});

const messagesOf = (result: { readonly diagnostics: readonly { readonly message: string }[] }): string =>
  result.diagnostics.map((item) => item.message).join('; ');

// Mounts a demo and publishes it. Never throws: a failure is published as `window.demo.error` and
// written to the status line, so a test and a person both see it.
export const mountFeatureDemo = async (setup: DemoSetup): Promise<void> => {
  let status: HTMLParagraphElement | undefined;
  try {
    const page = pageElements();
    status = page.status;
    const made = createDemoHost({ canvas: page.canvas });
    if (!made.ok) throw new Error(messagesOf(made));
    const host = made.value;
    const mounted = await setup(host, page);
    if (!mounted.ok) {
      host.dispose();
      throw new Error(messagesOf(mounted));
    }
    const demo = mounted.value;
    const publish = (ready: boolean): void => {
      window.demo = {
        ready,
        error: undefined,
        report: demo.report,
        act: (name, input) => demo.act?.(name, input) ?? false,
        capture: async () => {
          const image = await host.capture();
          return image.ok ? image.value.bytes.length : 0;
        },
      };
    };
    publish(false);
    // Ready once a frame has been drawn with the demo's setup in force.
    const first = host.onFrame(() => {
      first.dispose();
      publish(true);
    });
    window.addEventListener('pagehide', () => {
      demo.dispose?.();
      host.dispose();
    });
  } catch (cause) {
    const message = describeCause(cause);
    window.demo = demoFailed(message);
    if (status !== undefined) status.textContent = `Could not start: ${message}`;
  }
};
