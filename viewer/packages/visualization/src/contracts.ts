/** Contract revision V1. Data only; matrices are column-major, colors linear RGB. */
export type ObjectRef = { readonly modelId: string; readonly objectId: string };
export type ModelRef = { readonly id: string; readonly revision: string; readonly source?: string };
export type Vec3 = readonly [number, number, number];
export type Color = readonly [number, number, number];
export type Matrix4 = readonly [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number];
export type Coordinates = { readonly units: 'metres' | 'millimetres' | 'feet' | 'unknown'; readonly up: 'Y' | 'Z'; readonly registration: 'local' | 'project' | 'unknown' };
export type Appearance = { readonly color: Color; readonly opacity: number; readonly visible: boolean };
export type ObjectRecord = { readonly ref: ObjectRef; readonly name?: string; readonly sourceId?: string; readonly appearance: Appearance; readonly transform: Matrix4 };
export type ModelData = { readonly ref: ModelRef; readonly coordinates: Coordinates; readonly objects: readonly ObjectRecord[] };
export type NamedSet = { readonly id: string; readonly name: string; readonly members: readonly ObjectRef[] };
export type StyleRule = { readonly id: string; readonly members: readonly ObjectRef[]; readonly style: Partial<Appearance> };
export type EditOperation =
  | { readonly kind: 'add'; readonly object: ObjectRecord }
  | { readonly kind: 'delete'; readonly ref: ObjectRef }
  | { readonly kind: 'transform'; readonly ref: ObjectRef; readonly transform: Matrix4 }
  | { readonly kind: 'style'; readonly ref: ObjectRef; readonly style: Partial<Appearance> };
export type EditLayer = { readonly id: string; readonly enabled: boolean; readonly operations: readonly EditOperation[] };
export type CameraState = { readonly position: Vec3; readonly target: Vec3; readonly up: Vec3; readonly projection: 'perspective' | 'orthographic'; readonly zoom: number };
export type ViewState = { readonly id: string; readonly camera: CameraState; readonly selection: readonly ObjectRef[]; readonly rules: readonly StyleRule[] };
export type SceneDocument = { readonly schemaVersion: 1; readonly models: readonly ModelRef[]; readonly sets: readonly NamedSet[]; readonly views: readonly ViewState[]; readonly layers: readonly EditLayer[] };
export type Diagnostic = { readonly code: string; readonly message: string; readonly ref?: ObjectRef };
export type Result<T> = { readonly ok: true; readonly value: T; readonly diagnostics: readonly Diagnostic[] } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };
export const objectKey = (ref: ObjectRef): string => JSON.stringify([ref.modelId, ref.objectId]);
export const identityMatrix: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
