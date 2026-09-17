import { fail, formatCode } from './diagnostics.js';

// The phases of a load, in the order they happen. A phase that does no work is not reported.
export type LoadPhase = 'fetch' | 'parse' | 'convert' | 'metadata';

// How far one phase has got. `total` is present only when the loader knows it in advance.
export type LoadProgress = {
  readonly phase: LoadPhase;
  readonly loaded: number;
  readonly total?: number | undefined;
};

// Called as each phase advances. Never called after the load has finished or been cancelled.
export type ProgressReporter = (progress: LoadProgress) => void;

// What every loader in this package accepts: where to report progress, and what stops it.
export type LoadContext = {
  readonly onProgress?: ProgressReporter | undefined;
  readonly signal?: AbortSignal | undefined;
};

// Nothing is watching and nothing will cancel.
export const silentContext: LoadContext = {};

// True once the caller has asked for the load to stop.
export const isCancelled = (context: LoadContext): boolean => context.signal?.aborted === true;

// Ends the load with the cancellation code when the caller has asked it to stop.
export const throwIfCancelled = (context: LoadContext): void => {
  if (isCancelled(context)) fail(formatCode.cancelled, 'Model loading was cancelled');
};

// Reports one step, after checking for cancellation so a stopped load publishes nothing further.
export const reportProgress = (
  context: LoadContext,
  phase: LoadPhase,
  loaded: number,
  total?: number,
): void => {
  throwIfCancelled(context);
  context.onProgress?.(total === undefined ? { phase, loaded } : { phase, loaded, total });
};

// A context that reports into `phase` only, used when one loader drives another.
export const withinPhase = (context: LoadContext, phase: LoadPhase): LoadContext => ({
  ...(context.signal === undefined ? {} : { signal: context.signal }),
  ...(context.onProgress === undefined
    ? {}
    : { onProgress: (progress: LoadProgress): void => context.onProgress?.({ ...progress, phase }) }),
});

// How often a bulk loop checks for cancellation. Small enough to stop promptly, large enough to be free.
export const cancellationCheckInterval = 65_536;
