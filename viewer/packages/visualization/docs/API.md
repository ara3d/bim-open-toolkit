# Public API reference

Generated from the compiled TypeScript declarations. Run `npm run docs:api` after building. Optional subpaths keep renderer, DOM and UI dependencies outside the root data API.

## @bim-open-toolkit/visualization

```ts
// contracts
/** Contract revision V1. Data only; matrices are column-major, colors linear RGB. */
export type ObjectRef = {
    readonly modelId: string;
    readonly objectId: string;
};
export type ModelRef = {
    readonly id: string;
    readonly revision: string;
    readonly source?: string;
};
export type Vec3 = readonly [number, number, number];
export type Color = readonly [number, number, number];
export type Matrix4 = readonly [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
export type Coordinates = {
    readonly units: 'metres' | 'millimetres' | 'feet' | 'unknown';
    readonly up: 'Y' | 'Z';
    readonly registration: 'local' | 'project' | 'unknown';
};
export type Appearance = {
    readonly color: Color;
    readonly opacity: number;
    readonly visible: boolean;
};
export type ObjectRecord = {
    readonly ref: ObjectRef;
    readonly name?: string;
    readonly sourceId?: string;
    readonly appearance: Appearance;
    readonly transform: Matrix4;
};
export type ModelData = {
    readonly ref: ModelRef;
    readonly coordinates: Coordinates;
    readonly objects: readonly ObjectRecord[];
};
export type NamedSet = {
    readonly id: string;
    readonly name: string;
    readonly members: readonly ObjectRef[];
};
export type StyleRule = {
    readonly id: string;
    readonly members: readonly ObjectRef[];
    readonly style: Partial<Appearance>;
};
export type EditOperation = {
    readonly kind: 'add';
    readonly object: ObjectRecord;
} | {
    readonly kind: 'delete';
    readonly ref: ObjectRef;
} | {
    readonly kind: 'transform';
    readonly ref: ObjectRef;
    readonly transform: Matrix4;
} | {
    readonly kind: 'style';
    readonly ref: ObjectRef;
    readonly style: Partial<Appearance>;
};
export type EditLayer = {
    readonly id: string;
    readonly enabled: boolean;
    readonly operations: readonly EditOperation[];
};
export type CameraState = {
    readonly position: Vec3;
    readonly target: Vec3;
    readonly up: Vec3;
    readonly projection: 'perspective' | 'orthographic';
    readonly zoom: number;
};
export type ViewState = {
    readonly id: string;
    readonly camera: CameraState;
    readonly selection: readonly ObjectRef[];
    readonly rules: readonly StyleRule[];
};
export type SceneDocument = {
    readonly schemaVersion: 1;
    readonly models: readonly ModelRef[];
    readonly sets: readonly NamedSet[];
    readonly views: readonly ViewState[];
    readonly layers: readonly EditLayer[];
};
export type Diagnostic = {
    readonly code: string;
    readonly message: string;
    readonly ref?: ObjectRef;
};
export type Result<T> = {
    readonly ok: true;
    readonly value: T;
    readonly diagnostics: readonly Diagnostic[];
} | {
    readonly ok: false;
    readonly diagnostics: readonly Diagnostic[];
};
export declare const objectKey: (ref: ObjectRef) => string;
export declare const identityMatrix: Matrix4;

// identity
import { type ModelData, type ObjectRecord, type ObjectRef } from './contracts.js';
/** Loaded model revisions and geometry-independent identity indexes. */
export declare class ModelRegistry {
    private readonly entries;
    private disposed;
    add(model: ModelData): void;
    remove(modelId: string): boolean;
    getModel(modelId: string): ModelData | undefined;
    getObject(ref: ObjectRef): ObjectRecord | undefined;
    getSource(ref: ObjectRef): string | undefined;
    findBySource(modelId: string, sourceId: string): readonly ObjectRef[];
    models(): readonly ModelData[];
    dispose(): void;
}

// selection
import { type NamedSet, type ObjectRef } from './contracts.js';
/** Stable order, structural equality, and immutable snapshots. */
export declare function uniqueRefs(refs: Iterable<ObjectRef>): readonly ObjectRef[];
export declare function unionRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[];
export declare function intersectRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[];
export declare function subtractRefs(left: readonly ObjectRef[], right: readonly ObjectRef[]): readonly ObjectRef[];
export declare function createNamedSet(id: string, name: string, members: Iterable<ObjectRef>): NamedSet;
export type SelectionListener = (selection: readonly ObjectRef[]) => void;
/** Selection has no renderer or registry dependency; hosts may retain unresolved refs. */
export declare class SelectionStore {
    private members;
    private readonly listeners;
    private disposed;
    constructor(initial?: Iterable<ObjectRef>);
    snapshot(): readonly ObjectRef[];
    subscribe(listener: SelectionListener): () => void;
    replace(refs: readonly ObjectRef[]): boolean;
    add(refs: readonly ObjectRef[]): boolean;
    remove(refs: readonly ObjectRef[]): boolean;
    toggle(refs: readonly ObjectRef[]): boolean;
    dispose(): void;
    private assertActive;
}

// appearance
import { type Color, type ObjectRecord, type ObjectRef, type StyleRule } from './contracts.js';
export type Category = string | number | boolean;
export type CategoryLegendEntry = {
    readonly value: Category;
    readonly label: string;
    readonly color: Color;
};
/** Unknown categories, null, undefined and NaN all use the missing color. */
export declare function createCategoricalColorMap(entries: readonly CategoryLegendEntry[], missingColor: Color): {
    legend: {
        entries: readonly CategoryLegendEntry[];
        missing: {
            label: string;
            color: Color;
        };
    };
    color: (value: Category | null | undefined) => Color;
};
export type NumericColorOptions = {
    readonly min: number;
    readonly max: number;
    readonly low: Color;
    readonly high: Color;
    readonly missingColor: Color;
};
/** Clamp finite values to the range; a constant range uses its midpoint color. */
export declare function createNumericColorMap(options: NumericColorOptions): {
    legend: {
        min: number;
        max: number;
        low: Color;
        high: Color;
        missing: {
            label: string;
            color: Color;
        };
    };
    color(value: number | null | undefined): Color;
};
export type AppearanceOptions = {
    readonly rules?: readonly StyleRule[];
    /** An omitted filter shows all eligible objects; an empty filter hides all. */
    readonly visible?: readonly ObjectRef[];
    readonly selection?: readonly ObjectRef[];
    readonly selectionColor?: Color;
};
/** Rules and selection cannot resurrect hidden base/edit objects or earlier rule hides. */
export declare function composeAppearance(objects: readonly ObjectRecord[], options?: AppearanceOptions): readonly ObjectRecord[];

// edits
import { type Diagnostic, type EditLayer, type ObjectRecord, type ObjectRef } from './contracts.js';
export type ComposedEdits = {
    readonly objects: readonly ObjectRecord[];
    readonly tombstones: readonly ObjectRef[];
    readonly diagnostics: readonly Diagnostic[];
};
/** Enabled layers apply in order. Deletion is terminal within a composition. */
export declare function composeEdits(base: readonly ObjectRecord[], layers: readonly EditLayer[]): ComposedEdits;
export type EditHistory = {
    readonly past: readonly (readonly EditLayer[])[];
    readonly present: readonly EditLayer[];
    readonly future: readonly (readonly EditLayer[])[];
};
/** Snapshot complete transactions so subsequent caller edits cannot alter history. */
export declare function createEditHistory(initial?: readonly EditLayer[]): EditHistory;
export declare function commitEditHistory(history: EditHistory, layers: readonly EditLayer[]): EditHistory;
export declare function undoEditHistory(history: EditHistory): EditHistory;
export declare function redoEditHistory(history: EditHistory): EditHistory;

// persistence
import { type ModelData, type ModelRef, type Result, type SceneDocument } from './contracts.js';
/** Validate and detach plain schema-v1 data. Unknown fields and runtime objects are rejected. */
export declare function validateSceneDocument(input: unknown): Result<SceneDocument>;
export declare function parseSceneDocument(json: string): Result<SceneDocument>;
/** Throws for invalid data so a malformed save cannot silently overwrite a valid save. */
export declare function serializeSceneDocument(document: SceneDocument): string;
export type ModelResolver = (reference: ModelRef, signal?: AbortSignal) => Promise<ModelData | undefined>;
export type RestoredScene = {
    readonly document: SceneDocument;
    readonly models: readonly ModelData[];
};
/** Host-controlled resolution, concurrent across models, with deterministic diagnostics. */
export declare function restoreSceneDocument(document: SceneDocument, resolver: ModelResolver, options?: {
    readonly signal?: AbortSignal;
}): Promise<Result<RestoredScene>>;

// camera
import type { CameraState, Vec3 } from './contracts.js';
export type CameraBounds = {
    readonly min: Vec3;
    readonly max: Vec3;
};
export type PerspectiveFitOptions = {
    /** Vertical field of view in radians, before camera zoom. */
    readonly verticalFov: number;
    readonly aspect: number;
    /** Vector from target toward camera; defaults to [1, 1, 1]. */
    readonly direction?: Vec3;
    readonly padding?: number;
};
/** Fit the entire bounds sphere in both viewport dimensions, with a Y-up pose. */
export declare function fitPerspectivePose(bounds: CameraBounds, options: PerspectiveFitOptions): CameraState;
/** Near-overhead Y-up pose avoids the orbit model's singular pole. */
export declare function overheadPose(target: Vec3, distance: number): CameraState;

// layouts
import type { ObjectRecord, Vec3 } from './contracts.js';
export type LayoutCenter = (object: ObjectRecord, index: number) => Vec3;
export type ExplodeOptions = {
    readonly origin: Vec3;
    readonly strength: number;
    readonly centerOf: LayoutCenter;
};
export type GridOptions = {
    readonly origin: Vec3;
    readonly spacing: number;
    readonly columns: number;
    readonly centerOf: LayoutCenter;
};
/** Positive strength separates supplied world centers radially; zero restores the supplied base. */
export declare function explodeLayout(objects: readonly ObjectRecord[], options: ExplodeOptions): readonly ObjectRecord[];
/** Arrange supplied world centers on an XZ grid, retaining each object's internal placement. */
export declare function gridLayout(objects: readonly ObjectRecord[], options: GridOptions): readonly ObjectRecord[];

// annotations
import { type Diagnostic, type ObjectRef, type Result, type Vec3 } from './contracts.js';
export type Annotation = {
    readonly id: string;
    readonly text: string;
    readonly position: Vec3;
    readonly ref?: ObjectRef;
};
/** Separate from SceneDocument: positions stay in world space when objects move. */
export type AnnotationDocument = {
    readonly schemaVersion: 1;
    readonly annotations: readonly Annotation[];
};
export declare function validateAnnotationDocument(input: unknown): Result<AnnotationDocument>;
export declare function parseAnnotationDocument(json: string): Result<AnnotationDocument>;
export declare const serializeAnnotationDocument: (document: AnnotationDocument) => string;
export declare const addAnnotation: (document: AnnotationDocument, annotation: Annotation) => AnnotationDocument;
export declare function updateAnnotation(document: AnnotationDocument, annotation: Annotation): AnnotationDocument;
export declare const removeAnnotation: (document: AnnotationDocument, id: string) => AnnotationDocument;
export declare function diagnoseAnnotationRefs(document: AnnotationDocument, available: Iterable<ObjectRef>): readonly Diagnostic[];

// animation
import type { Vec3 } from './contracts.js';
/** Seconds throughout. Host timestamps must be finite and monotonic. */
export type PlaybackState = {
    readonly duration: number;
    readonly time: number;
    readonly rate: number;
    readonly playing: boolean;
    readonly loop: boolean;
    readonly timestamp: number;
};
export declare function createPlayback(duration: number, options?: {
    readonly loop?: boolean;
    readonly rate?: number;
    readonly timestamp?: number;
}): PlaybackState;
export declare function advancePlayback(state: PlaybackState, timestamp: number): PlaybackState;
export declare function playPlayback(state: PlaybackState, timestamp: number): PlaybackState;
export declare function pausePlayback(state: PlaybackState, timestamp: number): PlaybackState;
export declare function seekPlayback(state: PlaybackState, time: number, timestamp: number): PlaybackState;
export declare function setPlaybackRate(state: PlaybackState, rate: number, timestamp: number): PlaybackState;
export declare function resetPlayback(state: PlaybackState, timestamp: number): PlaybackState;
/** Horizontal circle, starting at zero displacement; independent of playback history. */
export declare function sampleCircularTranslation(time: number, options: {
    readonly period: number;
    readonly radius: number;
}): Vec3;

// view-link
import type { CameraState } from './contracts.js';
export type CameraEndpoint = {
    read(): CameraState;
    write(pose: CameraState): void;
    subscribe(listener: () => void): () => void;
};
/** Bidirectional camera synchronization with loop suppression and explicit disposal. */
export declare function linkCameraViews(a: CameraEndpoint, b: CameraEndpoint, options?: {
    readonly initial?: 'a' | 'b' | false;
}): () => void;

// benchmarks
export type MeasurementProgress = {
    readonly phase: 'warmup' | 'sample';
    readonly completed: number;
    readonly total: number;
};
export type MeasurementOptions = {
    readonly warmups: number;
    readonly samples: number;
    readonly name?: string;
    readonly counts?: Readonly<Record<string, number>>;
    readonly now?: () => number;
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: MeasurementProgress) => void;
};
export type OperationMeasurement = {
    readonly name: string;
    readonly counts: Readonly<Record<string, number>>;
    readonly warmups: number;
    readonly samples: readonly number[];
    readonly p50: number;
    readonly p95: number;
    readonly unit: 'ms';
};
export declare class MeasurementError extends Error {
    readonly code: 'invalid-options' | 'invalid-clock' | 'cancelled';
    constructor(code: 'invalid-options' | 'invalid-clock' | 'cancelled', message: string);
}
/** Nearest-rank quantiles, preserving the caller's sample order. */
export declare function summarizeMeasurements(samples: readonly number[]): {
    readonly p50: number;
    readonly p95: number;
};
/** Measures the supplied completion contract. Operation/progress errors propagate unchanged. */
export declare function measureOperation(operation: (signal?: AbortSignal) => void | Promise<void>, options: MeasurementOptions): Promise<OperationMeasurement>;

// building-model
import { type ObjectRef, type Result } from './contracts.js';
export type MissingReason = 'NotObserved' | 'NotExported' | 'NotApplicable' | 'Invalid' | 'Conflicting';
export type NumericFact = {
    readonly state: 'known';
    readonly value: number;
    readonly unit: 'm';
    readonly assurance: string;
    readonly evidenceIds: readonly string[];
} | {
    readonly state: 'missing';
    readonly reason: MissingReason;
    readonly explanation: string;
    readonly unit: 'm';
    readonly evidenceIds: readonly string[];
};
export type DoorScheduleRow = {
    readonly id: string;
    readonly name: string;
    readonly ref?: ObjectRef;
    readonly nominalWidth: NumericFact;
    readonly clearWidth: NumericFact;
    readonly evidenceIds: readonly string[];
};
export type WidthCoverage = {
    total: number;
    known: number;
    missing: number;
    conflicting: number;
    invalid: number;
    inapplicable: number;
};
export type WorkflowEvidence = {
    readonly id: string;
    readonly origin: string;
    readonly method: string;
    readonly explanation: string;
    readonly sourceIds: readonly string[];
    readonly externalReferences: readonly {
        readonly authority: string;
        readonly title: string;
        readonly version: string;
        readonly locator: string;
    }[];
};
export type DoorSchedule = {
    readonly snapshotId: string;
    readonly sourceFingerprint: string;
    readonly rows: readonly DoorScheduleRow[];
    readonly coverage: {
        readonly nominalWidth: WidthCoverage;
        readonly clearWidth: WidthCoverage;
    };
    readonly evidence: readonly WorkflowEvidence[];
};
export type DoorScheduleOptions = {
    readonly modelId: string;
    readonly contentFingerprint: string;
    readonly availableObjects?: Iterable<ObjectRef>;
};
/** Consume only the architectural fields needed for a door schedule. No geometry/BIM inference or I/O. */
export declare function adaptDoorSchedule(projection: unknown, options: DoorScheduleOptions): Result<DoorSchedule>;

// projection
import type { Vec3 } from './contracts.js';
export type OrthographicView = 'top' | 'front' | 'side' | 'isometric';
export type OrthographicFit = {
    readonly position: Vec3;
    readonly target: Vec3;
    readonly up: Vec3;
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
    readonly near: number;
    readonly far: number;
};
/** Fit projected box extents to either viewport dimension, preserving parallel projection. */
export declare function fitOrthographicView(bounds: {
    readonly min: Vec3;
    readonly max: Vec3;
}, options: {
    readonly view: OrthographicView;
    readonly aspect: number;
    readonly padding?: number;
}): OrthographicFit;

// storage
import type { Result, SceneDocument } from './contracts.js';
/** Minimal synchronous key/value store, compatible with browser Storage and in-memory hosts. */
export interface StorageLike {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** Explicit saves only. A custom namespace must be exclusively owned by this adapter. */
export declare class SceneStorage {
    private readonly storage;
    private readonly prefix;
    constructor(storage: StorageLike, namespace?: string);
    private key;
    save(id: string, document: SceneDocument, options?: {
        readonly overwrite?: boolean;
    }): Result<true>;
    load(id: string): Result<SceneDocument>;
    list(): Result<readonly string[]>;
    remove(id: string): Result<boolean>;
}

// review-tools
import { type Appearance, type ModelData, type ObjectRef } from './contracts.js';
export type ReviewToolHost = {
    snapshot(): {
        readonly models: readonly ModelData[];
        readonly selection: readonly ObjectRef[];
    };
    select(refs: readonly ObjectRef[]): void | Promise<void>;
    fit(refs: readonly ObjectRef[] | null): void | Promise<void>;
    /** A reversible host-owned style layer; null removes overrides for these refs. */
    setStyle(refs: readonly ObjectRef[], style: Pick<Partial<Appearance>, 'color' | 'visible'> | null): void | Promise<void>;
};
export type ReviewToolResult = {
    readonly content: readonly {
        readonly type: 'text';
        readonly text: string;
    }[];
    readonly isError: boolean;
};
export type ReviewToolDescriptor = {
    readonly name: string;
    readonly description: string;
    readonly inputSchema: Record<string, unknown>;
    readonly annotations: {
        readonly readOnlyHint: boolean;
    };
};
/** Bounded MCP-compatible descriptors/results; transport and authorization remain host-owned. */
export declare function createReviewTools(host: ReviewToolHost, options?: {
    readonly allowWrites?: boolean;
}): {
    list(): readonly ReviewToolDescriptor[];
    call(name: string, input?: unknown): Promise<ReviewToolResult>;
};
```

