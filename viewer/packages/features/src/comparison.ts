// Comparison: two revisions of one model, side by side, over one session.
//
// What makes a comparison honest is that the correspondence between an object in one revision and
// an object in the next is supplied evidence, never something the viewer inferred from names or
// positions. So the proposals are state, complete with the cases nobody can decide: a proposal with
// two candidates, two proposals claiming the same object, an object with no counterpart either way,
// and a proposal whose confidence was never recorded. Those stay visible instead of being resolved
// by a rule, because a comparison that quietly picks one is worse than one that says it cannot.
//
// The two revisions are two views over one session rather than two sessions, so selection, style
// and commands are shared and the cameras can be linked without anything being synchronised twice.

import {
  array,
  boolean,
  command,
  diagnostic,
  failure,
  feature,
  modelRefSchema,
  nullable,
  number,
  object,
  optional,
  refine,
  stateSlice,
  string,
  success,
  warning,
  type Command,
  type Feature,
  type Migration,
  type ModelRef,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';

// One proposal between the two revisions. `aId` absent means nothing in the first revision was
// proposed, which is an addition; `bIds` empty means nothing in the second was, which is a
// deletion. `confidence` absent means nobody recorded one, which is not the same as zero.
export type Correspondence = {
  readonly id: string;
  readonly aId?: string | undefined;
  readonly bIds: readonly string[];
  readonly basis: string;
  readonly confidence?: number | undefined;
  readonly resolved?: string | undefined;
};

// What one proposal amounts to once the whole set is read.
export type CorrespondenceStatus = 'matched' | 'added' | 'deleted' | 'ambiguous' | 'contested';

// The two revisions, the proposals between them, and how the two views are shown.
export type ComparisonState = {
  readonly before?: ModelRef | undefined;
  readonly after?: ModelRef | undefined;
  readonly correspondences: readonly Correspondence[];
  readonly linkedCameras: boolean;
  readonly beforeViewId: string;
  readonly afterViewId: string;
};

// One proposal.
export const correspondenceSchema: Schema<Correspondence> = object({
  id: refine(string(), (value) => value !== '', 'comparison/empty-id', 'A correspondence id cannot be empty.'),
  aId: optional(string()),
  bIds: array(string()),
  basis: string(),
  confidence: optional(number()),
  resolved: optional(string()),
});

// The whole slice, refusing two proposals with the same id.
export const comparisonSchema: Schema<ComparisonState> = refine(
  object({
    before: optional(modelRefSchema),
    after: optional(modelRefSchema),
    correspondences: array(correspondenceSchema),
    linkedCameras: boolean(),
    beforeViewId: string(),
    afterViewId: string(),
  }),
  (value) => new Set(value.correspondences.map((item) => item.id)).size === value.correspondences.length,
  'comparison/duplicate-id',
  'Two correspondences cannot share an id.',
);

// Nothing loaded: two empty views, unlinked.
export const noComparison: ComparisonState = {
  correspondences: [],
  linkedCameras: false,
  beforeViewId: 'before',
  afterViewId: 'after',
};

// Version 1 has no earlier versions to read; a later version adds its step here.
export const comparisonMigrations: readonly Migration[] = [];

// The slice the comparison feature owns.
export const comparisonSlice: StateSlice<ComparisonState> = stateSlice(
  'comparison',
  1,
  comparisonSchema,
  noComparison,
  comparisonMigrations,
);

// The proposal with that id, or undefined.
export const findCorrespondence = (state: ComparisonState, id: string): Correspondence | undefined =>
  state.correspondences.find((item) => item.id === id);

// The object ids more than one proposal claims, on either side of the comparison. Two proposals
// naming one object cannot both be right, whichever revision that object is in, so each of these is
// a decision somebody has to make rather than a match anything can act on.
export const contestedIds = (correspondences: readonly Correspondence[]): readonly string[] => {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const item of correspondences)
    for (const id of item.aId === undefined ? item.bIds : [item.aId, ...item.bIds]) {
      if (seen.has(id)) twice.add(id);
      seen.add(id);
    }
  return [...twice];
};

// What one proposal amounts to, read against the whole set. A proposal somebody resolved is matched
// whatever it looked like before; nothing overrides a decision that was actually made.
export const correspondenceStatus = (
  item: Correspondence,
  contested: readonly string[] = [],
): CorrespondenceStatus => {
  if (item.resolved !== undefined) return 'matched';
  if (item.aId === undefined) return 'added';
  if (item.bIds.length === 0) return 'deleted';
  if (item.bIds.length > 1) return 'ambiguous';
  if (contested.includes(item.aId) || item.bIds.some((id) => contested.includes(id))) return 'contested';
  return 'matched';
};

// The status of every proposal, in the order they are held.
export const comparisonStatuses = (state: ComparisonState): readonly CorrespondenceStatus[] => {
  const contested = contestedIds(state.correspondences);
  return state.correspondences.map((item) => correspondenceStatus(item, contested));
};

