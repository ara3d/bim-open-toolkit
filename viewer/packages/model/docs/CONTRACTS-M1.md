# Model contracts, revision M1

Package `@bim-open-toolkit/model`. Proposed revision M1 of the contracts the visualization V2 plan
(revision P0, `docs/plans/visualization/V2-PLAN.md`) assigns to this package. For the supervisor to
review before the wave 1 briefs go out.

## What M1 changes from P0, and why

- **`Session` is its own module** rather than part of `feature.ts`, because `command.ts` needs it and
  `feature.ts` needs `command.ts`. Three modules, one direction of dependency.
- **`Command` erases its input type.** P0 shows `run(session, input)` on a typed command. A registry
  holding commands with different input types cannot be typed that way in TypeScript without a
  variance error, so the exported `Command` takes `unknown` and validates with its own schema, while
  the `command()` constructor gives the author a checked, typed input. This is also what makes a
  generated MCP descriptor exact rather than hand-written.
- **`AppearanceExtras` is the style extension point:** a feature adds named plain values without
  changing this package.
- **`OptionalSchema` marks an optional property**, instead of inferring optionality from
  `undefined extends T`, so a schema of `unknown` is a required property rather than an optional one.
- **Edit targets and saved-view members are object keys, not sets**, so every persisted shape is
  plain data a document can hold and a schema can check.
- **`resolveStyles` takes the scene's object keys.** A filter hides everything it leaves out, which
  needs the set of objects. Asking for it is honest; guessing a universe is not.
- **A generic `History<S>`** carries undo and redo instead of inverting individual edit operations,
  which is what makes every reversal exact.

## Escape hatches

None. No `any`, no `as` cast, no non-null assertion, no compiler or lint directive in `src` or
`test`. One type predicate, `narrow` in `schema.ts`, is the single point where a completed runtime
check establishes a static type, used by `object` and `tuple` only: TypeScript cannot prove that a
structure walked key by key inhabits a mapped or a tuple type, and the alternative is a cast.

## M1.1 additions

Additive follow-up to the independent review of 2026-09-08, whose composition probe had to
hand-write four bridges. Nothing below renames, removes or re-signs an M1 export, so the revision
label stays M1; the module blocks further down are the M1 declarations and do not repeat these.

### `math` — plane vectors, for Track S

```ts
export type Vec2 = readonly [number, number];
export declare const crossVec2: (a: Vec2, b: Vec2) => number;
export declare const turnVec2: (a: Vec2, b: Vec2, c: Vec2) => number;
export declare const polygonArea: (points: readonly Vec2[]) => number;
```

### `table` — accessors, a record constructor, and string-key joins

`joinTablesOn` accepts two integer key columns or two string key columns; `joinTables` is unchanged
and still refuses anything but integers. A string key costs one map of the right column's distinct
strings plus one string hash per left row, against a number hash per row for the integer path.

```ts
export declare const tableFromRecord: (columns: Readonly<Record<string, Column>>) => Table;
export declare const stringColumnOf: (source: Table, name: string) => StringColumn | undefined;
export declare const boolColumnOf: (source: Table, name: string) => BoolColumn | undefined;
export declare const cellOf: (source: Table, name: string, row: number) => CellValue | undefined;
export declare const numberOf: (source: Table, name: string, row: number) => number | undefined;
export declare const stringOf: (source: Table, name: string, row: number) => string | undefined;
export declare const indexByStringKey: (column: StringColumn) => ReadonlyMap<string, number>;
export declare const matchStringRows: (left: StringColumn, right: StringColumn) => Int32Array;
export declare const joinTablesOn: (left: Table, leftKey: string, right: Table, rightKey: string, prefix?: string) => Result<Table>;
```

### `instance-table` — instance records as a table

`meshIndex` and `objectIndex` are the records' own arrays, not copies. The transform becomes sixteen
`f32` columns `m0`..`m15`, where `m{c * 4 + r}` is element (row r, column c) of the column-major
transform, so `m12`, `m13` and `m14` are the translation; the colour becomes `red`, `green`, `blue`
and `alpha`. One allocation and one pass per component column, none per row.

A strided view of a typed array does not exist in JavaScript, so a column that shared the transform
buffer would be sixteen times longer than the row count, and `takeRows`, `filterRows`, `sortRows`
and the joins would silently mix rows up. Correctness before the copy.

```ts
export declare const transformColumnNames: readonly string[];
export declare const colorColumnNames: readonly string[];
export declare const instanceTable: (records: InstanceRecords) => Table;
```

### `table-sets` — object sets and table rows

A string key column holds object keys; an integer key column holds indices into `keys`, which is
what an instance table's `objectIndex` is. A key column of neither kind keeps no rows and reads back
as the empty set, rather than guessing.

```ts
export declare const rowsInSet: (source: Table, keyColumn: string, set: ObjectSet, keys?: readonly ObjectKey[]) => Table;
export declare const setOfRows: (source: Table, keyColumn: string, keys?: readonly ObjectKey[]) => ObjectSet;
```

## Signatures

The emitted declarations, grouped by module, in dependency order.

### `result` — Result and Diagnostic

Every fallible operation returns a value with its diagnostics, or a failure with them. Diagnostics carry a code, a path into the value and a severity, so a caller can report exactly where something went wrong without exceptions.