## @bim-open-toolkit/visualization/render

```ts
import { type InstancedGroup, type ViewerScene, type SceneObject } from '@ara3d/viewer-core';
import { type Camera, Raycaster } from 'three';
import { type Matrix4, type ObjectRef, type ObjectRecord, type Result, type Vec3 } from './contracts.js';
export type InstanceBinding = {
    readonly ref: ObjectRef;
    readonly representationId: string;
    readonly group: InstancedGroup;
    readonly instanceIndex: number;
    readonly localTransform?: Matrix4;
    readonly colorFactor?: readonly [number, number, number, number];
};
export type ObjectHit = {
    readonly ref: ObjectRef;
    readonly representationId: string;
    readonly point: Vec3;
    readonly distance: number;
};
/** Owns scene membership, borrows groups. Dispose mirrors/viewer separately to release GPU resources. */
export declare class RenderBinding {
    private readonly scene;
    private readonly requestRender;
    private readonly pickSources;
    private readonly models;
    private readonly objects;
    private readonly instances;
    private disposed;
    constructor(scene: ViewerScene, requestRender: () => void);
    /** A group belongs to exactly one model and cannot already belong to the supplied scene. */
    addModel(modelId: string, bindings: readonly InstanceBinding[]): Result<number>;
    removeModel(modelId: string): boolean;
    /** CPU submission only, one render request. Unknown/geometry-free records are reported, not fabricated. */
    update(records: readonly ObjectRecord[]): Result<number>;
    /** Full effective scene: bound objects absent from records become invisible (e.g. edit tombstones). */
    applySnapshot(records: readonly ObjectRecord[]): Result<number>;
    private apply;
    resolveInstance(group: InstancedGroup, instanceIndex: number): InstanceBinding | undefined;
    /** Host pick providers own visibility/clipping checks; only loaded references are accepted. */
    addPickSource(source: (ray: Raycaster) => readonly ObjectHit[]): () => void;
    /** World-space closest visible hit. Ghosted objects remain pickable; alpha-zero objects do not. */
    pick(objects: SceneObject, camera: Camera, x: number, y: number): ObjectHit | undefined;
    dispose(): void;
}
```

