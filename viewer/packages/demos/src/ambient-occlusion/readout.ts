// What the page says in words: the status line under the picture. Pure.

import type { AmbientOcclusionPass } from '@bim-open-toolkit/render';

// The counts the status line reports, the last frame interval, and what the pass came to.
export type DemoCounts = {
  readonly fixture: string;
  readonly objects: number;
  readonly instances: number;
  readonly triangles: number;
  readonly lastFrameMs: number;
  // The renderer the browser reports, so a number is never read without knowing what drew it.
  readonly renderer: string;
  // The pass in force, or undefined when the picture is plain.
  readonly pass: AmbientOcclusionPass | undefined;
};

// The pass in words: off, or its radius in world units and how many directions it samples.
export const describePass = (pass: AmbientOcclusionPass | undefined): string =>
  pass === undefined
    ? 'ambient occlusion off'
    : `ambient occlusion ${pass.output === 'occlusion' ? 'term only' : 'on'} · radius ${pass.radius.toPrecision(3)} · ` +
      `${pass.samples} samples · intensity ${pass.intensity.toFixed(2)}`;

// The status line: what is in the scene, what the pass is doing and how long the last frame took.
export const statusLine = (counts: DemoCounts): string =>
  `${counts.fixture}: ${counts.objects} objects · ${counts.instances} instances · ${counts.triangles} triangles · ` +
  `${describePass(counts.pass)} · last frame ${counts.lastFrameMs.toFixed(1)} ms · ${counts.renderer}`;
