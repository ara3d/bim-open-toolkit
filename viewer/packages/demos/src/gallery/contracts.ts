// Contract revision G1 for the gallery (GALLERY-PLAN.md section 4.1): what a demo is, what data it
// can open, and the viewer it drives. `GalleryViewer` is the gallery's own interface so the demos
// never depend on how it is composed: Track GAL implements it over render, interact and formats
// first, and over the viewer package's `createViewer` when that lands, without a demo changing.
import type {
  AnyFeature,
  Bounds,
  Disposable,
  Geometry,
  ModelData,
  ModelRef,
  Result,
  Session,
  Vec2,
  Vec3,
} from '@bim-open-toolkit/model';
import type { LoadedModel } from '@bim-open-toolkit/formats';
import type { CaptureOptions, ObjectHit } from '@bim-open-toolkit/render';
import type { AnyHudPanel, PropertySheet } from '@bim-open-toolkit/ui-gratify';
import type { DemoReport } from '../feature-demos/_shared/protocol.js';

export type DemoChapter = 'inspect' | 'cut-and-arrange' | 'workflows' | 'scale-and-proof';

// The chapters in the order the gallery lists them.
export const chapters: readonly { readonly id: DemoChapter; readonly title: string }[] = [
  { id: 'inspect', title: 'Inspect' },
  { id: 'cut-and-arrange', title: 'Cut and arrange' },
  { id: 'workflows', title: 'Workflows' },
  { id: 'scale-and-proof', title: 'Scale and proof' },
];

// Whether the data a demo shows is generated, read from a source, or both. Every demo states it.
export type DataBasis = 'synthetic' | 'source-backed' | 'mixed';

// A model the viewer can open: data already in memory (the synthetic path), a model another
// package loaded, a URL on the fixture server, or a file the person picked.
export type ModelSource =
  | { readonly kind: 'data'; readonly id: string; readonly data: ModelData; readonly geometry: Geometry }
  | { readonly kind: 'loaded'; readonly id: string; readonly model: LoadedModel }
  | { readonly kind: 'url'; readonly id: string; readonly url: string }
  | { readonly kind: 'file'; readonly id: string; readonly file: Blob; readonly name: string };

// One choice in a demo's fixture picker. `source` is called when chosen, so a fixture costs
// nothing until it is used.
export type DemoFixture = {
  readonly id: string;
  readonly title: string;
  readonly basis: DataBasis;
  readonly source: () => Promise<Result<ModelSource>>;
};

// What one frame reports to listeners: when it was drawn and how long the previous one took.
export type FrameInfo = { readonly time: number; readonly intervalMs: number };

// The viewer a demo drives. It is a session (state changes only through commands) plus the few
// live capabilities a demo needs that are not plain data.
export type GalleryViewer = Session &
  Disposable & {
    // The element panels are placed in; it contains the canvas and is positioned.
    readonly viewport: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly open: (source: ModelSource) => Promise<Result<ModelRef>>;
    readonly models: () => readonly ModelRef[];
    readonly bounds: () => Bounds | undefined;
    readonly fit: () => void;
    readonly flyTo: (bounds: Bounds) => void;
    // World point to canvas pixels, or undefined when behind the camera.
    readonly project: (point: Vec3) => Vec2 | undefined;
    readonly pick: (clientX: number, clientY: number) => ObjectHit | undefined;
    readonly capture: (options?: CaptureOptions) => Promise<Result<Uint8Array>>;
    readonly onFrame: (listener: (frame: FrameInfo) => void) => Disposable;
  };

// A demo: a question, the features it installs, the data it opens, the panels it draws, the sheet
// it shows, and how it starts. Exported as `demo` from `demos/src/demos/<id>/index.ts`; the gallery
// discovers it, so adding a demo touches no central file.
export type Demo = {
  readonly id: string;
  readonly chapter: DemoChapter;
  readonly title: string;
  // One sentence, shown on the card.
  readonly question: string;
  // F-IDs and section 6 rows of the product brief.
  readonly briefIds: readonly string[];
  readonly features: readonly AnyFeature[];
  // The first is the default.
  readonly fixtures: readonly DemoFixture[];
  readonly panels: readonly AnyHudPanel[];
  // Pure; the host re-runs it after every change event.
  readonly inspector?: ((session: Session) => PropertySheet) | undefined;
  // Dispatches the opening commands once the fixture is open; the disposable undoes what it set up.
  readonly start: (viewer: GalleryViewer) => Promise<Result<Disposable>>;
  // True once the demo shows what it promises; the browser smoke waits for it.
  readonly ready: (session: Session) => boolean;
  // Plain values the browser smoke reads back and the README quotes.
  readonly report: (session: Session) => DemoReport;
  // Repository path of the demo and the command that verifies it.
  readonly source: string;
  readonly verify: string;
};

// The shape of a discovered demo module.
export type DemoModule = { readonly demo: Demo };

// Demos of one chapter, in the order they were given.
export const demosInChapter = (demos: readonly Demo[], chapter: DemoChapter): readonly Demo[] =>
  demos.filter((demo) => demo.chapter === chapter);

// Ids that appear more than once, so the gallery can refuse an ambiguous route.
export const duplicateDemoIds = (demos: readonly Demo[]): readonly string[] =>
  demos.map((demo) => demo.id).filter((id, index, ids) => ids.indexOf(id) !== index);
