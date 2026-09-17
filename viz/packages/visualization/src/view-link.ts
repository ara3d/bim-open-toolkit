import type { CameraState } from './contracts.js';

export type CameraEndpoint = {
  read(): CameraState;
  write(pose: CameraState): void;
  subscribe(listener: () => void): () => void;
};

function samePose(a: CameraState, b: CameraState): boolean {
  return a.projection === b.projection && a.zoom === b.zoom &&
    a.position.every((value, i) => value === b.position[i]) &&
    a.target.every((value, i) => value === b.target[i]) &&
    a.up.every((value, i) => value === b.up[i]);
}

/** Bidirectional camera synchronization with loop suppression and explicit disposal. */
export function linkCameraViews(a: CameraEndpoint, b: CameraEndpoint, options: { readonly initial?: 'a' | 'b' | false } = {}): () => void {
  let writing = false;
  let disposed = false;
  const transfer = (source: CameraEndpoint, target: CameraEndpoint) => {
    if (disposed || writing) return;
    const pose = source.read();
    if (samePose(pose, target.read())) return;
    writing = true;
    try { target.write(structuredClone(pose)); } finally { writing = false; }
  };
  const stopA = a.subscribe(() => transfer(a, b));
  const stopB = b.subscribe(() => transfer(b, a));
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    stopA();
    stopB();
  };
  try {
    if (options.initial !== false) {
      if (options.initial === 'b') transfer(b, a);
      else transfer(a, b);
    }
  } catch (error) { dispose(); throw error; }
  return dispose;
}
