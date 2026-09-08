// Showing one group three ways, entirely through the features' own commands.
//
// Isolation is the sets feature's filter, so the objects outside the group leave the picture and
// come back with `sets.showAll`. Ghosting and hiding are one style rule each, at a priority above
// any colouring, replaced rather than stacked: a new choice always removes the rule the last one
// added, so the slices hold exactly what the page is showing and a saved document would replay it.
//
// Nothing here writes a buffer. What is drawn is whatever `resolveAppearance` composes out of the
// sets and appearance slices, which is also what `shownObjects` counts, so the page's number and
// the renderer's picture come from the same place.

import {
  failure,
  isVisible,
  styleRule,
  success,
  type Appearance,
  type ObjectKey,
  type Result,
  type Session,
} from '@bim-open-toolkit/model';
import { appearanceSlice, resolveAppearance, setsSlice } from '@bim-open-toolkit/features';

// What showing a group does to everything else.
export type ShowMode = 'isolate' | 'ghost' | 'hide';

// The modes, in the order the page's picker stands.
export const showModes = ['isolate', 'ghost', 'hide'] as const;

// The rule that fades everything outside the chosen group.
export const ghostRuleId = 'show-by/ghost';

// The rule that hides the chosen group.
export const hideRuleId = 'show-by/hide';

// How faint a ghosted object is: visible enough to place the group in the building, faint enough
// to see through. It is above zero, so ghosting never counts as hiding.
export const ghostOpacity = 0.08;

// Above any colouring a demo or a workflow adds, so showing wins over what an object is coloured by.
export const showPriority = 10;

// A choice to apply: the objects of the chosen group, every object the model holds, and the mode.
export type ShowRequest = {
  readonly members: readonly ObjectKey[];
  readonly all: readonly ObjectKey[];
  readonly mode: ShowMode;
};

// True when the string is one of the modes, so page input never needs a cast.
export const isShowMode = (value: string): value is ShowMode =>
  showModes.some((mode) => mode === value);

// Ends isolation and removes whichever of the two rules is there. Safe to run when nothing is
// shown by, which is what the reset button and every mode change begin with.
export const clearShow = (session: Session): Result<readonly ObjectKey[]> => {
  const rules = session.read(appearanceSlice).rules;
  const steps: Result<unknown>[] = [];
  if (session.read(setsSlice).isolated !== null) steps.push(session.dispatch('sets.showAll', {}));
  for (const id of [ghostRuleId, hideRuleId])
    if (rules.some((rule) => rule.id === id)) steps.push(session.dispatch('appearance.removeRule', { id }));
  const failed = steps.find((step) => !step.ok);
  return failed === undefined ? success([]) : failure(failed.diagnostics);
};

// Shows one group in one mode, replacing whatever was shown before. The objects the mode addressed
// come back: the group for isolation and hiding, everything else for ghosting.
export const applyShow = (session: Session, request: ShowRequest): Result<readonly ObjectKey[]> => {
  const cleared = clearShow(session);
  if (!cleared.ok) return cleared;
  if (request.mode === 'isolate') {
    const isolated = session.dispatch('sets.isolate', { members: request.members });
    return isolated.ok ? success(request.members) : failure(isolated.diagnostics);
  }
  const ghosting = request.mode === 'ghost';
  const chosen = new Set(request.members);
  const targets = ghosting ? request.all.filter((key) => !chosen.has(key)) : request.members;
  const rule = styleRule(
    ghosting ? ghostRuleId : hideRuleId,
    ghosting ? 'Everything but the chosen group' : 'The chosen group',
    targets,
    ghosting ? { opacity: ghostOpacity } : { visible: false },
    showPriority,
  );
  const added = session.dispatch('appearance.addRule', { rule });
  return added.ok ? success(targets) : failure(added.diagnostics);
};

// The objects that draw right now, composed from the slices rather than read off the renderer. A
// ghosted object is faint, not gone, so it is still one of them.
export const shownObjects = (
  session: Session,
  keys: readonly ObjectKey[],
  base?: ReadonlyMap<ObjectKey, Appearance> | undefined,
): readonly ObjectKey[] => {
  const resolved = resolveAppearance(session, keys, base);
  return keys.filter((key) => isVisible(resolved, key));
};
