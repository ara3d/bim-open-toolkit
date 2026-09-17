// Contract revision G1 for the Gratify layer (GALLERY-PLAN.md section 4.2): what a demo hands the
// layer, a panel drawn in the canvas or a property sheet for the sidebar, and what the layer hands
// back, a hosted canvas with disposal and a semantics tree the DOM mirror reads. Track UG implements
// the hosts; the demo tracks build against these types and never against the implementation.
import type { Disposable, Result, Session, Table, Vec3 } from '@bim-open-toolkit/model';
import type { OverlayAction } from '@bim-open-toolkit/render';
import type { AppSpec, SemanticsNode } from 'gratify';

export type HudCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type HudEdge = 'top' | 'bottom';

// Where the host puts a panel: a viewport corner or edge, or over a world point it projects each frame.
export type HudPlace =
  | { readonly kind: 'corner'; readonly corner: HudCorner }
  | { readonly kind: 'edge'; readonly edge: HudEdge }
  | { readonly kind: 'world'; readonly point: (session: Session) => Vec3 | undefined };

// A Gratify app the host draws over the viewport. `sync` brings viewer state into the doc after a
// change event; `onCommit` turns a doc change into commands. Neither is required.
export type HudPanel<D, I> = {
  readonly id: string;
  readonly place: HudPlace;
  readonly spec: AppSpec<D, I>;
  readonly sync?: ((session: Session, doc: D) => D) | undefined;
  readonly onCommit?: ((doc: D, previous: D, session: Session) => void) | undefined;
};

// What hosting a panel returns. Revision G1.1 (Track UG) added `activate` and `onChanged`, which
// are what a DOM mirror needs to run the same intents as the canvas and to know when to rebuild.
export type Hosted = Disposable & {
  readonly canvas: HTMLCanvasElement;
  readonly semantics: () => SemanticsNode;
  // Presses the control at a semantics path exactly as a pointer would. False when nothing on
  // screen has that path.
  readonly activate: (path: string) => boolean;
  // Runs the given work after each committed change to the hosted document.
  readonly onChanged: (run: () => void) => Disposable;
};

// The host's way of mounting a panel of any doc and intent type.
export type PanelMount = <D, I>(panel: HudPanel<D, I>) => Result<Hosted>;

// A panel whose doc and intent types are closed over, so a demo can list panels of different
// types without a cast: the host passes its mount in and the panel applies it to itself.
export type AnyHudPanel = {
  readonly id: string;
  readonly place: HudPlace;
  readonly host: (mount: PanelMount) => Result<Hosted>;
};

// Closes a typed panel over its types.
export const hudPanel = <D, I>(panel: HudPanel<D, I>): AnyHudPanel => ({
  id: panel.id,
  place: panel.place,
  host: (mount) => mount(panel),
});

export type ValueState = 'known' | 'missing' | 'conflicting';

// One value in a property sheet, with the honesty the facts vocabulary requires: its state, why it
// is missing, and what says so.
export type PropertyValue = {
  readonly kind: 'text' | 'number' | 'flag' | 'reference';
  readonly text: string;
  readonly unit?: string | undefined;
  readonly state: ValueState;
  readonly missingReason?: string | undefined;
  readonly evidence?: readonly string[] | undefined;
};

// A row: a label, a value, optionally a command to run on click and a command that edits it.
export type PropertyRow = {
  readonly key: string;
  readonly label: string;
  readonly value: PropertyValue;
  readonly action?: OverlayAction | undefined;
  readonly edit?: { readonly command: string; readonly inputKey: string } | undefined;
};

export type PropertyGroup = {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly PropertyRow[];
};

// A columnar table in the sheet; a row click runs the action for that row.
export type SheetTable = {
  readonly id: string;
  readonly title: string;
  readonly table: Table;
  readonly rowAction?: ((row: number) => OverlayAction) | undefined;
};

// What the sidebar shows for the current state. A demo derives one from its session; the host
// re-derives it after every change event.
export type PropertySheet = {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly groups: readonly PropertyGroup[];
  readonly tables?: readonly SheetTable[] | undefined;
};

export type PanelHost = (container: HTMLElement, panel: AnyHudPanel, session: Session) => Result<Hosted>;
export type InspectorHost = (container: HTMLElement, sheet: () => PropertySheet, session: Session) => Result<Hosted>;

export type GalleryTheme = 'light' | 'dark';

// Applies a theme and text scale to every Gratify surface at once. Analytical colours are not
// theme tokens and do not change.
export type ThemeApplier = (theme: GalleryTheme, textScale: number) => void;

// A value that is known.
export const knownValue = (text: string, unit?: string): PropertyValue => ({
  kind: 'text',
  text,
  unit,
  state: 'known',
});

// A number that is known, printed with the given decimals.
export const knownNumber = (value: number, unit?: string, decimals = 2): PropertyValue => ({
  kind: 'number',
  text: value.toFixed(decimals),
  unit,
  state: 'known',
});

// A value nobody recorded, with the reason.
export const missingValue = (reason: string): PropertyValue => ({
  kind: 'text',
  text: '',
  state: 'missing',
  missingReason: reason,
});

// A value whose sources disagree; the text lists what they say.
export const conflictingValue = (texts: readonly string[], evidence: readonly string[] = []): PropertyValue => ({
  kind: 'text',
  text: texts.join(' vs '),
  state: 'conflicting',
  evidence,
});

export const propertyRow = (
  key: string,
  label: string,
  value: PropertyValue,
  action?: OverlayAction,
): PropertyRow => ({ key, label, value, action });

export const propertyGroup = (id: string, title: string, rows: readonly PropertyRow[]): PropertyGroup => ({
  id,
  title,
  rows,
});

export const propertySheet = (
  title: string,
  groups: readonly PropertyGroup[],
  subtitle?: string,
  tables?: readonly SheetTable[],
): PropertySheet => ({ title, subtitle, groups, tables });

// How many values in a sheet are in each state, for badges and tests.
export const sheetCoverage = (sheet: PropertySheet): Readonly<Record<ValueState, number>> => {
  const counts = { known: 0, missing: 0, conflicting: 0 };
  for (const group of sheet.groups) for (const row of group.rows) counts[row.value.state] += 1;
  return counts;
};
