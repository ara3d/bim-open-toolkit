// What a demo worked out in `start`, kept for the pure functions the host calls afterwards.
//
// G1 hands `inspector`, `ready` and `report` a `Session` and nothing else, and a session holds no
// result tables: no landed feature owns them. So a workflow demo keeps its own result beside the
// session. One value, written once by `start` and cleared when the demo is disposed, so a second
// run never reads the first one's numbers.
//
// Requested of Track GAL: give `start` a way to publish what it computed - a context passed to
// `inspector`, `ready` and `report`, or a sheet source returned from `start`. Then this goes.

// One value a demo holds between its start and the host's next call.
export type Held<T> = {
  readonly get: () => T | undefined;
  readonly set: (value: T) => void;
  readonly clear: () => void;
};

// A holder with nothing in it.
export const held = <T>(): Held<T> => {
  let value: T | undefined;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
    clear: () => {
      value = undefined;
    },
  };
};
