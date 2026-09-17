// A viewer that lives and dies with the component.
//
// `createViewer` owns a WebGL context, a frame loop, listeners on the canvas and a scene, so it can
// only be made once the canvas is in the document - which is after the first render, in an effect.
// The first render therefore has no viewer, which is what `ViewerProvider`'s `fallback` is for.
//
// The options are read once, when the viewer is made. Changing them afterwards does nothing: a
// viewer that rebuilt its renderer because a prop object was rewritten would lose the camera, the
// models and the selection on every parent render.

import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Diagnostic } from '@bim-open-toolkit/model';
import { createViewer, type Viewer, type ViewerOptions } from '@bim-open-toolkit/viewer';

// The viewer once there is one, and what making it reported. A canvas that could not give a WebGL
// context still yields a viewer: it has no view, and `diagnostics` says why.
export type ViewerHandle = {
  readonly viewer: Viewer | undefined;
  readonly diagnostics: readonly Diagnostic[];
};

// Makes a viewer on the canvas the ref points at, and disposes it when the component goes away.
export const useViewer = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: ViewerOptions = {},
): ViewerHandle => {
  const [made, setMade] = useState<Viewer | undefined>(undefined);
  // Read once. `useState`'s initializer is the only place a value can be captured without
  // recapturing it on every render.
  const [held] = useState<ViewerOptions>(options);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    const viewer = createViewer({ ...held, canvas });
    setMade(viewer);
    return () => {
      setMade(undefined);
      viewer.dispose();
    };
  }, [canvasRef, held]);

  return useMemo(
    () => ({ viewer: made, diagnostics: made === undefined ? [] : made.diagnostics() }),
    [made],
  );
};
