import { diagnostic, note, warning, type Diagnostic, type DiagnosticPath } from '@bim-open-toolkit/model';

// Every diagnostic this package reports, so a caller can branch on a code instead of a message.
export const formatCode = {
  cancelled: 'formats/cancelled',
  emptySource: 'formats/empty-source',
  fetchFailed: 'formats/fetch-failed',
  unresolvedResource: 'formats/unresolved-resource',
  detectedFormat: 'formats/detected-format',
  unknownFormat: 'formats/unknown-format',
  unsupportedFormat: 'formats/unsupported-format',
  invalidBfast: 'formats/invalid-bfast',
  invalidBos: 'formats/invalid-bos',
  invalidGltf: 'formats/invalid-gltf',
  invalidObj: 'formats/invalid-obj',
  invalidStl: 'formats/invalid-stl',
  invalidModel: 'formats/invalid-model',
  failed: 'formats/load-failed',
  hiddenInstances: 'formats/hidden-instances',
  droppedTextures: 'formats/dropped-textures',
  droppedPrimitives: 'formats/dropped-primitives',
  droppedAnimation: 'formats/dropped-animation',
  droppedMaterialLibrary: 'formats/dropped-material-library',
  droppedVertexColors: 'formats/dropped-vertex-colors',
  missingEntityTable: 'formats/missing-entity-table',
  missingPropertyTables: 'formats/missing-property-tables',
  missingDocumentTable: 'formats/missing-document-table',
  droppedProperties: 'formats/dropped-properties',
  noGeometry: 'formats/no-geometry',
  assumedCoordinates: 'formats/assumed-coordinates',
} as const;

// One of the codes above.
export type FormatCode = (typeof formatCode)[keyof typeof formatCode];

// A failure a parser raises inside a loop and the entry point turns into a diagnostic.
export class FormatError extends Error {
  readonly code: FormatCode;
  readonly path: DiagnosticPath;

  constructor(code: FormatCode, message: string, path: DiagnosticPath = []) {
    super(message);
    this.name = 'FormatError';
    this.code = code;
    this.path = path;
  }
}

// Raises a `FormatError`. Used where returning a Result would cost an allocation per row.
export function fail(code: FormatCode, message: string, path: DiagnosticPath = []): never {
  throw new FormatError(code, message, path);
}

// Raises unless `condition` holds. The message is built only when it does not.
export function requireThat(
  condition: boolean,
  code: FormatCode,
  message: () => string,
  path: DiagnosticPath = [],
): asserts condition {
  if (!condition) fail(code, message(), path);
}

// An error-severity diagnostic with one of this package's codes.
export const formatDiagnostic = (code: FormatCode, message: string, path: DiagnosticPath = []): Diagnostic =>
  diagnostic(code, message, path);

// A warning-severity diagnostic: the model loaded, but something in the source was not carried over.
export const formatWarning = (code: FormatCode, message: string, path: DiagnosticPath = []): Diagnostic =>
  warning(code, message, path);

// An info-severity diagnostic: something the loader decided that the caller may want to override.
export const formatNote = (code: FormatCode, message: string, path: DiagnosticPath = []): Diagnostic =>
  note(code, message, path);

// The diagnostic for anything thrown while loading: a `FormatError` keeps its code and path.
export const diagnosticOf = (error: unknown, fallback: FormatCode = formatCode.failed): Diagnostic => {
  if (error instanceof FormatError) return formatDiagnostic(error.code, error.message, error.path);
  if (error instanceof Error) return formatDiagnostic(fallback, error.message);
  return formatDiagnostic(fallback, String(error));
};