```ts
export type Severity = 'error' | 'warning' | 'info';
export type DiagnosticPath = readonly (string | number)[];
export type Diagnostic = { readonly code: string; readonly message: string; readonly path: DiagnosticPath; readonly severity: Severity; };
export type Result<T> = { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[]; } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[]; };
export declare const rootPath: DiagnosticPath;
export declare const diagnostic: (code: string, message: string, path?: DiagnosticPath, severity?: Severity) => Diagnostic;
export declare const warning: (code: string, message: string, path?: DiagnosticPath) => Diagnostic;
export declare const note: (code: string, message: string, path?: DiagnosticPath) => Diagnostic;
export declare const success: <T>(value: T, diagnostics?: readonly Diagnostic[]) => Result<T>;
export declare const failure: <T>(diagnostics: readonly Diagnostic[]) => Result<T>;
export declare const isError: (item: Diagnostic) => boolean;
export declare const hasErrors: (diagnostics: readonly Diagnostic[]) => boolean;
export declare const resultOf: <T>(value: T, diagnostics: readonly Diagnostic[]) => Result<T>;
export declare const map: <T, U>(result: Result<T>, fn: (value: T) => U) => Result<U>;
export declare const flatMap: <T, U>(result: Result<T>, fn: (value: T) => Result<U>) => Result<U>;
export declare const all: <T>(results: readonly Result<T>[]) => Result<readonly T[]>;
export declare const collect: <T>(results: readonly Result<T>[]) => { readonly values: readonly T[]; readonly diagnostics: readonly Diagnostic[]; };
export declare const valueOr: <T>(result: Result<T>, fallback: T) => T;
export declare const withDiagnostics: <T>(result: Result<T>, extra: readonly Diagnostic[]) => Result<T>;
export declare const underPath: (diagnostics: readonly Diagnostic[], segment: string | number) => readonly Diagnostic[];
export declare const formatPath: (path: DiagnosticPath) => string;
```

### `math` — Vectors, matrices and bounds

Plain number arrays only: a 4x4 transform is sixteen numbers, column-major, element (row r, column c) at index c * 4 + r. No matrix library is needed to consume this package.

```ts
export type Vec3 = readonly [number, number, number];
export type Color = readonly [number, number, number];
export type Matrix4 = readonly [ number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number ];
export type Bounds = { readonly min: Vec3; readonly max: Vec3; };
export declare const identityMatrix: Matrix4;
export declare const translation: (offset: Vec3) => Matrix4;
export declare const scaling: (factors: Vec3) => Matrix4;
export declare const multiplyMatrix: (second: Matrix4, first: Matrix4) => Matrix4;
export declare const transformPoint: (matrix: Matrix4, point: Vec3) => Vec3;
export declare const transformDirection: (matrix: Matrix4, direction: Vec3) => Vec3;
export declare const addVec3: (a: Vec3, b: Vec3) => Vec3;
export declare const subVec3: (a: Vec3, b: Vec3) => Vec3;
export declare const scaleVec3: (v: Vec3, factor: number) => Vec3;
export declare const emptyBounds: Bounds;
export declare const isEmptyBounds: (bounds: Bounds) => boolean;
export declare const expandBounds: (bounds: Bounds, point: Vec3) => Bounds;
export declare const unionBounds: (a: Bounds, b: Bounds) => Bounds;
export declare const boundsOf: (points: Iterable<Vec3>) => Bounds;
export declare const boundsCenter: (bounds: Bounds) => Vec3 | undefined;
export declare const boundsSize: (bounds: Bounds) => Vec3 | undefined;
export declare const boundsContain: (bounds: Bounds, point: Vec3) => boolean;
export declare const transformBounds: (matrix: Matrix4, bounds: Bounds) => Bounds;
export declare const vec3Length: (v: Vec3) => number;
export declare const normalizeVec3: (v: Vec3) => Vec3 | undefined;
```

### `identity` — Model and object identity

Identity is a model revision plus an object id, so the same object at two revisions is two references. Keys are percent-encoded strings usable in maps, sets and saved documents, and they parse back.

```ts
export type ModelRef = { readonly id: string; readonly revision: string; readonly source?: string | undefined; };
export type ObjectRef = { readonly modelId: string; readonly revision: string; readonly objectId: string; };
export type ModelKey = string;
export type ObjectKey = string;
export declare const modelIdentity: (model: ModelRef) => ModelRef;
export declare const objectRef: (model: ModelRef, objectId: string) => ObjectRef;
export declare const modelOf: (ref: ObjectRef) => ModelRef;
export declare const modelKey: (model: ModelRef) => ModelKey;
export declare const objectKey: (ref: ObjectRef) => ObjectKey;
export declare const parseObjectKey: (key: ObjectKey) => Result<ObjectRef>;
export declare const parseModelKey: (key: ModelKey) => Result<ModelRef>;
export declare const sameModel: (a: ModelRef, b: ModelRef) => boolean;
export declare const sameModelId: (a: ModelRef, b: ModelRef) => boolean;
export declare const sameObject: (a: ObjectRef, b: ObjectRef) => boolean;
export declare const belongsTo: (ref: ObjectRef, model: ModelRef) => boolean;
export declare const atRevision: (ref: ObjectRef, revision: string) => ObjectRef;
```

### `coordinates` — Coordinate frames

Every model, layout and overlay declares its units, its up axis and how it is registered. Unknown is a real state: a conversion that needs data the frame does not carry returns undefined rather than guessing.