## @bim-open-toolkit/visualization/loading

```ts
import { type LoadProgress, type LoadSource } from '@ara3d/viewer-loaders';
import { type ModelData, type ModelRef, type Result } from './contracts.js';
import type { InstanceBinding } from './render.js';
export type BosModelOptions = {
    readonly signal?: AbortSignal;
    readonly onProgress?: (progress: LoadProgress) => void;
    /** The returned model always uses Y-up; Z input rotates -90 degrees about X. */
    readonly sourceUp?: 'Y' | 'Z';
};
export type LoadedBosModel = {
    readonly model: ModelData;
    readonly bindings: InstanceBinding[];
};
/** Decode and normalize without touching a scene. A cancelled load never publishes a value. */
export declare function loadBosModel(source: LoadSource, modelRef: ModelRef, options?: BosModelOptions): Promise<Result<LoadedBosModel>>;
```

## @bim-open-toolkit/visualization/camera

```ts
import type { CameraState, Vec3 } from './contracts.js';
export type CameraBounds = {
    readonly min: Vec3;
    readonly max: Vec3;
};
export type PerspectiveFitOptions = {
    /** Vertical field of view in radians, before camera zoom. */
    readonly verticalFov: number;
    readonly aspect: number;
    /** Vector from target toward camera; defaults to [1, 1, 1]. */
    readonly direction?: Vec3;
    readonly padding?: number;
};
/** Fit the entire bounds sphere in both viewport dimensions, with a Y-up pose. */
export declare function fitPerspectivePose(bounds: CameraBounds, options: PerspectiveFitOptions): CameraState;
/** Near-overhead Y-up pose avoids the orbit model's singular pole. */
export declare function overheadPose(target: Vec3, distance: number): CameraState;
```

