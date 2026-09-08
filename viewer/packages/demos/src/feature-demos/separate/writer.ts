// The one thing that moves rows on this page: `layoutsHook` with the offsets supplied from outside
// rather than read from the layouts slice.
//
// Everything it does is the feature's own - `captureTranslations` once at the start,
// `layoutTranslations` into one reused buffer, `writeLayout` with change detection - so the only
// thing local about it is where the offsets come from. It goes when the layouts feature gains a
// `row` layout kind and the page can dispatch `layouts.row` instead.

import type { Disposable, ObjectKey, Vec3 } from '@bim-open-toolkit/model';
import {
  captureTranslations,
  layoutTranslations,
  writeLayout,
  type LayoutHost,
} from '@bim-open-toolkit/features';

// Applies offsets to the rows and says how many moved. Disposing puts the model back where it was.
export type LayoutWriter = Disposable & {
  readonly apply: (offsets: ReadonlyMap<ObjectKey, Vec3>) => number;
};

const nothingMoved: ReadonlyMap<ObjectKey, Vec3> = new Map();

// A writer over the rows of one open model. The base translations are read once, so every set of
// offsets is measured from the model's own placement rather than from the last arrangement.
export const layoutWriter = (host: LayoutHost): LayoutWriter => {
  const base = captureTranslations(host.table);
  const scratch = new Float32Array(base.length);
  const apply = (offsets: ReadonlyMap<ObjectKey, Vec3>): number => {
    const moved = writeLayout(host.table, layoutTranslations(host.table, base, offsets, scratch), host.dirty);
    host.moved?.(moved);
    return moved;
  };
  return {
    apply,
    dispose: () => {
      apply(nothingMoved);
    },
  };
};
