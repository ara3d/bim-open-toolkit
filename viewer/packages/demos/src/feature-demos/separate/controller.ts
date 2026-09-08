// What the page does, without a DOM: hold the arrangement, the lid and the cutaway, and turn each
// change into feature commands plus one set of offsets.
//
// The offsets go out through a seam rather than to a renderer, so this is driven in Node against a
// real session with `noRenderTarget` and a recording clipping target, and the page is left with
// nothing but wiring.
//
// One shim is visible here. The layouts slice can say "explode by storey" or "the model's own
// placement" and nothing else, so a row arrangement is recorded as the model's own placement while
// the rows are actually moved. Track FB's `row` layout kind removes both the shim and this note.

import {
  isVisible,
  type Appearance,
  type ObjectKey,
  type ModelData,
  type Session,
  type StyleRule,
  type Vec3,
} from '@bim-open-toolkit/model';
import { levelsOf, resolveAppearance, type Level, type SectionAxis } from '@bim-open-toolkit/features';
import { layoutKindOf, lidKeys, separateOffsets, type LayoutKind, type SeparateLayout } from './layout.js';

// Everything the page is showing, and everything a report says about it.
export type SeparateState = {
  readonly layout: LayoutKind;
  readonly spacing: number;
  // The storey whose rooms the room arrangement lays out; empty when the model records no storeys.
  readonly storeyId: string;
  readonly lidOff: boolean;
  readonly cutaway: boolean;
  readonly cutHeight: number;
};

// The heights a cutaway can be put at.
export type CutRange = { readonly min: number; readonly max: number };

// What the controller is built over: a session with the sets, edits, appearance, layouts and
// clipping features installed, the model those features read, and where its offsets go.
export type SeparateOptions = {
  readonly session: Session;
  readonly model: ModelData;
  // The keys a shown count is taken over, which is every object of the model.
  readonly keys: readonly ObjectKey[];
  readonly base: ReadonlyMap<ObjectKey, Appearance>;
  readonly apply: (offsets: ReadonlyMap<ObjectKey, Vec3>) => void;
  readonly cutRange: CutRange;
  // Called after every change, so a page redraws its status line once per change and not per frame.
  readonly onChange?: (() => void) | undefined;
};

// The page's behaviour.
export type SeparateDemo = {
  readonly state: () => SeparateState;
  readonly layout: () => SeparateLayout;
  readonly storeys: () => readonly Level[];
  // How many objects the resolved appearance draws, which is what the lid changes.
  readonly shownObjects: () => number;
  readonly setLayout: (kind: LayoutKind) => void;
  readonly setSpacing: (spacing: number) => void;
  readonly setStorey: (storeyId: string) => void;
  readonly setLidOff: (off: boolean) => void;
  readonly setCutaway: (on: boolean) => void;
  readonly setCutHeight: (height: number) => void;
  readonly reset: () => void;
  // One change by name, the way a control would make it; false when the name or the value is not one.
  readonly act: (name: string, input?: unknown) => boolean;
};

// The id of the rule that takes the lid off. It is added once, disabled, and switched on and off.
export const lidRuleId = 'separate/lid';

// The arrangement, the spacing and the cut a page opens at.
export const defaultSpacing = 1.2;
const startingLayout: LayoutKind = 'as-placed';

// The rule that hides the roof and every ceiling, off until the page is asked for it.
export const lidRule = (model: ModelData): StyleRule => ({
  id: lidRuleId,
  name: 'Roof and ceilings off',
  enabled: false,
  priority: 100,
  targets: lidKeys(model),
  change: { visible: false },
});

// Which axis a horizontal cut is measured along in the model's own frame.
const upAxis = (model: ModelData): SectionAxis => (model.coordinates.up === 'y' ? 'y' : 'z');

const clamp = (value: number, range: CutRange): number => Math.min(range.max, Math.max(range.min, value));

