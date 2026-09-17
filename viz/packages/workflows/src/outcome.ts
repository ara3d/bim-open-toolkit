import { styleRule, type AppearanceChange, type ObjectKey, type StyleRule } from '@bim-open-toolkit/model';

// What a workflow was able to say about an object. Every workflow colours by these five states.
export type Outcome = 'resolved' | 'missing' | 'conflicting' | 'candidate' | 'excluded';

// The appearance of each outcome. The colours are a display convention, not domain meaning.
export const outcomeAppearance: Readonly<Record<Outcome, AppearanceChange>> = {
  resolved: { color: [0.35, 0.65, 0.45] },
  missing: { color: [0.95, 0.7, 0.25] },
  conflicting: { color: [0.85, 0.3, 0.25] },
  candidate: { color: [0.6, 0.45, 0.85] },
  excluded: { color: [0.7, 0.7, 0.72], opacity: 0.35 },
};

// How outcomes settle when an object is in more than one: a conflict is seen over anything else.
export const outcomePriority: Readonly<Record<Outcome, number>> = {
  excluded: 1,
  resolved: 2,
  candidate: 3,
  missing: 4,
  conflicting: 5,
};

// The more serious of two outcomes, which is what an object showing several of them is coloured by.
export const worseOutcome = (a: Outcome, b: Outcome): Outcome =>
  outcomePriority[a] >= outcomePriority[b] ? a : b;

// A rule colouring the named objects by one outcome. Rule priority is the outcome's own priority.
export const outcomeRule = (id: string, name: string, outcome: Outcome, targets: readonly ObjectKey[]): StyleRule =>
  styleRule(id, name, targets, outcomeAppearance[outcome], outcomePriority[outcome]);

// One rule per outcome that has objects, in reading order, ready to be added to a scene.
export const outcomeRules = (
  prefix: string,
  byOutcome: ReadonlyMap<Outcome, readonly ObjectKey[]>,
): readonly StyleRule[] =>
  (['resolved', 'candidate', 'missing', 'conflicting', 'excluded'] as const).flatMap((outcome) => {
    const targets = byOutcome.get(outcome) ?? [];
    return targets.length === 0 ? [] : [outcomeRule(`${prefix}/${outcome}`, `${prefix} ${outcome}`, outcome, targets)];
  });

// The objects of each outcome, grouped from one outcome per object.
export const groupByOutcome = (
  entries: Iterable<readonly [ObjectKey, Outcome]>,
): ReadonlyMap<Outcome, readonly ObjectKey[]> => {
  const grouped = new Map<Outcome, ObjectKey[]>();
  for (const [key, outcome] of entries) grouped.set(outcome, [...(grouped.get(outcome) ?? []), key]);
  return grouped;
};