```ts
export type LengthUnit = 'metres' | 'centimetres' | 'millimetres' | 'feet' | 'inches' | 'unknown';
export type UpAxis = 'y' | 'z';
export type GeographicAnchor = { readonly latitude: number; readonly longitude: number; readonly altitude: number; readonly trueNorthDegrees: number; };
export type Registration = { readonly kind: 'local'; } | { readonly kind: 'project'; readonly projectId: string; } | { readonly kind: 'geographic'; readonly anchor: GeographicAnchor; } | { readonly kind: 'unknown'; };
export type CoordinateContext = { readonly units: LengthUnit; readonly up: UpAxis; readonly registration: Registration; };
export declare const metresPerUnit: (unit: LengthUnit) => number | undefined;
export declare const conversionFactor: (from: LengthUnit, to: LengthUnit) => number | undefined;
export declare const convertLength: (value: number, from: LengthUnit, to: LengthUnit) => number | undefined;
export declare const unitScaleMatrix: (from: LengthUnit, to: LengthUnit) => Matrix4 | undefined;
export declare const upVector: (up: UpAxis) => Vec3;
export declare const zUpToYUp: Matrix4;
export declare const yUpToZUp: Matrix4;
export declare const upAxisMatrix: (from: UpAxis, to: UpAxis) => Matrix4;
export declare const contextTransform: (from: CoordinateContext, to: CoordinateContext) => Matrix4 | undefined;
export declare const isRegistered: (context: CoordinateContext) => boolean;
export declare const geographicAnchor: (context: CoordinateContext) => GeographicAnchor | undefined;
export declare const unknownCoordinates: CoordinateContext;
export declare const metresZUpLocal: CoordinateContext;
```

### `objects` — Object records and model data

An object record is addressable without geometry, so a model with no representation is still valid data. A record points at a representation row by index rather than holding geometry.

```ts
export type ObjectRecord = { readonly ref: ObjectRef; readonly name?: string | undefined; readonly category?: string | undefined; readonly sourceId?: string | undefined; readonly parentId?: string | undefined; readonly transform: Matrix4; readonly appearance?: Appearance | undefined; readonly representation?: number | undefined; };
export type ModelData = { readonly ref: ModelRef; readonly coordinates: CoordinateContext; readonly objects: readonly ObjectRecord[]; };
export declare const emptyObject: (ref: ObjectRef) => ObjectRecord;
export declare const hasRepresentation: (record: ObjectRecord) => boolean;
export declare const objectsByKey: (model: ModelData) => ReadonlyMap<ObjectKey, ObjectRecord>;
export declare const objectIndexByKey: (model: ModelData) => ReadonlyMap<ObjectKey, number>;
export declare const objectRefs: (model: ModelData) => readonly ObjectRef[];
export declare const emptyModel: (ref: ModelRef, coordinates: CoordinateContext) => ModelData;
```

### `schema` — Schema combinators

One validator vocabulary for slices, commands, workflow inputs and generated MCP descriptors. Each combinator validates unknown into Result with path-addressed diagnostics and describes itself as a JSON-schema-like plain object.

```ts
export type JsonLiteral = string | number | boolean | null;
export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
export type JsonSchema = { readonly type?: JsonSchemaType; readonly description?: string; readonly properties?: Readonly<Record<string, JsonSchema>>; readonly required?: readonly string[]; readonly items?: JsonSchema; readonly prefixItems?: readonly JsonSchema[]; readonly additionalProperties?: JsonSchema; readonly minItems?: number; readonly maxItems?: number; readonly anyOf?: readonly JsonSchema[]; readonly const?: JsonLiteral; };
export type Schema<T> = { readonly check: (value: unknown, path: DiagnosticPath) => Result<T>; readonly describe: () => JsonSchema; readonly isOptional: boolean; };
export type OptionalSchema<T> = Schema<T | undefined> & { readonly isOptional: true; };
export type Infer<S> = S extends Schema<infer T> ? T : never;
export type ObjectShape = Readonly<Record<string, Schema<unknown>>>;
export type ObjectOf<Shape extends ObjectShape> = { readonly [K in RequiredKeys<Shape>]: Infer<Shape[K]>; } & { readonly [K in OptionalKeys<Shape>]?: Infer<Shape[K]>; };
export type TupleOf<Items extends readonly Schema<unknown>[]> = { readonly [K in keyof Items]: Infer<Items[K]>; };
export declare const string: () => Schema<string>;
export declare const number: () => Schema<number>;
export declare const integer: () => Schema<number>;
export declare const boolean: () => Schema<boolean>;
export declare const nullValue: () => Schema<null>;
export declare const unknownValue: () => Schema<unknown>;
export declare const literal: <T extends JsonLiteral>(value: T) => Schema<T>;
export declare const array: <T>(items: Schema<T>) => Schema<readonly T[]>;
export declare const tuple: <Items extends readonly Schema<unknown>[]>(...items: Items) => Schema<TupleOf<Items>>;
export declare const object: <Shape extends ObjectShape>(shape: Shape) => Schema<ObjectOf<Shape>>;
export declare const record: <T>(values: Schema<T>) => Schema<Readonly<Record<string, T>>>;
export declare const union: <T>(...alternatives: readonly Schema<T>[]) => Schema<T>;
export declare const optional: <T>(inner: Schema<T>) => OptionalSchema<T>;
export declare const nullable: <T>(inner: Schema<T>) => Schema<T | null>;
export declare const refine: <T>(inner: Schema<T>, predicate: (value: T) => boolean, code: string, message: string) => Schema<T>;
export declare const described: <T>(inner: Schema<T>, description: string) => Schema<T>;
export declare const parse: <T>(schema: Schema<T>, value: unknown) => Result<T>;
export {};
```

