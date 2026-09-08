import {
  array,
  failure,
  missing,
  modelRefSchema,
  nullable,
  object,
  resultOf,
  string,
  styleRule,
  type Color,
  type Diagnostic,
  type ModelRef,
  type ObjectKey,
  type Result,
  type Schema,
  type StyleRule,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import { duplicateDiagnostics, keyOf, namedObjectSet, suggestedView } from './keys.js';
import { marker, onObject, type Overlay } from './overlay.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { step, workflowCommands } from './recipe.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One object as it exists in one revision.
export type RevisionObject = { readonly objectId: string; readonly name: string; readonly category: string };

// A supplied proposal that an object of revision A is an object of revision B. `bIds` empty means
// no candidate was found, more than one means the proposal is not resolved. This workflow never
// proposes a correspondence of its own from names or geometry.
export type Correspondence = {
  readonly id: string;
  readonly aId: string | null;
  readonly bIds: readonly string[];
  readonly basis: string;
};

// Two snapshots of one model and the correspondences between them.
export type RevisionComparisonInput = {
  readonly modelA: ModelRef;
  readonly modelB: ModelRef;
  readonly objectsA: readonly RevisionObject[];
  readonly objectsB: readonly RevisionObject[];
  readonly correspondences: readonly Correspondence[];
};

// What the comparison says about one correspondence. `ambiguous` is never collapsed into the others.
export type ChangeType = 'unchanged' | 'renamed' | 'recategorized' | 'added' | 'deleted' | 'ambiguous';

// The colour each change type is drawn in. A display convention, not domain meaning.
export const changeColors: Readonly<Record<ChangeType, Color>> = {
  unchanged: [0.72, 0.72, 0.74],
  renamed: [0.35, 0.55, 0.85],
  recategorized: [0.55, 0.4, 0.8],
  added: [0.35, 0.65, 0.45],
  deleted: [0.85, 0.3, 0.25],
  ambiguous: [0.95, 0.7, 0.25],
};

const objectSchema = object({ objectId: string(), name: string(), category: string() });

// The JSON a revision comparison is given.
export const revisionComparisonInputSchema: Schema<RevisionComparisonInput> = object({
  modelA: modelRefSchema,
  modelB: modelRefSchema,
  objectsA: array(objectSchema),
  objectsB: array(objectSchema),
  correspondences: array(
    object({ id: string(), aId: nullable(string()), bIds: array(string()), basis: string() }),
  ),
});

const changeOfPair = (a: RevisionObject, b: RevisionObject): ChangeType =>
  a.category !== b.category ? 'recategorized' : a.name !== b.name ? 'renamed' : 'unchanged';

// True when no other correspondence names the same A object or the same B candidate, which is what
// makes a one-to-one proposal the only proposal.
const isSoleProposal = (item: Correspondence, all: readonly Correspondence[]): boolean =>
  all.every(
    (other) =>
      other.id === item.id ||
      ((item.aId === null || other.aId !== item.aId) && !item.bIds.some((id) => other.bIds.includes(id))),
  );

type Classified = {
  readonly item: Correspondence;
  readonly change: ChangeType;
  readonly detail: ResultRow | undefined;
  readonly bId: string | undefined;
};

const detailOf = (change: ChangeType, a: RevisionObject, b: RevisionObject): ResultRow | undefined =>
  change === 'renamed'
    ? { nameA: a.name, nameB: b.name }
    : change === 'recategorized'
      ? { categoryA: a.category, categoryB: b.category }
      : undefined;

// The comparison of two revisions from the correspondences supplied with them. A proposal with more
// than one candidate, or one that competes with another proposal, stays unresolved: it is reported
// as an exception with every candidate visible and is never forced into an addition or a deletion.
export const runRevisionComparison = (input: RevisionComparisonInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('objectsA', input.objectsA.map((item) => item.objectId)),
    ...duplicateDiagnostics('objectsB', input.objectsB.map((item) => item.objectId)),
    ...duplicateDiagnostics('correspondences', input.correspondences.map((item) => item.id)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const byIdA = new Map(input.objectsA.map((item) => [item.objectId, item]));
  const byIdB = new Map(input.objectsB.map((item) => [item.objectId, item]));

  const classified: readonly Classified[] = input.correspondences.map((item) => {
    const bId = item.bIds[0];
    const a = item.aId === null ? undefined : byIdA.get(item.aId);
    const b = bId === undefined ? undefined : byIdB.get(bId);
    if (item.bIds.length > 1 || !isSoleProposal(item, input.correspondences))
      return { item, change: 'ambiguous', detail: undefined, bId: undefined };
    if (item.aId === null) return { item, change: 'added', detail: undefined, bId };
    if (item.bIds.length === 0) return { item, change: 'deleted', detail: undefined, bId: undefined };
    if (a === undefined || b === undefined)
      return { item, change: 'ambiguous', detail: undefined, bId: undefined };
    const change = changeOfPair(a, b);
    return { item, change, detail: detailOf(change, a, b), bId };
  });

  const resolved = classified.filter((entry) => entry.change !== 'ambiguous');
  const ambiguous = classified.filter((entry) => entry.change === 'ambiguous');
  const rows: readonly ResultRow[] = resolved.map((entry) =>
    resultRecord({
      aId: entry.item.aId,
      bIds: entry.item.bIds,
      changeType: entry.change,
      detail: entry.detail,
    }),
  );

  // An object named by no correspondence at all is not an addition or a deletion: nothing was
  // proposed about it, which is a gap in the supplied correspondences rather than a change.
  const namedA = new Set(input.correspondences.flatMap((item) => (item.aId === null ? [] : [item.aId])));
  const namedB = new Set(input.correspondences.flatMap((item) => item.bIds));
  const unproposed: readonly WorkflowException[] = [
    ...input.objectsA.filter((item) => !namedA.has(item.objectId)).map((item) => ({ item, revision: 'A' })),
    ...input.objectsB.filter((item) => !namedB.has(item.objectId)).map((item) => ({ item, revision: 'B' })),
  ].map((entry) =>
    workflowException([entry.item.objectId], 'correspondence', missing('not-provided'), {
      scope: `revision ${entry.revision}`,
      detail: 'No correspondence was supplied for this object.',
    }),
  );

  const exceptions: readonly WorkflowException[] = [
    ...ambiguous.map((entry) =>
      workflowException(
        entry.item.aId === null ? [entry.item.id] : [entry.item.aId],
        'correspondence',
        missing('unresolved-source'),
        {
          related: entry.item.bIds,
          detail: `${entry.item.bIds.length} candidate objects in revision B; the match stays unresolved.`,
        },
      ),
    ),
    ...unproposed,
  ];

  const keysOfChange = (change: ChangeType): readonly ObjectKey[] =>
    classified.flatMap((entry) =>
      entry.change !== change
        ? []
        : [
            ...(entry.item.aId === null ? [] : [keyOf(input.modelA, entry.item.aId)]),
            ...entry.item.bIds.map((id) => keyOf(input.modelB, id)),
          ],
    );

  const changeTypes: readonly ChangeType[] = ['unchanged', 'renamed', 'recategorized', 'added', 'deleted', 'ambiguous'];
  const present = changeTypes.filter((change) => keysOfChange(change).length > 0);
  const rules: readonly StyleRule[] = present.map((change, index) =>
    styleRule(
      `revision-comparison/${change}`,
      `revision comparison ${change}`,
      keysOfChange(change),
      { color: changeColors[change] },
      index + 1,
    ),
  );

  const overlays: readonly Overlay[] = ambiguous.flatMap((entry) =>
    entry.item.bIds.map((id) =>
      marker(
        `revision-comparison/${entry.item.id}/${id}`,
        `Unresolved match: ${entry.item.aId ?? entry.item.id} to ${id}`,
        'missing',
        onObject(keyOf(input.modelB, id)),
      ),
    ),
  );

  return resultOf(
    workflowResult({
      id: 'revision-comparison',
      title: 'Revision comparison',
      model: input.modelA,
      tables: [resultTable('comparison', 'Revision comparison', rows)],
      summary: Object.fromEntries(
        changeTypes.map((change) => [change, classified.filter((entry) => entry.change === change).length]),
      ),
      exceptions,
      rules,
      sets: [
        ...present.map((change) => ({
          id: `revision-comparison/${change}`,
          name: `Revision comparison ${change}`,
          members: new Set(keysOfChange(change)),
        })),
        namedObjectSet('revision-comparison/unresolved', 'Unresolved matches', input.modelA,
          ambiguous.flatMap((entry) => (entry.item.aId === null ? [] : [entry.item.aId]))),
      ],
      overlays,
      view: suggestedView('revision-comparison', 'Unresolved revision matches', keysOfChange('ambiguous'), rules),
      selectSetId: 'revision-comparison/unresolved',
      extraSteps: [
        step(
          workflowCommands.linkViews,
          { linked: true },
          `Show both revisions side by side (${input.modelA.revision} and ${input.modelB.revision}).`,
        ),
      ],
    }),
    diagnostics,
  );
};

// Revision review: two snapshots compared through supplied correspondences, disputes left disputed.
export const revisionComparisonWorkflow: Workflow = workflow({
  id: 'revision-comparison',
  title: 'Revision comparison',
  description:
    'Compares two revisions through the correspondences supplied with them. A proposal with more than one ' +
    'candidate, or one competing with another proposal, is reported as an unresolved exception with every ' +
    'candidate visible; it is never forced into an addition or a deletion.',
  basis: 'synthetic',
  input: revisionComparisonInputSchema,
  run: runRevisionComparison,
});
