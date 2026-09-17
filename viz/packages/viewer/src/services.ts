// Live capabilities a session carries beside its slices.
//
// A slice holds plain data, because a document has to be able to save it. A renderer, a canvas and
// a camera are not plain data, and a feature that clips a section or flies the camera needs one.
// M1's `Session` is exactly read, write, dispatch and subscribe, so the viewer offers the rest
// through named services rather than by widening the contract behind the model package's back.
//
// A service is its own store: the key object holds a `WeakMap` from session to value, which is why
// `get` returns the declared type with no cast and no runtime check. A session that was never
// given the service reads back `undefined`, which is the honest answer for a headless session with
// no renderer.
//
// A feature in `@bim-open-toolkit/features` cannot import this package (the dependency runs the
// other way), so a feature needing live access today has to be installed by whoever holds the
// service. `docs/viewer.md` records the request to the model package that would close that gap.

import { disposable, type Disposable, type Session } from '@bim-open-toolkit/model';

// A named capability a session may carry.
export type Service<T> = {
  readonly id: string;
  // What the session was given, or undefined when nobody gave it one.
  readonly get: (session: Session) => T | undefined;
  // Gives a session the capability until the returned disposal takes it away again.
  readonly provide: (session: Session, value: T) => Disposable;
};

// Declares a service. Each declaration is a distinct key, so two services with the same id do not
// see each other's values; the id is for reporting, not for lookup.
export const service = <T>(id: string): Service<T> => {
  const held = new WeakMap<Session, T>();
  return {
    id,
    get: (session) => held.get(session),
    provide: (session, value) => {
      held.set(session, value);
      return disposable(() => {
        if (held.get(session) === value) held.delete(session);
      });
    },
  };
};