### `sets` — Object sets

Sets of object keys with the usual algebra. A no-op returns its operand unchanged and intersection walks the smaller side, so composing rules over large models does not allocate for the common cases.

```ts
export type ObjectSet = ReadonlySet<ObjectKey>;
export type NamedSet = { readonly id: string; readonly name: string; readonly members: ObjectSet; };
export declare const emptySet: ObjectSet;
export declare const setOf: (keys: Iterable<ObjectKey>) => ObjectSet;
export declare const setOfRefs: (refs: Iterable<ObjectRef>) => ObjectSet;
export declare const setSize: (set: ObjectSet) => number;
export declare const isEmptySet: (set: ObjectSet) => boolean;
export declare const contains: (set: ObjectSet, key: ObjectKey) => boolean;
export declare const containsRef: (set: ObjectSet, ref: ObjectRef) => boolean;
export declare const setKeys: (set: ObjectSet) => readonly ObjectKey[];
export declare const unionSets: (a: ObjectSet, b: ObjectSet) => ObjectSet;
export declare const intersectSets: (a: ObjectSet, b: ObjectSet) => ObjectSet;
export declare const differenceSets: (a: ObjectSet, b: ObjectSet) => ObjectSet;
export declare const symmetricDifferenceSets: (a: ObjectSet, b: ObjectSet) => ObjectSet;
export declare const unionAll: (sets: Iterable<ObjectSet>) => ObjectSet;
export declare const intersectAll: (sets: Iterable<ObjectSet>) => ObjectSet;
export declare const addToSet: (set: ObjectSet, key: ObjectKey) => ObjectSet;
export declare const removeFromSet: (set: ObjectSet, key: ObjectKey) => ObjectSet;
export declare const toggleInSet: (set: ObjectSet, key: ObjectKey) => ObjectSet;
export declare const filterSet: (set: ObjectSet, predicate: (key: ObjectKey) => boolean) => ObjectSet;
export declare const isSubsetOf: (a: ObjectSet, b: ObjectSet) => boolean;
export declare const equalSets: (a: ObjectSet, b: ObjectSet) => boolean;
export declare const namedSet: (id: string, name: string, members: ObjectSet) => NamedSet;
```

### `style` — Appearance, rules and composition

The one composition order: base appearances, then edit layers, then ordered rules, then the filter, then the transient selection. A selection marks an object; it never brings back geometry that was hidden, filtered or deleted.

```ts
export type AppearanceExtras = Readonly<Record<string, string | number | boolean>>;
export type Appearance = { readonly color: Color; readonly opacity: number; readonly visible: boolean; readonly extras?: AppearanceExtras | undefined; };
export type AppearanceChange = { readonly color?: Color | undefined; readonly opacity?: number | undefined; readonly visible?: boolean | undefined; readonly extras?: AppearanceExtras | undefined; };
export type StyleRule = { readonly id: string; readonly name: string; readonly enabled: boolean; readonly priority: number; readonly targets: readonly ObjectKey[]; readonly change: AppearanceChange; };
export type StyleComposition = { readonly base: ReadonlyMap<ObjectKey, Appearance>; readonly edits: EditEffect; readonly rules: readonly StyleRule[]; readonly filter?: ObjectSet | undefined; readonly selection: ObjectSet; readonly selectionChange: AppearanceChange; };
export type ResolvedStyles = { readonly fallback: Appearance; readonly byKey: ReadonlyMap<ObjectKey, Appearance>; readonly deleted: ObjectSet; };
export declare const defaultAppearance: Appearance;
export declare const defaultSelectionChange: AppearanceChange;
export declare const applyAppearance: (base: Appearance, change: AppearanceChange) => Appearance;
export declare const sameAppearance: (a: Appearance, b: Appearance) => boolean;
export declare const sameExtras: (a: AppearanceExtras | undefined, b: AppearanceExtras | undefined) => boolean;
export declare const styleRule: (id: string, name: string, targets: readonly ObjectKey[], change: AppearanceChange, priority?: number) => StyleRule;
export declare const enabledRules: (rules: readonly StyleRule[]) => readonly StyleRule[];
export declare const orderRules: (rules: readonly StyleRule[]) => readonly StyleRule[];
export declare const noStyling: StyleComposition;
export declare const styleComposition: (base: ReadonlyMap<ObjectKey, Appearance>, edits: EditState, rules: readonly StyleRule[], selection?: ObjectSet, filter?: ObjectSet) => StyleComposition;
export declare const resolveStyles: (composition: StyleComposition, keys: Iterable<ObjectKey>, fallback?: Appearance) => ResolvedStyles;
export declare const styleOf: (resolved: ResolvedStyles, key: ObjectKey) => Appearance;
export declare const isRemoved: (resolved: ResolvedStyles, key: ObjectKey) => boolean;
export declare const isVisible: (resolved: ResolvedStyles, key: ObjectKey) => boolean;
```

### `edits` — Edit layers and history

