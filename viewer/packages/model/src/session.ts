import type { Disposable, Listener } from './event.js';
import type { Result } from './result.js';
import type { StateSlice } from './slices.js';

// What a command may read and change. The viewer package implements it; this package only states it.
// State is read and written a slice at a time, so a feature never reaches into another's data.
export type Session = {
  readonly read: <S>(slice: StateSlice<S>) => S;
  readonly write: <S>(slice: StateSlice<S>, value: S) => void;
  readonly dispatch: (name: string, input: unknown) => Result<unknown>;
  readonly subscribe: (listener: Listener) => Disposable;
};