## @bim-open-toolkit/visualization/assets

```ts
import { type LoadSource } from '@ara3d/viewer-loaders';
import { type ModelRef, type Result } from './contracts.js';
import type { LoadedBosModel } from './loading.js';
export type AssetFormat = 'glb' | 'gltf' | 'obj' | 'stl';
export type AssetOptions = {
    readonly signal?: AbortSignal;
    readonly sourceUp?: 'Y' | 'Z';
    readonly resources?: (uri: string, signal?: AbortSignal) => Promise<ArrayBuffer | Blob>;
};
/** Geometry asset ingestion. IDs are generated visual references, never inferred BIM facts. */
export declare function loadAssetModel(source: LoadSource, format: AssetFormat, modelRef: ModelRef, options?: AssetOptions): Promise<Result<LoadedBosModel>>;
```

## @bim-open-toolkit/visualization/clipping

```ts
import { Object3D, Plane } from 'three';
import type { Vec3 } from './contracts.js';
export type SectionPlane = {
    readonly normal: Vec3;
    readonly constant: number;
};
export type Section = {
    readonly kind: 'planes';
    readonly planes: readonly SectionPlane[];
} | {
    readonly kind: 'box';
    readonly min: Vec3;
    readonly max: Vec3;
};
/** Keep points with nonnegative distance to every plane; a box keeps its interior. */
export declare function createSectionPlanes(section: Section): Plane[];
/** Apply to existing mirror materials, including BatchedMesh. Restore before applying another scope. */
export declare function applyClipping(root: Object3D, planes: readonly Plane[]): () => void;
```