Layers hold hide, delete, transform and colour operations addressed by key, so they are plain data a document can carry. Undo works over whole immutable states, so a reversal restores the earlier state exactly.

```ts
export type EditOperation = { readonly kind: 'hide'; readonly targets: readonly ObjectKey[]; } | { readonly kind: 'delete'; readonly targets: readonly ObjectKey[]; } | { readonly kind: 'transform'; readonly targets: readonly ObjectKey[]; readonly transform: Matrix4; } | { readonly kind: 'color'; readonly targets: readonly ObjectKey[]; readonly change: AppearanceChange; };
export type EditLayer = { readonly id: string; readonly name: string; readonly enabled: boolean; readonly operations: readonly EditOperation[]; };
export type EditState = readonly EditLayer[];
export type EditEffect = { readonly deleted: ObjectSet; readonly hidden: ObjectSet; readonly transforms: ReadonlyMap<ObjectKey, Matrix4>; readonly appearance: ReadonlyMap<ObjectKey, AppearanceChange>; };
export type History<S> = { readonly past: readonly S[]; readonly present: S; readonly future: readonly S[]; };
export type EditHistory = History<EditState>;
export declare const editLayer: (id: string, name: string, operations: readonly EditOperation[]) => EditLayer;
export declare const hideObjects: (targets: readonly ObjectKey[]) => EditOperation;
export declare const deleteObjects: (targets: readonly ObjectKey[]) => EditOperation;
export declare const transformObjects: (targets: readonly ObjectKey[], transform: Matrix4) => EditOperation;
export declare const colorObjects: (targets: readonly ObjectKey[], change: AppearanceChange) => EditOperation;
export declare const addLayer: (state: EditState, layer: EditLayer) => EditState;
export declare const removeLayer: (state: EditState, id: string) => EditState;
export declare const updateLayer: (state: EditState, id: string, change: (layer: EditLayer) => EditLayer) => EditState;
export declare const setLayerEnabled: (state: EditState, id: string, enabled: boolean) => EditState;
export declare const enabledLayers: (state: EditState) => readonly EditLayer[];
export declare const resolveEdits: (state: EditState) => EditEffect;
export declare const editedTransform: (effect: EditEffect, key: ObjectKey) => Matrix4;
export declare const isDeleted: (effect: EditEffect, key: ObjectKey) => boolean;
export declare const isHidden: (effect: EditEffect, key: ObjectKey) => boolean;
export declare const noEdits: EditEffect;
export declare const history: <S>(present: S) => History<S>;
export declare const commit: <S>(record: History<S>, present: S) => History<S>;
export declare const canUndo: <S>(record: History<S>) => boolean;
export declare const canRedo: <S>(record: History<S>) => boolean;
export declare const undo: <S>(record: History<S>) => History<S>;
export declare const redo: <S>(record: History<S>) => History<S>;
export declare const clearHistory: <S>(record: History<S>) => History<S>;
export declare const emptyEditHistory: EditHistory;
```

### `view` — View state and saved views

Camera pose, projection and the frame they are reported in. Framing fits the sphere around a box to the narrower of the vertical and horizontal fields. A saved view holds plain data, never renderer objects.

```ts
export type CameraPose = { readonly position: Vec3; readonly target: Vec3; readonly up: Vec3; };
export type Projection = { readonly kind: 'perspective'; readonly fieldOfViewDegrees: number; readonly near: number; readonly far: number; } | { readonly kind: 'orthographic'; readonly height: number; readonly near: number; readonly far: number; };
export type ViewState = { readonly camera: CameraPose; readonly projection: Projection; readonly coordinates: CoordinateContext; };
export type SavedView = { readonly id: string; readonly name: string; readonly view: ViewState; readonly selection: readonly ObjectKey[]; readonly rules: readonly StyleRule[]; readonly filter?: readonly ObjectKey[] | undefined; readonly savedAt?: string | undefined; };
export declare const cameraPose: (position: Vec3, target: Vec3, up: Vec3) => CameraPose;
export declare const perspective: (fieldOfViewDegrees?: number, near?: number, far?: number) => Projection;
export declare const orthographic: (height: number, near?: number, far?: number) => Projection;
export declare const viewState: (camera: CameraPose, projection?: Projection, coordinates?: CoordinateContext) => ViewState;
export declare const viewDirection: (pose: CameraPose) => Vec3;
export declare const viewDistance: (pose: CameraPose) => number;
export declare const atDistance: (pose: CameraPose, distance: number) => CameraPose;
export declare const boundsRadius: (bounds: Bounds) => number | undefined;
export declare const fitDistance: (radius: number, projection: Projection, aspect: number) => number;
export declare const frameBounds: (bounds: Bounds, direction: Vec3, projection?: Projection, aspect?: number, up?: Vec3) => ViewState | undefined;
export declare const panBy: (pose: CameraPose, offset: Vec3) => CameraPose;
export declare const savedView: (id: string, name: string, view: ViewState, selection?: readonly ObjectKey[], rules?: readonly StyleRule[]) => SavedView;
export declare const findSavedView: (views: readonly SavedView[], id: string) => SavedView | undefined;
export declare const putSavedView: (views: readonly SavedView[], view: SavedView) => readonly SavedView[];
export declare const removeSavedView: (views: readonly SavedView[], id: string) => readonly SavedView[];
export declare const defaultView: ViewState;
```

