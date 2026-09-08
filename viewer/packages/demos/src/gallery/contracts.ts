// Contract revision G1 for the gallery (GALLERY-PLAN.md section 4.1): what a demo is, what data it
// can open, and the viewer it drives. `GalleryViewer` is the gallery's own interface so the demos
// never depend on how it is composed: Track GAL implements it over render, interact and formats
// first, and over the viewer package's `createViewer` when that lands, without a demo changing.
import type {
  AnyFeature,
  Appearance,
  Bounds,
  Disposable,
  Geometry,
  ModelData,
  ModelRef,
  ObjectKey,
  ResolvedStyles,
  Result,
  Session,
  Vec2,
  Vec3,
} from '@bim-open-toolkit/model';
import type { LoadedModel, ModelDocuments, ModelProperties } from '@bim-open-toolkit/formats';
import type { Placement } from '@bim-open-toolkit/features';
import type { CaptureOptions, ObjectHit, SceneStatistics, UpdateReport } from '@bim-open-toolkit/render';
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

// A model the viewer has open, with the two pieces every style pass needs and neither the model
// nor the render package produces: the object key of each object ordinal, which is the order
// instance rows are addressed in, and the appearance each object was loaded with, without which
// resolving styles paints the whole model grey.
export type OpenedModel = {
  // The handle the source was opened under; `applyStyles` and `bounds` take it.
  readonly modelId: string;
  readonly ref: ModelRef;
  readonly data: ModelData;
  readonly geometry: Geometry;
  readonly keys: readonly ObjectKey[];
  readonly base: ReadonlyMap<ObjectKey, Appearance>;
  // What the file records about each object, when the file carries it and the loader was asked for
  // it: the parameter tables, and which of the source documents each object came from. Absent for a
  // generated model and for a format that carries neither, which is what a demo has to say when it
  // reads them.
  readonly properties?: ModelProperties | undefined;
  readonly documents?: ModelDocuments | undefined;
};

// The viewer a demo drives. It is a session (state changes only through commands) plus the few
// live capabilities a demo needs that are not plain data.
export type GalleryViewer = Session &
  Disposable & {
    // The element panels are placed in; it contains the canvas and is positioned.
    readonly viewport: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly open: (source: ModelSource) => Promise<Result<ModelRef>>;
    readonly models: () => readonly ModelRef[];
    // Where each object is: its own record when the records tell two objects apart, and the rows
    // that draw it when they do not, which is every model read from a BFAST file. A demo asks the
    // viewer because only the viewer has the bound rows.
    readonly placements: () => readonly Placement[];
    // The open models with their derived pieces, in the order they were opened.
    readonly opened: () => readonly OpenedModel[];
    // Writes a whole style resolution into the instance buffers; only rows that differ are written.
    readonly applyStyles: (modelId: string, resolved: ResolvedStyles) => Result<UpdateReport>;
    // What the scene draws now: objects, groups, instances and triangles.
    readonly statistics: () => SceneStatistics;
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
