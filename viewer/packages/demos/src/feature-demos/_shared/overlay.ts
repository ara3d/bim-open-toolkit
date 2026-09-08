// A Canvas2D panel laid over a corner of the viewport, for HUD drawings.
//
// The panel is its own canvas, sized to its content and positioned by the host, so it never takes
// the pointer from the viewport underneath except where it is drawn; a page that wants clicks on
// the panel listens on the panel's canvas. Drawing is the page's: this only makes and places the
// surface and hands back a context sized in CSS pixels with the device ratio applied.

import type { Disposable } from '@bim-open-toolkit/model';

// Which corner of the viewport the panel sits in.
export type PanelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

// A placed panel: its canvas, its 2D context, and its size in CSS pixels.
export type OverlayPanel = Disposable & {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
  // Clears the panel, ready for the next drawing.
  readonly clear: () => void;
};

// How to place a panel.
export type OverlayOptions = {
  readonly corner: PanelCorner;
  readonly width: number;
  readonly height: number;
  // Distance from the viewport's edges, in CSS pixels.
  readonly margin?: number | undefined;
};

// Makes a panel over `viewport`, which must be positioned (the host sets `position: relative`).
// Returns undefined when the browser gives no 2D context.
export const overlayPanel = (viewport: HTMLElement, options: OverlayOptions): OverlayPanel | undefined => {
  const ratio = Math.min(window.devicePixelRatio, 2);
  const canvas = document.createElement('canvas');
  canvas.className = 'demo-overlay';
  canvas.width = Math.round(options.width * ratio);
  canvas.height = Math.round(options.height * ratio);
  const margin = `${options.margin ?? 12}px`;
  canvas.style.position = 'absolute';
  canvas.style.width = `${options.width}px`;
  canvas.style.height = `${options.height}px`;
  canvas.style.top = options.corner.startsWith('top') ? margin : 'auto';
  canvas.style.bottom = options.corner.startsWith('bottom') ? margin : 'auto';
  canvas.style.left = options.corner.endsWith('left') ? margin : 'auto';
  canvas.style.right = options.corner.endsWith('right') ? margin : 'auto';
  const context = canvas.getContext('2d');
  if (context === null) return undefined;
  context.scale(ratio, ratio);
  viewport.append(canvas);
  return {
    canvas,
    context,
    width: options.width,
    height: options.height,
    clear: () => {
      context.clearRect(0, 0, options.width, options.height);
    },
    dispose: () => {
      canvas.remove();
    },
  };
};
