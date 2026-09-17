export type CaptureErrorCode = 'invalid-size' | 'render-failed' | 'encode-failed';
export class CaptureError extends Error {
  constructor(readonly code: CaptureErrorCode, message: string, options?: ErrorOptions) { super(message, options); this.name = 'CaptureError'; }
}
export type CaptureCanvas = { readonly width: number; readonly height: number; toBlob(callback: (blob: Blob | null) => void, type?: string): void };
/** Invoke render synchronously immediately before encoding for preserveDrawingBuffer=false canvases. */
export function captureCanvas(canvas: CaptureCanvas, renderFrame: () => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!Number.isFinite(canvas.width) || !Number.isFinite(canvas.height) || canvas.width <= 0 || canvas.height <= 0) { reject(new CaptureError('invalid-size', 'Capture canvas must have positive dimensions')); return; }
    try { renderFrame(); } catch (cause) { reject(new CaptureError('render-failed', 'Could not render capture frame', { cause })); return; }
    try {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new CaptureError('encode-failed', 'Canvas PNG encoding returned no image')), 'image/png');
    } catch (cause) { reject(new CaptureError('encode-failed', 'Canvas PNG encoding failed', { cause })); }
  });
}
