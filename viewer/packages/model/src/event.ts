import type { Diagnostic } from './result.js';

// Undoes a subscription or an installation. Calling it more than once does nothing more.
export type Disposable = { readonly dispose: () => void };

// What changed after one command committed: which slices hold a new value, and what was reported.
// Subscribers react to the slice ids they care about, so a feature they never heard of costs nothing.
export type ChangeEvent = {
  readonly command: string;
  readonly changed: readonly string[];
  readonly diagnostics: readonly Diagnostic[];
};

// Called after each commit with what changed.
export type Listener = (event: ChangeEvent) => void;

// A disposable that runs the given work once, however many times it is disposed.
export const disposable = (work: () => void): Disposable => {
  let done = false;
  return {
    dispose: () => {
      if (done) return;
      done = true;
      work();
    },
  };
};

// A disposable that disposes all of the given ones, in order, when it is disposed.
export const disposeAll = (items: readonly Disposable[]): Disposable =>
  disposable(() => {
    for (const item of items) item.dispose();
  });

// A disposable that does nothing, for a feature that installs no hook.
export const noDisposal: Disposable = disposable(() => undefined);

// An event reporting what one command changed.
export const changeEvent = (
  command: string,
  changed: readonly string[],
  diagnostics: readonly Diagnostic[] = [],
): ChangeEvent => ({ command, changed, diagnostics });

// The slice ids whose value is not the same one as before. Values are compared by identity,
// which is what immutable slices give: an unchanged slice keeps its object.
export const changedSlices = (
  before: ReadonlyMap<string, unknown>,
  after: ReadonlyMap<string, unknown>,
): readonly string[] => {
  const ids = [...new Set([...before.keys(), ...after.keys()])];
  return ids.filter((id) => before.get(id) !== after.get(id));
};

// True when the event says the named slice changed.
export const didChange = (event: ChangeEvent, sliceId: string): boolean => event.changed.includes(sliceId);

// Calls the listener only for events that touched one of the named slices.
export const onSlices = (sliceIds: readonly string[], listener: Listener): Listener => (event) => {
  if (sliceIds.some((id) => didChange(event, id))) listener(event);
};
