import { commandRegistry, type Command, type CommandRegistry } from './command.js';
import type { Disposable } from './event.js';
import { diagnostic, failure, success, type Diagnostic, type Result } from './result.js';
import type { Session } from './session.js';
import { sliceRegistry, type SliceRegistry, type StateSlice } from './slices.js';

// One capability: its state slice, its commands, and an optional hook into a live session.
// Adding a capability is adding one of these; nothing central changes.
export type Feature<S> = {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly slice: StateSlice<S>;
  readonly commands: readonly Command[];
  readonly install?: ((session: Session) => Disposable) | undefined;
};

// A feature whose state type is not known to the holder, as a registry keeps it.
export type AnyFeature = Feature<unknown>;

// A feature with the given slice and commands, depending on nothing unless it says so.
export const feature = <S>(
  id: string,
  slice: StateSlice<S>,
  commands: readonly Command[] = [],
  dependsOn: readonly string[] = [],
  install?: (session: Session) => Disposable,
): Feature<S> => ({ id, dependsOn, slice, commands, install });

// The features in an order where every feature comes after the ones it depends on.
// A dependency on a feature that is not installed, and a cycle, are reported rather than ignored.
export const installOrder = (features: readonly AnyFeature[]): Result<readonly AnyFeature[]> => {
  const byId = new Map(features.map((item) => [item.id, item]));
  const duplicates = features
    .map((item) => item.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  const missing: Diagnostic[] = features.flatMap((item) =>
    item.dependsOn
      .filter((id) => !byId.has(id))
      .map((id) => diagnostic('feature/missing', `Feature "${item.id}" depends on "${id}", which is not installed.`)),
  );
  if (duplicates.length > 0)
    return failure([
      ...missing,
      diagnostic('feature/duplicate', `More than one feature has the id ${[...new Set(duplicates)].join(', ')}.`),
    ]);
  if (missing.length > 0) return failure(missing);
  const ordered: AnyFeature[] = [];
  const placed = new Set<string>();
  let remaining = features;
  while (remaining.length > 0) {
    const ready = remaining.filter((item) => item.dependsOn.every((id) => placed.has(id)));
    if (ready.length === 0)
      return failure([
        diagnostic(
          'feature/cycle',
          `These features depend on each other: ${remaining.map((item) => item.id).join(', ')}.`,
        ),
      ]);
    for (const item of ready) {
      ordered.push(item);
      placed.add(item.id);
    }
    remaining = remaining.filter((item) => !placed.has(item.id));
  }
  return success(ordered);
};

// The slices of the features, so a document can be composed of exactly what is installed.
export const featureSlices = (features: readonly AnyFeature[]): readonly StateSlice<unknown>[] =>
  features.map((item) => item.slice);

// The commands of every feature, in feature order.
export const featureCommands = (features: readonly AnyFeature[]): readonly Command[] =>
  features.flatMap((item) => item.commands);

// The slices of the features, by id.
export const featureSliceRegistry = (features: readonly AnyFeature[]): SliceRegistry =>
  sliceRegistry(featureSlices(features));

// The commands of the features, by name, refusing two commands that share a name.
export const featureCommandRegistry = (features: readonly AnyFeature[]): Result<CommandRegistry> =>
  commandRegistry(featureCommands(features));

// Runs each feature's install hook in dependency order and returns one disposal for all of them.
// Features with no hook cost nothing. Disposal happens in the reverse of the installation order.
export const installFeatures = (
  features: readonly AnyFeature[],
  session: Session,
): { readonly disposals: readonly Disposable[]; readonly diagnostics: readonly Diagnostic[] } => {
  const order = installOrder(features);
  if (!order.ok) return { disposals: [], diagnostics: order.diagnostics };
  const disposals = order.value.flatMap((item) => (item.install === undefined ? [] : [item.install(session)]));
  return { disposals: [...disposals].reverse(), diagnostics: order.diagnostics };
};

// The slice ids more than one feature claims. Two features cannot own the same slice of a document.
export const duplicateSliceIds = (features: readonly AnyFeature[]): readonly string[] => {
  const ids = features.map((item) => item.slice.id);
  return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
};

// Every diagnostic a set of features reports about itself: order, slice ids and command names.
export const checkFeatures = (features: readonly AnyFeature[]): readonly Diagnostic[] => {
  const shared = duplicateSliceIds(features);
  return [
    ...installOrder(features).diagnostics,
    ...featureCommandRegistry(features).diagnostics,
    ...(shared.length === 0
      ? []
      : [diagnostic('feature/slice', `More than one feature owns the slice ${shared.join(', ')}.`)]),
  ];
};