### `slices` — State slices and the scene document

A document is the composition of the installed slices, each versioned and migrated on its own, so persistence never learns about a feature. An absent slice reads as its default with a note; a missing migration is refused, not guessed.

```ts
export type StateSlice<S> = { readonly id: string; readonly version: number; readonly schema: Schema<S>; readonly migrate: (value: unknown, fromVersion: number) => Result<S>; readonly default: S; };
export type SliceEnvelope = { readonly version: number; readonly value: unknown; };
export type SceneDocument = { readonly formatVersion: number; readonly models: readonly ModelRef[]; readonly slices: Readonly<Record<string, SliceEnvelope>>; };
export type SliceRegistry = ReadonlyMap<string, StateSlice<unknown>>;
export type Migration = { readonly from: number; readonly up: (value: unknown) => unknown; };
export declare const currentFormatVersion = 1;
export declare const modelRefSchema: Schema<ModelRef>;
export declare const sliceEnvelopeSchema: Schema<SliceEnvelope>;
export declare const sceneDocumentSchema: Schema<SceneDocument>;
export declare const noMigration: <S>(schema: Schema<S>, version: number) => (value: unknown, fromVersion: number) => Result<S>;
export declare const migrations: <S>(schema: Schema<S>, version: number, steps: readonly Migration[]) => (value: unknown, fromVersion: number) => Result<S>;
export declare const stateSlice: <S>(id: string, version: number, schema: Schema<S>, defaultValue: S, steps?: readonly Migration[]) => StateSlice<S>;
export declare const emptyDocument: (models?: readonly ModelRef[]) => SceneDocument;
export declare const putSlice: <S>(document: SceneDocument, slice: StateSlice<S>, value: S) => SceneDocument;
export declare const removeSlice: (document: SceneDocument, id: string) => SceneDocument;
export declare const hasSlice: (document: SceneDocument, id: string) => boolean;
export declare const storedSliceIds: (document: SceneDocument) => readonly string[];
export declare const getSlice: <S>(document: SceneDocument, slice: StateSlice<S>) => Result<S>;
export declare const sliceRegistry: (slices: readonly StateSlice<unknown>[]) => SliceRegistry;
export declare const orphanSliceIds: (document: SceneDocument, registry: SliceRegistry) => readonly string[];
export declare const parseDocument: (value: unknown) => Result<SceneDocument>;
```

### `table` — Columnar tables

Typed-array columns with select, filter, stable sort and an inner join on integer keys. This is what bulk render updates and workflow inputs travel in. Ordering rows is a first-class operation because the instance-update study measured sorting rows into buffer order as worth two thirds of a scattered write.

```ts
export type ColumnType = 'f32' | 'f64' | 'i32' | 'u32' | 'bool' | 'string';
export type Column = { readonly type: 'f32'; readonly values: Float32Array; } | { readonly type: 'f64'; readonly values: Float64Array; } | { readonly type: 'i32'; readonly values: Int32Array; } | { readonly type: 'u32'; readonly values: Uint32Array; } | { readonly type: 'bool'; readonly values: Uint8Array; } | { readonly type: 'string'; readonly values: readonly string[]; };
export type NumericColumn = Extract<Column, { readonly type: 'f32' | 'f64' | 'i32' | 'u32'; }>;
export type IntegerColumn = Extract<Column, { readonly type: 'i32' | 'u32'; }>;
export type StringColumn = Extract<Column, { readonly type: 'string'; }>;
export type BoolColumn = Extract<Column, { readonly type: 'bool'; }>;
export type CellValue = number | string | boolean;
export type Table = { readonly rowCount: number; readonly columns: ReadonlyMap<string, Column>; };
export declare const f32Column: (values: ArrayLike<number>) => NumericColumn;
export declare const f64Column: (values: ArrayLike<number>) => NumericColumn;
export declare const i32Column: (values: ArrayLike<number>) => IntegerColumn;
export declare const u32Column: (values: ArrayLike<number>) => IntegerColumn;
export declare const boolColumn: (values: readonly boolean[]) => BoolColumn;
export declare const stringColumn: (values: readonly string[]) => StringColumn;
export declare const columnLength: (column: Column) => number;
export declare const cellAt: (column: Column, row: number) => CellValue | undefined;
export declare const numberAt: (column: NumericColumn, row: number) => number | undefined;
export declare const stringAt: (column: StringColumn, row: number) => string | undefined;
export declare const isNumericColumn: (column: Column) => column is NumericColumn;
export declare const isIntegerColumn: (column: Column) => column is IntegerColumn;
export declare const table: (entries: Iterable<readonly [string, Column]>) => Table;
export declare const columnOf: (source: Table, name: string) => Column | undefined;
export declare const numericColumnOf: (source: Table, name: string) => NumericColumn | undefined;
export declare const columnNames: (source: Table) => readonly string[];
export declare const emptyTable: Table;
export type RowIndices = readonly number[] | Int32Array | Uint32Array;
export type SortDirection = 'ascending' | 'descending';
export declare const takeColumn: (column: Column, rows: RowIndices) => Column;
export declare const selectColumns: (source: Table, names: readonly string[]) => Table;
export declare const dropColumns: (source: Table, names: readonly string[]) => Table;
export declare const withColumn: (source: Table, name: string, column: Column) => Table;
export declare const takeRows: (source: Table, rows: RowIndices) => Table;
export declare const findRows: (source: Table, keep: (row: number) => boolean) => readonly number[];
export declare const filterRows: (source: Table, keep: (row: number) => boolean) => Table;
export declare const orderRowsBy: (source: Table, name: string, direction?: SortDirection) => readonly number[];
export declare const sortRows: (source: Table, name: string, direction?: SortDirection) => Table;
export declare const indexByKey: (column: IntegerColumn) => ReadonlyMap<number, number>;
export declare const matchRows: (left: IntegerColumn, right: IntegerColumn) => Int32Array;
export declare const rowOf: (source: Table, row: number) => Readonly<Record<string, CellValue>>;
export declare const integerColumnOf: (source: Table, name: string) => IntegerColumn | undefined;
export declare const joinTables: (left: Table, leftKey: string, right: Table, rightKey: string, prefix?: string) => Result<Table>;
```

