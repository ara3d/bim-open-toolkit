// The feature host: install, order, dependencies and disposal.
//
// M1 already decides what a correct set of features looks like - `installOrder` for dependencies
// and cycles, `checkFeatures` for repeated ids, slice owners and command names. What is left is
// what only a running viewer can do: install into a session that already has features in it, put
// each feature's slice in the registry and its commands on the bus, and take all three away again
// in the reverse order.
//
// Installing is all or nothing. A feature whose install hook throws takes the whole call with it:
// everything installed by that call is disposed, the session is left as it was, and the throw comes
// back as a diagnostic. A half-installed set would be worse than none, because its commands would
// be on the bus with no state behind them.

import {
  diagnostic,
  disposeAll,
  failure,
  installOrder,
  success,
  type AnyFeature,
  type Diagnostic,
  type Disposable,
  type Result,
} from '@bim-open-toolkit/model';
import type { ViewerSession } from './session.js';

// What one installed feature holds, so disposal can undo exactly what installation did.
type Installed = {
  readonly feature: AnyFeature;
  readonly disposal: Disposable | undefined;
};

// Features installed into one session.
export type FeatureHost = {
  // The features now installed, in installation order.
  readonly features: () => readonly AnyFeature[];
  readonly installed: (id: string) => boolean;
  // Installs features beside the ones already there. Dependencies may be satisfied by either set.
  // Returns the ids installed, in the order they were installed.
  readonly install: (features: readonly AnyFeature[]) => Result<readonly string[]>;
  // Removes features and everything they brought: their install hook's disposal, their commands and
  // their slice with its stored value. A feature another installed feature depends on is refused.
  readonly remove: (ids: readonly string[]) => Result<readonly string[]>;
  // Removes every feature, in the reverse of the order they were installed.
  readonly dispose: () => void;
};

const describe = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

// A host over a session. Nothing is installed until `install` is called.
export const featureHost = (session: ViewerSession): FeatureHost => {
  const held: Installed[] = [];
  const ids = (): readonly string[] => held.map((one) => one.feature.id);

  const undo = (one: Installed): void => {
    one.disposal?.dispose();
    session.commands.remove(one.feature.commands.map((command) => command.name));
    session.forget([one.feature.slice.id]);
  };

  const install = (added: readonly AnyFeature[]): Result<readonly string[]> => {
    if (added.length === 0) return success([]);
    const all = [...held.map((one) => one.feature), ...added];
    const order = installOrder(all);
    if (!order.ok) return failure(order.diagnostics);
    const before = new Set(ids());
    const fresh = order.value.filter((one) => !before.has(one.id));

    const slices = session.register(fresh.map((one) => one.slice));
    if (!slices.ok) return failure(slices.diagnostics);
    const commands = session.commands.add(fresh.flatMap((one) => one.commands));
    if (!commands.ok) {
      session.forget(fresh.map((one) => one.slice.id));
      return failure(commands.diagnostics);
    }

    const done: Installed[] = [];
    for (const one of fresh) {
      let disposal: Disposable | undefined;
      try {
        disposal = one.install === undefined ? undefined : one.install(session);
      } catch (cause) {
        for (const backwards of [...done].reverse()) undo(backwards);
        session.commands.remove(fresh.flatMap((each) => each.commands.map((command) => command.name)));
        session.forget(fresh.map((each) => each.slice.id));
        return failure([
          diagnostic('viewer/install-failed', `Feature ${one.id} could not install: ${describe(cause)}`, ['id']),
        ]);
      }
      done.push({ feature: one, disposal });
    }
    held.push(...done);
    return success(fresh.map((one) => one.id));
  };

  const remove = (removed: readonly string[]): Result<readonly string[]> => {
    const going = new Set(removed.filter((id) => held.some((one) => one.feature.id === id)));
    if (going.size === 0) return success([]);
    const needed: Diagnostic[] = held
      .filter((one) => !going.has(one.feature.id))
      .flatMap((one) =>
        one.feature.dependsOn
          .filter((id) => going.has(id))
          .map((id) =>
            diagnostic('viewer/still-needed', `Feature ${one.feature.id} depends on ${id}`, ['dependsOn']),
          ),
      );
    if (needed.length > 0) return failure(needed);
    const taken = held.filter((one) => going.has(one.feature.id));
    for (const one of [...taken].reverse()) undo(one);
    for (const one of taken) held.splice(held.indexOf(one), 1);
    return success(taken.map((one) => one.feature.id));
  };

  return {
    features: () => held.map((one) => one.feature),
    installed: (id) => held.some((one) => one.feature.id === id),
    install,
    remove,
    dispose: () => {
      const all = [...held].reverse();
      held.length = 0;
      disposeAll(all.flatMap((one) => (one.disposal === undefined ? [] : [one.disposal]))).dispose();
      for (const one of all) {
        session.commands.remove(one.feature.commands.map((command) => command.name));
        session.forget([one.feature.slice.id]);
      }
    },
  };
};
