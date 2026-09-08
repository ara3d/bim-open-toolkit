// A headless session that lives and dies with the component.
//
// This is the half of a viewer that needs no canvas: slices, commands and events. A page that has
// not made its renderer yet, a test that renders to a string, and a panel driven entirely by
// commands all work over one of these, which is why every hook and every component in this package
// reads a session rather than a viewer.
//
// The session is made while rendering rather than in an effect, because it is plain data with no
// side effects outside itself, and a tree that only has state after its first effect cannot be
// rendered to a string at all.

import { useEffect, useRef, useState } from 'react';
import type { AnyFeature, Diagnostic } from '@bim-open-toolkit/model';
import {
  createSession,
  defaultFeatures,
  featureHost,
  type FeatureHost,
  type ViewerSession,
} from '@bim-open-toolkit/viewer';

// A session with its features installed, and whatever installing them reported.
export type SessionHandle = {
  readonly session: ViewerSession;
  readonly features: FeatureHost;
  readonly diagnostics: readonly Diagnostic[];
};

// A session over the given features, or the default composition's own when given none.
// Throws only when a session cannot be made at all, which means two commands claimed one name.
export const headlessSession = (features?: readonly AnyFeature[]): SessionHandle => {
  const made = createSession();
  if (!made.ok) throw new Error(made.diagnostics.map((one) => one.message).join('; '));
  const host = featureHost(made.value);
  const installed = host.install(features ?? defaultFeatures());
  return { session: made.value, features: host, diagnostics: installed.ok ? [] : installed.diagnostics };
};

// A session created with the component and disposed with it. The features are read once, when the
// session is made; a later list does not reinstall, because a session that changed its commands
// under a rendered tree would be a surprise, not a feature.
export const useSession = (features?: readonly AnyFeature[]): SessionHandle => {
  const held = useRef<readonly AnyFeature[] | undefined>(features);
  const [made, setMade] = useState<SessionHandle>(() => headlessSession(held.current));
  useEffect(() => {
    // A development double-mount disposes and re-runs this effect with the session it just
    // disposed, so a disposed session is replaced rather than left refusing every command.
    if (made.session.disposed()) {
      setMade(headlessSession(held.current));
      return undefined;
    }
    return () => {
      made.features.dispose();
      made.session.dispose();
    };
  }, [made]);
  return made;
};
