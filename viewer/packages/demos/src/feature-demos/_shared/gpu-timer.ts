// GPU frame timing through EXT_disjoint_timer_query_webgl2, with no `any`.
//
// The extension object reaches TypeScript untyped, but nothing here needs it beyond its presence:
// its two constants are fixed by the specification, and the query functions it relies on
// (`createQuery`, `beginQuery`, `endQuery`, `getQueryParameter`, `deleteQuery`) are typed on
// `WebGL2RenderingContext` itself. The timer is written over the small `TimerQueryContext` below,
// which the real context satisfies and a test fakes.
//
// A result arrives some frames after the work it measures, so `end` queues the query and `poll`
// hands back the oldest finished one, in milliseconds. A disjoint event (the GPU clock jumped, for
// example under power management) invalidates every pending query, which are then dropped rather
// than reported.

import { noGpuTimer, type GpuFrameTimer } from '@bim-open-toolkit/render';

// `TIME_ELAPSED_EXT` and `GPU_DISJOINT_EXT` as the specification numbers them.
export const timeElapsedExt = 0x88bf;
export const gpuDisjointExt = 0x8fbb;

// The part of a WebGL2 context a timer query needs.
export type TimerQueryContext = {
  readonly QUERY_RESULT: number;
  readonly QUERY_RESULT_AVAILABLE: number;
  readonly createQuery: () => WebGLQuery | null;
  readonly deleteQuery: (query: WebGLQuery | null) => void;
  readonly beginQuery: (target: number, query: WebGLQuery) => void;
  readonly endQuery: (target: number) => void;
  // Untyped in the DOM library; read here as `unknown` and narrowed.
  readonly getQueryParameter: (query: WebGLQuery, name: number) => unknown;
  readonly getParameter: (name: number) => unknown;
  readonly getExtension: (name: string) => unknown;
};

// How many finished frames may wait to be polled before the oldest is dropped.
export const mostPendingQueries = 8;

// A timer over a context that has the extension, or the reason it has none.
export const timerQueryFrameTimer = (context: TimerQueryContext): GpuFrameTimer => {
  const extension = context.getExtension('EXT_disjoint_timer_query_webgl2');
  if (extension === null || extension === undefined) return noGpuTimer('EXT_disjoint_timer_query_webgl2 is not present');
  const pending: WebGLQuery[] = [];
  let active: WebGLQuery | undefined;
  return {
    availability: { state: 'available' },
    begin: () => {
      if (active !== undefined) return;
      const query = context.createQuery();
      if (query === null) return;
      context.beginQuery(timeElapsedExt, query);
      active = query;
    },
    end: () => {
      if (active === undefined) return;
      context.endQuery(timeElapsedExt);
      pending.push(active);
      active = undefined;
      while (pending.length > mostPendingQueries) context.deleteQuery(pending.shift() ?? null);
    },
    poll: () => {
      const oldest = pending[0];
      if (oldest === undefined) return undefined;
      if (context.getQueryParameter(oldest, context.QUERY_RESULT_AVAILABLE) !== true) return undefined;
      pending.shift();
      if (context.getParameter(gpuDisjointExt) === true) {
        for (const query of pending.splice(0)) context.deleteQuery(query);
        context.deleteQuery(oldest);
        return undefined;
      }
      const nanoseconds = context.getQueryParameter(oldest, context.QUERY_RESULT);
      context.deleteQuery(oldest);
      return typeof nanoseconds === 'number' && Number.isFinite(nanoseconds) ? nanoseconds / 1e6 : undefined;
    },
  };
};

// The timer for a canvas: its WebGL2 context, which is the one the renderer already created, or
// the reason there is none.
export const gpuFrameTimer = (canvas: HTMLCanvasElement): GpuFrameTimer => {
  const context = canvas.getContext('webgl2');
  if (context === null) return noGpuTimer('the canvas has no WebGL2 context');
  return timerQueryFrameTimer(context);
};