### `mesh` — Mesh and instance data

Plain-data meshes and columnar instance records: one allocation per attribute for the whole model, no per-instance JavaScript object. A row with no geometry is valid, which is what geometry-free objects need.

```ts
export declare const noMesh = -1;
export declare const transformStride = 16;
export declare const colorStride = 4;
export type Mesh = { readonly positions: Float32Array; readonly indices: Uint32Array; readonly normals?: Float32Array | undefined; readonly bounds: Bounds; };
export type InstanceRecords = { readonly count: number; readonly meshIndex: Int32Array; readonly transform: Float32Array; readonly color: Float32Array; readonly objectIndex: Int32Array; };
export type InstanceRecord = { readonly meshIndex: number; readonly transform: Matrix4; readonly color: Color; readonly opacity: number; readonly objectIndex: number; };
export type Geometry = { readonly meshes: readonly Mesh[]; readonly instances: InstanceRecords; };
export declare const boundsOfPositions: (positions: Float32Array) => Bounds;
export declare const mesh: (positions: Float32Array, indices: Uint32Array, normals?: Float32Array) => Mesh;
export declare const vertexCount: (source: Mesh) => number;
export declare const triangleCount: (source: Mesh) => number;
export declare const emptyInstances: (count: number) => InstanceRecords;
export declare const instanceRecords: (rows: readonly InstanceRecord[]) => InstanceRecords;
export declare const instanceTransform: (records: InstanceRecords, row: number) => Matrix4;
export declare const instanceColor: (records: InstanceRecords, row: number) => Color;
export declare const instanceOpacity: (records: InstanceRecords, row: number) => number;
export declare const isGeometryFree: (records: InstanceRecords, row: number) => boolean;
export declare const geometryBounds: (geometry: Geometry) => Bounds;
```

### `facts` — Facts, coverage and evidence

The vocabulary the workflows need: an observation is known, missing for a stated reason, or conflicting between sources. Nothing recorded reads as missing rather than as data, a total refuses to mix units, and coverage says where the gaps are.

```ts
export type MissingReason = 'not-provided' | 'not-applicable' | 'not-measured' | 'unresolved-source' | 'out-of-scope';
export type Evidence = { readonly source: string; readonly reference?: string | undefined; readonly recordedAt?: string | undefined; };
export type Quantity = { readonly value: number; readonly unit: string; };
export type FactValue = { readonly kind: 'quantity'; readonly quantity: Quantity; } | { readonly kind: 'text'; readonly text: string; } | { readonly kind: 'flag'; readonly value: boolean; } | { readonly kind: 'reference'; readonly ref: ObjectRef; };
export type Observation = { readonly kind: 'known'; readonly value: FactValue; readonly evidence: readonly Evidence[]; } | { readonly kind: 'missing'; readonly reason: MissingReason; readonly evidence: readonly Evidence[]; } | { readonly kind: 'conflicting'; readonly values: readonly FactValue[]; readonly evidence: readonly Evidence[]; };
export type Fact = { readonly subject: ObjectRef; readonly name: string; readonly observation: Observation; };
export type Coverage = { readonly total: number; readonly known: number; readonly missing: number; readonly conflicting: number; };
export declare const quantity: (value: number, unit: string) => FactValue;
export declare const text: (value: string) => FactValue;
export declare const flag: (value: boolean) => FactValue;
export declare const reference: (ref: ObjectRef) => FactValue;
export declare const known: (value: FactValue, evidence?: readonly Evidence[]) => Observation;
export declare const missing: (reason: MissingReason, evidence?: readonly Evidence[]) => Observation;
export declare const conflicting: (values: readonly FactValue[], evidence?: readonly Evidence[]) => Observation;
export declare const knownValue: (observation: Observation) => FactValue | undefined;
export declare const knownQuantity: (observation: Observation) => Quantity | undefined;
export declare const fact: (subject: ObjectRef, name: string, observation: Observation) => Fact;
export declare const coverageOf: (observations: Iterable<Observation>) => Coverage;
export declare const coverageRatio: (coverage: Coverage) => number | undefined;
export declare const emptyCoverage: Coverage;
export type FactIndex = ReadonlyMap<ObjectKey, ReadonlyMap<string, Fact>>;
export declare const sameFactValue: (a: FactValue, b: FactValue) => boolean;
export declare const observedValues: (observation: Observation) => readonly FactValue[];
export declare const withEvidence: (observation: Observation, evidence: readonly Evidence[]) => Observation;
export declare const reconcile: (values: readonly FactValue[], evidence?: readonly Evidence[], absent?: MissingReason) => Observation;
export declare const mergeObservations: (a: Observation, b: Observation) => Observation;
export declare const indexFacts: (facts: Iterable<Fact>) => FactIndex;
export declare const lookupFact: (index: FactIndex, subject: ObjectRef, name: string) => Fact | undefined;
export declare const observationAt: (index: FactIndex, subject: ObjectRef, name: string) => Observation;
export declare const completeFacts: (index: FactIndex, subjects: readonly ObjectRef[], names: readonly string[]) => readonly Fact[];
export declare const coverageOfFacts: (facts: Iterable<Fact>) => Coverage;
export declare const coverageByName: (facts: Iterable<Fact>) => ReadonlyMap<string, Coverage>;
export declare const unknownFacts: (facts: Iterable<Fact>) => readonly Fact[];
export declare const conflictingFacts: (facts: Iterable<Fact>) => readonly Fact[];
export declare const reportedUnits: (facts: Iterable<Fact>) => readonly string[];
export declare const sumQuantities: (facts: Iterable<Fact>) => Quantity | undefined;
```