// The page's behaviour over a session that already has its features installed. The lid rule is
// added at once, so the page never has to add it later and a report is meaningful from the start.
export const separateDemo = (options: SeparateOptions): SeparateDemo => {
  const { session, model } = options;
  const levels = levelsOf(model);
  const axis = upAxis(model);
  const middle = (options.cutRange.min + options.cutRange.max) / 2;
  const initial: SeparateState = {
    layout: startingLayout,
    spacing: defaultSpacing,
    storeyId: levels[0]?.id ?? '',
    lidOff: false,
    cutaway: false,
    cutHeight: middle,
  };
  let state = initial;
  session.dispatch('appearance.addRule', { rule: lidRule(model) });

  const layoutOf = (current: SeparateState): SeparateLayout => {
    switch (current.layout) {
      case 'as-placed':
        return { kind: 'as-placed' };
      case 'stacked':
        return { kind: 'stacked', spacing: current.spacing };
      case 'storey-row':
        return { kind: 'storey-row', spacing: current.spacing };
      case 'room-row':
        return { kind: 'room-row', storeyId: current.storeyId, spacing: current.spacing };
    }
  };

  // Records the arrangement in the layouts slice as far as it can say it, then moves the rows.
  const arrange = (): void => {
    const layout = layoutOf(state);
    if (layout.kind === 'stacked') session.dispatch('layouts.explode', { by: 'storey', strength: layout.spacing });
    else session.dispatch('layouts.reset', {});
    options.apply(separateOffsets(model, layout));
  };

  const cut = (): void => {
    if (state.cutaway) session.dispatch('clipping.sectionAt', { elevation: state.cutHeight, axis, keep: 'below' });
    else session.dispatch('clipping.clear', {});
  };

  const changed = (): void => {
    options.onChange?.();
  };

  const setLayout = (kind: LayoutKind): void => {
    state = { ...state, layout: kind };
    arrange();
    changed();
  };
  const setSpacing = (spacing: number): void => {
    if (!Number.isFinite(spacing)) return;
    state = { ...state, spacing };
    arrange();
    changed();
  };
  const setStorey = (storeyId: string): void => {
    state = { ...state, storeyId };
    arrange();
    changed();
  };
  const setLidOff = (off: boolean): void => {
    state = { ...state, lidOff: off };
    session.dispatch('appearance.setRuleEnabled', { id: lidRuleId, enabled: off });
    changed();
  };
  const setCutaway = (on: boolean): void => {
    state = { ...state, cutaway: on };
    cut();
    changed();
  };
  const setCutHeight = (height: number): void => {
    if (!Number.isFinite(height)) return;
    state = { ...state, cutHeight: clamp(height, options.cutRange) };
    cut();
    changed();
  };
  const reset = (): void => {
    state = initial;
    arrange();
    session.dispatch('appearance.setRuleEnabled', { id: lidRuleId, enabled: false });
    cut();
    changed();
  };

  const act = (name: string, input: unknown): boolean => {
    switch (name) {
      case 'layout': {
        const kind = typeof input === 'string' ? layoutKindOf(input) : undefined;
        if (kind === undefined) return false;
        setLayout(kind);
        return true;
      }
      case 'spacing':
        if (typeof input !== 'number') return false;
        setSpacing(input);
        return true;
      case 'storey':
        if (typeof input !== 'string') return false;
        setStorey(input);
        return true;
      case 'lid':
        if (typeof input !== 'boolean') return false;
        setLidOff(input);
        return true;
      case 'cutaway':
        if (typeof input !== 'boolean') return false;
        setCutaway(input);
        return true;
      case 'cutHeight':
        if (typeof input !== 'number') return false;
        setCutHeight(input);
        return true;
      case 'reset':
        reset();
        return true;
      default:
        return false;
    }
  };

  return {
    state: () => state,
    layout: () => layoutOf(state),
    storeys: () => levels,
    shownObjects: () => {
      const resolved = resolveAppearance(session, options.keys, options.base);
      return options.keys.filter((key) => isVisible(resolved, key)).length;
    },
    setLayout,
    setSpacing,
    setStorey,
    setLidOff,
    setCutaway,
    setCutHeight,
    reset,
    act,
  };
};