## @bim-open-toolkit/visualization/environment

```ts
import { Scene } from 'three';
export type EnvironmentSettings = {
    readonly background: number;
    readonly intensity: number;
    readonly warmth?: number;
};
/** Own a simple review light rig; restore the host's lighting/background on disposal. */
export declare function applyEnvironment(scene: Scene, settings: EnvironmentSettings): () => void;
```

## @bim-open-toolkit/visualization/navigation-aids

```ts
import { Group, type Scene } from 'three';
import type { Bounds3 } from '@ara3d/viewer-core';
/** Helpers have no object identity and never participate in the toolkit's model picking. */
export declare function addNavigationAids(scene: Scene, bounds: Bounds3): {
    readonly root: Group;
    dispose(): void;
};
```

## @bim-open-toolkit/visualization/overlay-renderer

```ts
import { type Camera } from 'three';
import { type Annotation } from './annotations.js';
/** SVG labels and leaders are screen overlays, not depth-occluded geometry. Host updates after camera changes. */
export declare class AnnotationOverlay {
    private readonly camera;
    private readonly root;
    private entries;
    private disposed;
    constructor(container: HTMLElement, camera: Camera);
    setAnnotations(notes: readonly Annotation[]): void;
    update(width: number, height: number): void;
    dispose(): void;
}
```