// The proposals nobody has decided: more than one candidate, or a candidate another proposal also
// claims. Additions and deletions are not here; they are findings, not open questions.
export const unresolvedCorrespondences = (state: ComparisonState): readonly Correspondence[] => {
  const contested = contestedIds(state.correspondences);
  return state.correspondences.filter((item) => {
    const status = correspondenceStatus(item, contested);
    return status === 'ambiguous' || status === 'contested';
  });
};

// How many proposals of each status there are.
export const comparisonCounts = (state: ComparisonState): Readonly<Record<CorrespondenceStatus, number>> => {
  const counts: Record<CorrespondenceStatus, number> = { matched: 0, added: 0, deleted: 0, ambiguous: 0, contested: 0 };
  for (const status of comparisonStatuses(state)) counts[status] += 1;
  return counts;
};

// The proposals whose confidence nobody wrote down. They are not low-confidence matches, and a
// ranking that treated them as zero would put a perfectly good match at the bottom.
export const unrecordedConfidence = (state: ComparisonState): readonly Correspondence[] =>
  state.correspondences.filter((item) => item.confidence === undefined || !Number.isFinite(item.confidence));

// The two view ids to show side by side, or undefined when nothing is loaded.
export const comparisonViews = (state: ComparisonState): readonly [string, string] | undefined =>
  state.before === undefined || state.after === undefined ? undefined : [state.beforeViewId, state.afterViewId];

// The state with one proposal decided, or undecided again when the candidate is null.
export const resolveCorrespondence = (
  state: ComparisonState,
  id: string,
  bId: string | null,
): Result<ComparisonState> => {
  const found = findCorrespondence(state, id);
  if (found === undefined)
    return failure([diagnostic('comparison/unknown', `There is no correspondence named "${id}".`)]);
  if (bId !== null && !found.bIds.includes(bId))
    return failure([
      diagnostic('comparison/not-a-candidate', `"${bId}" is not one of the candidates of correspondence "${id}".`),
    ]);
  const decided: Correspondence = { ...found, resolved: bId ?? undefined };
  return success({
    ...state,
    correspondences: state.correspondences.map((item) => (item.id === id ? decided : item)),
  });
};

// Loads two revisions of one model and the proposals between them.
const loadCommand: Command = command({
  name: 'comparison.load',
  title: 'Load comparison',
  description: 'Loads two revisions of one model side by side, with the correspondences between them.',
  input: object({
    before: modelRefSchema,
    after: modelRefSchema,
    correspondences: array(correspondenceSchema),
    beforeViewId: optional(string()),
    afterViewId: optional(string()),
    linkedCameras: optional(boolean()),
  }),
  run: (session: Session, input) => {
    const repeated = input.correspondences
      .map((item) => item.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);
    if (repeated.length > 0)
      return failure([
        diagnostic('comparison/duplicate-id', `More than one correspondence is named ${[...new Set(repeated)].join(', ')}.`),
      ]);
    const state: ComparisonState = {
      before: input.before,
      after: input.after,
      correspondences: input.correspondences,
      linkedCameras: input.linkedCameras ?? false,
      beforeViewId: input.beforeViewId ?? noComparison.beforeViewId,
      afterViewId: input.afterViewId ?? noComparison.afterViewId,
    };
    session.write(comparisonSlice, state);
    const different = input.before.id !== input.after.id;
    return success(
      state,
      different
        ? [warning('comparison/different-models', 'The two revisions name different models, not two revisions of one.')]
        : [],
    );
  },
});

// Links or unlinks the two cameras.
const linkCommand: Command = command({
  name: 'comparison.link',
  title: 'Link comparison cameras',
  description: 'Turns camera linking between the two views on or off.',
  input: object({ linked: boolean() }),
  run: (session: Session, input) => {
    const state = session.read(comparisonSlice);
    const next: ComparisonState = { ...state, linkedCameras: input.linked };
    session.write(comparisonSlice, next);
    return success(
      next,
      comparisonViews(next) === undefined
        ? [warning('comparison/not-loaded', 'No comparison is loaded, so nothing is linked yet.')]
        : [],
    );
  },
});

// Decides one proposal, or undecides it again.
const resolveCommand: Command = command({
  name: 'comparison.resolve',
  title: 'Resolve correspondence',
  description: 'Chooses which candidate a correspondence means, or clears the choice.',
  input: object({ id: string(), bId: nullable(string()) }),
  run: (session: Session, input) => {
    const next = resolveCorrespondence(session.read(comparisonSlice), input.id, input.bId);
    if (!next.ok) return failure(next.diagnostics);
    session.write(comparisonSlice, next.value);
    return success(findCorrespondence(next.value, input.id), next.diagnostics);
  },
});

// The commands the comparison feature registers, in the order a registry lists them.
export const comparisonCommands: readonly Command[] = [loadCommand, linkCommand, resolveCommand];

// Two revisions of one model, side by side, with the unresolved matches left unresolved.
export const comparisonFeature: Feature<ComparisonState> = feature(
  'comparison',
  comparisonSlice,
  comparisonCommands,
);
