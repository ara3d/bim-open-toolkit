/** Defer drawing-buffer writes until after ResizeObserver delivery; own pending work. */
export function observeResize(element: Element, resize: () => void): () => void {
  let frame: number | undefined;
  let disposed = false;
  const observer = new ResizeObserver(() => {
    if (disposed || frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      if (!disposed) resize();
    });
  });
  observer.observe(element);
  return () => {
    disposed = true;
    observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  };
}