## @bim-open-toolkit/visualization/capture

```ts
export type CaptureErrorCode = 'invalid-size' | 'render-failed' | 'encode-failed';
export declare class CaptureError extends Error {
    readonly code: CaptureErrorCode;
    constructor(code: CaptureErrorCode, message: string, options?: ErrorOptions);
}
export type CaptureCanvas = {
    readonly width: number;
    readonly height: number;
    toBlob(callback: (blob: Blob | null) => void, type?: string): void;
};
/** Invoke render synchronously immediately before encoding for preserveDrawingBuffer=false canvases. */
export declare function captureCanvas(canvas: CaptureCanvas, renderFrame: () => void): Promise<Blob>;
```

## @bim-open-toolkit/visualization/replacement

```ts
import { type Bounds3, type MeshBuffers, type SceneObject } from '@ara3d/viewer-core';
import { Group, type Raycaster } from 'three';
import { type Matrix4, type ObjectRecord, type ObjectRef } from './contracts.js';
import { type ObjectHit, RenderBinding } from './render.js';
/** World-coordinate box geometry; use an identity replacement world matrix. */
export declare function boxReplacementMesh(bounds: Bounds3): MeshBuffers;
/** Owns overlay meshes while borrowing source records; source scene membership never changes. */
export declare class ReplacementLayer {
    private readonly scene;
    private readonly render;
    private readonly requestRender;
    readonly root: Group<import("three").Object3DEventMap>;
    private readonly entries;
    private readonly stopPicking;
    private disposed;
    constructor(scene: SceneObject, render: RenderBinding, requestRender: () => void);
    replace(original: ObjectRecord, supplied: MeshBuffers, worldTransform?: Matrix4): void;
    setVisible(ref: ObjectRef, visible: boolean): void;
    bounds(ref: ObjectRef): Bounds3 | undefined;
    raycast(ray: Raycaster): readonly ObjectHit[];
    undo(ref: ObjectRef): boolean;
    reset(): void;
    dispose(): void;
    private release;
}
```

## @bim-open-toolkit/visualization/gratify

```ts
import { type AppSpec } from 'gratify';
export type ReviewCommand = 'fit' | 'clearSelection' | 'toggleGhost';
export type ReviewCommands = Readonly<Record<ReviewCommand, () => void>>;
export type ReviewControlState = {
    readonly revision: number;
    readonly last: ReviewCommand | null;
    readonly ghost: boolean;
};
/** Pure MVU state; host commands run only after an actual dispatched commit. */
export declare function createReviewControlsApp(commands: ReviewCommands): AppSpec<ReviewControlState, ReviewCommand>;
export type ReviewControls = {
    dispatch(command: ReviewCommand): void;
    dispose(): void;
};
/** Genuine Gratify renderer with host-owned input/RAF teardown; fixed 288×196 logical surface. */
export declare function mountReviewControls(canvas: HTMLCanvasElement, commands: ReviewCommands): ReviewControls;
```