### `event` — Change events and disposal

A commit publishes the ids of the slices whose value is a different object. Subscribers react only to the slices they named, so a feature they never heard of costs them nothing.

```ts
export type Disposable = { readonly dispose: () => void; };
export type ChangeEvent = { readonly command: string; readonly changed: readonly string[]; readonly diagnostics: readonly Diagnostic[]; };
export type Listener = (event: ChangeEvent) => void;
export declare const disposable: (work: () => void) => Disposable;
export declare const disposeAll: (items: readonly Disposable[]) => Disposable;
export declare const noDisposal: Disposable;
export declare const changeEvent: (command: string, changed: readonly string[], diagnostics?: readonly Diagnostic[]) => ChangeEvent;
export declare const changedSlices: (before: ReadonlyMap<string, unknown>, after: ReadonlyMap<string, unknown>) => readonly string[];
export declare const didChange: (event: ChangeEvent, sliceId: string) => boolean;
export declare const onSlices: (sliceIds: readonly string[], listener: Listener) => Listener;
```

### `session` — The session a command sees

The least a command needs: read a slice, write a slice, dispatch another command, subscribe. The viewer package implements it; this package only states it, so nothing here depends on a runtime.

```ts
export type Session = { readonly read: <S>(slice: StateSlice<S>) => S; readonly write: <S>(slice: StateSlice<S>, value: S) => void; readonly dispatch: (name: string, input: unknown) => Result<unknown>; readonly subscribe: (listener: Listener) => Disposable; };
```

### `command` — Commands and their descriptors

Commands are the only way state changes, so a button, a keyboard binding, a script and an assistant all go through the same door. A command validates its own input, which is what lets a registry hold commands of different input types and lets tool descriptors be generated from the same schema.

```ts
export type Command = { readonly name: string; readonly title: string; readonly description: string; readonly describeInput: () => JsonSchema; readonly run: (session: Session, input: unknown) => Result<unknown>; };
export type CommandDescriptor = { readonly name: string; readonly title: string; readonly description: string; readonly inputSchema: JsonSchema; };
export type CommandRegistry = ReadonlyMap<string, Command>;
export declare const command: <I>(spec: { readonly name: string; readonly title: string; readonly description: string; readonly input: Schema<I>; readonly run: (session: Session, input: I) => Result<unknown>; }) => Command;
export declare const describeCommand: (item: Command) => CommandDescriptor;
export declare const commandRegistry: (commands: readonly Command[]) => Result<CommandRegistry>;
export declare const runCommand: (registry: CommandRegistry, session: Session, name: string, input: unknown) => Result<unknown>;
export declare const describeCommands: (registry: CommandRegistry) => readonly CommandDescriptor[];
```

### `feature` — Features

One capability is one module: an id, its dependencies, its slice, its commands and an optional install hook. Ordering, missing dependencies, cycles, repeated ids, repeated slice owners and repeated command names are all reported.

```ts
export type Feature<S> = { readonly id: string; readonly dependsOn: readonly string[]; readonly slice: StateSlice<S>; readonly commands: readonly Command[]; readonly install?: ((session: Session) => Disposable) | undefined; };
export type AnyFeature = Feature<unknown>;
export declare const feature: <S>(id: string, slice: StateSlice<S>, commands?: readonly Command[], dependsOn?: readonly string[], install?: (session: Session) => Disposable) => Feature<S>;
export declare const installOrder: (features: readonly AnyFeature[]) => Result<readonly AnyFeature[]>;
export declare const featureSlices: (features: readonly AnyFeature[]) => readonly StateSlice<unknown>[];
export declare const featureCommands: (features: readonly AnyFeature[]) => readonly Command[];
export declare const featureSliceRegistry: (features: readonly AnyFeature[]) => SliceRegistry;
export declare const featureCommandRegistry: (features: readonly AnyFeature[]) => Result<CommandRegistry>;
export declare const installFeatures: (features: readonly AnyFeature[], session: Session) => { readonly disposals: readonly Disposable[]; readonly diagnostics: readonly Diagnostic[]; };
export declare const duplicateSliceIds: (features: readonly AnyFeature[]) => readonly string[];
export declare const checkFeatures: (features: readonly AnyFeature[]) => readonly Diagnostic[];
```
